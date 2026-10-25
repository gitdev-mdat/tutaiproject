import 'server-only';

import { getSql } from '@/lib/db/postgres';
import { completionResult, learningDay, type CompletionResult } from './learning-streak';

/** How far back the streak is read: a longer streak shows as this many days. */
const WINDOW_DAYS = 400;

/**
 * Records that a student finished a lesson and returns what it did to their
 * streak. Safe to call again for the same lesson (a refresh, a second tab, a
 * retried request): the primary keys of tutai.lesson_completions and
 * tutai.learning_days turn every repeat into a no-op, and two concurrent calls
 * wait on each other's insert, so a day is awarded at most once.
 */
export async function recordLessonCompletion(
  studentId: string,
  lessonId: string,
  now: Date = new Date()
): Promise<CompletionResult> {
  const today = learningDay(now);
  return getSql().begin(async (tx) => {
    const first = await tx`
      insert into tutai.lesson_completions (student_id, lesson_id, completed_day)
      values (${studentId}, ${lessonId}, ${today})
      on conflict do nothing
      returning lesson_id`;
    const awarded = first.length
      ? await tx`
          insert into tutai.learning_days (student_id, day, lesson_id)
          values (${studentId}, ${today}, ${lessonId})
          on conflict do nothing
          returning day`
      : [];
    const rows = await tx<{ day: string }[]>`
      select day::text as day from tutai.learning_days
      where student_id = ${studentId}
        and day > ${today}::date - ${WINDOW_DAYS}::int
        and day <= ${today}::date
      order by day desc`;
    return completionResult(
      first.length > 0,
      awarded.length > 0,
      rows.map((row) => row.day),
      today
    );
  }) as Promise<CompletionResult>;
}
