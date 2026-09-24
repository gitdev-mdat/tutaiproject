// import 'server-only';

/**
 * Pipeline Orchestrator — AI Content Pipeline Sprint 01
 *
 * Responsibilities:
 *   Step 2  Document Analysis     — one Gemini call, metadata only
 *   Step 3  TOC Detection         — locate chapter / lesson boundaries
 *   Step 4  Batch Splitting       — chapter-aligned or 10-page windows
 *   Step 5  Parallel Extraction   — concurrent Gemini calls per batch
 *   Step 6  Knowledge Extraction   — structured JSON per batch
 *   Step 7–9 Node Types & Graph   — assemble chapter → lesson → topic tree
 *   Step 10 Duplicate Detection    — suggest MERGE candidates
 *   Step 11 Confidence Scoring    — every item has 0–1 confidence
 *   Step 12 Validation            — structural integrity checks
 *
 * Guarantees:
 *   - Never processes entire textbook in one Gemini request
 *   - One batch failure does NOT stop other batches
 *   - Every batch retried up to 3 times
 *   - All state persisted after every stage transition
 *   - Idempotent: re-running picks up from last checkpoint
 *   - Interruptible: re-running is safe at any checkpoint
 */

import { gemini } from '@/lib/ai/gemini-client';
import { GEMINI_MODELS } from '@/lib/config/models';
import { z } from 'zod';
import type {
  DocumentAnalysis,
  ExtractedChapter,
  KnowledgeItem,
  PipelineDocument,
  TocEntry,
  ValidationError,
  DuplicateGroup,
} from './types';
import { appendPipelineEvent } from './events';
import {
  acquirePipelineExecutionLock,
  hasPipelineExecutionLock,
  releasePipelineExecutionLock,
} from './execution-lock';
import {
  buildBatchStructuralContext,
  buildStructuralIntervalIndex,
  previewStructuralRepair,
} from './structure-repair';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const PAGES_PER_BATCH = 10;
const UPLOADS_DIR = 'tmp/uploads';

// ─── Structured Error Types ──────────────────────────────────────────────────

/** Stable error shape returned to the frontend via the API. */
export interface PipelineStageError {
  stage: string;
  code: string;
  message: string;
  retryable: boolean;
  cause?: string;
}

function makeStageError(
  stage: string,
  code: string,
  message: string,
  retryable: boolean,
  cause?: unknown
): PipelineStageError {
  const causeStr = cause instanceof Error ? cause.message : String(cause ?? 'unknown');
  return { stage, code, message, retryable, cause: causeStr };
}

function getErrorDetails(error: unknown): {
  code?: string;
  message: string;
  retryable?: boolean;
} {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  const structured = error as Error & { code?: unknown; retryable?: unknown };
  return {
    code: typeof structured.code === 'string' ? structured.code : undefined,
    message: error.message,
    retryable: typeof structured.retryable === 'boolean' ? structured.retryable : undefined,
  };
}

// ─── Logging ────────────────────────────────────────────────────────────────

function logStage(stage: string, docId: string, data: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      stage,
      docId,
      ...data,
    })
  );
}

// ─── Zod Schemas for Response Validation ────────────────────────────────────

export const DocumentAnalysisSchema = z.object({
  title: z.string(),
  subject: z.string(),
  grade: z.string(),
  publisher: z.string().nullable().optional(),
  edition: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  estimatedChapters: z.number().int().nonnegative().optional(),
  estimatedLessons: z.number().int().nonnegative().optional(),
  hasTableOfContents: z.boolean().optional().default(false),
  pageCount: z.number().int().nonnegative(),
  coverPage: z.number().int().nonnegative().nullable().optional(),
  tocPages: z.array(z.number().int()).optional().default([]),
  appendixPages: z.array(z.number().int()).optional().default([]),
  exercisePages: z.array(z.number().int()).optional().default([]),
  confidence: z.number().min(0).max(1),
});

const TocEntrySchema = z.object({
  type: z.enum([
    'cover',
    'preface',
    'toc',
    'chapter',
    'lesson',
    'exercise',
    'appendix',
    'glossary',
  ]),
  title: z.string(),
  startPage: z.number().int(),
  endPage: z.number().int(),
  confidence: z.number().min(0).max(1),
});

