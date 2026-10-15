import type { LearningLesson, LearningSubject } from '@/lib/knowledge-tree/learning-visibility';
import type { LessonPracticeSummary } from '@/lib/practice/practice-service';
import {
  lessonLearningState,
  type LessonLearningState,
  type LessonProgressState,
} from './lesson-progress';

/**
 * The study plan: one deterministic rule, shared by the Roadmap, the lesson
 * list, the end of a lesson and the end of a practice session, so they never
 * point the student to different places.
 *
 * Inputs are only what is already stored: the published curriculum (order of
 * chapters and lessons, by knowledge-node id), how far the student read each
 * lesson (this browser) and their practice attempts (database).
 *
 * "Completed" is evidence of learning, not of having opened a page: practice
 * passed (80%), or, for a lesson that has no practice questions yet, read to
 * its last part.
 */

export type Summaries = Record<string, LessonPracticeSummary>;

/** The program the Roadmap follows: the published Mathematics grade 12 curriculum (math-12-v1). */
export const ROADMAP_PROGRAM = { subjectId: 'subj_math', gradeId: 'grade_12', title: 'Toán 12' };

export interface StudyScope {
  title: string;
  subjectId: string;
  chapters: { id: string; title: string; lessons: LearningLesson[] }[];
  lessons: LearningLesson[];
}

/** The Roadmap's lessons, in curriculum order; null when nothing is published for the program. */
export function roadmapScope(catalog: LearningSubject[]): StudyScope | null {
  const subject =
    catalog.find((item) => item.id === ROADMAP_PROGRAM.subjectId) ??
    catalog.find((item) => item.title.toLocaleLowerCase('vi-VN').startsWith('toán'));
  if (!subject) return null;
  const grades = subject.grades.some((grade) => grade.id === ROADMAP_PROGRAM.gradeId)
    ? subject.grades.filter((grade) => grade.id === ROADMAP_PROGRAM.gradeId)
    : subject.grades;
  const chapters = grades.flatMap((grade) => grade.chapters);
  const lessons = chapters.flatMap((chapter) => chapter.lessons);
  if (!lessons.length) return null;
  return { title: ROADMAP_PROGRAM.title, subjectId: subject.id, chapters, lessons };
}

/** The lessons a lesson's "next step" is chosen from: the Roadmap's when it is in it, else its subject's. */
export function scopeLessonsFor(catalog: LearningSubject[], lessonId: string): LearningLesson[] {
  const roadmap = roadmapScope(catalog);
  if (roadmap?.lessons.some((lesson) => lesson.id === lessonId)) return roadmap.lessons;
  const subject = catalog.find((item) =>
    item.grades.some((grade) =>
      grade.chapters.some((chapter) => chapter.lessons.some((lesson) => lesson.id === lessonId))
    )
  );
  return subject ? subject.grades.flatMap((g) => g.chapters.flatMap((c) => c.lessons)) : [];
}

export interface LessonStanding {
  reading: LessonLearningState;
  practice: LessonPracticeSummary | undefined;
  hasPractice: boolean;
  passed: boolean;
  completed: boolean;
}

export function lessonStanding(
  lessonId: string,
  progress: LessonProgressState | null,
  summaries: Summaries
): LessonStanding {
  const reading = lessonLearningState(progress, lessonId);
  const practice = summaries[lessonId];
  const hasPractice = (practice?.questionCount ?? 0) > 0;
  const passed = !!practice?.best?.passed;
  return {
    reading,
    practice,
    hasPractice,
    passed,
    completed: passed || (!hasPractice && reading.kind === 'learned'),
  };
}

export type StandingTone = 'done' | 'active' | 'attention' | 'idle';

/** One short, factual status line per lesson. */
export function standingLabel(standing: LessonStanding): { text: string; tone: StandingTone } {
  const { reading, practice } = standing;
  const best = practice?.best;
  if (standing.passed)
    return {
      text: `Hoàn thành · luyện tập đạt ${best!.correctCount}/${best!.totalCount}`,
      tone: 'done',
    };
  if (standing.completed) return { text: 'Hoàn thành · đã học hết bài', tone: 'done' };
  if (practice?.inProgress)
    return {
      text: `Đang luyện tập ${practice.inProgress.answeredCount}/${practice.inProgress.totalCount} câu`,
      tone: 'active',
    };
  if (best)
    return {
      text: `${reading.kind === 'learned' ? 'Đã học · ' : ''}luyện tập ${best.correctCount}/${best.totalCount}, chưa đạt`,
      tone: 'attention',
    };
  if (reading.kind === 'learned') return { text: 'Đã học · chưa luyện tập', tone: 'active' };
  if (reading.kind === 'started')
    return {
      text: reading.total > 0 ? `Đang học · phần ${reading.stage}/${reading.total}` : 'Đã mở xem',
      tone: 'active',
    };
  return { text: 'Chưa học', tone: 'idle' };
}

export type NextStepKind = 'resume-practice' | 'resume-lesson' | 'practice' | 'retry' | 'start';

