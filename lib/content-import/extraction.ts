import 'server-only';

import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { executeWithAbortableProviderTimeout } from '@/lib/ai/provider-timeout';
import { GEMINI_MODELS } from '@/lib/config/models';
import { QUESTION_TYPE_VALUES, DIFFICULTY_VALUES } from '@/lib/question-bank/qb-types';
import { sourcePageFile } from './storage';
import type { ImportSession, QuestionCandidate } from './types';

const DOCUMENT_RECOVERY_PROVIDER_TIMEOUT_MS = 180_000;

const confidenceSchema = z.enum(['HIGH', 'REVIEW', 'UNCERTAIN']);
const extractionSchema = z
  .object({
    questions: z.array(
      z
        .object({
          number: z.number().int().positive(),
          sourcePageOrders: z.array(z.number().int().positive()).min(1),
          sourceBounds: z
            .object({
              x: z.number().min(0).max(100),
              y: z.number().min(0).max(100),
              width: z.number().min(0).max(100),
              height: z.number().min(0).max(100),
            })
            .optional(),
          questionType: z.enum(QUESTION_TYPE_VALUES),
          content: z.string(),
          options: z.array(z.object({ key: z.string(), content: z.string() }).strict()),
          statements: z.array(
            z
              .object({ key: z.string(), content: z.string(), correct: z.boolean().optional() })
              .strict()
          ),
          correctAnswer: z.string(),
          detectedSelectedAnswer: z.string(),
          explanation: z.string(),
          sharedContext: z.string(),
          questionAssetDescription: z.string(),
          subjectId: z.enum(['MATH', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY']).optional(),
          grade: z.union([z.literal(10), z.literal(11), z.literal(12)]).optional(),
          chapter: z.string(),
          lesson: z.string(),
          concept: z.string(),
          difficulty: z.enum(DIFFICULTY_VALUES),
          confidence: z
            .object({
              content: confidenceSchema,
              options: confidenceSchema,
              answer: confidenceSchema,
              asset: confidenceSchema,
              classification: confidenceSchema,
            })
            .strict(),
          warningCodes: z.array(
            z.enum([
              'MISSING_ANSWER',
              'SUSPECT_MATH',
              'CONTINUES_NEXT_PAGE',
              'DUPLICATE_OPTIONS',
              'MISSING_ASSET',
              'POSSIBLE_DUPLICATE',
              'HANDWRITING_DETECTED',
            ])
          ),
        })
        .strict()
    ),
  })
  .strict();

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'number',
          'sourcePageOrders',
          'questionType',
          'content',
          'options',
          'statements',
          'correctAnswer',
          'detectedSelectedAnswer',
          'explanation',
          'sharedContext',
          'questionAssetDescription',
          'chapter',
          'lesson',
          'concept',
          'difficulty',
          'confidence',
          'warningCodes',
        ],
        properties: {
          number: { type: 'integer', minimum: 1 },
          sourcePageOrders: { type: 'array', items: { type: 'integer', minimum: 1 } },
          sourceBounds: {
            type: 'object',
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' },
            },
            required: ['x', 'y', 'width', 'height'],
          },
          questionType: { type: 'string', enum: [...QUESTION_TYPE_VALUES] },
          content: { type: 'string' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: { key: { type: 'string' }, content: { type: 'string' } },
              required: ['key', 'content'],
            },
          },
          statements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                content: { type: 'string' },
                correct: { type: 'boolean' },
              },
              required: ['key', 'content'],
            },
          },
          correctAnswer: { type: 'string' },
          detectedSelectedAnswer: { type: 'string' },
          explanation: { type: 'string' },
          sharedContext: { type: 'string' },
          questionAssetDescription: { type: 'string' },
          subjectId: { type: 'string', enum: ['MATH', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY'] },
          grade: { type: 'integer', enum: [10, 11, 12] },
          chapter: { type: 'string' },
          lesson: { type: 'string' },
          concept: { type: 'string' },
          difficulty: { type: 'string', enum: [...DIFFICULTY_VALUES] },
          confidence: {
            type: 'object',
            properties: {
              content: { type: 'string', enum: ['HIGH', 'REVIEW', 'UNCERTAIN'] },
              options: { type: 'string', enum: ['HIGH', 'REVIEW', 'UNCERTAIN'] },
              answer: { type: 'string', enum: ['HIGH', 'REVIEW', 'UNCERTAIN'] },
              asset: { type: 'string', enum: ['HIGH', 'REVIEW', 'UNCERTAIN'] },
              classification: { type: 'string', enum: ['HIGH', 'REVIEW', 'UNCERTAIN'] },
            },
            required: ['content', 'options', 'answer', 'asset', 'classification'],
          },
          warningCodes: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'MISSING_ANSWER',
                'SUSPECT_MATH',
                'CONTINUES_NEXT_PAGE',
                'DUPLICATE_OPTIONS',
                'MISSING_ASSET',
                'POSSIBLE_DUPLICATE',
                'HANDWRITING_DETECTED',
              ],
            },
          },
        },
      },
    },
  },
};

