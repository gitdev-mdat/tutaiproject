'use client';

import Link from 'next/link';
import { ArrowRight, Check, CircleDashed, ClipboardCheck, PlayCircle } from 'lucide-react';
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
import { lessonHref, lessonStanding, pickNextStep, type Summaries } from '../lib/study-plan';

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
        <ResumeOrRoadmap lessons={lessons} progress={progress} summaries={summaries} />
      ) : (
        <div aria-hidden="true" className="mt-5 h-10" />
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
                          completed={
                            !!progress && lessonStanding(lesson.id, progress, summaries).completed
                          }
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
  completed,
  summary,
}: {
  lesson: LearningLesson;
  state: LessonLearningState | null;
  /** Same rule as the Roadmap: practice passed, or read to the end when there is no practice. */
  completed: boolean;
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
        data-completed={completed}
      >
        <StateIcon state={state} completed={completed} />
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

function StateIcon({
  state,
  completed,
}: {
  state: LessonLearningState | null;
  completed: boolean;
}) {
  if (completed)
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  if (state && state.kind !== 'new')
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

// ─── Resume, or the way to the Roadmap ───────────────────────────────────────

/**
 * The lesson list is for browsing. It does not recommend: that is the
 * Roadmap's job. It only offers to resume what the student left unfinished
 * (the same step the Roadmap would show), and otherwise points to the Roadmap.
 */
function ResumeOrRoadmap({
  lessons,
  progress,
  summaries,
}: {
  lessons: LearningLesson[];
  progress: LessonProgressState;
  summaries: Summaries;
}) {
  const step = pickNextStep(lessons, progress, summaries);
  if (step && (step.kind === 'resume-practice' || step.kind === 'resume-lesson')) {
    const Icon = step.kind === 'resume-practice' ? ClipboardCheck : PlayCircle;
    return (
      <section
        aria-label="Đang học dở"
        className="mt-6 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-[#F4F8FF] px-5 py-4 sm:flex-row sm:items-center"
        data-testid="next-step"
        data-kind={step.kind}
      >
        <p className="min-w-0 flex-1 text-[14px] leading-6 text-slate-600">
          <span className="font-semibold text-blue-700">Em đang học dở: </span>
          <span className="font-semibold text-[#091224]">{step.lesson.title}</span>
        </p>
        <Link
          href={step.href}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-4 text-[14px] font-bold text-white transition hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          data-testid="next-step-cta"
        >
          <Icon className="size-4" aria-hidden="true" />
          {step.cta}
        </Link>
      </section>
    );
  }
  return (
    <p className="mt-5 text-[14px] text-slate-500" data-testid="next-step" data-kind="roadmap">
      Chưa biết học bài nào tiếp?{' '}
      <Link
        href="/student/roadmap"
        className="inline-flex items-center gap-1 font-semibold text-blue-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        Xem bước tiếp theo trong Lộ trình <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </p>
  );
}
