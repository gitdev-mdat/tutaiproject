import type { ExamType } from '@/lib/content-import/types';
import type { Question, QuestionType } from '@/lib/question-bank/qb-types';
import {
  gradePracticeResponse,
  parsePracticeResponse,
  practiceExclusionReason,
} from '@/lib/practice/grading';
import { difficultyMix, type DifficultyMix } from '@/lib/practice/practice-sets';
import type { ExamRecord } from './exam-types';

/**
 * Rules for the exams students take, from the exam's published snapshot only.
 * Deterministic: no AI, no estimates.
 */

/** Extra seconds after the deadline for a save already on its way. */
export const EXAM_GRACE_SECONDS = 15;

export type ExamScope = 'NATIONAL' | 'SEMESTER' | 'CHAPTER' | 'OTHER';

export const EXAM_SCOPE_ORDER: ExamScope[] = ['NATIONAL', 'SEMESTER', 'CHAPTER', 'OTHER'];

export const EXAM_SCOPE_LABELS: Record<ExamScope, string> = {
  NATIONAL: 'Thi tốt nghiệp THPT',
  SEMESTER: 'Kiểm tra học kỳ',
  CHAPTER: 'Theo chương',
  OTHER: 'Đề khác',
};

/** Short form for filters and card labels. */
export const EXAM_SCOPE_SHORT: Record<ExamScope, string> = {
  NATIONAL: 'THPT',
  SEMESTER: 'Học kỳ',
  CHAPTER: 'Chương',
  OTHER: 'Khác',
};

export function examScope(type: ExamType | undefined): ExamScope {
  switch (type) {
    case 'NATIONAL_EXAM_MOCK':
    case 'OFFICIAL':
      return 'NATIONAL';
    case 'SEMESTER':
      return 'SEMESTER';
    case 'CHAPTER':
    case 'LESSON':
      return 'CHAPTER';
    default:
      return 'OTHER';
  }
}

export function examQuestions(exam: ExamRecord): Question[] {
  return exam.publishedSnapshot?.questions ?? [];
}

/**
 * A student can take the exam on the web when it is published, has a time
 * limit, and every question can be shown and graded automatically (the same
 * rule as practice: no images yet, no free-text answers, a solution present).
 */
export function isExamTakeable(exam: ExamRecord): boolean {
  const questions = examQuestions(exam);
  return (
    exam.publishStatus === 'PUBLISHED' &&
    questions.length > 0 &&
    (exam.durationMinutes ?? exam.publishedSnapshot?.metadata.durationMinutes ?? 0) > 0 &&
    questions.every((question) => practiceExclusionReason(question) === null)
  );
}

export function examDuration(exam: ExamRecord): number {
  return exam.publishedSnapshot?.metadata.durationMinutes ?? exam.durationMinutes ?? 0;
}

export function examName(exam: ExamRecord): string {
  return exam.publishedSnapshot?.metadata.name ?? exam.name;
}

export type ExamPart = { type: QuestionType; label: string; count: number };

const PART_LABELS: Partial<Record<QuestionType, string>> = {
  MULTIPLE_CHOICE_SINGLE: 'Trắc nghiệm nhiều phương án',
  MULTIPLE_CHOICE_MULTIPLE: 'Trắc nghiệm chọn nhiều đáp án',
  TRUE_FALSE: 'Trắc nghiệm đúng sai',
  NUMERIC: 'Trả lời ngắn',
};

/** The exam's structure as a student sees it: parts by question type, in exam format order. */
export function examParts(questions: Question[]): ExamPart[] {
  const order: QuestionType[] = [
    'MULTIPLE_CHOICE_SINGLE',
    'MULTIPLE_CHOICE_MULTIPLE',
    'TRUE_FALSE',
    'NUMERIC',
  ];
  return order
    .map((type) => ({
      type,
      label: PART_LABELS[type] ?? type,
      count: questions.filter((q) => q.questionType === type).length,
    }))
    .filter((part) => part.count > 0);
}

export interface ExamFacts {
  questionCount: number;
  durationMinutes: number;
  mix: DifficultyMix;
  /** ADVANCED or HIGH_DISCRIMINATION. */
  demandingCount: number;
  /** Distinct chapters the questions come from. */
  chapterCount: number;
  parts: ExamPart[];
}

export function examFacts(exam: ExamRecord): ExamFacts {
  const questions = examQuestions(exam);
  return {
    questionCount: questions.length,
    durationMinutes: examDuration(exam),
    mix: difficultyMix(questions),
    demandingCount: questions.filter(
      (q) => q.difficulty === 'ADVANCED' || q.difficulty === 'HIGH_DISCRIMINATION'
    ).length,
    chapterCount: new Set(questions.map((q) => q.chapterId).filter(Boolean)).size,
    parts: examParts(questions),
  };
}

export type ExamQuestionResult = { questionId: string; answered: boolean; correct: boolean };

/**
 * Grades every question from the stored responses. A missing or malformed
 * response is unanswered, never an error: the exam always gets a score.
 */
export function gradeExam(
  questions: Question[],
  responses: Record<string, unknown>
): { results: ExamQuestionResult[]; correct: number } {
  const results = questions.map((question) => {
    const raw = responses[question.id];
    if (raw === undefined || raw === null) {
      return { questionId: question.id, answered: false, correct: false };
    }
    try {
      const parsed = parsePracticeResponse(question, raw);
      return {
        questionId: question.id,
        answered: true,
        correct: gradePracticeResponse(question, parsed).correct,
      };
    } catch {
      return { questionId: question.id, answered: false, correct: false };
    }
  });
  return { results, correct: results.filter((result) => result.correct).length };
}

/** Score out of 10, one decimal, counting each question equally. */
export function scoreOutOfTen(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) / 10 : 0;
}

export function isPastDeadline(deadline: Date, now: Date = new Date()): boolean {
  return now.getTime() > deadline.getTime() + EXAM_GRACE_SECONDS * 1000;
}
