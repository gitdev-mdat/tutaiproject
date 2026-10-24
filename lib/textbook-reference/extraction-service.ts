import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { GEMINI_MODELS } from '@/lib/config/models';
import { findMathIssues, hasMathIssues } from '@/lib/content/math-notation';
import { entryWithDescendants, mappingSpan } from './lesson-coverage';
import { mapPrintedPage } from './page-mapping';
import { splitNumberedArtifacts } from './artifact-linking';
import {
  buildExtractionPrompt,
  classifyOutcome,
  exerciseSetFor,
  parseExtractionResponse,
  PREVIOUS_PROMPT_VERSIONS,
  PROMPT_VERSION,
  TEXTBOOK_RESPONSE_SCHEMA,
  validateItem,
} from './extraction-response';
import { proposeSolutions } from './solution-matching';
import { renderPrintedPageCrops } from './pdf-pages';
import { isPracticeSourceForLesson } from './practice-sources';
import {
  enqueueTextbookJob,
  getTextbookDocument,
  insertTextbookArtifacts,
  listTextbookArtifacts,
  listTextbookJobs,
  listTextbookMappings,
  recordFinishedTextbookJob,
} from './repository';
import { visionProviderFor, type VisionProvider } from './vision-provider';
import type {
  ExtractionDiagnostics,
  TextbookArtifact,
  TextbookDocumentRecord,
  TextbookExtractionJob,
} from './types';

export { PROMPT_VERSION };
export const MAX_PAGES_PER_REQUEST = 6;
/** The same pages (same prompt and model) are not sent again after this many failures. */
export const MAX_FAILED_ATTEMPTS = 3;
const CONTENT_FAILURES = new Set(['INVALID_RESPONSE', 'UNREADABLE', 'OUTPUT_LIMIT', 'UNKNOWN']);
const SAME_INPUT_FAILS_AGAIN = new Set(['UNREADABLE', 'OUTPUT_LIMIT']);

/** Errors the Admin can act on; the API returns their message with a 4xx status. */
export class TextbookRequestError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 409 | 422 = 422
  ) {
    super(message);
    this.name = 'TextbookRequestError';
  }
}

export function mappingCoversEntries(
  document: { tocEntries: Array<{ id: string; parentId: string | null }> },
  mappings: Array<{ documentId: string; knowledgeNodeId: string; entryId: string; status: string }>,
  documentId: string,
  knowledgeNodeId: string,
  entries: Array<{ id: string; parentId: string | null }>
): boolean {
  const confirmedEntryIds = new Set(
    mappings
      .filter(
        (mapping) =>
          mapping.documentId === documentId &&
          mapping.knowledgeNodeId === knowledgeNodeId &&
          mapping.status === 'CONFIRMED'
      )
      .map((mapping) => mapping.entryId)
  );
  return (
    entries.length > 0 &&
    entries.every((entry) => {
      let current: { id: string; parentId: string | null } | undefined = entry;
      while (current) {
        if (confirmedEntryIds.has(current.id)) return true;
        current = document.tocEntries.find((candidate) => candidate.id === current?.parentId);
      }
      return false;
    })
  );
}

export interface ExtractionRequest {
  documentId: string;
  knowledgeNodeId: string;
  entryIds: string[];
  printedPages: number[];
}