const WARNING_COPY: Record<QuestionCandidate['warnings'][number]['code'], string> = {
  MISSING_ANSWER: 'Chưa tìm thấy đáp án',
  SUSPECT_MATH: 'Một ký hiệu toán học có thể nhận diện chưa chính xác',
  CONTINUES_NEXT_PAGE: 'Câu hỏi có thể tiếp tục ở trang kế tiếp',
  DUPLICATE_OPTIONS: 'Phát hiện hai đáp án có nội dung giống nhau',
  MISSING_ASSET: 'Hình minh họa chưa được ghép',
  POSSIBLE_DUPLICATE: 'Câu hỏi có thể trùng với dữ liệu hiện có',
  HANDWRITING_DETECTED:
    'Phát hiện nét viết tay gần phương án đã chọn. Nội dung này chỉ được lưu làm chú thích nguồn.',
};

const WARNING_ACTIONS: Record<
  QuestionCandidate['warnings'][number]['code'],
  QuestionCandidate['warnings'][number]['actions']
> = {
  MISSING_ANSWER: ['EDIT', 'NO_ANSWER'],
  SUSPECT_MATH: ['EDIT', 'RESELECT_REGION'],
  CONTINUES_NEXT_PAGE: ['MERGE_NEXT_PAGE', 'EDIT'],
  DUPLICATE_OPTIONS: ['EDIT'],
  MISSING_ASSET: ['RESELECT_REGION', 'EDIT'],
  POSSIBLE_DUPLICATE: ['CHECK_DUPLICATE', 'SKIP'],
  HANDWRITING_DETECTED: ['EDIT'],
};

type ExtractedQuestion = z.infer<typeof extractionSchema>['questions'][number];

function candidateFromExtractedQuestion(
  question: ExtractedQuestion,
  sourcePageIds: string[],
  sourcePages: number[]
): QuestionCandidate {
  const warningCodes = [...question.warningCodes];
  const correctAnswer = warningCodes.includes('MISSING_ANSWER')
    ? ''
    : question.correctAnswer.trim();
  if (!correctAnswer && !warningCodes.includes('MISSING_ANSWER')) {
    warningCodes.push('MISSING_ANSWER');
  }
  const warnings = warningCodes.map((code) => ({
    id: randomUUID(),
    code,
    message: WARNING_COPY[code],
    actions: WARNING_ACTIONS[code],
  }));
  const validationErrors: NonNullable<QuestionCandidate['validationErrors']> = [];
  if (!question.content.trim()) {
    validationErrors.push({
      code: 'MISSING_STEM',
      message: 'Question stem is required.',
      field: 'content',
    });
  }
  if (!correctAnswer) {
    validationErrors.push({
      code: 'MISSING_ANSWER',
      message: 'A valid answer is required before commit.',
      field: 'correctAnswer',
    });
  }
  const reviewLevel = validationErrors.length > 0 ? 'BLOCKING' : 'REVIEW';
  return {
    id: randomUUID(),
    number: question.number,
    sourcePageIds,
    sourcePages,
    sourceBounds: question.sourceBounds,
    questionType: question.questionType,
    content: question.content,
    options: question.options,
    statements: question.statements,
    correctAnswer,
    detectedSelectedAnswer: question.detectedSelectedAnswer,
    explanation: question.explanation,
    sharedContext: question.sharedContext,
    questionAssetDescription: question.questionAssetDescription,
    subjectId: question.subjectId,
    grade: question.grade,
    chapter: question.chapter,
    lesson: question.lesson,
    concept: question.concept,
    difficulty: question.difficulty,
    status: warnings.length > 0 ? 'WARNING' : 'UNREVIEWED',
    fieldConfidence: question.confidence,
    warnings,
    updatedAt: new Date().toISOString(),
    reviewLevel,
    validationErrors,
  };
}

