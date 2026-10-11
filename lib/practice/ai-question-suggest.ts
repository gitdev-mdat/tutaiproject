/**
 * AI question suggestions for lesson practice. The model proposes questions,
 * each with the answer it believes is correct and a worked explanation; this
 * module only checks their shape. Nothing is saved here: the admin edits a
 * suggestion, saves it as a DRAFT, and must check the answer before it can go
 * to review and publication.
 */

import { z } from 'zod';
import { executeWithAbortableProviderTimeout } from '@/lib/ai/provider-timeout';
import {
  LessonDraftError,
  classifyProviderError,
  sanitizeDraftText,
  type LessonDraftProvider,
} from '@/lib/knowledge-tree/ai-lesson-draft';
import { parseDecimal } from './grading';

export const SUGGESTION_TYPES = ['MULTIPLE_CHOICE_SINGLE', 'TRUE_FALSE', 'NUMERIC'] as const;
export type SuggestionType = (typeof SUGGESTION_TYPES)[number];

export type QuestionSuggestion = {
  questionType: SuggestionType;
  stem: string;
  options: { key: string; content: string }[];
  statements: { content: string; isTrue: boolean }[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'FOUNDATIONAL' | 'INTERMEDIATE' | 'ADVANCED';
};

export type SuggestionContext = {
  path: string[];
  title: string;
  description: string;
  /** Text of the published lesson, so questions stay within what was taught. */
  lessonText: string;
  existingStems: string[];
  count: number;
  note?: string;
};

export const SUGGESTION_LIMITS = {
  maxCount: 5,
  noteChars: 300,
  lessonChars: 8000,
  timeoutMs: 60_000,
};

export const SUGGESTION_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          questionType: { type: 'string', enum: [...SUGGESTION_TYPES] },
          stem: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          statements: {
            type: 'array',
            items: {
              type: 'object',
              properties: { content: { type: 'string' }, isTrue: { type: 'boolean' } },
              required: ['content', 'isTrue'],
            },
          },
          correctAnswer: { type: 'string' },
          explanation: { type: 'string' },
          difficulty: { type: 'string', enum: ['FOUNDATIONAL', 'INTERMEDIATE', 'ADVANCED'] },
        },
        required: ['questionType', 'stem', 'explanation', 'difficulty'],
      },
    },
  },
  required: ['questions'],
} as const;

export function buildSuggestionPrompt(context: SuggestionContext): string {
  return [
    'Bạn là giáo viên Toán THPT Việt Nam, soạn câu hỏi luyện tập ngay sau một bài học.',
    `Chương trình: ${context.path.join(' › ')}`,
    `Tên kiến thức: ${context.title}`,
    context.description ? `Mô tả: ${context.description}` : '',
    context.lessonText
      ? `Nội dung bài học (chỉ hỏi trong phạm vi này):\n${context.lessonText.slice(0, SUGGESTION_LIMITS.lessonChars)}`
      : '',
    context.existingStems.length
      ? `Không lặp lại các câu đã có:\n${context.existingStems.map((s) => `- ${s}`).join('\n')}`
      : '',
    context.note ? `Yêu cầu thêm của quản trị viên: ${context.note}` : '',
    `Soạn ${context.count} câu. Mỗi câu thuộc một trong các dạng:`,
    '- MULTIPLE_CHOICE_SINGLE: đúng 4 lựa chọn trong "options" (không ghi chữ A/B/C/D), "correctAnswer" là A, B, C hoặc D.',
    '- TRUE_FALSE: 4 mệnh đề trong "statements", mỗi mệnh đề có "isTrue".',
    '- NUMERIC: "correctAnswer" là một số (dùng dấu chấm thập phân).',
    'Bắt buộc có "explanation": lời giải từng bước, đủ để học sinh tự hiểu vì sao đáp án đúng.',
    'Viết công thức bằng LaTeX trong $...$. Không dùng Markdown hay HTML.',
    'Chỉ đưa câu mà bạn chắc chắn về đáp án; tự giải lại trước khi trả lời.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

const KEYS = ['A', 'B', 'C', 'D'];

const rawQuestion = z.object({
  questionType: z.enum(SUGGESTION_TYPES),
  stem: z.string(),
  options: z.array(z.string()).optional(),
  statements: z.array(z.object({ content: z.string(), isTrue: z.boolean() })).optional(),
  correctAnswer: z.string().optional(),
  explanation: z.string(),
  difficulty: z.enum(['FOUNDATIONAL', 'INTERMEDIATE', 'ADVANCED']),
});

function toSuggestion(value: unknown): QuestionSuggestion | null {
  const parsed = rawQuestion.safeParse(value);
  if (!parsed.success) return null;
  const q = parsed.data;
  const stem = sanitizeDraftText(q.stem);
  const explanation = sanitizeDraftText(q.explanation);
  if (!stem || !explanation) return null;
  const base = { stem, explanation, difficulty: q.difficulty, options: [], statements: [] };
  switch (q.questionType) {
    case 'MULTIPLE_CHOICE_SINGLE': {
      const options = (q.options ?? []).map(sanitizeDraftText);
      const answer = q.correctAnswer?.trim().toUpperCase() ?? '';
      if (options.length !== 4 || options.some((o) => !o) || !KEYS.includes(answer)) return null;
      return {
        ...base,
        questionType: q.questionType,
        options: options.map((content, index) => ({ key: KEYS[index], content })),
        correctAnswer: answer,
      };
    }
    case 'TRUE_FALSE': {
      const statements = (q.statements ?? []).map((s) => ({
        content: sanitizeDraftText(s.content),
        isTrue: s.isTrue,
      }));
      if (statements.length < 2 || statements.some((s) => !s.content)) return null;
      return { ...base, questionType: q.questionType, statements, correctAnswer: '' };
    }
    case 'NUMERIC': {
      const answer = q.correctAnswer?.trim() ?? '';
      if (parseDecimal(answer) === null) return null;
      return { ...base, questionType: q.questionType, correctAnswer: answer };
    }
  }
}

/** Keeps the well-formed suggestions; fails only when none is usable. */
export function parseSuggestions(raw: string): QuestionSuggestion[] {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new LessonDraftError('MALFORMED');
  }
  const list = (body as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) throw new LessonDraftError('MALFORMED');
  const suggestions = list
    .map(toSuggestion)
    .filter((s): s is QuestionSuggestion => s !== null)
    .slice(0, SUGGESTION_LIMITS.maxCount);
  if (suggestions.length === 0) throw new LessonDraftError('MALFORMED');
  return suggestions;
}

export async function generateSuggestions(
  context: SuggestionContext,
  provider: LessonDraftProvider,
  timeoutMs = SUGGESTION_LIMITS.timeoutMs
): Promise<QuestionSuggestion[]> {
  let raw: string;
  try {
    raw = await executeWithAbortableProviderTimeout(
      (signal) => provider(buildSuggestionPrompt(context), signal),
      timeoutMs
    );
  } catch (error) {
    throw classifyProviderError(error);
  }
  if (!raw?.trim()) throw new LessonDraftError('MALFORMED');
  return parseSuggestions(raw);
}