/** Validates a request against the stored book and returns what the job will process. */
async function planExtraction(input: ExtractionRequest) {
  const pages = [...new Set(input.printedPages)].sort((a, b) => a - b);
  if (!pages.length || pages.length > MAX_PAGES_PER_REQUEST)
    throw new TextbookRequestError(
      `Chọn từ 1 đến ${MAX_PAGES_PER_REQUEST} trang sách cho mỗi lần trích xuất.`
    );
  const document = await getTextbookDocument(input.documentId);
  if (!document) throw new TextbookRequestError('Không tìm thấy sách.', 404);
  if (document.status !== 'INDEXED')
    throw new TextbookRequestError('Sách chưa có mục lục, chưa thể trích xuất.', 409);
  const entryIds = new Set(input.entryIds);
  const entries = document.tocEntries.filter((entry) => entryIds.has(entry.id));
  if (!entries.length || entries.length !== entryIds.size)
    throw new TextbookRequestError('Không tìm thấy mục trong mục lục.', 404);
  if (
    pages.some(
      (page) =>
        !entries.some(
          (entry) =>
            entry.printedStartPage !== null &&
            page >= entry.printedStartPage &&
            (entry.printedEndPage === null || page <= entry.printedEndPage)
        )
    )
  )
    throw new TextbookRequestError('Có trang nằm ngoài phạm vi của mục đã chọn.');
  const locations = pages.map((printedPage) =>
    mapPrintedPage(printedPage, document.anchors, document.pageLayout)
  );
  if (locations.some((location) => location.position === 'UNCERTAIN'))
    throw new TextbookRequestError(
      'Có trang chưa xác định được vị trí trong PDF. Thêm mốc trang bao quanh các trang này.'
    );
  const mappings = await listTextbookMappings({ documentId: document.id });
  // Exercise sets and "Hướng dẫn giải" sections of a chapter the lesson is linked
  // in are practice sources: extractable without linking them as lesson references.
  const practiceSource = entries.every((entry) =>
    isPracticeSourceForLesson(entry, document, mappings, input.knowledgeNodeId)
  );
  if (
    !practiceSource &&
    !mappingCoversEntries(document, mappings, document.id, input.knowledgeNodeId, entries)
  )
    throw new TextbookRequestError('Mục này chưa được liên kết với bài học trong Cây kiến thức.');
  // A link narrowed to part of a section only allows extraction inside that part.
  const spans = mappings
    .filter(
      (mapping) =>
        mapping.knowledgeNodeId === input.knowledgeNodeId &&
        mapping.status === 'CONFIRMED' &&
        entries.some((entry) =>
          entryWithDescendants(document.tocEntries, mapping.entryId).has(entry.id)
        )
    )
    .map((mapping) =>
      mappingSpan(
        mapping,
        document.tocEntries.find((entry) => entry.id === mapping.entryId)
      )
    );
  if (
    !practiceSource &&
    !spans.some((span) => span === null) &&
    pages.some((page) => !spans.some((span) => span && page >= span.start && page <= span.end))
  )
    throw new TextbookRequestError('Có trang nằm ngoài phạm vi trang đã liên kết với bài này.');
  const model = GEMINI_MODELS.batchExtraction;
  const keyFor = (prompt: string) =>
    createHash('sha256')
      .update(
        JSON.stringify({
          source: document.sha256,
          pages,
          entries: [...entryIds].sort(),
          prompt,
          model,
        })
      )
      .digest('hex');
  // The section that holds the pages most tightly names the exercise set.
  const target = [...entries].sort((a, b) => b.level - a.level)[0];
  return {
    document,
    entries,
    target,
    exerciseSet: exerciseSetFor(target, document.tocEntries),
    pages,
    locations,
    model,
    extractionKey: keyFor(PROMPT_VERSION),
    /** Results of earlier prompt versions for exactly these pages: reused, never duplicated. */
    previousKeys: PREVIOUS_PROMPT_VERSIONS.map(keyFor),
  };
}

/** Stored artifacts for this request under the current or an earlier prompt version. */
async function storedResult(plan: { extractionKey: string; previousKeys: string[] }) {
  for (const key of [plan.extractionKey, ...plan.previousKeys]) {
    const artifacts = await listTextbookArtifacts({ extractionKey: key });
    if (artifacts.length) return artifacts;
  }
  return [];
}

/**
 * A failure that already knows its class, with what the provider round trip
 * cost and showed, so the job keeps usage and diagnostics even when it fails.
 */
export class ExtractionFailure extends Error {
  constructor(
    message: string,
    readonly code: 'INVALID_RESPONSE' | 'UNREADABLE',
    readonly jobFields: Partial<TextbookExtractionJob>
  ) {
    super(message);
    this.name = 'ExtractionFailure';
  }
}

function newJob(
  kind: TextbookExtractionJob['kind'],
  fields: Partial<TextbookExtractionJob> & { documentId: string; extractionKey: string }
): TextbookExtractionJob {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    kind,
    knowledgeNodeId: '',
    entryIds: [],
    printedPages: [],
    status: 'QUEUED',
    attempts: 0,
    provider: 'gemini',
    pagesProcessed: [],
    cacheHit: false,
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}

/**
 * Queues a bounded extraction, or answers from the cache. An identical request
 * (same file, pages, sections, prompt and model) reuses the stored artifacts and
 * never calls the provider again, whatever their review state.
 */