function extractionPrompt(session: ImportSession): string {
  const pageManifest = session.pages
    .map(
      (page) =>
        `Trang ${page.order}: ${page.pageType}, xoay ${page.rotation}°, crop ${JSON.stringify(page.crop ?? null)}`
    )
    .join('\n');
  return `Trích xuất ${session.domain === 'EXAM' ? 'toàn bộ câu hỏi của đề thi' : 'đúng một câu hỏi'} từ các ảnh đính kèm.

Danh sách trang:
${pageManifest}

Quy tắc bắt buộc:
- Chỉ trích xuất nội dung nhìn thấy trong ảnh, không sáng tác và không tự bổ sung lời giải.
- Hỗ trợ: MULTIPLE_CHOICE_SINGLE, TRUE_FALSE, SHORT_ANSWER. Nếu không chắc, chọn loại gần nhất và đặt confidence phù hợp.
- Giữ công thức dưới dạng LaTeX khi có thể.
- correctAnswer chỉ lấy từ đáp án in chính thức hoặc lời giải rõ ràng. Một phương án được tô màu, khoanh, gạch hoặc viết tay phải nằm ở detectedSelectedAnswer, không được suy thành correctAnswer.
- Nếu câu kéo dài qua nhiều trang, ghi đủ sourcePageOrders và cảnh báo CONTINUES_NEXT_PAGE khi chưa chắc ghép đúng.
- sourceBounds dùng phần trăm 0–100 trên trang đầu của câu.
- Khi không có dữ liệu cho trường chuỗi, trả chuỗi rỗng. Không trả null.
- Mọi nội dung AI tạo ra là ứng viên cần người quản trị duyệt, không phải câu hỏi đã xuất bản.
Trả về JSON đúng schema.`;
}