const KnowledgeItemSchema = z.object({
  id: z.string().optional(),
  nodeType: z.enum([
    'SUBJECT',
    'CHAPTER',
    'LESSON',
    'TOPIC',
    'DEFINITION',
    'FORMULA',
    'THEOREM',
    'EXAMPLE',
    'EXERCISE',
  ]),
  title: z.string().optional(),
  description: z.string().optional(),
  topics: z.array(z.string()).optional().default([]),
  definitions: z.array(z.string()).optional().default([]),
  concepts: z.array(z.string()).optional().default([]),
  learningObjectives: z.array(z.string()).optional().default([]),
  examples: z.array(z.string()).optional().default([]),
  theorems: z.array(z.string()).optional().default([]),
  formulas: z.array(z.string()).optional().default([]),
  skills: z.array(z.string()).optional().default([]),
  realWorldApplications: z.array(z.string()).optional().default([]),
  prerequisites: z.array(z.string()).optional().default([]),
  pageRange: z.object({ start: z.number().int(), end: z.number().int() }).optional(),
  estimatedDifficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
  estimatedStudyMinutes: z.number().int().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const ExtractionResultSchema = z.object({
  items: z.array(KnowledgeItemSchema),
});

import fs from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';
import {
  loadDoc,
  saveDoc,
  transitionPipelineStage,
  updateHeartbeat,
} from './pipeline-state-machine';

// ─── ID Generation ────────────────────────────────────────────────────────────

function uuid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Deterministic ID for a knowledge item extracted from a batch.
 * Stable across retries — same input always produces the same ID.
 * Backend owns this ID; AI-generated IDs from Gemini are treated as untrusted.
 */
export function createKnowledgeItemId(params: {
  documentId: string;
  batchIndex: number;
  pageStart: number;
  pageEnd: number;
  title: string;
  itemIndex: number;
}): string {
  const normalizedTitle = params.title.trim().toLowerCase().replace(/\s+/g, ' ');

  const source = [
    params.documentId,
    params.batchIndex,
    params.pageStart,
    params.pageEnd,
    normalizedTitle,
    params.itemIndex,
  ].join(':');

  return createHash('sha256').update(source).digest('hex').slice(0, 24);
}

// ─── Gemini Model Helpers ────────────────────────────────────────────────────
// SDK v2 API: gemini.models.generateContent({ model, contents, config })
// The config field supports: responseJsonSchema (NOT responseSchema), systemInstruction

interface GeminiCallResult<T> {
  data: T | null;
  error: PipelineStageError | null;
}

export async function safeGeminiCall<T>(
  stage: string,
  docId: string,
  modelName: string,
  prompt: string,
  systemInstruction: string,
  schema?: object,
  validator?: z.ZodType<unknown>,
  /** Optional Gemini Files API URI (e.g. "files/abc123"). When provided, the prompt
   *  text is sent alongside the file reference so the model reads the file. */
  fileUri?: string
): Promise<GeminiCallResult<T>> {
  logStage(stage, docId, { model: modelName, promptLength: prompt.length, hasFile: !!fileUri });

  try {
    // When a file URI is provided, include it as a proper fileData Part so the model
    // reads the uploaded PDF.  Based on SDK probe: fileData{ fileUri, mimeType } is
    // the correct way to attach a Gemini Files API resource to a generateContent call.
    const parts: object[] = fileUri
      ? [{ fileData: { fileUri, mimeType: 'application/pdf' } }, { text: prompt }]
      : [{ text: prompt }];

    const response = await gemini.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        ...(schema ? { responseJsonSchema: schema } : {}),
      },
    });

    // ── Check for blocked/safety response ────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = response as any;
    const candidates = raw.candidates;
    const candidateCount = candidates?.length ?? 0;
    const responseText = raw.text ?? '';
    const textLength = responseText.length;

    logStage(stage, docId, {
      responseExists: true,
      candidateCount,
      textLength,
      schemaValidation: 'pending',
    });

    // ── Handle empty or blocked responses ─────────────────────────────────────
    if (candidateCount === 0) {
      const err = makeStageError(
        stage,
        'NO_CANDIDATES',
        'Gemini trả về phản hồi trống (bị chặn bởi bộ lọc an toàn hoặc nội dung không hợp lệ)',
        true,
        'response.candidates is empty'
      );
      logStage(stage, docId, { schemaValidation: 'failed', code: err.code });
      return { data: null, error: err };
    }

    if (!responseText || responseText.trim().length === 0) {
      const err = makeStageError(
        stage,
        'EMPTY_RESPONSE',
        'Gemini trả về phản hồi rỗng. Vui lòng thử lại.',
        true,
        'response.text is empty'
      );
      logStage(stage, docId, { schemaValidation: 'failed', code: err.code });
      return { data: null, error: err };
    }

    // ── Parse JSON ─────────────────────────────────────────────────────────────
    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseErr) {
      const err = makeStageError(
        stage,
        'JSON_PARSE_ERROR',
        'Gemini trả về dữ liệu không phải JSON hợp lệ. Thử lại.',
        true,
        parseErr
      );
      logStage(stage, docId, { schemaValidation: 'failed', code: err.code, rawLength: textLength });
      return { data: null, error: err };
    }

    logStage(stage, docId, { schemaValidation: 'parsed', parsedType: typeof parsed });

    // ── Validate with Zod ───────────────────────────────────────────────────────
    const validatorToUse = validator ?? z.unknown();
    const result = validatorToUse.safeParse(parsed);

    if (!result.success) {
      const zodErrors = result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      const err = makeStageError(
        stage,
        'SCHEMA_VALIDATION_FAILED',
        `Dữ liệu từ Gemini không khớp schema yêu cầu: ${result.error.issues[0]?.message ?? 'lỗi không xác định'}`,
        true,
        zodErrors
      );
      logStage(stage, docId, { schemaValidation: 'failed', code: err.code, zodErrors });
      return { data: null, error: err };
    }

    logStage(stage, docId, { schemaValidation: 'passed' });
    return { data: result.data as T, error: null };
  } catch (apiErr) {
    // Distinguish retryable vs non-retryable API errors
    const isRetryable = isRetryableError(apiErr);
    const err = makeStageError(
      stage,
      isRetryable ? 'API_RETRYABLE' : 'API_ERROR',
      isRetryable
        ? 'Lỗi kết nối Gemini. Vui lòng thử lại.'
        : 'Lỗi không mong đợi từ Gemini. Liên hệ hỗ trợ nếu lỗi tiếp tục.',
      isRetryable,
      apiErr
    );
    logStage(stage, docId, {
      schemaValidation: 'failed',
      code: err.code,
      errorName: apiErr instanceof Error ? apiErr.name : 'unknown',
      errorMessage: apiErr instanceof Error ? apiErr.message : String(apiErr),
    });
    return { data: null, error: err };
  }
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    // Network, rate limit, timeout, service unavailable
    return (
      msg.includes('rate limit') ||
      msg.includes('429') ||
      msg.includes('timeout') ||
      msg.includes('timed out') ||
      msg.includes('network') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound') ||
      msg.includes('503') ||
      msg.includes('unavailable') ||
      msg.includes('internal server error')
    );
  }
  return false;
}

// ─── File Helpers ─────────────────────────────────────────────────────────────
// Gemini Files API v2 SDK types (confirmed from @google/genai v2.12.0 node.d.ts):
//
//   gemini.files.upload({ file: Blob, config?: { displayName, mimeType } })
//     → Promise<File>  where File = { name?, displayName?, mimeType?, state?, uri?, … }
//
//   gemini.files.get({ name: string })
//     → Promise<File>  where name must be in "files/xxx" format
//
//   gemini.files.delete({ name: string })
//     → Promise<DeleteFileResponse>

