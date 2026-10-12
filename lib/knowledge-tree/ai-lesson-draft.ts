/**
 * AI lesson drafting — provider-agnostic core.
 *
 * Builds the prompt from curriculum context, calls an injected provider with a
 * timeout, and turns its raw text into a validated, sanitized draft. Nothing in
 * this module stores or publishes anything: the admin reviews the draft in the
 * editor and saves it through the normal article flow.
 */

import { z } from 'zod';
import {
  executeWithAbortableProviderTimeout,
  ProviderTimeoutError,
} from '@/lib/ai/provider-timeout';
import type { KnowledgeArticleBlock } from './knowledge-tree-types';

/** Blocks the AI may propose. References are excluded so sources are never invented. */
export const AI_DRAFT_BLOCK_TYPES = [
  'INTRO',
  'OBJECTIVE',
  'MAIN_CONTENT',
  'EXAMPLE',
  'RECAP',
  'COMMON_MISTAKE',
] as const satisfies ReadonlyArray<KnowledgeArticleBlock['type']>;

export type AiDraftBlockType = (typeof AI_DRAFT_BLOCK_TYPES)[number];
export type AiLessonDraft = Record<AiDraftBlockType, string>;

export const AI_DRAFT_LIMITS = {
  noteChars: 500,
  existingBlockChars: 6000,
  existingTotalChars: 20000,
  outputBlockChars: 6000,
  timeoutMs: 60_000,
} as const;

export interface LessonDraftContext {
  subject: string;
  grade: string;
  /** Chapter and any intermediate groups between grade and the knowledge item. */
  chapterPath: string[];
  title: string;
  description: string;
  /** Present only when the admin chose to send the current content. */
  existing?: Partial<Record<AiDraftBlockType, string>>;
  note?: string;
}

export type LessonDraftErrorCode =
  'UNAVAILABLE' | 'INVALID_REQUEST' | 'BUSY' | 'TIMEOUT' | 'QUOTA' | 'MALFORMED' | 'PROVIDER';

const ERROR_MESSAGES: Record<LessonDraftErrorCode, string> = {
  UNAVAILABLE: 'Tính năng soạn nháp bằng AI chưa được bật.',
  INVALID_REQUEST: 'Yêu cầu không hợp lệ.',
  BUSY: 'AI đang soạn nháp cho bài này. Chờ yêu cầu trước hoàn tất.',
  TIMEOUT: 'AI phản hồi quá lâu nên yêu cầu đã dừng. Thử lại sau ít phút.',
  QUOTA: 'Đã hết hạn mức gọi AI. Thử lại sau hoặc kiểm tra gói Gemini.',
  MALFORMED: 'AI trả về nội dung không đúng cấu trúc. Thử tạo lại.',
  PROVIDER: 'Dịch vụ AI đang gặp lỗi. Thử lại sau.',
};

const ERROR_STATUS: Record<LessonDraftErrorCode, number> = {
  UNAVAILABLE: 403,
  INVALID_REQUEST: 400,
  BUSY: 409,
  TIMEOUT: 504,
  QUOTA: 429,
  MALFORMED: 502,
  PROVIDER: 502,
};

export class LessonDraftError extends Error {
  constructor(
    public readonly code: LessonDraftErrorCode,
    message: string = ERROR_MESSAGES[code]
  ) {
    super(message);
    this.name = 'LessonDraftError';
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }
}

/** Provider contract: receives the full prompt, returns the model's raw JSON text. */
export type LessonDraftProvider = (prompt: string, signal: AbortSignal) => Promise<string>;

// ─── Request parsing ─────────────────────────────────────────────────────────

export interface LessonDraftRequest {
  existing?: Partial<Record<AiDraftBlockType, string>>;
  note?: string;
}

