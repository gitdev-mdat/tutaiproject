import type { Question } from '@/lib/question-bank/qb-types';
import { validateForPublishing } from '@/lib/question-bank/qb-validation';
import type {
  ExamQuestionCriteria,
  ExamSelectionAllocation,
  ExamSelectionResult,
  ExamSelectionRule,
} from './exam-types';

export type ExamSelectionStrategy = 'SEQUENTIAL' | 'RANDOM';

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('vi');
}

export function isSelectableQuestion(question: Question): boolean {
  return question.editorialStatus === 'PUBLISHED' && validateForPublishing(question).valid;
}

/** Taxonomy used when replacing one question without persisting generation rules on the draft. */
export function criteriaForQuestion(question: Question): ExamQuestionCriteria {
  return {
    subjectId: question.subjectId,
    grade: question.grade,
    chapterId: question.chapterId,
    lessonId: question.lessonId,
    topicId: question.topicId,
    knowledgeNodeId: question.primaryKnowledgeNodeId,
    questionType: question.questionType,
    difficulty: question.difficulty,
    cognitiveLevel: question.cognitiveLevel,
  };
}

export function matchesExamCriteria(question: Question, criteria: ExamQuestionCriteria): boolean {
  if (!isSelectableQuestion(question)) return false;
  if (criteria.subjectId && question.subjectId !== criteria.subjectId) return false;
  if (criteria.grade && question.grade !== criteria.grade) return false;
  if (criteria.chapterId && question.chapterId !== criteria.chapterId) return false;
  if (criteria.lessonId && question.lessonId !== criteria.lessonId) return false;
  if (criteria.topicId && question.topicId !== criteria.topicId) return false;
  if (
    criteria.knowledgeNodeId &&
    question.primaryKnowledgeNodeId !== criteria.knowledgeNodeId &&
    !question.relatedKnowledgeNodeIds?.includes(criteria.knowledgeNodeId)
  )
    return false;
  if (criteria.questionType && question.questionType !== criteria.questionType) return false;
  if (criteria.difficulty && question.difficulty !== criteria.difficulty) return false;
  if (criteria.cognitiveLevel && question.cognitiveLevel !== criteria.cognitiveLevel) return false;
  if (criteria.usageContext && !question.usageContexts.includes(criteria.usageContext))
    return false;
  if (criteria.search) {
    const search = normalized(criteria.search);
    const haystack = normalized(
      [
        question.code,
        question.stem,
        question.source.sourceName,
        question.primaryKnowledgeNodeId,
        ...(question.relatedKnowledgeNodeIds ?? []),
        ...question.conceptCodes,
      ]
        .filter(Boolean)
        .join(' ')
    );
    if (!haystack.includes(search)) return false;
  }
  return true;
}

export function findQuestionCandidates(
  questions: readonly Question[],
  criteria: ExamQuestionCriteria = {},
  excludedQuestionIds: Iterable<string> = []
): Question[] {
  const excluded = new Set(excludedQuestionIds);
  return questions
    .filter((question) => !excluded.has(question.id) && matchesExamCriteria(question, criteria))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function selectQuestionsSequentially(
  questions: readonly Question[],
  rules: readonly ExamSelectionRule[],
  excludedQuestionIds: Iterable<string> = []
): ExamSelectionResult {
  return selectQuestionsByRules(questions, rules, excludedQuestionIds, 'SEQUENTIAL');
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

/**
 * Applies rule groups in order. RANDOM only shuffles each already-constrained pool;
 * it never relaxes criteria or samples from the full bank.
 */
export function selectQuestionsByRules(
  questions: readonly Question[],
  rules: readonly ExamSelectionRule[],
  excludedQuestionIds: Iterable<string> = [],
  strategy: ExamSelectionStrategy = 'SEQUENTIAL',
  random: () => number = Math.random
): ExamSelectionResult {
  const excluded = new Set(excludedQuestionIds);
  const questionIds: string[] = [];
  const allocations: ExamSelectionAllocation[] = [];

  for (const [ruleIndex, rule] of rules.entries()) {
    const requested = Number.isInteger(rule.count) && rule.count > 0 ? rule.count : 0;
    const criteria = Object.fromEntries(
      Object.entries(rule).filter(([key]) => key !== 'count')
    ) as ExamQuestionCriteria;
    const matching = findQuestionCandidates(questions, criteria, excluded);
    const available = strategy === 'RANDOM' ? shuffled(matching, random) : matching;
    const selected = available.slice(0, requested);
    for (const question of selected) {
      excluded.add(question.id);
      questionIds.push(question.id);
    }
    allocations.push({
      ruleIndex,
      criteria,
      requested,
      available: available.length,
      questionIds: selected.map((question) => question.id),
    });
  }

  const shortfalls = allocations
    .filter((allocation) => allocation.questionIds.length < allocation.requested)
    .map((allocation) => ({
      ruleIndex: allocation.ruleIndex,
      criteria: allocation.criteria,
      requested: allocation.requested,
      available: allocation.available,
      selected: allocation.questionIds.length,
      shortage: allocation.requested - allocation.questionIds.length,
    }));

  if (shortfalls.length > 0) {
    return {
      ok: false,
      error: 'INSUFFICIENT_QUESTIONS',
      message: 'Ngân hàng câu hỏi không đủ câu phù hợp với một hoặc nhiều tiêu chí.',
      // A failed allocation is atomic: callers must not apply a partial selection.
      questionIds: [],
      allocations,
      shortfalls,
    };
  }
  return { ok: true, questionIds, allocations };
}

export function selectQuestionsRandomly(
  questions: readonly Question[],
  rules: readonly ExamSelectionRule[],
  excludedQuestionIds: Iterable<string> = [],
  random: () => number = Math.random
): ExamSelectionResult {
  return selectQuestionsByRules(questions, rules, excludedQuestionIds, 'RANDOM', random);
}

export function findReplacementCandidates(
  questions: readonly Question[],
  criteria: ExamQuestionCriteria,
  currentExamQuestionIds: readonly string[]
): Question[] {
  return findQuestionCandidates(questions, criteria, currentExamQuestionIds);
}
