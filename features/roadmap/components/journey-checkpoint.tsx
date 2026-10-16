'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { LessonProgressState } from '@/features/lessons/lib/lesson-progress';
import {
  lessonStanding,
  planProgress,
  programHref,
  type StudyScope,
  type Summaries,
} from '@/features/lessons/lib/study-plan';
import { JourneyTrack } from './journey-track';

/**
 * A slice of the Roadmap's hero, where a lesson or a practice session ends:
 * the program, how many of its lessons are done and the chapters as stages.
 * It is computed by the same rule as the Roadmap, from the same data, so the
 * progress the student just made shows up here exactly as it will there.
 */
export function JourneyCheckpoint({
  program,
  progress,
  summaries,
  lessonId,
  linked = false,
}: {
  program: StudyScope;
  progress: LessonProgressState;
  summaries: Summaries;
  lessonId: string;
  /** The program's name leads back to the journey (when nothing else on screen does). */
  linked?: boolean;
}) {
  const standings = new Map(
    program.lessons.map((lesson) => [lesson.id, lessonStanding(lesson.id, progress, summaries)])
  );
  const { completed, total } = planProgress(program.lessons, progress, summaries);
  const name = `Hành trình ${program.title}`;
  return (
    <div
      className="relative isolate overflow-hidden bg-[#0A1F5C] px-5 pb-4 pt-3.5 text-white sm:px-6"
      data-testid="journey-checkpoint"
    >
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        {linked ? (
          <Link
            href={programHref(program)}
            className="group inline-flex min-h-8 items-center gap-1 rounded text-[13px] font-semibold text-blue-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            data-testid="to-roadmap"
          >
            {name}
            <ArrowRight
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        ) : (
          <span className="text-[13px] font-semibold text-blue-100">{name}</span>
        )}
        <span className="shrink-0 text-[13px] text-blue-100/90">
          <strong
            className="text-[15px] font-extrabold text-white"
            data-testid="checkpoint-completed"
          >
            {completed}/{total}
          </strong>{' '}
          bài xong
        </span>
      </div>
      <JourneyTrack program={program} standings={standings} currentLessonId={lessonId} compact />
    </div>
  );
}