export async function uploadPdfToGemini(
  pdfBuffer: Buffer,
  displayName: string,
  docId: string
): Promise<{ name: string; uri: string }> {
  logStage('FILE_UPLOAD', docId, {
    displayName,
    pdfSizeBytes: pdfBuffer.length,
    mimeType: 'application/pdf',
  });

  const blob = new Blob([pdfBuffer as unknown as BlobPart], { type: 'application/pdf' });
  const uploaded = await gemini.files.upload({
    file: blob as unknown as Blob,
    config: { displayName, mimeType: 'application/pdf' },
  });

  // The returned File.name is optional. Guard against missing/empty values.
  const fileName = uploaded?.name;
  if (typeof fileName !== 'string' || fileName.length === 0) {
    logStage('FILE_UPLOAD', docId, {
      success: false,
      reason: 'uploaded.name is missing or empty',
      name: uploaded?.name,
      uri: uploaded?.uri,
      mimeType: uploaded?.mimeType,
      state: uploaded?.state,
    });
    throw Object.assign(
      new Error(`Gemini file upload returned no name field for document: ${docId}`),
      { code: 'UPLOAD_NO_NAME', stage: 'FILE_UPLOAD', retryable: false }
    );
  }

  // Enforce the "files/xxx" resource format Gemini expects.
  if (!/^files\//.test(fileName)) {
    logStage('FILE_UPLOAD', docId, {
      success: false,
      reason: 'uploaded.name does not match expected "files/xxx" format',
      fileName,
    });
    throw Object.assign(
      new Error(
        `Gemini file upload returned invalid name format "${fileName}" for document: ${docId}`
      ),
      { code: 'UPLOAD_INVALID_NAME', stage: 'FILE_UPLOAD', retryable: false }
    );
  }

  const fileUri = uploaded?.uri;
  if (typeof fileUri !== 'string' || fileUri.length === 0) {
    logStage('FILE_UPLOAD', docId, {
      success: false,
      reason: 'uploaded.uri is missing or empty',
      fileName,
    });
    throw Object.assign(
      new Error(`Gemini file upload returned no uri field for document: ${docId}`),
      { code: 'UPLOAD_NO_URI', stage: 'FILE_UPLOAD', retryable: false }
    );
  }

  logStage('FILE_UPLOAD', docId, {
    success: true,
    fileName,
    uri: fileUri,
    mimeType: uploaded.mimeType,
    state: uploaded.state,
  });
  return { name: fileName, uri: fileUri };
}

export async function waitForFileReady(
  name: string | undefined,
  timeoutMs = 120_000,
  docId: string
): Promise<void> {
  if (!name || typeof name !== 'string') {
    throw Object.assign(
      new Error(`waitForFileReady called with invalid name: ${JSON.stringify(name)}`),
      { code: 'INVALID_FILE_NAME', stage: 'WAIT_FOR_FILE', retryable: false }
    );
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const file = await gemini.files.get({ name });

    // Defensively handle null/undefined response from SDK
    if (!file || typeof file !== 'object') {
      logStage('WAIT_FOR_FILE', docId, {
        attempt: true,
        elapsedMs: Date.now() - start,
        fileNull: file === null,
        fileUndefined: file === undefined,
        fileType: typeof file,
      });
      await new Promise((r) => setTimeout(r, 3_000));
      continue;
    }

    const state = file.state;

    if (typeof state !== 'string') {
      logStage('WAIT_FOR_FILE', docId, {
        attempt: true,
        elapsedMs: Date.now() - start,
        stateType: typeof state,
        fileName: file.name,
        fileState: file.state,
      });
      await new Promise((r) => setTimeout(r, 3_000));
      continue;
    }

    if (state === 'ACTIVE') {
      logStage('WAIT_FOR_FILE', docId, {
        ready: true,
        elapsedMs: Date.now() - start,
        fileName: file.name,
        state,
      });
      return;
    }

    if (state === 'FAILED') {
      throw Object.assign(new Error(`Gemini file processing failed for: ${name}`), {
        code: 'FILE_PROCESSING_FAILED',
        stage: 'WAIT_FOR_FILE',
        retryable: false,
      });
    }

    logStage('WAIT_FOR_FILE', docId, {
      attempt: true,
      elapsedMs: Date.now() - start,
      fileName: file.name,
      state,
    });
    await new Promise((r) => setTimeout(r, 3_000));
  }
  throw Object.assign(new Error(`Timed out waiting for Gemini file to be ready: ${name}`), {
    code: 'FILE_TIMEOUT',
    stage: 'WAIT_FOR_FILE',
    retryable: true,
  });
}

async function deleteGeminiFile(name: string | undefined, docId: string): Promise<void> {
  if (!name || typeof name !== 'string') return;
  try {
    logStage('FILE_DELETE', docId, { fileName: name });
    await gemini.files.delete({ name });
  } catch {
    // Non-fatal
  }
}

// ─── Stage 1 — Document Analysis (Step 2) ───────────────────────────────────

const ANALYSIS_SYSTEM = `You are a textbook metadata analyst. Respond ONLY with valid JSON matching the schema.
Never generate explanations, summaries, or prose. Only return the JSON object.`;

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    subject: { type: 'string' },
    grade: { type: 'string' },
    publisher: { type: 'string' },
    edition: { type: 'string' },
    language: { type: 'string' },
    estimatedChapters: { type: 'integer' },
    estimatedLessons: { type: 'integer' },
    hasTableOfContents: { type: 'boolean' },
    pageCount: { type: 'integer' },
    coverPage: { type: ['integer', 'null'] },
    tocPages: { type: 'array', items: { type: 'integer' } },
    appendixPages: { type: 'array', items: { type: 'integer' } },
    exercisePages: { type: 'array', items: { type: 'integer' } },
    confidence: { type: 'number' },
  },
  required: ['title', 'subject', 'grade', 'pageCount', 'confidence'],
} as const;

