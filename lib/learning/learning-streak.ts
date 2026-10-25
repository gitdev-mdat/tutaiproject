/**
 * The daily learning streak: how many consecutive learning days end today
 * (or yesterday, while today can still keep it going). Days are calendar days
 * in Vietnam, the app's one time zone, so a lesson finished at 23:50 and one
 * at 00:10 count on two days for every student, wherever the server runs.
 *
 * Pure date arithmetic on 'YYYY-MM-DD' strings; the database side is in
 * learning-streak-service.ts.
 */

export const STREAK_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** The calendar day of `now` in Vietnam, as 'YYYY-MM-DD'. */
export function learningDay(now: Date, timeZone = STREAK_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** The day before `day` ('YYYY-MM-DD'). */
export function previousDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Consecutive learning days ending exactly on `day` (0 if `day` is not one). */
export function streakEndingOn(days: ReadonlySet<string>, day: string): number {
  let count = 0;
  for (let cursor = day; days.has(cursor); cursor = previousDay(cursor)) count += 1;
  return count;
}

export type StreakSummary = {
  /** Consecutive days ending today, or ending yesterday if today is not yet one. */
  current: number;
  /** True when today is already a learning day. */
  today: boolean;
};

export function summarizeStreak(days: Iterable<string>, today: string): StreakSummary {
  const set = new Set(days);
  if (set.has(today)) return { current: streakEndingOn(set, today), today: true };
  return { current: streakEndingOn(set, previousDay(today)), today: false };
}

/**
 * What finishing a lesson did to the streak, as the server confirmed it:
 * - `awarded`: first completion of this lesson, and the first learning day
 *   today: the streak went from `previous` to `current`.
 * - `kept`: first completion of this lesson, but today was already a
 *   learning day (another lesson earned it).
 * - `repeat`: the lesson was completed before; nothing changes.
 */
export type CompletionResult =
  | { status: 'awarded'; previous: number; current: number; today: true }
  | { status: 'kept'; current: number; today: true }
  | { status: 'repeat'; current: number; today: boolean };

/** The response of POST /api/student/lessons/[lessonId]/complete. */
export type CompletionResponse =
  CompletionResult | { status: 'disabled' } | { status: 'error'; error: string };

/** Classifies a completion from what the two inserts did and the days after them. */
export function completionResult(
  firstCompletion: boolean,
  dayAwarded: boolean,
  days: Iterable<string>,
  today: string
): CompletionResult {
  const set = new Set(days);
  const summary = summarizeStreak(set, today);
  if (firstCompletion && dayAwarded) {
    return {
      status: 'awarded',
      previous: streakEndingOn(set, previousDay(today)),
      current: summary.current,
      today: true,
    };
  }
  if (firstCompletion) return { status: 'kept', current: summary.current, today: true };
  return { status: 'repeat', current: summary.current, today: summary.today };
}

/** The streak is on only where TUTAI_LEARNING_STREAK=on (it writes to the database). */
export function learningStreakEnabled(
  setting: string | undefined = process.env.TUTAI_LEARNING_STREAK
): boolean {
  return /^(on|true|1)$/i.test(setting?.trim() ?? '');
}