export async function extractQuestionsFromSession(
  session: ImportSession
): Promise<QuestionCandidate[]> {
  const { gemini } = await import('@/lib/ai/gemini-client');
  const imageParts = await Promise.all(
    session.pages.map(async (page) => {
      const bytes = await fs.readFile(sourcePageFile(session.id, page.storedFileName));
      return {
        inlineData: { mimeType: page.mimeType, data: bytes.toString('base64') },
      };
    })
  );
  const response = await executeWithAbortableProviderTimeout(
    (abortSignal) =>
      gemini.models.generateContent({
        model: GEMINI_MODELS.documentAnalysis,
        contents: [
          {
            role: 'user',
            parts: [...imageParts, { text: extractionPrompt(session) }],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: RESPONSE_SCHEMA,
          temperature: 0.1,
          abortSignal,
        },
      }),
    120_000
  );
  const raw = response as { text?: string };
  if (!raw.text) throw new Error('Dịch vụ nhận diện không trả về dữ liệu.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.text);
  } catch {
    throw new Error('Dịch vụ nhận diện trả về dữ liệu không hợp lệ.');
  }
  const validated = extractionSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Không thể xác thực dữ liệu nhận diện: ${validated.error.issues[0]?.message ?? 'sai cấu trúc'}`
    );
  }
  return validated.data.questions.map((question) =>
    candidateFromExtractedQuestion(
      question,
      question.sourcePageOrders
        .map((order) => session.pages.find((page) => page.order === order)?.id)
        .filter((id): id is string => Boolean(id)),
      question.sourcePageOrders
    )
  );
}

function documentRecoveryPrompt(
  format: 'PDF' | 'DOCX',
  pageCount: number,
  pageNumbers?: number[]
): string {
  const scope = pageNumbers?.length
    ? `Chỉ phục hồi các câu hỏi bắt đầu hoặc chưa đọc được tại các trang sau: ${pageNumbers.join(', ')}. Không trả lại câu hỏi chỉ thuộc các trang khác.`
    : 'Trích xuất toàn bộ câu hỏi nhìn thấy trong tài liệu.';
  return `${scope} Tài liệu ${format} có ${pageCount} trang.\n\nQuy tắc bắt buộc:\n- Chỉ sao chép nội dung thực sự nhìn thấy; không đoán, không sáng tác, không tự giải bài và không suy diễn đáp án hoặc công thức bị thiếu.\n- correctAnswer chỉ lấy từ đáp án hoặc lời giải được in rõ ràng trong tài liệu. Nếu không có, trả chuỗi rỗng và warningCodes phải chứa MISSING_ANSWER.\n- Không dùng đáp án được tô màu, khoanh, gạch hoặc viết tay làm correctAnswer; chỉ ghi nhận tại detectedSelectedAnswer.\n- sourcePageOrders phải là số trang nguồn bắt đầu từ 1. sourceBounds là tọa độ phần trăm 0–100 trên trang đầu của câu.\n- Khi không đọc chắc nội dung, dùng chuỗi rỗng, confidence UNCERTAIN và cảnh báo phù hợp; không bù nội dung còn thiếu.\n- Mọi trường chuỗi không có dữ liệu phải là chuỗi rỗng, không trả null. Mọi kết quả là ứng viên cần người quản trị duyệt.\nTrả về JSON đúng schema.`;
}

async function extractDocumentWithPrompt(
  bytes: Buffer,
  format: 'PDF' | 'DOCX',
  pageCount: number,
  pageNumbers?: number[]
): Promise<QuestionCandidate[]> {
  const { gemini } = await import('@/lib/ai/gemini-client');
  const response = await executeWithAbortableProviderTimeout(
    (abortSignal) =>
      gemini.models.generateContent({
        model: GEMINI_MODELS.documentAnalysis,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType:
                    format === 'PDF'
                      ? 'application/pdf'
                      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  data: bytes.toString('base64'),
                },
              },
              { text: documentRecoveryPrompt(format, pageCount, pageNumbers) },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: RESPONSE_SCHEMA,
          temperature: 0.1,
          abortSignal,
        },
      }),
    DOCUMENT_RECOVERY_PROVIDER_TIMEOUT_MS
  );
  const raw = response as { text?: string };
  if (!raw.text) throw new Error('Dịch vụ nhận diện không trả về dữ liệu.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.text);
  } catch {
    throw new Error('Dịch vụ nhận diện trả về dữ liệu không hợp lệ.');
  }
  const validated = extractionSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Không thể xác thực dữ liệu nhận diện: ${validated.error.issues[0]?.message ?? 'sai cấu trúc'}`
    );
  }
  const questions = pageNumbers?.length
    ? validated.data.questions.filter((question) =>
        question.sourcePageOrders.some((pageNumber) => pageNumbers.includes(pageNumber))
      )
    : validated.data.questions;
  return questions.map((question) =>
    candidateFromExtractedQuestion(question, [], question.sourcePageOrders)
  );
}

export async function extractQuestionsFromDocument(
  bytes: Buffer,
  format: 'PDF' | 'DOCX',
  pageCount: number
): Promise<QuestionCandidate[]> {
  return extractDocumentWithPrompt(bytes, format, pageCount);
}

/** Uses the original document once, while constraining multimodal recovery to unresolved pages. */
export async function extractQuestionsFromDocumentPages(
  bytes: Buffer,
  format: 'PDF' | 'DOCX',
  pageCount: number,
  pageNumbers: number[]
): Promise<QuestionCandidate[]> {
  if (pageNumbers.length === 0) return [];
  return extractDocumentWithPrompt(
    bytes,
    format,
    pageCount,
    [...new Set(pageNumbers)].sort((a, b) => a - b)
  );
}