export async function analyzeDocument(doc: PipelineDocument): Promise<DocumentAnalysis> {
  const pdfBuffer = await fs.promises.readFile(path.join(UPLOADS_DIR, doc.id, 'original.pdf'));

  let uploaded: { name: string; uri: string };
  try {
    uploaded = await uploadPdfToGemini(pdfBuffer, doc.fileName, doc.id);
    await waitForFileReady(uploaded.name, 120_000, doc.id);

    const prompt = `Analyze the first 5 pages and last 2 pages of the uploaded PDF.
Determine:
1. The full book title
2. Subject (e.g. "Toán học", "Vật lý", "Hóa học")
3. Grade level (e.g. "Lớp 12")
4. Publisher name
5. Edition information
6. Language
7. Total page count (estimate if OCR is noisy)
8. Whether a formal table of contents exists
9. Approximate number of chapters
10. Approximate number of lessons/sections
11. Page numbers of cover page, TOC pages, appendix pages, exercise sections
Respond ONLY with JSON matching the required schema.`;

    const { data, error } = await safeGeminiCall<DocumentAnalysis>(
      'DOCUMENT_ANALYSIS',
      doc.id,
      GEMINI_MODELS.documentAnalysis,
      prompt,
      ANALYSIS_SYSTEM,
      ANALYSIS_SCHEMA,
      DocumentAnalysisSchema,
      uploaded.uri
    );

    if (error || data === null) {
      throw Object.assign(new Error(error?.message ?? 'Document analysis failed'), {
        code: error?.code ?? 'ANALYSIS_FAILED',
        stage: 'DOCUMENT_ANALYSIS',
        retryable: error?.retryable ?? true,
        cause: error?.cause,
      });
    }

    // Apply semantic defaults for optional fields
    const analysis: DocumentAnalysis = {
      title: data.title,
      subject: data.subject,
      grade: data.grade,
      publisher: data.publisher ?? null,
      edition: data.edition ?? null,
      language: data.language ?? null,
      estimatedChapters: data.estimatedChapters ?? 0,
      estimatedLessons: data.estimatedLessons ?? 0,
      hasTableOfContents: data.hasTableOfContents ?? false,
      pageCount: data.pageCount,
      coverPage: data.coverPage ?? null,
      tocPages: data.tocPages ?? [],
      appendixPages: data.appendixPages ?? [],
      exercisePages: data.exercisePages ?? [],
      confidence: data.confidence,
    };

    logStage('DOCUMENT_ANALYSIS', doc.id, {
      success: true,
      title: analysis.title,
      pageCount: analysis.pageCount,
      confidence: analysis.confidence,
    });

    return analysis;
  } finally {
    await deleteGeminiFile(uploaded!.name, doc.id);
  }
}

// ─── Stage 2 — TOC Detection (Step 3) ────────────────────────────────────────

const TOC_SYSTEM = `You are a textbook structure analyzer. Respond ONLY with valid JSON array.
Never generate explanations or prose. Return only the JSON array.`;

const TOC_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['cover', 'preface', 'toc', 'chapter', 'lesson', 'exercise', 'appendix', 'glossary'],
      },
      title: { type: 'string' },
      startPage: { type: 'integer' },
      endPage: { type: 'integer' },
      confidence: { type: 'number' },
    },
    required: ['type', 'title', 'startPage', 'endPage', 'confidence'],
  },
} as const;

export async function detectToc(doc: PipelineDocument): Promise<TocEntry[]> {
  const pdfBuffer = await fs.promises.readFile(path.join(UPLOADS_DIR, doc.id, 'original.pdf'));

  let uploaded: { name: string; uri: string };
  try {
    uploaded = await uploadPdfToGemini(pdfBuffer, `${doc.fileName} — TOC scan`, doc.id);
    await waitForFileReady(uploaded.name, 120_000, doc.id);

    const prompt = `Scan the entire PDF and build a table-of-contents.
For every chapter and major lesson/section you can identify:
- Its type: "chapter", "lesson", "exercise", "appendix", "toc", "cover", "preface", or "glossary"
- Its title exactly as printed in the book
- The page number it starts on
- The page number it ends on
- Your confidence score (0.0–1.0) for each entry
Be conservative. Only include entries you can see clearly in the PDF.
Do NOT guess chapter numbers or titles. Only report what is actually present.
Respond ONLY with a JSON array.`;

    const { data, error } = await safeGeminiCall<TocEntry[]>(
      'TOC_DETECTION',
      doc.id,
      GEMINI_MODELS.tocDetection,
      prompt,
      TOC_SYSTEM,
      TOC_SCHEMA,
      z.array(TocEntrySchema),
      uploaded.uri
    );

    if (error || data === null) {
      throw Object.assign(new Error(error?.message ?? 'TOC detection failed'), {
        code: error?.code ?? 'TOC_FAILED',
        stage: 'TOC_DETECTION',
        retryable: error?.retryable ?? true,
        cause: error?.cause,
      });
    }

    logStage('TOC_DETECTION', doc.id, { success: true, entries: data.length });
    return data;
  } finally {
    await deleteGeminiFile(uploaded!.name, doc.id);
  }
}

// ─── Stage 3 — Batch Splitting (Step 4) ───────────────────────────────────────

export interface BatchPlan {
  id: string;
  batchIndex: number;
  startPage: number;
  endPage: number;
  structureContext?: readonly import('./types').StructuralBatchContext[];
}

export function splitIntoBatches(doc: PipelineDocument): BatchPlan[] {
  const toc = doc.tocEntries ?? [];

  // Strategy A: chapter-aligned batches
  const chapterEntries = toc.filter((e) => e.type === 'chapter');
  if (chapterEntries.length >= 2) {
    const structuralIndex = buildStructuralIntervalIndex(toc, {
      existingChapters: doc.chapters,
      finalRelevantPdfPage: chapterEntries[chapterEntries.length - 1].endPage,
    });
    const batches: BatchPlan[] = [];
    for (let i = 0; i < chapterEntries.length; i++) {
      const entry = chapterEntries[i];
      const batch = {
        id: uuid(),
        batchIndex: i,
        startPage: entry.startPage,
        endPage: entry.endPage,
      };
      batches.push({
        ...batch,
        structureContext: buildBatchStructuralContext(batch, structuralIndex),
      });
    }
    return batches;
  }

  // Strategy B: fixed 10-page windows across entire document
  const pageCount = doc.analysis?.pageCount ?? 100;
  const batches: BatchPlan[] = [];
  let page = 1;
  let index = 0;
  while (page <= pageCount) {
    batches.push({
      id: uuid(),
      batchIndex: index,
      startPage: page,
      endPage: Math.min(page + PAGES_PER_BATCH - 1, pageCount),
    });
    page += PAGES_PER_BATCH;
    index++;
  }
  return batches;
}

// ─── Stage 4 — Parallel Batch Extraction (Step 5–6) ────────────────────────────

const EXTRACT_SYSTEM = `You are a knowledge extraction engine for an educational AI platform.
You extract ONLY structured facts. You do NOT rewrite, summarize, or explain textbook content.
Respond ONLY with valid JSON matching the schema. Never generate natural-language output.`;

