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
