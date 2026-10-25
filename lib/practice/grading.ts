import type { Question, QuestionType } from '@/lib/question-bank/qb-types';
import { Q22_DERIVATIVE_GRAPH } from '@/lib/textbook-reference/student-diagram';

/**
 * Grading for lesson practice. Every rule is derived from the answer the
 * admin stored on the question; nothing is inferred or generated.
 *
 * SHORT_ANSWER is not graded here: its stored answer is a reference text and
 * a free-text match would mark correct answers wrong, so those questions are
 * kept out of practice (see `practiceExclusionReason`).
 */
export const PRACTICE_QUESTION_TYPES = [
  'MULTIPLE_CHOICE_SINGLE',
  'MULTIPLE_CHOICE_MULTIPLE',
  'TRUE_FALSE',
  'NUMERIC',
] as const satisfies readonly QuestionType[];

export type PracticeQuestionType = (typeof PRACTICE_QUESTION_TYPES)[number];

/** What the student sends for each question type. */
export type PracticeResponse =
  | { type: 'MULTIPLE_CHOICE_SINGLE'; choice: string }
  | { type: 'MULTIPLE_CHOICE_MULTIPLE'; choices: string[] }
  | { type: 'TRUE_FALSE'; statements: Record<string, boolean> }
  | { type: 'NUMERIC'; value: string };

export type StatementResult = {
  id: string;
  expected: boolean;
  given: boolean | null;
  correct: boolean;
};

export type GradeResult = {
  correct: boolean;
  /** For true/false: how many statements were right, out of how many. */
  statements?: StatementResult[];
};

export class PracticeResponseError extends Error {}

const LEGACY_STATEMENT_ID = 'statement';

function optionKeys(question: Question): Set<string> {
  return new Set(question.options.map((option) => option.key.trim().toUpperCase()));
}

function answerKeys(answer: string): string[] {
  return answer
    .split(',')
    .map((key) => key.trim().toUpperCase())
    .filter(Boolean);
}

