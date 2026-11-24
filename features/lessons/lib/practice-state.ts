import type { LessonPracticeOverview } from '@/lib/practice/practice-service';

/**
 * Where the student stands with a lesson's practice, read only from the saved
 * sessions (never estimated):
 * - `unavailable`: the overview could not be loaded (signed out or an error).
 * - `empty`: the lesson has no practice questions.
 * - `ready`: questions exist, no session yet.
 * - `opened`: a session was started but no question has been answered.
 * - `in-progress`: a session with at least one answer, not finished.
 * - `passed` / `retry`: a finished session reached / did not reach the pass mark.
 * An open session always wins over older finished ones: it is what "continue" resumes.
 */
export type PracticeState =
  'unavailable' | 'empty' | 'ready' | 'opened' | 'in-progress' | 'passed' | 'retry';

export function practiceState(overview: LessonPracticeOverview | null): PracticeState {
  if (!overview) return 'unavailable';
  if (overview.inProgress) return overview.inProgress.answeredCount > 0 ? 'in-progress' : 'opened';
  if (overview.best?.passed) return 'passed';
  if (overview.best) return 'retry';
  return overview.questionCount > 0 ? 'ready' : 'empty';
}
