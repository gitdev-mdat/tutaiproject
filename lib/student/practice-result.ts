import type { KnowledgeTreeDocument } from '@/lib/knowledge-tree/knowledge-tree-types';
import type { Question } from '@/lib/question-bank/qb-types';
import {
  calculatePracticeResult,
  evaluatePractice,
  evaluatePracticeResult,
  filterQuestionsByKnowledgeNode,
  groupWrongAnswersByKnowledgeNode,
  type PracticeAnswerInput,
  type PracticeAnswers,
  type PracticeEvaluationItem,
  type PracticeEvaluationResult,
  type PracticeSelectedAnswer,
  type WeakKnowledgeArea,
} from '@/lib/exam-sets/practice-evaluation';

export type {
  PracticeAnswerInput,
  PracticeAnswers,
  PracticeEvaluationItem,
  PracticeEvaluationResult,
  PracticeSelectedAnswer,
  WeakKnowledgeArea,
};

export {
  calculatePracticeResult,
  evaluatePractice,
  evaluatePracticeResult,
  filterQuestionsByKnowledgeNode,
  groupWrongAnswersByKnowledgeNode,
};

export interface StoredPracticeSummary {
  examSlug: string;
  examTitle: string;
  score: number;
  total: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  durationSeconds?: number;
  completedAt: string;
  weakAreas: Array<{
    nodeId: string;
    title: string;
    path: string[];
    count: number;
  }>;
  reviewItems: Array<{
    questionIndex: number;
    questionContent: string;
    selectedAnswer: string | null;
    correctAnswer: string;
    isCorrect: boolean;
    status: 'Đúng' | 'Sai' | 'Chưa trả lời';
    explanation?: string;
  }>;
}

const STORAGE_PREFIX = 'tutai-practice-result-';

export function saveStoredPracticeResult(examSlug: string, data: StoredPracticeSummary): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${examSlug}`, JSON.stringify(data));
  } catch {
    /* ignore localStorage errors */
  }
}

export function getStoredPracticeResult(examSlug: string): StoredPracticeSummary | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${examSlug}`);
    if (!raw) return null;
    return JSON.parse(raw) as StoredPracticeSummary;
  } catch {
    return null;
  }
}

/** Student-facing result calculation entry point. */
export function calculateStudentPracticeResult(
  questions: readonly Question[],
  answers: PracticeAnswers | readonly PracticeAnswerInput[],
  knowledgeTree?: KnowledgeTreeDocument
): PracticeEvaluationResult {
  return evaluatePractice(questions, answers, knowledgeTree);
}

/** Returns only areas requiring review, already sorted for display. */
export function getWeakKnowledgeAreas(result: PracticeEvaluationResult): WeakKnowledgeArea[] {
  return result.weakAreas;
}