export interface NextStep {
  kind: NextStepKind;
  lesson: LearningLesson;
  /** The action, as a button label. */
  cta: string;
  /** Why this is the step, in one sentence. */
  reason: string;
  href: string;
}

export const lessonHref = (id: string) => `/student/lessons/${encodeURIComponent(id)}`;
export const practiceHref = (id: string, attemptId?: string) =>
  `${lessonHref(id)}/practice${attemptId ? `?attempt=${encodeURIComponent(attemptId)}` : ''}`;

/** Adds `from=roadmap` so the lesson and practice pages lead back to the Roadmap. */
export function withFrom(href: string, from: 'roadmap' | null | undefined) {
  if (from !== 'roadmap') return href;
  return `${href}${href.includes('?') ? '&' : '?'}from=roadmap`;
}

/**
 * The single next step, in the order a teacher would ask:
 * 1. finish the practice you left open;
 * 2. finish the lesson you left open;
 * 3. practise a lesson you have read but not yet passed;
 * 4. start the first lesson, in curriculum order, that is not completed.
 * Within 1–3 the lesson opened most recently comes first, then curriculum order.
 * `exclude` leaves out the lesson the student is on (end of a lesson or practice).
 */
export function pickNextStep(
  lessons: LearningLesson[],
  progress: LessonProgressState | null,
  summaries: Summaries,
  options: { exclude?: string } = {}
): NextStep | null {
  const pool = lessons.filter((lesson) => lesson.id !== options.exclude);
  const standing = (id: string) => lessonStanding(id, progress, summaries);
  const last = progress?.lastLessonId;
  const byRecency = [...pool].sort((a, b) => (a.id === last ? -1 : b.id === last ? 1 : 0));

  for (const lesson of byRecency) {
    const open = summaries[lesson.id]?.inProgress;
    // An optional retry of a lesson already passed does not outrank new work.
    if (open && !summaries[lesson.id]?.best?.passed)
      return {
        kind: 'resume-practice',
        lesson,
        cta: 'Làm tiếp luyện tập',
        reason: `Em đang luyện tập dở, đã làm ${open.answeredCount}/${open.totalCount} câu. Bài làm được lưu, em làm tiếp từ câu đang dừng.`,
        href: practiceHref(lesson.id, open.id),
      };
  }
  for (const lesson of byRecency) {
    const { reading, completed } = standing(lesson.id);
    if (!completed && reading.kind === 'started' && reading.total > 0)
      return {
        kind: 'resume-lesson',
        lesson,
        cta: 'Học tiếp',
        reason: `Em dừng ở phần ${reading.stage}/${reading.total} của bài này. Bài mở lại đúng chỗ đó.`,
        href: lessonHref(lesson.id),
      };
  }
  for (const lesson of byRecency) {
    const current = standing(lesson.id);
    if (current.reading.kind !== 'learned' || !current.hasPractice || current.passed) continue;
    const best = current.practice?.best;
    return best
      ? {
          kind: 'retry',
          lesson,
          cta: 'Luyện tập lại',
          reason: `Lần tốt nhất của em là ${best.correctCount}/${best.totalCount} câu đúng. Đạt 80% thì bài này mới tính là hoàn thành.`,
          href: practiceHref(lesson.id),
        }
      : {
          kind: 'practice',
          lesson,
          cta: 'Luyện tập',
          reason: `Em đã học hết bài. Luyện tập ${current.practice!.questionCount} câu, đạt 80% là hoàn thành bài này.`,
          href: practiceHref(lesson.id),
        };
  }
  const next = pool.find((lesson) => !standing(lesson.id).completed);
  if (!next) return null;
  const attempted = standing(next.id).practice?.best;
  const first = pool.every((lesson) => standing(lesson.id).reading.kind === 'new');
  return {
    kind: 'start',
    lesson: next,
    cta: standing(next.id).reading.kind === 'new' ? 'Bắt đầu học' : 'Học bài này',
    reason: attempted
      ? 'Em đã luyện tập bài này nhưng chưa đạt. Học hết bài trước rồi luyện lại sẽ chắc hơn.'
      : first
        ? 'Bài đầu tiên trong chương trình. Các bài được xếp theo thứ tự thầy cô đã soạn.'
        : 'Bài tiếp theo em chưa hoàn thành, theo thứ tự của chương trình.',
    href: lessonHref(next.id),
  };
}

/** The first lesson after `lessonId`, in curriculum order, that is not completed. */
export function nextFreshLesson(
  lessons: LearningLesson[],
  progress: LessonProgressState | null,
  summaries: Summaries,
  lessonId: string
): LearningLesson | null {
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  return (
    lessons
      .slice(index + 1)
      .find((lesson) => !lessonStanding(lesson.id, progress, summaries).completed) ?? null
  );
}

/** Lessons completed out of all lessons in scope; nothing is estimated. */
export function planProgress(
  lessons: LearningLesson[],
  progress: LessonProgressState | null,
  summaries: Summaries
) {
  const completed = lessons.filter(
    (lesson) => lessonStanding(lesson.id, progress, summaries).completed
  ).length;
  return { completed, total: lessons.length };
}