export function parseDecimal(value: string): number | null {
  const normalized = value.trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The statements a true/false question is graded on, including the legacy single-statement form. */
export function trueFalseStatements(
  question: Question
): { id: string; content: string; isTrue: boolean }[] {
  if (question.trueFalseStatements?.length) return question.trueFalseStatements;
  const answer = question.correctAnswer.trim().toUpperCase();
  if (answer !== 'TRUE' && answer !== 'FALSE') return [];
  return [{ id: LEGACY_STATEMENT_ID, content: question.stem, isTrue: answer === 'TRUE' }];
}

/** Why a question cannot be used in practice, or null when it can. */
export function practiceExclusionReason(question: Question): string | null {
  const unsupportedQuestionImage = question.content?.some(
    (block) => block.type === 'IMAGE' && block.media.assetId !== Q22_DERIVATIVE_GRAPH
  );
  if (!(PRACTICE_QUESTION_TYPES as readonly string[]).includes(question.questionType)) {
    return 'Câu tự luận ngắn chưa chấm tự động được.';
  }
  if (
    question.hasMedia ||
    unsupportedQuestionImage ||
    question.options.some((option) => option.hasMedia)
  ) {
    return 'Câu có hình ảnh chưa hiển thị được trong luyện tập.';
  }
  if (!question.explanation?.trim()) return 'Thiếu lời giải.';
  switch (question.questionType) {
    case 'MULTIPLE_CHOICE_SINGLE':
    case 'MULTIPLE_CHOICE_MULTIPLE': {
      const keys = optionKeys(question);
      const answers = answerKeys(question.correctAnswer);
      if (answers.length === 0 || answers.some((key) => !keys.has(key))) {
        return 'Đáp án không khớp với các lựa chọn.';
      }
      if (question.questionType === 'MULTIPLE_CHOICE_SINGLE' && answers.length !== 1) {
        return 'Câu một đáp án nhưng lưu nhiều đáp án.';
      }
      return null;
    }
    case 'TRUE_FALSE':
      return trueFalseStatements(question).length > 0 ? null : 'Thiếu đáp án Đúng/Sai.';
    case 'NUMERIC':
      return parseDecimal(question.correctAnswer) === null ? 'Đáp án số không hợp lệ.' : null;
    default:
      return 'Loại câu hỏi không hỗ trợ.';
  }
}

/** Checks the shape of a student's response against the question it answers. */
export function parsePracticeResponse(question: Question, raw: unknown): PracticeResponse {
  const body = (raw ?? {}) as Record<string, unknown>;
  switch (question.questionType) {
    case 'MULTIPLE_CHOICE_SINGLE': {
      const choice = typeof body.choice === 'string' ? body.choice.trim().toUpperCase() : '';
      if (!optionKeys(question).has(choice))
        throw new PracticeResponseError('Hãy chọn một đáp án.');
      return { type: 'MULTIPLE_CHOICE_SINGLE', choice };
    }
    case 'MULTIPLE_CHOICE_MULTIPLE': {
      const keys = optionKeys(question);
      const choices = Array.isArray(body.choices)
        ? [...new Set(body.choices.map((key) => String(key).trim().toUpperCase()))]
        : [];
      if (choices.length === 0 || choices.some((key) => !keys.has(key))) {
        throw new PracticeResponseError('Hãy chọn ít nhất một đáp án.');
      }
      return { type: 'MULTIPLE_CHOICE_MULTIPLE', choices: choices.sort() };
    }
    case 'TRUE_FALSE': {
      const given = (body.statements ?? {}) as Record<string, unknown>;
      const statements: Record<string, boolean> = {};
      for (const statement of trueFalseStatements(question)) {
        const value = given[statement.id];
        if (typeof value !== 'boolean') {
          throw new PracticeResponseError('Hãy chọn Đúng hoặc Sai cho mọi mệnh đề.');
        }
        statements[statement.id] = value;
      }
      return { type: 'TRUE_FALSE', statements };
    }
    case 'NUMERIC': {
      const value = typeof body.value === 'string' ? body.value.trim() : '';
      if (parseDecimal(value) === null) throw new PracticeResponseError('Hãy nhập một số hợp lệ.');
      return { type: 'NUMERIC', value };
    }
    default:
      throw new PracticeResponseError('Câu hỏi này chưa luyện tập được.');
  }
}

export function gradePracticeResponse(question: Question, response: PracticeResponse): GradeResult {
  switch (response.type) {
    case 'MULTIPLE_CHOICE_SINGLE':
      return { correct: answerKeys(question.correctAnswer)[0] === response.choice };
    case 'MULTIPLE_CHOICE_MULTIPLE': {
      const expected = [...new Set(answerKeys(question.correctAnswer))].sort();
      return {
        correct:
          expected.length === response.choices.length &&
          expected.every((key, index) => key === response.choices[index]),
      };
    }
    case 'TRUE_FALSE': {
      const statements = trueFalseStatements(question).map((statement) => {
        const given = response.statements[statement.id] ?? null;
        return {
          id: statement.id,
          expected: statement.isTrue,
          given,
          correct: given === statement.isTrue,
        };
      });
      return { correct: statements.every((item) => item.correct), statements };
    }
    case 'NUMERIC': {
      const expected = parseDecimal(question.correctAnswer);
      const given = parseDecimal(response.value);
      if (expected === null || given === null) return { correct: false };
      return { correct: Math.abs(expected - given) <= 1e-9 * Math.max(1, Math.abs(expected)) };
    }
  }
}

/** The answer key shown to the student after they answered. */
export function revealAnswer(question: Question) {
  switch (question.questionType) {
    case 'TRUE_FALSE':
      return {
        statements: Object.fromEntries(
          trueFalseStatements(question).map((statement) => [statement.id, statement.isTrue])
        ),
      };
    case 'NUMERIC':
      return { value: question.correctAnswer.trim() };
    default:
      return { choices: answerKeys(question.correctAnswer) };
  }
}

/** The question as the student sees it before answering: no answer, no explanation. */
export function toPracticeQuestion(question: Question) {
  return {
    id: question.id,
    code: question.code,
    type: question.questionType as PracticeQuestionType,
    stem: question.stem,
    ...(question.content?.length ? { content: question.content } : {}),
    options: question.options.map((option) => ({ key: option.key, content: option.content })),
    statements:
      question.questionType === 'TRUE_FALSE'
        ? trueFalseStatements(question).map((statement) => ({
            id: statement.id,
            content: statement.content,
          }))
        : [],
    difficulty: question.difficulty,
  };
}

export type PracticeQuestion = ReturnType<typeof toPracticeQuestion>;

/** The feedback the student gets once a question is answered. */
export function toPracticeFeedback(question: Question, response: unknown, result: GradeResult) {
  return {
    questionId: question.id,
    correct: result.correct,
    response,
    answer: revealAnswer(question),
    statements: result.statements,
    explanation: question.explanation ?? '',
    solutionGuidance: question.solutionGuidance ?? '',
  };
}

export type PracticeFeedback = ReturnType<typeof toPracticeFeedback>;
