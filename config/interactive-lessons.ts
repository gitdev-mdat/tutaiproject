/**
 * Lessons shown with the interactive graph experience (pilot).
 *
 * Only the lessons listed here use it; every other lesson keeps the text
 * journey. To turn the pilot off without touching code, set the server
 * environment variable TUTAI_INTERACTIVE_LESSONS=off (or to a comma-separated
 * list of the lesson ids to keep on) and restart; no rebuild is needed, the
 * lesson page reads it on every request.
 *
 * `practice` are fallback functions for "Đến lượt em" and for the f′ = 0 case,
 * used only while the lesson's own "Hàm cho học sinh tự làm" field is empty.
 * They are functions, not answers: every question and check is computed from
 * them by lib/learning/function-model.ts.
 */
export const INTERACTIVE_LESSONS: Record<string, { practice: string[] }> = {
  // Toán 12 · Tính đơn điệu của hàm số (P1)
  'knowledge-45c34e43-ad2e-47bf-8845-68782b67cfb9': {
    practice: ['y = -x^3 + 3x', 'y = x^3'],
  },
};

/** The pilot settings for a lesson, or null when it keeps the text journey. */
export function interactiveLessonConfig(
  lessonId: string,
  setting: string | undefined = process.env.TUTAI_INTERACTIVE_LESSONS
): { practice: string[] } | null {
  const config = INTERACTIVE_LESSONS[lessonId];
  if (!config) return null;
  const value = setting?.trim();
  if (!value) return config;
  if (/^(off|false|0|none)$/i.test(value)) return null;
  const allowed = value.split(',').map((id) => id.trim());
  return allowed.includes(lessonId) ? config : null;
}