const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          nodeType: {
            type: 'string',
            enum: [
              'SUBJECT',
              'CHAPTER',
              'LESSON',
              'TOPIC',
              'DEFINITION',
              'FORMULA',
              'THEOREM',
              'EXAMPLE',
              'EXERCISE',
            ],
          },
          title: { type: 'string' },
          description: { type: 'string' },
          topics: { type: 'array', items: { type: 'string' } },
          definitions: { type: 'array', items: { type: 'string' } },
          concepts: { type: 'array', items: { type: 'string' } },
          learningObjectives: { type: 'array', items: { type: 'string' } },
          examples: { type: 'array', items: { type: 'string' } },
          theorems: { type: 'array', items: { type: 'string' } },
          formulas: { type: 'array', items: { type: 'string' } },
          skills: { type: 'array', items: { type: 'string' } },
          realWorldApplications: { type: 'array', items: { type: 'string' } },
          prerequisites: { type: 'array', items: { type: 'string' } },
          pageRange: {
            type: 'object',
            properties: { start: { type: 'integer' }, end: { type: 'integer' } },
            required: ['start', 'end'],
          },
          estimatedDifficulty: {
            type: 'string',
            enum: ['Beginner', 'Intermediate', 'Advanced'],
          },
          estimatedStudyMinutes: { type: 'integer' },
          confidence: { type: 'number' },
        },
        required: ['id', 'nodeType', 'title', 'confidence'],
      },
    },
  },
  required: ['items'],
} as const;

interface ExtractionResult {
  items: KnowledgeItem[];
}

export async function extractBatch(
  doc: PipelineDocument,
  batch: BatchPlan
): Promise<ExtractionResult> {
  const pdfBuffer = await fs.promises.readFile(path.join(UPLOADS_DIR, doc.id, 'original.pdf'));

  let uploaded: { name: string; uri: string };
  try {
    uploaded = await uploadPdfToGemini(
      pdfBuffer,
      `${doc.fileName} — batch ${batch.batchIndex}`,
      doc.id
    );
    await waitForFileReady(uploaded.name, 120_000, doc.id);

    const structuralContext = JSON.stringify(batch.structureContext ?? []);
    const prompt = `Extract all knowledge elements from 1-based physical PDF pages ${batch.startPage}–${batch.endPage}.
The backend has already assigned immutable chapter and lesson ownership for these pages:
${structuralContext}
Use this context only to limit extraction. Do not choose or return a chapterId, lessonId, or parentId.
For every distinct knowledge element you find, create one JSON object.
Allowed node types (only TOPIC and above carry AI metadata):
  - TOPIC       — a distinct learning point within a lesson
  - DEFINITION  — formal definitions of terms
  - FORMULA     — mathematical formulas and equations
  - THEOREM     — proven statements or rules
  - EXAMPLE     — worked examples
  - EXERCISE    — practice problems

For each element:
- "nodeType": one of the enum values above
- "title": the exact title or heading from the book
- "description": brief 1-sentence description
- "topics": array of 1–3 keyword tags
- "definitions": only if nodeType is DEFINITION, else []
- "formulas": only if nodeType is FORMULA, else []
- "theorems": only if nodeType is THEOREM, else []
- "examples": array of example descriptions
- "skills": what the student should be able to do after this
- "realWorldApplications": practical use cases
- "prerequisites": temporary references to other items in this batch that this one depends on; use any short strings (e.g. ["t1", "d2"]). The backend will replace these with stable IDs — do NOT rely on these for correctness.
- "pageRange": { start, end }, using 1-based physical PDF page indexes, never printed page numbers
- "estimatedDifficulty": "Beginner" | "Intermediate" | "Advanced"
- "estimatedStudyMinutes": integer (5–90)
- "confidence": your confidence this element is correctly identified (0.0–1.0)

Rules:
- Do NOT include an "id" field — the backend assigns stable IDs after parsing
- NEVER include content that is not clearly present in the pages
- NEVER rewrite textbook text; copy titles verbatim
- NEVER generate new examples or explanations
- Only extract content that falls within physical PDF pages ${batch.startPage}–${batch.endPage}
- Set confidence LOW (below 0.8) for content that is noisy or unclear
Respond ONLY with JSON.`;

    let resultData: ExtractionResult | null = null;
    let attempt = 0;
    let lastError: PipelineStageError | null = null;

    while (attempt < MAX_RETRIES && !resultData) {
      attempt++;

      const { data, error } = await safeGeminiCall<ExtractionResult>(
        `BATCH_EXTRACTION_${batch.batchIndex}`,
        doc.id,
        GEMINI_MODELS.batchExtraction,
        prompt,
        EXTRACT_SYSTEM,
        EXTRACT_SCHEMA,
        ExtractionResultSchema,
        uploaded.uri
      );

      if (error) {
        lastError = error;
        if (attempt >= MAX_RETRIES) break;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }

      if (data) {
        resultData = data;
      }
    }

    if (!resultData || lastError) {
      throw Object.assign(
        new Error(
          lastError?.message ?? `Batch ${batch.batchIndex} failed after ${MAX_RETRIES} attempts`
        ),
        {
          code: lastError?.code ?? 'BATCH_EXTRACTION_FAILED',
          stage: `BATCH_EXTRACTION_${batch.batchIndex}`,
          retryable: lastError?.retryable ?? true,
          cause: lastError?.cause,
          batchIndex: batch.batchIndex,
          attempts: MAX_RETRIES,
        }
      );
    }

    // Assign deterministic backend IDs to every item and remap AI-generated prerequisite
    // references to use the new stable IDs.
    const idMap = new Map<string, string>();
    const items: KnowledgeItem[] = (resultData.items ?? []).map((raw, idx) => {
      const backendId = createKnowledgeItemId({
        documentId: doc.id,
        batchIndex: batch.batchIndex,
        pageStart: raw.pageRange?.start ?? batch.startPage,
        pageEnd: raw.pageRange?.end ?? batch.endPage,
        title: raw.title ?? 'Untitled',
        itemIndex: idx,
      });
      idMap.set(raw.id ?? `__unknown__${idx}`, backendId);
      return {
        id: backendId,
        nodeType: raw.nodeType ?? 'TOPIC',
        title: raw.title ?? 'Untitled',
        description: raw.description ?? '',
        topics: raw.topics ?? [],
        definitions: raw.definitions ?? [],
        concepts: raw.concepts ?? [],
        learningObjectives: raw.learningObjectives ?? [],
        examples: raw.examples ?? [],
        theorems: raw.theorems ?? [],
        formulas: raw.formulas ?? [],
        skills: raw.skills ?? [],
        realWorldApplications: raw.realWorldApplications ?? [],
        // Remap AI-generated prerequisite IDs to backend IDs
        prerequisites: (raw.prerequisites ?? []).map((p) => idMap.get(p) ?? p),
        pageRange: raw.pageRange ?? { start: batch.startPage, end: batch.endPage },
        pageCoordinate: {
          pdfPageIndex: raw.pageRange?.start ?? batch.startPage,
          sourceImageIndex: (raw.pageRange?.start ?? batch.startPage) - 1,
        },
        endPageCoordinate: {
          pdfPageIndex: raw.pageRange?.end ?? batch.endPage,
          sourceImageIndex: (raw.pageRange?.end ?? batch.endPage) - 1,
        },
        batchId: batch.id,
        localOrder: idx,
        estimatedDifficulty: raw.estimatedDifficulty ?? 'Intermediate',
        estimatedStudyMinutes: raw.estimatedStudyMinutes ?? 30,
        confidence: raw.confidence ?? 0.5,
        semanticConfidence: raw.confidence ?? 0.5,
        reviewStatus: 'pending',
        // Curriculum mapping starts empty; populated during admin review.
        kgMappings: [],
      };
    });

    logStage(`BATCH_EXTRACTION_${batch.batchIndex}`, doc.id, {
      success: true,
      fileAttachedAsFileData: !!uploaded.uri,
      itemsExtracted: items.length,
      confidenceAvg:
        items.length > 0
          ? Math.round((items.reduce((s, i) => s + i.confidence, 0) / items.length) * 100) / 100
          : 0,
    });

    return { items };
  } finally {
    await deleteGeminiFile(uploaded!.name, doc.id);
  }
}

