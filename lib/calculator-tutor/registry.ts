import type { Question } from '@/lib/question-bank/qb-types';
import { OPERATION_LABEL } from './detect';
import { contentHash, generateGuide, type GeneratedGuide } from './generate';
import { X_OVER_LN_X } from './guides/x-over-ln-x';
import { parseLatex, sameFunction } from './latex';
import type { CalculatorGuideReview, SolutionGuide, SolutionGuidePayload } from './types';

/**
 * The calculator guide of a question, from its content alone:
 *
 * 1. A reviewed reference lesson, when the question's content matches it (the
 *    x/ln x lesson, kept as the reference and regression fixture).
 * 2. Otherwise the guide generated from the question and its explanation
 *    (`generate.ts`), shown to students unless Admin disabled it, and only once
 *    Admin accepted it when it carries a warning that needs review.
 *
 * Nothing here is keyed by question id. Admin's decision is stored on the
 * question itself (`calculatorGuideReview`, in the question bank JSON: no
 * migration) with the content hash it was made on, so editing the question
 * puts the guide back to review.
 */
export const REFERENCE_GUIDES: SolutionGuide[] = [X_OVER_LN_X];

const squash = (text: string) => text.replace(/\s+/g, '');

/** Generation is pure and fast; the cache only spares repeating it for the same content. */
const cache = new Map<string, GeneratedGuide>();
export function guideForContent(
  question: Pick<Question, 'stem' | 'explanation' | 'options'>
): GeneratedGuide {
  const input = {
    stem: question.stem,
    explanation: question.explanation,
    options: question.options,
  };
  const key = contentHash(input);
  let guide = cache.get(key);
  if (!guide) {
    guide = generateGuide(input);
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    cache.set(key, guide);
  }
  return guide;
}

function referenceFor(question: Question, generated: GeneratedGuide): SolutionGuide | null {
  if (generated.operation !== 'TABLE' || !generated.functionLatex) return null;
  const options = (question.options ?? []).map((option) => squash(option.content)).sort();
  return (
    REFERENCE_GUIDES.find((guide) => {
      const wanted = parseLatex(guide.match.functionLatex);
      const used = /\$f\(x\) = (.+?)\$/.exec(generated.functionLatex!)?.[1];
      const actual = used ? parseLatex(used) : null;
      return (
        wanted &&
        actual &&
        sameFunction(wanted, actual) &&
        JSON.stringify(guide.match.options.map(squash).sort()) === JSON.stringify(options)
      );
    }) ?? null
  );
}

/** Admin's decision, if it was made on the question's current content. */
export function currentReview(
  question: Question,
  generated: GeneratedGuide
): CalculatorGuideReview | null {
  const review = question.calculatorGuideReview;
  return review && review.sourceHash === generated.sourceHash ? review : null;
}

export function visibleToStudents(
  generated: GeneratedGuide,
  review: CalculatorGuideReview | null
): boolean {
  if (!generated.level) return false;
  if (review?.status === 'DISABLED' || review?.status === 'ORIGINAL_ONLY') return false;
  const needsReview = generated.warnings.some((warning) => warning.severity === 'review');
  return !needsReview || review?.status === 'ACCEPTED';
}

function withCorrections(generated: GeneratedGuide, review: CalculatorGuideReview | null) {
  const corrections = review?.corrections ?? {};
  const steps = generated.steps.map((step) =>
    corrections[step.id] ? { ...step, instruction: corrections[step.id] } : step
  );
  const calculator = generated.calculator && {
    ...generated.calculator,
    steps: generated.calculator.steps.map((step) =>
      corrections[step.id] ? { ...step, instruction: corrections[step.id] } : step
    ),
  };
  return { steps, calculator };
}

/**
 * The guide for a question, or null. For students (the default) only a guide
 * they may see; for Admin any guide, with the detection and warnings. Attached
 * to the feedback of a graded answer only, so it never reaches a student
 * before the solution does.
 */
export function solutionGuideFor(
  question: Question,
  audience: 'student' | 'admin' = 'student'
): SolutionGuidePayload | null {
  const generated = guideForContent(question);
  if (!generated.detection.present) return null;
  const review = currentReview(question, generated);
  const visible = visibleToStudents(generated, review);
  const admin = {
    detection: generated.detection,
    warnings: generated.warnings,
    sourceHash: generated.sourceHash,
    review,
    visibleToStudents: visible,
  };

  const reference = referenceFor(question, generated);
  if (reference) {
    if (review?.status === 'DISABLED' || review?.status === 'ORIGINAL_ONLY') {
      if (audience === 'student') return null;
    }
    const explanation = question.explanation ?? '';
    return {
      id: reference.id,
      level: 'A',
      origin: 'reference',
      derivative: reference.derivative,
      calculator: reference.calculator,
      steps: [],
      operation: { id: 'TABLE', label: OPERATION_LABEL.TABLE },
      model: { name: reference.calculator.model.name, named: false, note: generated.model.note },
      verification: reference.verification,
      source: {
        ...reference.source,
        notes: reference.source.notes.filter(
          (note) => !note.when || explanation.includes(note.when)
        ),
      },
      ...(audience === 'admin'
        ? {
            admin: {
              ...admin,
              visibleToStudents: !(
                review?.status === 'DISABLED' || review?.status === 'ORIGINAL_ONLY'
              ),
            },
          }
        : {}),
    };
  }

  if (!generated.level || (audience === 'student' && !visible)) return null;
  const { steps, calculator } = withCorrections(generated, review);
  return {
    id: `generated-${generated.sourceHash}`,
    level: generated.level,
    origin: 'generated',
    mathText: generated.mathText ?? undefined,
    calculator,
    steps,
    operation: {
      id: generated.operation ?? 'GENERIC',
      label: OPERATION_LABEL[generated.operation ?? 'GENERIC'],
    },
    model: generated.model,
    source: { label: 'Lời giải gốc đã nhập (giữ nguyên văn)', notes: generated.notes },
    verification: {
      status: review?.status === 'ACCEPTED' ? 'ACCEPTED' : 'GENERATED',
      by:
        review?.status === 'ACCEPTED'
          ? `Admin${review.by ? ` (${review.by})` : ''}`
          : 'Tú Tài (tự động)',
      on: review?.status === 'ACCEPTED' ? review.at.slice(0, 10) : '',
      checks: generated.checks,
    },
    ...(audience === 'admin' ? { admin } : {}),
  };
}

/** Feedback with the question's guide, when there is one for this audience. */
export function withSolutionGuide<T extends object>(
  feedback: T,
  question: Question,
  audience: 'student' | 'admin' = 'student'
): T & { guide?: SolutionGuidePayload } {
  const guide = solutionGuideFor(question, audience);
  return guide ? { ...feedback, guide } : feedback;
}
