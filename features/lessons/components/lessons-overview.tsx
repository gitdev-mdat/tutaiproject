'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleDashed,
  ClipboardCheck,
  PlayCircle,
  RotateCcw,
} from 'lucide-react';
import { useStudentShell } from '@/components/student/student-shell';
import {
  flattenSubjectLessons,
  type LearningLesson,
  type LearningSubject,
} from '@/lib/knowledge-tree/learning-visibility';
import type { LessonPracticeSummary } from '@/lib/practice/practice-service';
import {
  lessonLearningState,
  useLessonProgress,
  type LessonLearningState,
  type LessonProgressState,
} from '../lib/lesson-progress';

type Summaries = Record<string, LessonPracticeSummary>;

const lessonHref = (id: string) => `/student/lessons/${encodeURIComponent(id)}`;

export function LessonsOverview({
  catalog,
  subject,
  summaries = {},
}: {
  catalog: LearningSubject[];
  subject: LearningSubject;
  summaries?: Summaries;
}) {
  const { model } = useStudentShell();
  const progress = useLessonProgress(model.identity.id);
  const lessons = flattenSubjectLessons(subject);
  const stateOf = (id: string) => lessonLearningState(progress, id);
  const learnedCount = lessons.filter((lesson) => stateOf(lesson.id).kind === 'learned').length;
  const passedCount = lessons.filter((lesson) => summaries[lesson.id]?.best?.passed).length;
  const chapterCount = subject.grades.reduce((sum, grade) => sum + grade.chapters.length, 0);

  return (
    <div className="mx-auto w-full max-w-[880px] pb-10">
      <header className="pt-1">
        <p className="text-[13px] font-semibold text-blue-600">Bài học</p>
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight text-[#091224] sm:text-[34px]">
          {subject.title}
        </h1>
        <p className="mt-1.5 text-[15px] text-slate-500">
          {subject.grades.map((grade) => grade.title).join(', ')} · {chapterCount} chương ·{' '}
          {lessons.length} bài đang mở
        </p>
        {catalog.length > 1 && (
          <nav aria-label="Chọn môn học" className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {catalog.map((item) => (
              <Link
                key={item.id}
                href={`/student/lessons?subject=${encodeURIComponent(item.id)}`}
                aria-current={item.id === subject.id ? 'page' : undefined}
                className={`h-9 shrink-0 rounded-full px-4 text-sm font-semibold leading-9 transition-colors ${
                  item.id === subject.id
                    ? 'bg-[#091224] text-white'
                    : 'bg-white text-slate-600 ring-1 ring-inset ring-[#E5EBF3] hover:bg-slate-50'
                }`}
              >
                {item.title}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {progress ? (
        <NextStep
          lessons={lessons}
          progress={progress}
          summaries={summaries}
          learnedCount={learnedCount}
          passedCount={passedCount}
        />
      ) : (
        <div aria-hidden="true" className="mt-6 h-[188px] rounded-[20px] bg-[#F4F8FF]" />
      )}

      <div className="mt-8 space-y-8">
        {subject.grades.map((grade) => (
          <section key={grade.id} aria-labelledby={`grade-${grade.id}`}>
            {subject.grades.length > 1 && (
              <h2
                id={`grade-${grade.id}`}
                className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400"
              >
                {grade.title}
              </h2>
            )}
            <ol className="space-y-4">
              {grade.chapters.map((chapter, index) => {
                const learned = chapter.lessons.filter(
                  (lesson) => stateOf(lesson.id).kind === 'learned'
                ).length;
                return (
                  <li
                    key={chapter.id}
                    className="overflow-hidden rounded-2xl border border-[#E5EBF3] bg-white"
                  >
                    <div className="flex items-start gap-4 px-5 pb-2 pt-5 sm:px-6">
                      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-sm font-bold text-blue-600">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3
                          id={subject.grades.length > 1 ? undefined : `grade-${grade.id}`}
                          className="text-[17px] font-bold leading-snug text-[#091224]"
                        >
                          {chapter.title}
                        </h3>
                        <p className="mt-0.5 text-[13px] text-slate-500">
                          {chapter.lessons.length} bài
                          {progress &&
                            learned > 0 &&
                            ` · đã học xong ${learned}/${chapter.lessons.length}`}
                        </p>
                      </div>
                    </div>
                    <ul className="px-2 pb-2 sm:px-3">
                      {chapter.lessons.map((lesson) => (
                        <LessonRow
                          key={lesson.id}
                          lesson={lesson}
                          state={progress ? stateOf(lesson.id) : null}
                          summary={summaries[lesson.id]}
                        />
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

// ─── One lesson ──────────────────────────────────────────────────────────────

function learningLabel(state: LessonLearningState) {
  if (state.kind === 'learned') return 'Đã học xong';
  if (state.kind === 'started')
    return state.total > 0 ? `Đang học · phần ${state.stage}/${state.total}` : 'Đã mở xem';
  return null;
}

function practiceLabel(summary: LessonPracticeSummary | undefined) {
  if (!summary) return null;
  if (summary.inProgress)
    return {
      text: `Đang làm luyện tập ${summary.inProgress.answeredCount}/${summary.inProgress.totalCount}`,
      tone: 'bg-blue-50 text-blue-700',
    };
  if (summary.best)
    return summary.best.passed
      ? {
          text: `Luyện tập đạt ${summary.best.correctCount}/${summary.best.totalCount}`,
          tone: 'bg-emerald-50 text-emerald-700',
        }
      : {
          text: `Luyện tập ${summary.best.correctCount}/${summary.best.totalCount} · chưa đạt`,
          tone: 'bg-amber-50 text-amber-800',
        };
  return null;
}

function LessonRow({
  lesson,
  state,
  summary,
}: {
  lesson: LearningLesson;
  state: LessonLearningState | null;
  summary?: LessonPracticeSummary;
}) {
  const learning = state ? learningLabel(state) : null;
  const practice = practiceLabel(summary);
  return (
    <li>
      <Link
        href={lessonHref(lesson.id)}
        className="group flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[#F4F8FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        data-testid="lesson-row"
        data-state={state?.kind ?? 'unknown'}
      >
        <StateIcon state={state} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-snug text-slate-800 group-hover:text-[#091224]">
            {lesson.title}
          </span>
          {lesson.description && (
            <span className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-slate-500">
              {lesson.description}
            </span>
          )}
          {(learning || practice) && (
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              {learning && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    state?.kind === 'learned'
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-blue-50 text-blue-700'
                  }`}
                  data-testid="lesson-learning-state"
                >
                  {learning}
                </span>
              )}
              {practice && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${practice.tone}`}
                  data-testid="lesson-practice-result"
                >
                  {practice.text}
                </span>
              )}
            </span>
          )}
        </span>
        <ArrowRight
          aria-hidden="true"
          className="mt-1 size-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500"
        />
      </Link>
    </li>
  );
}

function StateIcon({ state }: { state: LessonLearningState | null }) {
  if (state?.kind === 'learned')
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  if (state?.kind === 'started')
    return (
      <span aria-hidden="true" className="mt-0.5 grid size-6 shrink-0 place-items-center">
        <CircleDashed className="size-6 text-blue-500" strokeWidth={2.25} />
      </span>
    );
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 size-6 shrink-0 rounded-full border-2 border-slate-200"
    />
  );
}

// ─── The single next step ────────────────────────────────────────────────────

type Step = {
  eyebrow: string;
  lesson: LearningLesson;
  detail: string;
  href: string;
  cta: string;
  icon: typeof BookOpen;
};

/**
 * One recommendation, in the order a teacher would ask: finish the practice
 * you left open, finish the lesson you left open, practise a lesson you
 * finished reading, then start the next lesson you have not opened.
 */
function pickNextStep(
  lessons: LearningLesson[],
  progress: LessonProgressState,
  summaries: Summaries
): Step | null {
  const state = (id: string) => lessonLearningState(progress, id);
  const last = progress.lastLessonId;
  const byRecency = [...lessons].sort((a, b) => (a.id === last ? -1 : b.id === last ? 1 : 0));

  for (const lesson of byRecency) {
    const open = summaries[lesson.id]?.inProgress;
    if (open)
      return {
        eyebrow: 'Em đang làm dở',
        lesson,
        detail: `Phần luyện tập còn ${open.totalCount - open.answeredCount} câu chưa trả lời.`,
        href: `${lessonHref(lesson.id)}/practice?attempt=${open.id}`,
        cta: 'Làm tiếp luyện tập',
        icon: ClipboardCheck,
      };
  }
  for (const lesson of byRecency) {
    const current = state(lesson.id);
    if (current.kind === 'started' && current.total > 0)
      return {
        eyebrow: 'Em đang học dở',
        lesson,
        detail: `Dừng ở phần ${current.stage}/${current.total}. Bài sẽ mở lại đúng chỗ đó.`,
        href: lessonHref(lesson.id),
        cta: 'Học tiếp',
        icon: PlayCircle,
      };
  }
  for (const lesson of byRecency) {
    const summary = summaries[lesson.id];
    if (
      state(lesson.id).kind === 'learned' &&
      summary &&
      summary.questionCount > 0 &&
      !summary.best?.passed
    )
      return {
        eyebrow: summary.best ? 'Nên luyện lại' : 'Đã học xong, chưa luyện tập',
        lesson,
        detail: summary.best
          ? `Lần tốt nhất ${summary.best.correctCount}/${summary.best.totalCount} câu đúng. Cần 80% để đạt.`
          : `${summary.questionCount} câu, chấm ngay từng câu, có lời giải.`,
        href: `${lessonHref(lesson.id)}/practice`,
        cta: summary.best ? 'Luyện tập lại' : 'Luyện tập',
        icon: summary.best ? RotateCcw : ClipboardCheck,
      };
  }
  const next = lessons.find((lesson) => state(lesson.id).kind !== 'learned');
  if (next) {
    const fresh = state(next.id).kind === 'new';
    const started = lessons.some((lesson) => state(lesson.id).kind !== 'new');
    return {
      eyebrow: started ? 'Bài tiếp theo' : 'Bắt đầu từ đây',
      lesson: next,
      detail: next.description || next.chapterTitle,
      href: lessonHref(next.id),
      cta: fresh ? 'Bắt đầu học' : 'Học bài này',
      icon: BookOpen,
    };
  }
  return null;
}

function NextStep({
  lessons,
  progress,
  summaries,
  learnedCount,
  passedCount,
}: {
  lessons: LearningLesson[];
  progress: LessonProgressState;
  summaries: Summaries;
  learnedCount: number;
  passedCount: number;
}) {
  const step = pickNextStep(lessons, progress, summaries);
  const percent = lessons.length ? Math.round((learnedCount / lessons.length) * 100) : 0;
  const Icon = step?.icon ?? RotateCcw;

  return (
    <section
      aria-label="Bước tiếp theo"
      className="mt-6 rounded-[20px] border border-blue-100 bg-gradient-to-br from-[#F4F8FF] to-white p-5 sm:p-6"
      data-testid="next-step"
    >
      {step ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-blue-600">{step.eyebrow}</p>
            <p className="mt-1 text-lg font-bold leading-snug text-[#091224]">
              {step.lesson.title}
            </p>
            <p className="mt-1 line-clamp-2 text-[14px] leading-6 text-slate-600">{step.detail}</p>
          </div>
          <Link
            href={step.href}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-5 text-[15px] font-bold text-white shadow-[0_6px_18px_rgba(0,82,255,0.22)] transition hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            data-testid="next-step-cta"
          >
            <Icon className="size-[18px]" aria-hidden="true" />
            {step.cta}
          </Link>
        </div>
      ) : (
        <div>
          <p className="text-[13px] font-semibold text-emerald-700">Hoàn thành</p>
          <p className="mt-1 text-lg font-bold leading-snug text-[#091224]">
            Em đã học xong và luyện đạt mọi bài đang mở.
          </p>
          <p className="mt-1 text-[14px] leading-6 text-slate-600">
            Bài mới sẽ hiện ở đây khi thầy cô mở thêm. Em có thể ôn lại bất kỳ bài nào bên dưới.
          </p>
        </div>
      )}
      <div className="mt-5 border-t border-blue-100/80 pt-4">
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-[13px] text-slate-600">
          <span>
            Đã học xong{' '}
            <strong className="font-semibold text-[#091224]">
              {learnedCount}/{lessons.length}
            </strong>{' '}
            bài
          </span>
          <span>
            Luyện tập đạt <strong className="font-semibold text-[#091224]">{passedCount}</strong>{' '}
            bài
          </span>
        </div>
        <div
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-blue-100"
          role="progressbar"
          aria-label="Số bài đã học xong"
          aria-valuemin={0}
          aria-valuemax={lessons.length}
          aria-valuenow={learnedCount}
        >
          <div className="h-full rounded-full bg-[#0052FF]" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </section>
  );
}