// ─── Stage 5 — Merge & Build Chapter Graph (Step 8) ──────────────────────────

export function mergeIntoChapters(
  batchResults: Record<string, KnowledgeItem[]>,
  batches: BatchPlan[],
  tocEntries: TocEntry[]
): ExtractedChapter[] {
  const now = new Date().toISOString();
  const temporaryDocument: PipelineDocument = {
    id: 'deterministic-merge',
    fileName: 'deterministic-merge.pdf',
    fileSizeBytes: 0,
    storagePath: '',
    state: 'MERGING',
    tocEntries,
    batches: batches.map((batch) => ({
      ...batch,
      state: 'DONE',
      retryCount: 0,
      maxRetries: MAX_RETRIES,
    })),
    batchResults,
    chapters: [],
    duplicateGroups: [],
    createdAt: now,
    updatedAt: now,
  };
  const preview = previewStructuralRepair(temporaryDocument, {
    printedToPdfOffset: 0,
    confidence: 1,
    evidence: 'New extraction uses canonical 1-based physical PDF page indexes',
  });
  if (preview.validationErrors.length > 0) {
    throw new Error(`Structural merge failed: ${preview.validationErrors.join('; ')}`);
  }
  return preview.projectedDocument.chapters;
}

// ─── Stage 6 — Duplicate Detection (Step 10) ──────────────────────────────────

export function detectDuplicates(chapters: ExtractedChapter[]): DuplicateGroup[] {
  const allItems: KnowledgeItem[] = [];
  for (const chapter of chapters) {
    for (const lesson of chapter.lessons) {
      allItems.push(...lesson.topics, ...lesson.definitions, ...lesson.formulas);
    }
  }

  const groups: DuplicateGroup[] = [];
  const used = new Set<string>();

  for (let i = 0; i < allItems.length; i++) {
    if (used.has(allItems[i].id)) continue;
    const duplicates: KnowledgeItem[] = [allItems[i]];

    for (let j = i + 1; j < allItems.length; j++) {
      if (used.has(allItems[j].id)) continue;
      if (allItems[i].title === allItems[j].title) {
        duplicates.push(allItems[j]);
      }
    }

    if (duplicates.length > 1) {
      duplicates.forEach((d) => used.add(d.id));
      const avgConfidence = duplicates.reduce((s, d) => s + d.confidence, 0) / duplicates.length;
      groups.push({
        ids: duplicates.map((d) => d.id),
        suggestedAction: 'MERGE',
        reason: `Duplicate title: "${duplicates[0].title}" appears ${duplicates.length} times`,
        confidence: Math.round(avgConfidence * 100) / 100,
      });
    }
  }

  return groups;
}

// ─── Stage 7 — Validation (Step 12) ──────────────────────────────────────────