export async function queueTextbookExtraction(input: ExtractionRequest): Promise<{
  job: TextbookExtractionJob;
  artifacts: TextbookArtifact[];
  cacheHit: boolean;
  existing: boolean;
}> {
  const plan = await planExtraction(input);
  const cached = await storedResult(plan);
  const fields = {
    documentId: plan.document.id,
    knowledgeNodeId: input.knowledgeNodeId,
    entryIds: [...input.entryIds].sort(),
    printedPages: plan.pages,
    extractionKey: plan.extractionKey,
    model: plan.model,
    promptVersion: PROMPT_VERSION,
  };
  if (cached.length) {
    const job = newJob('EXTRACT', {
      ...fields,
      status: 'COMPLETED',
      cacheHit: true,
      providerCalls: 0,
      pagesProcessed: plan.pages,
      provider: 'none',
    });
    await recordFinishedTextbookJob(job);
    return { job, artifacts: cached, cacheHit: true, existing: false };
  }
  // Bounded retries. Only failures caused by these pages themselves count: an
  // unreadable scan or an over-long answer will fail the same way again, and
  // repeated unusable answers stop after a few attempts. Outages, quotas and
  // configuration problems (fixed elsewhere) never block the pages.
  const failures = (await listTextbookJobs({ jobKey: plan.extractionKey })).filter(
    (job) => job.status === 'FAILED' && CONTENT_FAILURES.has(job.errorCode ?? 'UNKNOWN')
  );
  if (failures[0] && SAME_INPUT_FAILS_AGAIN.has(failures[0].errorCode!))
    throw new TextbookRequestError(
      `Lần trước các trang này không trích được: ${failures[0].error ?? 'lỗi không thử lại được.'} Gửi lại y nguyên sẽ không giúp; hãy chọn ít trang hơn hoặc kiểm tra mốc trang.`,
      409
    );
  if (failures.length >= MAX_FAILED_ATTEMPTS)
    throw new TextbookRequestError(
      `Các trang này đã thử ${failures.length} lần đều lỗi, nên hệ thống dừng gọi AI để tránh tốn phí. Thử trích từng trang một, hoặc kiểm tra mốc trang và bản quét.`,
      409
    );
  const { job, existing } = await enqueueTextbookJob(newJob('EXTRACT', fields));
  return { job, artifacts: [], cacheHit: false, existing };
}

export function verifyJob(documentId: string, sha256: string) {
  return newJob('VERIFY', {
    documentId,
    extractionKey: createHash('sha256').update(`verify:${sha256}`).digest('hex'),
    provider: 'none',
  });
}

