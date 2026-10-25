import type { Question } from '@/lib/question-bank/qb-types';
import { X_OVER_LN_X } from './guides/x-over-ln-x';
import type { SolutionGuide, SolutionGuidePayload } from './types';

/**
 * Verified solution guides, by question. Only guides written and reviewed as
 * configuration are listed; nothing here is derived from extracted text.
 */
export const SOLUTION_GUIDES: SolutionGuide[] = [X_OVER_LN_X];

function matches(guide: SolutionGuide, question: Question): boolean {
  if (guide.match.questionIds.includes(question.id)) return true;
  const rule = guide.match.textbook;
  const source = question.textbookSource;
  return Boolean(
    rule &&
    source &&
    source.documentTitle === rule.documentTitle &&
    source.questionNumber === rule.questionNumber &&
    question.stem.includes(rule.stemIncludes)
  );
}

/**
 * The guide for a question, with the source notes that apply to its imported
 * explanation. Server-side only for students: it is attached to the feedback
 * of a graded answer, so it never reaches a student before the solution does.
 */
export function solutionGuideFor(question: Question): SolutionGuidePayload | null {
  const guide = SOLUTION_GUIDES.find((entry) => matches(entry, question));
  if (!guide) return null;
  const explanation = question.explanation ?? '';
  return {
    id: guide.id,
    derivative: guide.derivative,
    calculator: guide.calculator,
    verification: guide.verification,
    source: {
      ...guide.source,
      notes: guide.source.notes.filter((note) => !note.when || explanation.includes(note.when)),
    },
  };
}

/** Feedback with the question's guide, when there is one. */
export function withSolutionGuide<T extends object>(
  feedback: T,
  question: Question
): T & { guide?: SolutionGuidePayload } {
  const guide = solutionGuideFor(question);
  return guide ? { ...feedback, guide } : feedback;
}