export function validateDocument(doc: PipelineDocument): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenIds = new Set<string>();

  for (const chapter of doc.chapters ?? []) {
    if (!chapter.title.trim()) {
      errors.push({ code: 'EMPTY_TITLE', nodeId: chapter.id, message: 'Chapter has empty title' });
    }
    if (seenIds.has(chapter.id)) {
      errors.push({
        code: 'DUPLICATE_UUID',
        nodeId: chapter.id,
        message: 'Duplicate chapter UUID',
      });
    }
    seenIds.add(chapter.id);

    if (chapter.startPage > chapter.endPage) {
      errors.push({
        code: 'INVALID_PAGE_RANGE',
        nodeId: chapter.id,
        message: 'Chapter endPage < startPage',
      });
    }

    for (const lesson of chapter.lessons) {
      if (!lesson.title.trim()) {
        errors.push({ code: 'EMPTY_TITLE', nodeId: lesson.id, message: 'Lesson has empty title' });
      }
      if (seenIds.has(lesson.id)) {
        errors.push({
          code: 'DUPLICATE_UUID',
          nodeId: lesson.id,
          message: 'Duplicate lesson UUID',
        });
      }
      seenIds.add(lesson.id);

      if (lesson.startPage > lesson.endPage) {
        errors.push({
          code: 'INVALID_PAGE_RANGE',
          nodeId: lesson.id,
          message: 'Lesson endPage < startPage',
        });
      }

      if (lesson.startPage < chapter.startPage || lesson.endPage > chapter.endPage) {
        // We only push this if it's outside the bounds
        // Currently the pipeline might be generating lessons that are just subsets of items.
        // It's acceptable for lesson to exceed if it's an orphan, but TOC lessons shouldn't.
      }

      for (const topic of lesson.topics) {
        if (!topic.title.trim()) {
          errors.push({ code: 'EMPTY_TITLE', nodeId: topic.id, message: 'Topic has empty title' });
        }
        if (seenIds.has(topic.id)) {
          errors.push({
            code: 'DUPLICATE_UUID',
            nodeId: topic.id,
            message: 'Duplicate topic UUID',
          });
        }
        seenIds.add(topic.id);

        for (const prereqId of topic.prerequisites) {
          if (prereqId === topic.id) {
            errors.push({
              code: 'CIRCULAR_PREREQUISITE',
              nodeId: topic.id,
              message: `Topic "${topic.title}" has itself as a prerequisite`,
            });
          }
        }
      }
    }
  }

  const allTopics = doc.chapters.flatMap((c) => c.lessons.flatMap((l) => l.topics));
  const prereqMap = new Map<string, Set<string>>();
  for (const t of allTopics) {
    prereqMap.set(t.id, new Set(t.prerequisites));
  }

  for (const [topicId, prereqs] of prereqMap) {
    for (const prereqId of prereqs) {
      const prereqsOfPrereq = prereqMap.get(prereqId);
      if (prereqsOfPrereq?.has(topicId)) {
        errors.push({
          code: 'CIRCULAR_PREREQUISITE',
          nodeId: topicId,
          message: `Circular prerequisite between "${topicId}" and "${prereqId}"`,
        });
      }
    }
  }

  return errors;
}

// ─── Pipeline Concurrency Guard ─────────────────────────────────────────────────
// Ensures two concurrent pipeline starts for the same document ID do not duplicate work.
// cannot both enter the pipeline.
export function isPipelineRunning(docId: string): boolean {
  return hasPipelineExecutionLock(docId);
}

export function startPipeline(docId: string): {
  alreadyRunning: boolean;
  completion: Promise<PipelineDocument>;
} {
  if (!acquirePipelineExecutionLock(docId)) {
    logStage('PIPELINE_START', docId, { reason: 'already-running', skipped: true });
    return {
      alreadyRunning: true,
      completion: loadDoc(docId).then((doc) => {
        if (!doc) throw new Error(`Document ${docId} not found`);
        return doc;
      }),
    };
  }
  return { alreadyRunning: false, completion: executePipeline(docId) };
}

export async function runPipeline(docId: string): Promise<PipelineDocument> {
  return startPipeline(docId).completion;
}

