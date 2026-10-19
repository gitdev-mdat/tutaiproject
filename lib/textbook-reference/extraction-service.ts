import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { GEMINI_MODELS } from '@/lib/config/models';
import { executeWithAbortableProviderTimeout } from '@/lib/ai/provider-timeout';
import { mapPrintedPage } from './page-mapping';
import { splitAndLinkExercises } from './artifact-linking';
import { renderPrintedPageCrops } from './pdf-pages';
import { readTextbookStore, usesDatabaseTextbookStore, writeTextbookStore } from './repository';
import type { TextbookArtifact, TextbookExtractionJob } from './types';

const PROMPT_VERSION = 'textbook-knowledge-v4';
const MAX_PAGES_PER_REQUEST = 6;
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

export async function queueTextbookExtraction(input: {
  documentId: string;
  knowledgeNodeId: string;
  entryIds: string[];
  printedPages: number[];
}) {
  const pages = [...new Set(input.printedPages)].sort((a, b) => a - b);
  if (!pages.length || pages.length > MAX_PAGES_PER_REQUEST)
    throw new Error(
      `Choose between 1 and ${MAX_PAGES_PER_REQUEST} printed pages per extraction batch.`
    );
  const store = await readTextbookStore();
  const document = store.documents.find((item) => item.id === input.documentId);
  if (!document) throw new Error('Textbook not found.');
  const entryIds = new Set(input.entryIds);
  const entries = document.tocEntries.filter((entry) => entryIds.has(entry.id));
  if (!entries.length || entries.length !== entryIds.size)
    throw new Error('Unknown table-of-contents entry.');
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
    throw new Error('Requested page range is outside the selected table-of-contents sections.');
  if (pages.some((page) => mapPrintedPage(page, document.anchors).position === 'UNCERTAIN'))
    throw new Error('One or more printed pages have an uncertain PDF location and require review.');
  if (!mappingCoversEntries(document, store.mappings, document.id, input.knowledgeNodeId, entries))
    throw new Error(
      'Every requested outline entry needs a confirmed Knowledge Tree mapping or a confirmed mapped parent.'
    );
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
  const cached = store.artifacts.filter((artifact) => artifact.extractionKey === extractionKey);
  const now = new Date().toISOString();
  if (cached.length) {
    const normalized = splitAndLinkExercises(cached);
    const isUnreviewed = cached.every((artifact) => artifact.reviewStatus === 'NEEDS_REVIEW');
    if (isUnreviewed && JSON.stringify(normalized) !== JSON.stringify(cached)) {
      store.artifacts = store.artifacts
        .filter((artifact) => artifact.extractionKey !== extractionKey)
        .concat(normalized);
      await writeTextbookStore(store);
    }
    const job = makeJob(input, pages, extractionKey, Date.now(), 'COMPLETED', true, model);
    job.attempts = 0;
    job.pagesProcessed = pages;
    store.jobs.push(job);
    await writeTextbookStore(store);
    return { job, artifacts: isUnreviewed ? normalized : cached, cacheHit: true };
  }
  const existing = store.jobs.find(
    (job) =>
      job.extractionKey === extractionKey && ['QUEUED', 'RUNNING', 'PARTIAL'].includes(job.status)
  );
  if (existing) return { job: existing, artifacts: [], cacheHit: false };
  const job = makeJob(input, pages, extractionKey, Date.now(), 'QUEUED', false, model);
  job.attempts = 0;
  job.updatedAt = now;
  store.jobs.push(job);
  try {
    await writeTextbookStore(store);
  } catch (error) {
    if ((error as { code?: string }).code !== '23505') throw error;
    const concurrent = (await readTextbookStore()).jobs.find(
      (candidate) =>
        candidate.extractionKey === extractionKey &&
        ['QUEUED', 'RUNNING', 'PARTIAL'].includes(candidate.status)
    );
    if (!concurrent) throw error;
    return { job: concurrent, artifacts: [], cacheHit: false };
  }
  return { job, artifacts: [], cacheHit: false };
}

