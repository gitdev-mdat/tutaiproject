import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { GEMINI_MODELS } from '@/lib/config/models';
import { mapPrintedPage } from './page-mapping';
import { splitAndLinkExercises } from './artifact-linking';
import { renderPrintedPageCrops } from './pdf-pages';
import {
  enqueueTextbookJob,
  getTextbookDocument,
  insertTextbookArtifacts,
  listTextbookArtifacts,
  listTextbookMappings,
  recordFinishedTextbookJob,
} from './repository';
import { visionProviderFor, type VisionProvider } from './vision-provider';
import type { TextbookArtifact, TextbookDocumentRecord, TextbookExtractionJob } from './types';

// v5: formulas come back as $...$ LaTeX so they render like lesson text.
export const PROMPT_VERSION = 'textbook-knowledge-v5';
export const MAX_PAGES_PER_REQUEST = 6;

const TEXTBOOK_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'kind',
          'title',
          'content',
          'mathematicalNotation',
          'printedPages',
          'verificationNotes',
        ],
        properties: {
          kind: {
            type: 'string',
            enum: ['THEORY', 'METHOD', 'WORKED_EXAMPLE', 'EXERCISE', 'SOLUTION'],
          },
          title: { type: 'string' },
          content: { type: 'string' },
          mathematicalNotation: { type: 'array', items: { type: 'string' } },
          printedPages: { type: 'array', items: { type: 'integer' } },
          exerciseReference: { type: 'string' },
          solutionReference: { type: 'string' },
          verificationNotes: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const;

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

function parseJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return JSON.parse(cleaned);
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
  const locations = pages.map((printedPage) => mapPrintedPage(printedPage, document.anchors, document.pageLayout));
  if (locations.some((location) => location.position === 'UNCERTAIN'))
    throw new TextbookRequestError(
      'Có trang chưa xác định được vị trí trong PDF. Thêm mốc trang bao quanh các trang này.'
    );
  const mappings = await listTextbookMappings({ documentId: document.id });
  if (!mappingCoversEntries(document, mappings, document.id, input.knowledgeNodeId, entries))
    throw new TextbookRequestError('Mục này chưa được liên kết với bài học trong Cây kiến thức.');
  const model = GEMINI_MODELS.batchExtraction;
  const extractionKey = createHash('sha256')
    .update(
      JSON.stringify({
        source: document.sha256,
        pages,
        entries: [...entryIds].sort(),
        prompt: PROMPT_VERSION,
        model,
      })
    )
    .digest('hex');
  return { document, entries, pages, locations, model, extractionKey };
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
  const cached = await listTextbookArtifacts({ extractionKey: plan.extractionKey });
  const fields = {
    documentId: plan.document.id,
    knowledgeNodeId: input.knowledgeNodeId,
    entryIds: [...input.entryIds].sort(),
    printedPages: plan.pages,
    extractionKey: plan.extractionKey,
    model: plan.model,
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

/** Runs an EXTRACT job: renders the requested pages, calls the provider once, stores artifacts. */
export async function runExtractionJob(
  job: TextbookExtractionJob,
  options: { provider?: VisionProvider; readPdf: (document: TextbookDocumentRecord) => Promise<Buffer> }
): Promise<{ job: TextbookExtractionJob; artifacts: TextbookArtifact[] }> {
  const start = Date.now();
  const plan = await planExtraction(job);
  if (plan.extractionKey !== job.extractionKey)
    throw new Error('The book, prompt or model changed since this job was queued; queue it again.');
  const cached = await listTextbookArtifacts({ extractionKey: job.extractionKey });
  if (cached.length) {
    // Another job stored these first (or this job was interrupted after storing).
    return {
      job: { ...job, status: 'COMPLETED', cacheHit: true, pagesProcessed: plan.pages, durationMs: Date.now() - start },
      artifacts: cached,
    };
  }
  const provider = options.provider ?? visionProviderFor();
  const images = await renderPrintedPageCrops(await options.readPdf(plan.document), plan.locations);
  const prompt = `Trích xuất kiến thức giáo dục bằng tiếng Việt từ đúng ${plan.pages.length} ảnh trang sách đính kèm. Không bổ sung điều không đọc được. Giữ nguyên nội dung công thức; viết MỌI công thức, ký hiệu toán trong content và title bằng LaTeX đặt trong $...$ (ví dụ $f'(x) \\ge 0$, $x \\in I$, $y = \\frac{ax+b}{cx+d}$, $D = \\mathbb{R} \\setminus \\{-3\\}$); ký hiệu không đọc chắc thì viết [?] và nêu trong verificationNotes. Chỉ trả tối đa 5 item: một THEORY, một METHOD, một WORKED_EXAMPLE, một EXERCISE và một SOLUTION. Với EXERCISE/SOLUTION, chỉ chọn một cặp có cùng số Câu và công thức khớp trên các trang được gửi; nếu không đối chiếu được thì bỏ cả hai. Mỗi câu hỏi và lời giải là một item riêng. Trả JSON {"items":[{"kind":"THEORY|METHOD|WORKED_EXAMPLE|EXERCISE|SOLUTION","title":"...","content":"...","mathematicalNotation":["..."],"printedPages":[number],"exerciseReference":"...","solutionReference":"...","verificationNotes":["..."]}]}. Mục lục liên quan: ${plan.entries.map((entry) => entry.originalHeading).join(' / ')}. Mỗi item phải ghi số trang in nhìn thấy trong ảnh.`;
  const response = await provider({
    model: plan.model,
    prompt,
    images: images.map((image) => image.bytes),
    schema: TEXTBOOK_RESPONSE_SCHEMA,
  });
  const parsed = parseJson(response.text) as { items?: unknown };
  if (!Array.isArray(parsed.items))
    throw new Error('Gemini response is missing the items array.');
  if (parsed.items.length === 0)
    throw new Error('Gemini returned no extractable educational items for this page batch.');
  const extracted = parsed.items.map((raw): TextbookArtifact => {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid extracted item.');
    const item = raw as Record<string, unknown>;
    if (!['THEORY', 'METHOD', 'WORKED_EXAMPLE', 'EXERCISE', 'SOLUTION'].includes(String(item.kind)))
      throw new Error('Invalid extracted item kind.');
    const itemPages = Array.isArray(item.printedPages) ? item.printedPages.map(Number) : [];
    if (!itemPages.length || itemPages.some((page) => !plan.pages.includes(page)))
      throw new Error('Extracted item cites a page outside this batch.');
    return {
      id: randomUUID(),
      documentId: plan.document.id,
      entryId: plan.entries[0].id,
      kind: item.kind as TextbookArtifact['kind'],
      title: String(item.title ?? ''),
      content: String(item.content ?? ''),
      mathematicalNotation: Array.isArray(item.mathematicalNotation)
        ? item.mathematicalNotation.map(String)
        : [],
      printedPages: itemPages,
      pdfPages: [
        ...new Set(
          itemPages.map(
            (page) => mapPrintedPage(page, plan.document.anchors, plan.document.pageLayout).pdfPage
          )
        ),
      ],
      exerciseReference: typeof item.exerciseReference === 'string' ? item.exerciseReference : undefined,
      solutionReference: typeof item.solutionReference === 'string' ? item.solutionReference : undefined,
      reviewStatus: 'NEEDS_REVIEW',
      verificationNotes: Array.isArray(item.verificationNotes)
        ? item.verificationNotes.map(String)
        : ['AI extraction; human review required.'],
      extractionKey: job.extractionKey,
      createdAt: new Date().toISOString(),
    };
  });
  const artifacts = splitAndLinkExercises(extracted);
  await insertTextbookArtifacts(artifacts);
  return {
    job: {
      ...job,
      status: 'COMPLETED',
      provider: 'gemini',
      providerCalls: (job.providerCalls ?? 0) + 1,
      tokenUsage: response.usage,
      pagesProcessed: plan.pages,
      durationMs: Date.now() - start,
    },
    artifacts,
  };
}