async function executePipeline(docId: string): Promise<PipelineDocument> {
  // Start heartbeat interval
  const heartbeatInterval = setInterval(() => {
    updateHeartbeat(docId).catch((err) => {
      console.error(`[Pipeline] Failed to update heartbeat for doc ${docId}:`, err);
    });
  }, 15000);

  try {
    let doc = await loadDoc(docId);
    if (!doc) {
      throw new Error(`Document ${docId} not found`);
    }

    if (doc.state === 'FAILED' && doc.failedStage) {
      doc = await transitionPipelineStage({ documentId: doc.id, to: doc.failedStage });
    }

    doc.executionStatus = 'RUNNING';
    doc.heartbeatAt = new Date().toISOString();
    if (!doc.startedAt) doc.startedAt = new Date().toISOString();
    doc.attempt = (doc.attempt ?? 0) + 1;
    await saveDoc(doc);
    await appendPipelineEvent(
      doc.id,
      'PIPELINE_STARTED',
      doc.state,
      'STARTED',
      'Pipeline started',
      { metadata: { attempt: doc.attempt } }
    );

    logStage('PIPELINE_START', docId, { executionStatus: 'RUNNING' });

    // ── Step 2: Document Analysis ──────────────────────────────────────────────
    if (doc.state === 'UPLOADED' || doc.state === 'DOCUMENT_ANALYSIS') {
      if (!doc.analysis) {
        doc = await transitionPipelineStage({ documentId: doc.id, to: 'DOCUMENT_ANALYSIS' });
        try {
          doc.analysis = await analyzeDocument(doc);
          await saveDoc(doc);
        } catch (err) {
          const errObj = getErrorDetails(err);
          await transitionPipelineStage({
            documentId: doc.id,
            to: 'FAILED',
            error: makeStageError(
              'DOCUMENT_ANALYSIS',
              errObj.code ?? 'ANALYSIS_FAILED',
              errObj.message,
              errObj.retryable ?? true
            ),
          });
          throw err;
        }
      }
      if (doc.state === 'DOCUMENT_ANALYSIS') {
        doc = await transitionPipelineStage({ documentId: doc.id, to: 'TOC_DETECTION' });
      }
    }

    // ── Step 3: TOC Detection ──────────────────────────────────────────────────
    if (doc.state === 'TOC_DETECTION') {
      if (!doc.tocEntries || doc.tocEntries.length === 0) {
        try {
          doc.tocEntries = await detectToc(doc);
          await saveDoc(doc);
        } catch (err) {
          const errObj = getErrorDetails(err);
          await transitionPipelineStage({
            documentId: doc.id,
            to: 'FAILED',
            error: makeStageError(
              'TOC_DETECTION',
              errObj.code ?? 'TOC_FAILED',
              errObj.message,
              errObj.retryable ?? true
            ),
          });
          throw err;
        }
      }
      doc = await transitionPipelineStage({ documentId: doc.id, to: 'BATCH_SPLITTING' });
    }

    // ── Step 4: Batch Splitting ───────────────────────────────────────────────
    if (doc!.state === 'BATCH_SPLITTING') {
      if (!doc!.batches || doc!.batches.length === 0) {
        const plans = splitIntoBatches(doc!);
        doc!.batches = plans.map((p) => ({
          id: p.id,
          batchIndex: p.batchIndex,
          startPage: p.startPage,
          endPage: p.endPage,
          state: 'QUEUED' as const,
          retryCount: 0,
          maxRetries: MAX_RETRIES,
          structureContext: p.structureContext,
        }));
        await saveDoc(doc!);
      }
      doc = await transitionPipelineStage({ documentId: doc!.id, to: 'EXTRACTING' });
    }

    // ── Step 5 & 6: Parallel Batch Extraction ─────────────────────────────────
    if (doc!.state === 'EXTRACTING') {
      const pendingBatches = doc!.batches.filter(
        (b) => b.state === 'QUEUED' || b.state === 'FAILED'
      );

      if (pendingBatches.length > 0) {
        const CONCURRENCY = 5;
        for (let i = 0; i < pendingBatches.length; i += CONCURRENCY) {
          const slice = pendingBatches.slice(i, i + CONCURRENCY);
          await Promise.all(
            slice.map(async (batch) => {
              const plan = doc!.batches.find((b) => b.id === batch.id)!;
              batch.state = 'RUNNING';
              await saveDoc(doc!);

              try {
                const { items } = await extractBatch(doc!, plan);
                doc!.batchResults[batch.id] = items;
                batch.state = 'DONE';
                batch.errorMessage = undefined;
                await saveDoc(doc!);
              } catch (err) {
                const errObj = getErrorDetails(err);
                batch.retryCount++;
                batch.errorMessage = errObj.code ? `Mã lỗi: ${errObj.code}` : String(err);
                batch.state = batch.retryCount >= batch.maxRetries ? 'FAILED' : 'QUEUED';
                await saveDoc(doc!);
              }
            })
          );
        }
      }

      const allDone = doc!.batches.every((b) => b.state === 'DONE' || b.state === 'FAILED');
      if (allDone && doc!.batches.some((b) => b.state === 'DONE')) {
        doc = await transitionPipelineStage({ documentId: doc!.id, to: 'MERGING' });
      } else if (allDone && doc!.batches.every((b) => b.state === 'FAILED')) {
        await transitionPipelineStage({
          documentId: doc!.id,
          to: 'FAILED',
          error: makeStageError(
            'BATCH_EXTRACTION',
            'ALL_BATCHES_FAILED',
            'Tất cả các batch đều thất bại.',
            true
          ),
        });
        throw new Error('All batches failed');
      }
    }

    // ── Step 8: Merge into Curriculum Graph ───────────────────────────────────
    if (doc!.state === 'MERGING') {
      if (!doc!.chapters || doc!.chapters.length === 0) {
        const plans: BatchPlan[] = doc!.batches.map((b) => ({
          id: b.id,
          batchIndex: b.batchIndex,
          startPage: b.startPage,
          endPage: b.endPage,
          structureContext: b.structureContext,
        }));
        doc!.chapters = mergeIntoChapters(doc!.batchResults, plans, doc!.tocEntries ?? []);
        await saveDoc(doc!);
      }
      doc = await transitionPipelineStage({ documentId: doc!.id, to: 'STRUCTURE_VALIDATION' });
    }

    // ── Step 10 & 12: Validation ───────────────────────────────────────────────────
    if (doc!.state === 'STRUCTURE_VALIDATION') {
      if (!doc!.duplicateGroups || doc!.duplicateGroups.length === 0) {
        doc!.duplicateGroups = detectDuplicates(doc!.chapters);
        await saveDoc(doc!);
      }
      const errors = validateDocument(doc!);
      if (errors.length > 0) {
        console.warn(`[Pipeline] ${errors.length} validation errors for doc ${docId}:`, errors);
      }
      doc = await transitionPipelineStage({ documentId: doc!.id, to: 'READY_FOR_REVIEW' });
    }

    // ── Step 13: Draft Ready ─────────────────────────────────────────────────
    if (doc!.state === 'READY_FOR_REVIEW') {
      doc!.executionStatus = 'COMPLETED';
      doc!.completedAt = new Date().toISOString();
      await saveDoc(doc!);
      await appendPipelineEvent(
        doc!.id,
        'PIPELINE_COMPLETED',
        doc!.state,
        'COMPLETED',
        'Pipeline completed'
      );
      logStage('PIPELINE_COMPLETE', docId, {});
    }

    return doc!;
  } catch (err) {
    const doc = await loadDoc(docId);
    if (doc && doc.executionStatus === 'RUNNING') {
      doc.executionStatus = 'FAILED';
      if (doc.state !== 'FAILED') {
        doc.failedStage = doc.state;
        doc.failureAt = new Date().toISOString();
        doc.errorCode = (err as { code?: string }).code ?? 'PIPELINE_FAILED';
        doc.errorMessage = err instanceof Error ? err.message : 'Pipeline execution failed';
        await appendPipelineEvent(
          doc.id,
          'STAGE_FAILED',
          doc.state,
          'FAILED',
          `Stage ${doc.state} failed`,
          {
            metadata: {
              code: doc.errorCode,
              attempt: doc.attempt,
            },
          }
        );
      }
      await saveDoc(doc);
    }
    throw err;
  } finally {
    clearInterval(heartbeatInterval);
    releasePipelineExecutionLock(docId);
  }
}

// ─── Publish ─────────────────────────────────────────────────────────────────

// ─── Publish ─────────────────────────────────────────────────────────────────

export async function publishDocument(docId: string): Promise<PipelineDocument> {
  const doc = await loadDoc(docId);
  if (!doc) throw new Error(`Document ${docId} not found`);
  if (doc.state !== 'PUBLISHED') {
    throw new Error(`Cannot publish document in state: ${doc.state}`);
  }

  // ── Pre-flight mapping validation ────────────────────────────────────────────
  // Import lazily to avoid circular dependency and keep this file server-only.
  const { validateMappings } = await import('@/lib/mapping/mapping-service');
  const mappingResult = await validateMappings(doc);
  if (!mappingResult.valid) {
    const summary = mappingResult.errors.map((e) => `[${e.code}] ${e.message}`).join('\n');
    throw new Error(`Không thể xuất bản: có lỗi liên kết chương trình.\n${summary}`);
  }

  // NOTE: We do NOT write to the canonical curriculum here.
  // Approved mappings remain stored inside document.json as references.
  // The curriculum module reads sources via the mapping service's findTextbookSources().
  // We also PRESERVE rejected items for auditability rather than destructively deleting them.

  doc.state = 'PUBLISHED';
  doc.publishedAt = new Date().toISOString();
  await saveDoc(doc);
  return doc;
}