export async function extractTextbookPages(input: {
  documentId: string;
  knowledgeNodeId: string;
  entryIds: string[];
  printedPages: number[];
  jobId?: string;
  signal?: AbortSignal;
}) {
  const start = Date.now();
  const pages = [...new Set(input.printedPages)].sort((a, b) => a - b);
  if (!pages.length || pages.length > MAX_PAGES_PER_REQUEST) {
    throw new Error(
      `Choose between 1 and ${MAX_PAGES_PER_REQUEST} printed pages per extraction batch.`
    );
  }
  const store = await readTextbookStore();
  const document = store.documents.find((item) => item.id === input.documentId);
  if (!document) throw new Error('Textbook not found.');
  const entryIds = new Set(input.entryIds);
  const entries = document.tocEntries.filter((entry) => entryIds.has(entry.id));
  if (!entries.length || entries.length !== entryIds.size)
    throw new Error('Unknown table-of-contents entry.');
  if (
    pages.some(
      (printedPage) =>
        !entries.some(
          (entry) =>
            entry.printedStartPage !== null &&
            printedPage >= entry.printedStartPage &&
            (entry.printedEndPage === null || printedPage <= entry.printedEndPage)
        )
    )
  ) {
    throw new Error('Requested page range is outside the selected table-of-contents sections.');
  }
  const locations = pages.map((printedPage) => ({
    ...mapPrintedPage(printedPage, document.anchors),
    printedPage,
  }));
  if (locations.some((location) => location.position === 'UNCERTAIN')) {
    throw new Error('One or more printed pages have an uncertain PDF location and require review.');
  }
  const model = GEMINI_MODELS.batchExtraction;
  const key = createHash('sha256')
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
  const cached = store.artifacts.filter((artifact) => artifact.extractionKey === key);
  if (!mappingCoversEntries(document, store.mappings, document.id, input.knowledgeNodeId, entries))
    throw new Error(
      'Every requested outline entry needs a confirmed Knowledge Tree mapping or a confirmed mapped parent.'
    );
  if (cached.length) {
    const job = input.jobId
      ? store.jobs.find((candidate) => candidate.id === input.jobId)
      : undefined;
    const completed = job ?? makeJob(input, pages, key, start, 'COMPLETED', true, model);
    completed.status = 'COMPLETED';
    completed.cacheHit = true;
    completed.pagesProcessed = pages;
    completed.durationMs = Date.now() - start;
    completed.updatedAt = new Date().toISOString();
    if (!job) store.jobs.push(completed);
    document.status = 'EXTRACTED';
    await writeTextbookStore(store);
    return { job: completed, artifacts: cached, cacheHit: true };
  }

  const job = input.jobId
    ? store.jobs.find((candidate) => candidate.id === input.jobId)
    : undefined;
  if (input.jobId && !job) throw new Error('Queued extraction job not found.');
  const activeJob = job ?? makeJob(input, pages, key, start, 'RUNNING', false, model);
  activeJob.status = 'RUNNING';
  if (!usesDatabaseTextbookStore()) activeJob.attempts += 1;
  delete activeJob.error;
  activeJob.updatedAt = new Date().toISOString();
  document.status = 'EXTRACTING';
  if (!job) store.jobs.push(activeJob);
  await writeTextbookStore(store);
  try {
    const images = await renderPrintedPageCrops(document.storageKey, locations);
    const { gemini } = await import('@/lib/ai/gemini-client');
    const parts = [
      {
        text: `Trích xuất kiến thức giáo dục bằng tiếng Việt từ đúng ${pages.length} ảnh trang sách đính kèm. Không bổ sung điều không đọc được. Giữ nguyên công thức; đánh dấu công thức không chắc chắn. Chỉ trả tối đa 5 item: một THEORY, một METHOD, một WORKED_EXAMPLE, một EXERCISE và một SOLUTION. Với EXERCISE/SOLUTION, chỉ chọn một cặp có cùng số Câu và công thức khớp trên các trang được gửi; nếu không đối chiếu được thì bỏ cả hai. Mỗi câu hỏi và lời giải là một item riêng. Trả JSON {"items":[{"kind":"THEORY|METHOD|WORKED_EXAMPLE|EXERCISE|SOLUTION","title":"...","content":"...","mathematicalNotation":["..."],"printedPages":[number],"exerciseReference":"...","solutionReference":"...","verificationNotes":["..."]}]}. Mục lục liên quan: ${entries.map((entry) => entry.originalHeading).join(' / ')}. Mỗi item phải ghi số trang in nhìn thấy trong ảnh.`,
      },
      ...images.map((image) => ({
        inlineData: { mimeType: 'image/png', data: image.bytes.toString('base64') },
      })),
    ];
    const response = await executeWithAbortableProviderTimeout(
      (signal) =>
        gemini.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: {
            responseMimeType: 'application/json',
            responseJsonSchema: TEXTBOOK_RESPONSE_SCHEMA,
            temperature: 0.1,
            maxOutputTokens: 8192,
            abortSignal: signal,
          },
        }),
      120_000
    );
    const usage = (
      response as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }
    ).usageMetadata;
    if (usage)
      activeJob.tokenUsage = { input: usage.promptTokenCount, output: usage.candidatesTokenCount };
    const parsed = parseJson((response as { text?: string }).text ?? '') as { items?: unknown };
    if (!Array.isArray(parsed.items))
      throw new Error(
        `Gemini response is missing the items array (keys: ${Object.keys(parsed as object).join(',') || 'none'}).`
      );
    if (parsed.items.length === 0)
      throw new Error('Gemini returned no extractable educational items for this page batch.');
    const extracted = parsed.items.map((raw): TextbookArtifact => {
      if (!raw || typeof raw !== 'object') throw new Error('Invalid extracted item.');
      const item = raw as Record<string, unknown>;
      const kind = item.kind;
      if (!['THEORY', 'METHOD', 'WORKED_EXAMPLE', 'EXERCISE', 'SOLUTION'].includes(String(kind))) {
        throw new Error('Invalid extracted item kind.');
      }
      const itemPages = Array.isArray(item.printedPages) ? item.printedPages.map(Number) : [];
      if (!itemPages.length || itemPages.some((page) => !pages.includes(page))) {
        throw new Error('Extracted item cites a page outside this batch.');
      }
      return {
        id: randomUUID(),
        documentId: document.id,
        entryId: entries[0].id,
        kind: kind as TextbookArtifact['kind'],
        title: String(item.title ?? ''),
        content: String(item.content ?? ''),
        mathematicalNotation: Array.isArray(item.mathematicalNotation)
          ? item.mathematicalNotation.map(String)
          : [],
        printedPages: itemPages,
        pdfPages: [
          ...new Set(
            itemPages.map((printedPage) => mapPrintedPage(printedPage, document.anchors).pdfPage)
          ),
        ],
        exerciseReference:
          typeof item.exerciseReference === 'string' ? item.exerciseReference : undefined,
        solutionReference:
          typeof item.solutionReference === 'string' ? item.solutionReference : undefined,
        reviewStatus: 'NEEDS_REVIEW',
        verificationNotes: Array.isArray(item.verificationNotes)
          ? item.verificationNotes.map(String)
          : ['AI extraction; human review required.'],
        extractionKey: key,
        createdAt: new Date().toISOString(),
      };
    });
    const artifacts = splitAndLinkExercises(extracted);
    activeJob.status = 'COMPLETED';
    activeJob.pagesProcessed = pages;
    activeJob.durationMs = Date.now() - start;
    activeJob.updatedAt = new Date().toISOString();
    document.processingErrors = [];
    store.artifacts.push(...artifacts);
    document.status = 'EXTRACTED';
    await writeTextbookStore(store);
    return { job: activeJob, artifacts, cacheHit: false };
  } catch (error) {
    activeJob.status = 'FAILED';
    activeJob.error = error instanceof Error ? error.message : String(error);
    activeJob.durationMs = Date.now() - start;
    activeJob.updatedAt = new Date().toISOString();
    document.status = 'FAILED';
    document.processingErrors.push(activeJob.error);
    await writeTextbookStore(store);
    throw error;
  }
}

function makeJob(
  input: { documentId: string; knowledgeNodeId: string; entryIds: string[] },
  printedPages: number[],
  extractionKey: string,
  start: number,
  status: TextbookExtractionJob['status'],
  cacheHit: boolean,
  model: string
): TextbookExtractionJob {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    documentId: input.documentId,
    knowledgeNodeId: input.knowledgeNodeId,
    entryIds: input.entryIds,
    printedPages,
    extractionKey,
    status,
    attempts: 1,
    provider: 'gemini',
    model,
    pagesProcessed: [],
    cacheHit,
    createdAt: now,
    updatedAt: now,
    ...(status === 'COMPLETED' ? { durationMs: Date.now() - start } : {}),
  };
}
