import type { ExerciseChoice } from './types';

export const Q22_DERIVATIVE_GRAPH = '/textbook-figures/derivative-sign-q22.svg';
export const VERIFIED_Q22_ARTIFACT_ID = 'art-34fb292f8fa955fd590e4a28b108232f';

/**
 * Q22's printed graph is a cubic-shaped derivative crossing at -1, 0 and 2.
 * Its solution states f'(x) < 0 on (0, 2), which agrees with the graph and
 * uniquely supports option B. The solution's separate left interval says -2
 * where the printed graph shows -1; that typo does not affect the answer.
 * Keep this narrowly tied to the verified question and its paired explanation.
 */
export function hasStudentVisibleDiagram(exercise: {
  id?: string;
  hasDiagram: boolean;
  stem: string;
  choices: ExerciseChoice[];
  explanation: string;
}): boolean {
  if (!exercise.hasDiagram) return true;
  if (exercise.id !== VERIFIED_Q22_ARTIFACT_ID) return false;
  const asksAboutDerivativeGraph =
    /đồ thị[\s\S]*y\s*=\s*f'\s*\(x\)/iu.test(exercise.stem) &&
    exercise.choices.some((choice) => choice.label === 'B' && /\(0\s*;\s*2\)/u.test(choice.text));
  const pairedSolutionSupportsAnswer =
    /f'\s*\(x\)\s*<\s*0/iu.test(exercise.explanation) &&
    /\(0\s*;\s*2\)/u.test(exercise.explanation);
  return asksAboutDerivativeGraph && pairedSolutionSupportsAnswer;
}

/** The question's content blocks for students: the stem and, for Q22, its redrawn graph. */
export function studentQuestionContent(view: {
  id: string;
  hasDiagram: boolean;
  stem: string;
  choices: ExerciseChoice[];
  explanation: string;
  printedPages: number[];
}) {
  if (!view.hasDiagram || !hasStudentVisibleDiagram(view)) return undefined;
  return [
    { id: `${view.id}-text`, type: 'TEXT' as const, text: view.stem },
    {
      id: `${view.id}-diagram`,
      type: 'IMAGE' as const,
      media: {
        assetId: Q22_DERIVATIVE_GRAPH,
        alt: 'Đồ thị y = f′(x), cắt trục hoành tại −1, 0 và 2',
        sourcePage: view.printedPages[0],
      },
    },
  ];
}
