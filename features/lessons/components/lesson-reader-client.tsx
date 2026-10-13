'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { useStudentShell } from '@/components/student/student-shell';
import type { LearningLesson } from '@/lib/knowledge-tree/learning-visibility';
import { recordLessonViewed, useLessonProgress } from '../lib/lesson-progress';

/** Records that the student opened this lesson so "Tiếp tục học" can bring them back. */
export function LessonViewRecorder({ lessonId }: { lessonId: string }) {
  const { model } = useStudentShell();
  React.useEffect(() => {
    recordLessonViewed(model.identity.id, lessonId);
  }, [model.identity.id, lessonId]);
  return null;
}

/** The current chapter's lessons, with the open one highlighted and viewed ones checked. */
export function ChapterLessonList({
  chapterTitle,
  lessons,
  currentId,
}: {
  chapterTitle: string;
  lessons: LearningLesson[];
  currentId: string;
}) {
  const { model } = useStudentShell();
  const progress = useLessonProgress(model.identity.id);
  return (
    <nav
      aria-label="Các bài trong chương"
      className="rounded-2xl border border-[#E5EBF3] bg-white p-4"
    >
      <p className="px-2 text-xs font-bold uppercase tracking-wider text-slate-400">Trong chương</p>
      <p className="mt-1 px-2 text-[15px] font-bold leading-snug text-[#091224]">{chapterTitle}</p>
      <ol className="mt-3 space-y-0.5">
        {lessons.map((lesson, index) => {
          const current = lesson.id === currentId;
          const viewed = !!progress?.viewed[lesson.id];
          return (
            <li key={lesson.id}>
              <Link
                href={`/student/lessons/${encodeURIComponent(lesson.id)}`}
                aria-current={current ? 'page' : undefined}
                className={`flex items-start gap-2.5 rounded-lg px-2 py-2 text-sm leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  current
                    ? 'bg-blue-50 font-semibold text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-px grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                    viewed && !current
                      ? 'bg-emerald-500 text-white'
                      : current
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {viewed && !current ? <Check className="size-3" strokeWidth={3} /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">{lesson.title}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Segmented bar for the chapter: viewed lessons filled, the open one highlighted. */
export function ChapterProgress({
  lessons,
  currentId,
}: {
  lessons: LearningLesson[];
  currentId: string;
}) {
  const { model } = useStudentShell();
  const progress = useLessonProgress(model.identity.id);
  const position = lessons.findIndex((lesson) => lesson.id === currentId) + 1;
  const viewed = lessons.filter((lesson) => progress?.viewed[lesson.id]).length;
  return (
    <div className="min-w-0">
      <p className="text-[13px] font-semibold text-slate-600">
        Bài {position}/{lessons.length} trong chương
        {progress && <span className="text-slate-400"> · đã mở {viewed} bài</span>}
      </p>
      <ol className="mt-1.5 flex gap-1" aria-hidden="true">
        {lessons.map((lesson) => (
          <li
            key={lesson.id}
            className={`h-1.5 w-8 rounded-full sm:w-10 ${
              lesson.id === currentId
                ? 'bg-blue-600'
                : progress?.viewed[lesson.id]
                  ? 'bg-emerald-400'
                  : 'bg-slate-200'
            }`}
          />
        ))}
      </ol>
    </div>
  );
}

/** "Lộ trình bài học": the lesson's steps, with the one on screen highlighted. */
export function LessonFlowNav({
  steps,
  variant,
}: {
  steps: Array<{ id: string; label: string }>;
  variant: 'rail' | 'chips';
}) {
  const [active, setActive] = React.useState(steps[0]?.id ?? '');
  const [seen, setSeen] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    const elements = steps
      .map((step) => document.getElementById(step.id))
      .filter((element): element is HTMLElement => !!element);
    if (!elements.length || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (!visible.length) return;
        const top = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        setActive(top.target.id);
        setSeen((current) => {
          const index = steps.findIndex((step) => step.id === top.target.id);
          const next = new Set(current);
          steps.slice(0, index).forEach((step) => next.add(step.id));
          return next;
        });
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [steps]);

  if (variant === 'chips') {
    return (
      <nav aria-label="Các bước của bài học" className="-mx-4 overflow-x-auto px-4 pb-1 lg:hidden">
        <ol className="flex w-max gap-2">
          {steps.map((step, index) => (
            <li key={step.id}>
              <a
                href={`#${step.id}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span className="text-slate-400">{index + 1}</span> {step.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    );
  }

  return (
    <nav aria-label="Lộ trình bài học" className="rounded-2xl border border-[#E5EBF3] bg-white p-4">
      <p className="px-2 text-xs font-bold uppercase tracking-wider text-slate-400">
        Lộ trình bài học
      </p>
      <ol className="relative mt-3">
        {steps.map((step, index) => {
          const current = step.id === active;
          const done = seen.has(step.id) && !current;
          return (
            <li key={step.id} className="relative">
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-[19px] top-7 h-[calc(100%-16px)] w-px bg-slate-200"
                />
              )}
              <a
                href={`#${step.id}`}
                aria-current={current ? 'step' : undefined}
                className={`relative flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  current
                    ? 'bg-blue-50 font-semibold text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                    current
                      ? 'bg-blue-600 text-white'
                      : done
                        ? 'bg-emerald-500 text-white'
                        : 'border border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  {done ? <Check className="size-3" strokeWidth={3} /> : index + 1}
                </span>
                {step.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
