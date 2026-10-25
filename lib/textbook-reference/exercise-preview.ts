import type { Question } from '@/lib/question-bank/qb-types';
import type { ExercisePracticeView } from './practice-state';
import { studentQuestionContent } from './student-diagram';

/**
 * A textbook exercise as the student would get it, for the Admin's preview
 * before it is published: the same stem, choices, answer and explanation the
 * import writes to the Question Bank. Nothing is stored.
 */
export function exercisePreviewQuestion(view: ExercisePracticeView): Question {
  const content = studentQuestionContent(view);
  return {
    id: `preview-${view.id}`,
    code: `Câu ${view.questionNumber ?? '?'}`,
    questionType: 'MULTIPLE_CHOICE_SINGLE',
    stem: view.stem,
    ...(content ? { content } : {}),
    options: view.choices.map((choice) => ({ key: choice.label, content: choice.text.trim() })),
    correctAnswer: view.answer ?? '',
    explanation: view.explanation.trim(),
    difficulty: 'FOUNDATIONAL',
  } as Question;
}
