'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen, Check, PlayCircle, RotateCcw } from 'lucide-react';
import { useStudentShell } from '@/components/student/student-shell';
import {
  flattenSubjectLessons,
  type LearningLesson,
  type LearningSubject,
} from '@/lib/knowledge-tree/learning-visibility';
import { useLessonProgress } from '../lib/lesson-progress';

export type LessonPracticeResults = Record<
  string,
  { best: number; total: number; passed: boolean }
>;

export function LessonsOverview({
  catalog,
  subject,
  practiceResults = {},
}: {
  catalog: LearningSubject[];
  subject: LearningSubject;
  practiceResults?: LessonPracticeResults;
}) {
  const { model } = useStudentShell();
  const progress = useLessonProgress(model.identity.id);
  const lessons = flattenSubjectLessons(subject);
  const viewed = (id: string) => !!progress?.viewed[id];
  const viewedCount = lessons.filter((lesson) => viewed(lesson.id)).length;
  const lastLesson = lessons.find((lesson) => lesson.id === progress?.lastLessonId);
  const nextUnviewed = lessons.find((lesson) => !viewed(lesson.id));
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
          {lessons.length} bài
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

      <ContinueCard
        lessons={lessons}
        lastLesson={lastLesson}
        nextUnviewed={nextUnviewed}
        viewedCount={progress ? viewedCount : null}
      />

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
                const seen = chapter.lessons.filter((lesson) => viewed(lesson.id)).length;
                return (
                  <li
                    key={chapter.id}
                    className="overflow-hidden rounded-2xl border border-[#E5EBF3] bg-white"
                  >
                    <div className="flex items-start gap-4 px-5 pb-3 pt-5 sm:px-6">
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
                          {progress && seen > 0 && ` · đã xem ${seen}/${chapter.lessons.length}`}
                        </p>
                      </div>
                    </div>
                    <ul className="px-2 pb-2 sm:px-3">
                      {chapter.lessons.map((lesson) => {
                        const isViewed = viewed(lesson.id);
                        const isCurrent = lesson.id === lastLesson?.id;
                        return (
                          <li key={lesson.id}>
                            <Link
                              href={`/student/lessons/${encodeURIComponent(lesson.id)}`}
                              className="group flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[#F4F8FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            >
                              <span
                                aria-hidden="true"
                                className={`grid size-6 shrink-0 place-items-center rounded-full border ${
                                  isViewed
                                    ? 'border-emerald-500 bg-emerald-500 text-white'
                                    : 'border-slate-300 text-transparent'
                                }`}
                              >
                                <Check className="size-3.5" strokeWidth={3} />
                              </span>
                              <span className="min-w-0 flex-1 text-[15px] font-medium leading-snug text-slate-800 group-hover:text-[#091224]">
                                {lesson.title}
                                {isViewed && <span className="sr-only"> (đã xem)</span>}
                              </span>
                              {practiceResults[lesson.id] && (
                                <span
                                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                    practiceResults[lesson.id].passed
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-amber-50 text-amber-700'
                                  }`}
                                  data-testid="lesson-practice-result"
                                >
                                  Luyện tập {practiceResults[lesson.id].best}/
                                  {practiceResults[lesson.id].total}
                                </span>
                              )}
                              {isCurrent && (
                                <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600">
                                  Đang học
                                </span>
                              )}
                              <ArrowRight
                                aria-hidden="true"
                                className="size-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500"
                              />
                            </Link>
                          </li>
                        );
                      })}
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

function ContinueCard({
  lessons,
  lastLesson,
  nextUnviewed,
  viewedCount,
}: {
  lessons: LearningLesson[];
  lastLesson?: LearningLesson;
  nextUnviewed?: LearningLesson;
  viewedCount: number | null;
}) {
  const allViewed = viewedCount !== null && viewedCount === lessons.length;
  const target = allViewed ? lessons[0] : (lastLesson ?? nextUnviewed ?? lessons[0]);
  const eyebrow =
    viewedCount === null || viewedCount === 0
      ? 'Bắt đầu từ đây'
      : allViewed
        ? 'Em đã xem tất cả các bài'
        : lastLesson
          ? 'Tiếp tục bài đang học'
          : 'Bài tiếp theo';
  const cta = allViewed ? 'Ôn lại từ đầu' : viewedCount ? 'Học tiếp' : 'Bắt đầu học';
  const Icon = allViewed ? RotateCcw : viewedCount ? PlayCircle : BookOpen;
  const percent = viewedCount === null ? 0 : Math.round((viewedCount / lessons.length) * 100);

  return (
    <section
      aria-label="Tiếp tục học"
      className="mt-6 rounded-[20px] border border-blue-100 bg-gradient-to-br from-[#F4F8FF] to-white p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-blue-600">{eyebrow}</p>
          <p className="mt-1 text-lg font-bold leading-snug text-[#091224]">{target.title}</p>
          <p className="mt-0.5 text-[13px] text-slate-500">{target.chapterTitle}</p>
        </div>
        <Link
          href={`/student/lessons/${encodeURIComponent(target.id)}`}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-5 text-[15px] font-bold text-white shadow-[0_6px_18px_rgba(0,82,255,0.22)] transition hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <Icon className="size-[18px]" aria-hidden="true" />
          {cta}
        </Link>
      </div>
      {viewedCount !== null && (
        <div className="mt-5">
          <div className="flex justify-between text-[13px] text-slate-500">
            <span>
              Đã xem {viewedCount}/{lessons.length} bài
            </span>
            <span className="tabular-nums">{percent}%</span>
          </div>
          <div
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-blue-100"
            role="progressbar"
            aria-label="Số bài đã xem"
            aria-valuemin={0}
            aria-valuemax={lessons.length}
            aria-valuenow={viewedCount}
          >
            <div className="h-full rounded-full bg-[#0052FF]" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}
    </section>
  );
}