export function parseLessonDraftRequest(body: unknown): LessonDraftRequest {
  if (!body || typeof body !== 'object') return {};
  const input = body as Record<string, unknown>;
  const request: LessonDraftRequest = {};

  if (input.note !== undefined) {
    if (typeof input.note !== 'string') throw new LessonDraftError('INVALID_REQUEST');
    const note = input.note.trim();
    if (note.length > AI_DRAFT_LIMITS.noteChars) {
      throw new LessonDraftError(
        'INVALID_REQUEST',
        `Yêu cầu thêm dài quá ${AI_DRAFT_LIMITS.noteChars} ký tự.`
      );
    }
    if (note) request.note = note;
  }

  if (input.existing !== undefined && input.existing !== null) {
    if (typeof input.existing !== 'object') throw new LessonDraftError('INVALID_REQUEST');
    const existing: Partial<Record<AiDraftBlockType, string>> = {};
    let total = 0;
    for (const type of AI_DRAFT_BLOCK_TYPES) {
      const value = (input.existing as Record<string, unknown>)[type];
      if (value === undefined) continue;
      if (typeof value !== 'string') throw new LessonDraftError('INVALID_REQUEST');
      const text = value.trim();
      if (text.length > AI_DRAFT_LIMITS.existingBlockChars) {
        throw new LessonDraftError(
          'INVALID_REQUEST',
          `Mỗi phần gửi kèm tối đa ${AI_DRAFT_LIMITS.existingBlockChars} ký tự.`
        );
      }
      total += text.length;
      if (text) existing[type] = text;
    }
    if (total > AI_DRAFT_LIMITS.existingTotalChars) {
      throw new LessonDraftError(
        'INVALID_REQUEST',
        `Nội dung gửi kèm tối đa ${AI_DRAFT_LIMITS.existingTotalChars} ký tự.`
      );
    }
    if (Object.keys(existing).length) request.existing = existing;
  }

  return request;
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const BLOCK_GUIDE: Record<AiDraftBlockType, string> = {
  INTRO: 'Mở đầu 2–3 câu: kiến thức này là gì, vì sao cần học, gắn với điều học sinh đã biết.',
  OBJECTIVE: 'Mục tiêu: 2–4 gạch đầu dòng, mỗi dòng bắt đầu bằng "- " và một động từ đo được.',
  MAIN_CONTENT:
    'Nội dung chính: định nghĩa, tính chất, công thức, quy trình. Chia đoạn bằng một dòng trống; danh sách dùng "- " hoặc "1. ".',
  EXAMPLE: 'Ví dụ: ít nhất 1 ví dụ điển hình có đề bài và lời giải từng bước.',
  RECAP: 'Ghi nhớ: 3–5 gạch đầu dòng ngắn.',
  COMMON_MISTAKE: 'Lỗi hay gặp: 2–3 gạch đầu dòng, mỗi lỗi kèm cách tránh.',
};

function subjectGuidance(subject: string): string {
  const s = subject.toLocaleLowerCase('vi');
  if (/toán/.test(s)) {
    return 'Môn Toán: mọi biểu thức toán viết trong $...$ theo cú pháp LaTeX đơn giản (\\frac, \\sqrt, ^, _, \\le, \\ge, \\mathbb{R}). Lời giải ví dụ trình bày từng bước, có kết luận.';
  }
  if (/lý|lí|hóa|hoá|sinh/.test(s)) {
    return 'Môn khoa học tự nhiên: nêu rõ đại lượng, đơn vị SI; công thức viết trong $...$. Ví dụ là bài tập định lượng hoặc hiện tượng thực tế có giải thích.';
  }
  if (/văn|ngữ/.test(s)) {
    return 'Môn Ngữ văn: không dùng công thức; ví dụ là đoạn trích ngắn hoặc dàn ý có phân tích.';
  }
  if (/anh|english/.test(s)) {
    return 'Môn Tiếng Anh: giải thích bằng tiếng Việt, ví dụ câu tiếng Anh kèm nghĩa tiếng Việt.';
  }
  return 'Nếu có công thức, viết trong $...$.';
}

export function buildLessonDraftPrompt(context: LessonDraftContext): string {
  const path = [context.subject, context.grade, ...context.chapterPath].filter(Boolean).join(' › ');
  const existing = context.existing
    ? AI_DRAFT_BLOCK_TYPES.filter((type) => context.existing?.[type])
        .map((type) => `[${type}]\n${context.existing![type]}`)
        .join('\n\n')
    : '';

  return [
    'Bạn hỗ trợ giáo viên soạn bài học cho học sinh THPT Việt Nam trên nền tảng Tú Tài.',
    'Viết bản nháp bài học bằng tiếng Việt, đúng chương trình giáo dục phổ thông 2018, ngắn gọn, chính xác, dễ hiểu với học sinh.',
    'Không bịa số liệu, tên sách, trang sách hay nguồn tham khảo. Nếu không chắc một chi tiết, viết ở mức tổng quát.',
    'Chỉ dùng văn bản thuần: không HTML, không Markdown in đậm/tiêu đề, không khối mã.',
    subjectGuidance(context.subject),
    '',
    `Vị trí trong chương trình: ${path}`,
    `Tên kiến thức: ${context.title}`,
    context.description ? `Mô tả có sẵn: ${context.description}` : '',
    '',
    'Yêu cầu cho từng phần:',
    ...AI_DRAFT_BLOCK_TYPES.map((type) => `- ${type}: ${BLOCK_GUIDE[type]}`),
    existing
      ? `\nGiáo viên đã viết các phần dưới đây. Giữ ý đúng, bổ sung chỗ thiếu, sửa chỗ sai:\n${existing}`
      : '',
    context.note ? `\nYêu cầu thêm của giáo viên: ${context.note}` : '',
    '',
    'Trả về đúng một đối tượng JSON có các khóa INTRO, OBJECTIVE, MAIN_CONTENT, EXAMPLE, RECAP, COMMON_MISTAKE, giá trị là chuỗi.',
    'Trong chuỗi JSON, mỗi dấu \\ của LaTeX phải viết thành \\\\ (ví dụ \\\\notin, \\\\neq, \\\\frac, \\\\times, \\\\right).',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/** JSON schema handed to the provider for structured output. */
export const LESSON_DRAFT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: Object.fromEntries(AI_DRAFT_BLOCK_TYPES.map((type) => [type, { type: 'string' }])),
  required: ['OBJECTIVE', 'MAIN_CONTENT', 'EXAMPLE'],
} as const;

// ─── Output validation ───────────────────────────────────────────────────────

const HTML_TAG =
  /<\/?(?:a|abbr|b|br|code|div|em|font|h[1-6]|hr|i|iframe|img|li|link|meta|object|ol|p|pre|small|span|strong|style|sub|sup|table|tbody|td|th|thead|tr|u|ul|embed|svg|form|input|button)\b[^<>]*>/gi;

/** Reduces model output to the plain text + $math$ format the reader renders. */
export function sanitizeDraftText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/<(script|style|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(HTML_TAG, '')
    .replace(/^```[a-z]*\s*$/gim, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[*•]\s+/gm, '- ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, AI_DRAFT_LIMITS.outputBlockChars);
}

const requiredText = z.string().transform(sanitizeDraftText).pipe(z.string().min(20));
const optionalText = z
  .string()
  .optional()
  .transform((value) => sanitizeDraftText(value ?? ''));

const draftSchema = z.object({
  INTRO: optionalText,
  OBJECTIVE: requiredText,
  MAIN_CONTENT: requiredText,
  EXAMPLE: requiredText,
  RECAP: optionalText,
  COMMON_MISTAKE: optionalText,
});

function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
}

// A lone backslash before a LaTeX command whose name starts with a JSON escape
// letter (\notin, \frac, \times, \beta, \right) would parse as a newline, form
// feed, tab, backspace or carriage return and silently corrupt the formula.
const AMBIGUOUS_LATEX_ESCAPE =
  /(?<!\\)((?:\\\\)*)\\(?=(?:n(?:e|eq|eg|otin|abla)|t(?:imes|o|an|heta|ext|au|frac|riangle)|f(?:rac|orall)|b(?:eta|ar|inom|ig[a-z]*)|r(?:ight|ho))(?![A-Za-z]))/g;
// Any other backslash that is not a valid JSON escape (\in, \le, \sqrt, \underline).
const INVALID_JSON_ESCAPE = /(?<!\\)((?:\\\\)*)\\(?=[^"\\/bfnrtu]|u(?![0-9a-fA-F]{4}))/g;

/** Doubles backslashes the model left single inside LaTeX so JSON.parse keeps them. */
export function repairLatexEscapes(json: string): string {
  return json.replace(AMBIGUOUS_LATEX_ESCAPE, '$1\\\\').replace(INVALID_JSON_ESCAPE, '$1\\\\');
}

export function parseLessonDraft(raw: string): AiLessonDraft {
  let parsed: unknown;
  try {
    parsed = JSON.parse(repairLatexEscapes(stripJsonFence(raw)));
  } catch {
    throw new LessonDraftError('MALFORMED');
  }
  const result = draftSchema.safeParse(parsed);
  if (!result.success) throw new LessonDraftError('MALFORMED');
  return result.data;
}

// ─── Orchestration ───────────────────────────────────────────────────────────

export function classifyProviderError(error: unknown): LessonDraftError {
  if (error instanceof LessonDraftError) return error;
  if (error instanceof ProviderTimeoutError) return new LessonDraftError('TIMEOUT');
  const status = (error as { status?: unknown } | null)?.status;
  const message = error instanceof Error ? error.message : String(error);
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(message)) {
    return new LessonDraftError('QUOTA');
  }
  if (error instanceof Error && error.name === 'AbortError') return new LessonDraftError('TIMEOUT');
  return new LessonDraftError('PROVIDER');
}

function redactProviderMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/AIza[0-9A-Za-z_-]{10,}/g, '[redacted]').slice(0, 300);
}

export async function generateLessonDraft(
  context: LessonDraftContext,
  provider: LessonDraftProvider,
  options: { timeoutMs?: number } = {}
): Promise<AiLessonDraft> {
  let raw: string;
  try {
    raw = await executeWithAbortableProviderTimeout(
      (signal) => provider(buildLessonDraftPrompt(context), signal),
      options.timeoutMs ?? AI_DRAFT_LIMITS.timeoutMs
    );
  } catch (error) {
    const classified = classifyProviderError(error);
    // Server log only: the code, HTTP status and a trimmed provider message help tell
    // a wrong model id or a revoked key from a quota problem. Keys never appear here.
    console.warn('[ai-draft] provider failure', {
      code: classified.code,
      status: (error as { status?: unknown } | null)?.status,
      message: redactProviderMessage(error),
    });
    throw classified;
  }
  if (!raw?.trim()) throw new LessonDraftError('MALFORMED');
  return parseLessonDraft(raw);
}

// ─── Duplicate-request guard ─────────────────────────────────────────────────

const inFlight = new Set<string>();

/** Runs `task` unless a draft for the same key is already being generated. */
export async function withDraftLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  if (inFlight.has(key)) throw new LessonDraftError('BUSY');
  inFlight.add(key);
  try {
    return await task();
  } finally {
    inFlight.delete(key);
  }
}
