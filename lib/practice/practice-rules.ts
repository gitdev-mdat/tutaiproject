import { DIFFICULTY_VALUES, type Question } from '@/lib/question-bank/qb-types';
import { practiceExclusionReason } from './grading';

/** At most this many questions in one practice session. */
export const PRACTICE_SESSION_SIZE = 10;
/** A lesson is "ready" for students once it has this many usable questions. */
export const PRACTICE_READY_THRESHOLD = 3;
/** Score (correct / total) at which a session counts as passed. */
export const PRACTICE_PASS_RATIO = 0.8;

const DIFFICULTY_ORDER = ['FOUNDATIONAL', 'INTERMEDIATE', 'ADVANCED', 'HIGH_DISCRIMINATION'];

export type PracticeQuestionState =
  'IN_PRACTICE' | 'DRAFT' | 'IN_REVIEW' | 'ARCHIVED' | 'PUBLISHED_ELSEWHERE' | 'NOT_USABLE';

/**
 * Where a question linked to a lesson stands for lesson practice, and why.
 * Students only receive IN_PRACTICE questions: published, free (OPEN), marked
 * for open practice, and gradable by `grading.ts`.
 */
export function practiceQuestionState(question: Question): {
  state: PracticeQuestionState;
  reason: string | null;
} {
  if (question.editorialStatus === 'DRAFT') return { state: 'DRAFT', reason: null };
  if (question.editorialStatus === 'IN_REVIEW') return { state: 'IN_REVIEW', reason: null };
  if (question.editorialStatus === 'ARCHIVED') return { state: 'ARCHIVED', reason: null };
  const exclusion = practiceExclusionReason(question);
  if (exclusion) return { state: 'NOT_USABLE', reason: exclusion };
  if (question.accessTier !== 'OPEN') {
    return {
      state: 'PUBLISHED_ELSEWHERE',
      reason: question.usageContexts.includes('PLUS_SPECIAL')
        ? 'Câu Plus: nằm trong bộ Tổng hợp của chương.'
        : 'Câu dành cho gói Plus.',
    };
  }
  if (!question.usageContexts.includes('OPEN_PRACTICE')) {
    return { state: 'PUBLISHED_ELSEWHERE', reason: 'Chưa bật "Luyện tập mở".' };
  }
  return { state: 'IN_PRACTICE', reason: null };
}

export function isInLessonPractice(question: Question, lessonId: string): boolean {
  return (
    question.primaryKnowledgeNodeId === lessonId &&
    practiceQuestionState(question).state === 'IN_PRACTICE'
  );
}

/** Easier questions first, then the order the admin created them in. */
export function orderPracticeQuestions(questions: Question[]): Question[] {
  return [...questions].sort(
    (a, b) =>
      DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id)
  );
}

export function pickLessonSession(questions: Question[], lessonId: string): Question[] {
  return orderPracticeQuestions(questions.filter((q) => isInLessonPractice(q, lessonId))).slice(
    0,
    PRACTICE_SESSION_SIZE
  );
}

/** Correct answers out of answered questions at one difficulty level. */
export type DifficultyResult = {
  difficulty: Question['difficulty'];
  correct: number;
  total: number;
};

/** Tallies answers per difficulty, easiest first; answers whose question is gone are left out. */
export function resultsByDifficulty(
  answers: { difficulty: Question['difficulty'] | undefined; correct: boolean }[]
): DifficultyResult[] {
  const tally = new Map<Question['difficulty'], DifficultyResult>();
  for (const { difficulty, correct } of answers) {
    if (!difficulty) continue;
    const row = tally.get(difficulty) ?? { difficulty, correct: 0, total: 0 };
    row.total += 1;
    if (correct) row.correct += 1;
    tally.set(difficulty, row);
  }
  return DIFFICULTY_VALUES.flatMap((difficulty) => tally.get(difficulty) ?? []);
}

export function isPassingScore(correct: number, total: number): boolean {
  return total > 0 && correct / total >= PRACTICE_PASS_RATIO;
}

/** At most this many quick questions are asked inside the lesson itself. */
export const LESSON_CHECK_LIMIT = 2;

/**
 * The questions asked inside the lesson, right after the worked example.
 * They come from the lesson's own practice questions: the ones the admin
 * pinned with "Hỏi nhanh trong bài" (LESSON_CHECK), otherwise the easiest ones.
 */
export function pickLessonChecks(questions: Question[], lessonId: string): Question[] {
  const pool = orderPracticeQuestions(questions.filter((q) => isInLessonPractice(q, lessonId)));
  const pinned = pool.filter((q) => q.usageContexts.includes('LESSON_CHECK'));
  if (pinned.length) return pinned.slice(0, LESSON_CHECK_LIMIT);
  const foundational = pool.filter((q) => q.difficulty === 'FOUNDATIONAL');
  return (foundational.length ? foundational : pool).slice(0, LESSON_CHECK_LIMIT);
}
