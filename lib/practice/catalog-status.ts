import { isPassingScore } from './practice-rules';
import type { AttemptState, LessonEntry } from './practice-catalog';

/**
 * What the Practice page says about one lesson or chapter set, and which
 * action it offers. Pure: every number comes from the stored attempts that
 * `practice-catalog.ts` reads, so the page can be checked against the data.
 *
 * Words used on the page:
 * - "Cao nhất c/t": the best whole-lesson (or whole-set) session. A retry of
 *   only the missed questions is never a score for the lesson.
 * - "cần n để đạt": the smallest score that reaches the pass ratio.
 * - "Xem n câu sai": the questions still wrong in the newest finished session
 *   (a whole session, or a retry of missed questions, then "câu còn sai").
 */

export type StatusTone = 'empty' | 'idle' | 'active' | 'attention' | 'done';

export type LessonAction =
  | { kind: 'read' }
  | { kind: 'start' }
  | { kind: 'resume'; attemptId: string }
  | { kind: 'mistakes'; attemptId: string; count: number; label: string }
  | { kind: 'retry' };

/** The smallest number of correct answers out of `total` that passes. */
export function passMark(total: number): number {
  for (let correct = 0; correct <= total; correct += 1) {
    if (isPassingScore(correct, total)) return correct;
  }
  return total;
}

/** One line of state. `count` is how many questions a new session has. */
export function attemptStatus(
  state: AttemptState,
  count: number
): { tone: StatusTone; text: string } {
  if (state.inProgress)
    return {
      tone: 'active',
      text: `Đang làm · ${state.inProgress.answered}/${state.inProgress.total} câu`,
    };
  if (state.best?.passed)
    return { tone: 'done', text: `Đạt · ${state.best.correct}/${state.best.total}` };
  if (state.best)
    return {
      tone: 'attention',
      text: `Cao nhất ${state.best.correct}/${state.best.total} · cần ${passMark(state.best.total)} để đạt`,
    };
  return { tone: 'idle', text: `${count} câu` };
}

export function lessonStatus(lesson: LessonEntry): { tone: StatusTone; text: string } {
  if (!lesson.questionCount && !lesson.inProgress && !lesson.best)
    return { tone: 'empty', text: 'Chưa có câu hỏi' };
  return attemptStatus(lesson, lesson.questionCount);
}

/**
 * The one action of a lesson row.
 * Missed questions are offered while the lesson is not passed, whatever the
 * newest session scored: a retry of 8 missed questions with 7 right is a high
 * ratio, but the lesson is still not passed and 1 question is still wrong.
 */
export function lessonAction(lesson: LessonEntry): LessonAction {
  if (lesson.inProgress) return { kind: 'resume', attemptId: lesson.inProgress.attemptId };
  if (!lesson.questionCount) return { kind: 'read' };
  const last = lesson.lastCompleted;
  if (last && !lesson.best?.passed && last.correct < last.total) {
    const count = last.total - last.correct;
    return {
      kind: 'mistakes',
      attemptId: last.attemptId,
      count,
      label: last.mode === 'MISTAKES' ? `Xem ${count} câu còn sai` : `Xem ${count} câu sai`,
    };
  }
  if (lesson.best) return { kind: 'retry' };
  return { kind: 'start' };
}

/** Lessons with practice, and how many of them are passed. */
export function passedCount(lessons: LessonEntry[]): { passed: number; total: number } {
  const withPractice = lessons.filter((lesson) => lesson.questionCount > 0);
  return {
    passed: withPractice.filter((lesson) => lesson.best?.passed).length,
    total: withPractice.length,
  };
}

/**
 * The lesson whose action is the page's main one when nothing is left open:
 * the first lesson, in curriculum order, that has practice and is not passed.
 */
export function nextLessonId(lessons: LessonEntry[]): string | null {
  return lessons.find((lesson) => lesson.questionCount > 0 && !lesson.best?.passed)?.id ?? null;
}