/** Runs an EXTRACT job: renders the requested pages, calls the provider once, stores what validates. */
export async function runExtractionJob(
  job: TextbookExtractionJob,
  options: {
    provider?: VisionProvider;
    readPdf: (document: TextbookDocumentRecord) => Promise<Buffer>;
  }
): Promise<{ job: TextbookExtractionJob; artifacts: TextbookArtifact[] }> {
  const start = Date.now();
  const plan = await planExtraction(job);
  if (plan.extractionKey !== job.extractionKey)
    throw new Error('The book, prompt or model changed since this job was queued; queue it again.');
  const cached = await storedResult(plan);
  if (cached.length) {
    // Another job stored these first (or this job was interrupted after storing).
    return {
      job: {
        ...job,
        status: 'COMPLETED',
        cacheHit: true,
        pagesProcessed: plan.pages,
        durationMs: Date.now() - start,
      },
      artifacts: cached,
    };
  }
  const provider = options.provider ?? visionProviderFor();
  const images = await renderPrintedPageCrops(await options.readPdf(plan.document), plan.locations);
  const chapter = plan.document.tocEntries.find(
    (entry) => entry.id === plan.exerciseSet.chapterEntryId
  );
  const response = await provider({
    model: plan.model,
    prompt: buildExtractionPrompt({
      pages: plan.pages,
      headings: plan.entries.map((entry) => entry.originalHeading),
      chapterHeading: chapter?.originalHeading ?? null,
      problemType: plan.exerciseSet.problemType,
    }),
    images: images.map((image) => image.bytes),
    schema: TEXTBOOK_RESPONSE_SCHEMA,
    // Room for the model's own reasoning plus a page pair of questions; a cut-off
    // answer keeps the items that finished.
    maxOutputTokens: 32768,
    allowTruncated: true,
  });
  const truncated = response.finishReason === 'MAX_TOKENS';
  const parsed = parseExtractionResponse(response.text, { truncated, pages: plan.pages });
  const createdAt = new Date().toISOString();
  const results = (parsed.items ?? []).map((raw, index) =>
    validateItem(raw, index, {
      documentId: plan.document.id,
      entryId: plan.target.id,
      extractionKey: job.extractionKey,
      pages: plan.pages,
      pdfPageOf: (page) =>
        mapPrintedPage(page, plan.document.anchors, plan.document.pageLayout).pdfPage,
      exerciseSet: plan.exerciseSet,
      createdAt,
    })
  );
  const accepted = results.flatMap((result) => (result.ok ? [result.artifact] : []));
  const rejectedItems = results.flatMap((result) =>
    result.ok ? [] : [{ reference: result.reference, reason: result.reason }]
  );
  const extracted = splitNumberedArtifacts(accepted).map((artifact) => {
    const issues = findMathIssues(`${artifact.title}\n${artifact.content}`);
    if (!hasMathIssues(issues)) return artifact;
    const raw = [...issues.unsupported, ...issues.outsideMath];
    return {
      ...artifact,
      verificationNotes: [
        ...artifact.verificationNotes,
        `Công thức sẽ hiện thô${raw.length ? ` (${raw.join(', ')})` : ''}; sửa trước khi duyệt.`,
      ],
    };
  });
  const diagnostics: ExtractionDiagnostics = {
    promptVersion: PROMPT_VERSION,
    images: images.map((image) => ({
      printedPage: image.printedPage,
      pdfPage: image.pdfPage,
      position: image.position,
      width: image.width,
      height: image.height,
    })),
    finishReason: response.finishReason,
    responseChars: response.text.length,
    itemsReturned: parsed.items?.length ?? 0,
    itemsAccepted: extracted.length,
    rejectedItems,
    unreadable: parsed.unreadable,
    pageReports: parsed.pages,
    truncated: parsed.truncated,
    questions: extracted.filter((artifact) => artifact.kind === 'EXERCISE').length,
    solutionsMatched: 0,
  };
  const spent = {
    provider: 'gemini' as const,
    providerCalls: (job.providerCalls ?? 0) + 1,
    tokenUsage: response.usage,
    pagesProcessed: plan.pages,
    diagnostics,
    durationMs: Date.now() - start,
  };
  const outcome = classifyOutcome({
    accepted: extracted.length,
    rejected: rejectedItems.length,
    partialItems: results.filter((result) => result.ok && result.partial).length,
    truncated: parsed.truncated,
    pages: parsed.pages,
    unreadable: parsed.unreadable.length,
  });
  if (outcome === 'UNREADABLE')
    throw new ExtractionFailure(
      `The scanned pages could not be read: ${parsed.pages.map((page) => `p.${page.printedPage} ${page.status}`).join(', ') || parsed.unreadable.map((item) => item.reference).join(', ')}`,
      'UNREADABLE',
      spent
    );
  if (outcome === 'INVALID_RESPONSE')
    throw new ExtractionFailure(
      parsed.items === null
        ? `Gemini response is not the expected JSON (${response.text.length} characters${truncated ? ', cut off' : ''}).`
        : `Gemini returned ${parsed.items.length} items, none valid${rejectedItems.length ? `: ${rejectedItems.map((item) => item.reason).join('; ')}` : ''}; pages reported ${parsed.pages.map((page) => page.status).join(', ') || 'nothing'}.`,
      'INVALID_RESPONSE',
      spent
    );
  await insertTextbookArtifacts(extracted);
  diagnostics.solutionsMatched = await matchStoredSolutions(plan.document.id);
  return {
    job: { ...job, ...spent, status: 'COMPLETED', outcome, diagnostics },
    artifacts: await listTextbookArtifacts({ extractionKey: job.extractionKey }),
  };
}

/**
 * How many of the book's questions now have a suggested solution. Suggestions
 * are computed on read and never stored: a pair only becomes real when an
 * Admin confirms it in the textbook-exercises workspace.
 */
export async function matchStoredSolutions(documentId: string): Promise<number> {
  const proposals = proposeSolutions(await listTextbookArtifacts({ documentId }));
  return [...proposals.values()].filter((proposal) => proposal.status === 'SUGGESTED').length;
}
