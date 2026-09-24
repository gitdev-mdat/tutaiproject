import type { KnowledgeTreeDocument } from '@/lib/knowledge-tree/knowledge-tree-types';
import { buildKnowledgeBreadcrumb } from '@/lib/question-bank/qb-knowledge-utils';
import type { Question } from '@/lib/question-bank/qb-types';

export type PracticeSelectedAnswer = string | string[] | null | undefined;
export type PracticeAnswers = Readonly<Record<string, PracticeSelectedAnswer>>;

export interface PracticeAnswerInput {
  questionId: string;
  selectedAnswer: PracticeSelectedAnswer;
}

export interface PracticeEvaluationItem {
  questionId: string;
  selectedAnswer: string | string[] | null;
  correctAnswer: string;
  isCorrect: boolean;
  isUnanswered: boolean;
  primaryKnowledgeNodeId?: string;
  explanation?: string;
}

export interface WeakKnowledgeArea {
  knowledgeNodeId: string | null;
  title: string;
  breadcrumb: string[];
  incorrectCount: number;
  questionIds: string[];
}

export interface PracticeEvaluationResult {
  total: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  score: number;
  percentage: number;
  isPerfect: boolean;
  items: PracticeEvaluationItem[];
  weakAreas: WeakKnowledgeArea[];
}

const UNMAPPED_TITLE = 'Chưa phân loại kiến thức';

function normalizeAnswer(answer: PracticeSelectedAnswer): string[] {
  if (answer === null || answer === undefined) return [];
  const values = Array.isArray(answer) ? answer : answer.split(',');
  return values
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
    .sort();
}

function answersMatch(selectedAnswer: PracticeSelectedAnswer, correctAnswer: string): boolean {
  const selected = normalizeAnswer(selectedAnswer);
  const correct = normalizeAnswer(correctAnswer);
  return (
    selected.length > 0 &&
    selected.length === correct.length &&
    selected.every((value, index) => value === correct[index])
  );
}

function isPracticeAnswerInputArray(
  answers: PracticeAnswers | readonly PracticeAnswerInput[]
): answers is readonly PracticeAnswerInput[] {
  return Array.isArray(answers);
}

function getAnswerMap(answers: PracticeAnswers | readonly PracticeAnswerInput[]): PracticeAnswers {
  if (isPracticeAnswerInputArray(answers)) {
    return Object.fromEntries(answers.map((answer) => [answer.questionId, answer.selectedAnswer]));
  }
  return answers;
}

function resolveKnowledgeArea(
  nodeId: string | undefined,
  tree: KnowledgeTreeDocument | undefined,
  questionIds: string[]
): WeakKnowledgeArea {
  if (!nodeId || !tree?.nodes.some((node) => node.id === nodeId)) {
    return {
      knowledgeNodeId: null,
      title: UNMAPPED_TITLE,
      breadcrumb: [],
      incorrectCount: questionIds.length,
      questionIds,
    };
  }

  const breadcrumb = buildKnowledgeBreadcrumb(nodeId, tree);
  return {
    knowledgeNodeId: nodeId,
    title: breadcrumb[breadcrumb.length - 1] ?? UNMAPPED_TITLE,
    breadcrumb,
    incorrectCount: questionIds.length,
    questionIds,
  };
}

/** Groups incorrect questions by their canonical primary knowledge node. */
export function groupWrongAnswersByKnowledgeNode(
  items: readonly PracticeEvaluationItem[],
  knowledgeTree?: KnowledgeTreeDocument
): WeakKnowledgeArea[] {
  const groups = new Map<string, string[]>();

  for (const item of items) {
    if (item.isCorrect) continue;
    const key = item.primaryKnowledgeNodeId ?? '__unmapped__';
    const questionIds = groups.get(key) ?? [];
    questionIds.push(item.questionId);
    groups.set(key, questionIds);
  }

  return [...groups.entries()]
    .map(([key, questionIds]) =>
      resolveKnowledgeArea(key === '__unmapped__' ? undefined : key, knowledgeTree, questionIds)
    )
    .sort((left, right) => {
      if (right.incorrectCount !== left.incorrectCount) {
        return right.incorrectCount - left.incorrectCount;
      }
      return left.title.localeCompare(right.title, 'vi');
    });
}

export function filterQuestionsByKnowledgeNode<
  TQuestion extends { primaryKnowledgeNodeId?: string },
>(questions: readonly TQuestion[], knowledgeNodeId: string): TQuestion[] {
  return questions.filter((question) => question.primaryKnowledgeNodeId === knowledgeNodeId);
}

/** Evaluates a practice submission without exposing correctness before submission. */
export function evaluatePractice(
  questions: readonly Question[],
  answers: PracticeAnswers | readonly PracticeAnswerInput[],
  knowledgeTree?: KnowledgeTreeDocument
): PracticeEvaluationResult {
  const answerMap = getAnswerMap(answers);
  const items = questions.map((question): PracticeEvaluationItem => {
    const selectedAnswer = answerMap[question.id];
    const unanswered = normalizeAnswer(selectedAnswer).length === 0;

    return {
      questionId: question.id,
      selectedAnswer: selectedAnswer == null ? null : selectedAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect: !unanswered && answersMatch(selectedAnswer, question.correctAnswer),
      isUnanswered: unanswered,
      primaryKnowledgeNodeId: question.primaryKnowledgeNodeId,
      explanation: question.explanation ?? question.solutionGuidance,
    };
  });

  const correctCount = items.filter((item) => item.isCorrect).length;
  const unansweredCount = items.filter((item) => item.isUnanswered).length;
  const total = questions.length;
  const incorrectCount = total - correctCount - unansweredCount;
  const percentage = total === 0 ? 0 : Math.round((correctCount / total) * 100);

  return {
    total,
    correctCount,
    incorrectCount,
    unansweredCount,
    score: correctCount,
    percentage,
    isPerfect: total > 0 && correctCount === total,
    items,
    weakAreas: groupWrongAnswersByKnowledgeNode(items, knowledgeTree),
  };
}

export const calculatePracticeResult = evaluatePractice;
export const evaluatePracticeResult = evaluatePractice;

export { UNMAPPED_TITLE };
