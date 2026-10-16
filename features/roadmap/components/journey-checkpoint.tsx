'use client';

import type { LessonProgressState } from '@/features/lessons/lib/lesson-progress';
import {
  lessonStanding,
  planProgress,
  type StudyScope,
  type Summaries,
} from '@/features/lessons/lib/study-plan';
import { JourneyTrack } from './journey-track';

/**
 * A slice of the Roadmap's hero, shown once: when a practice session passes
 * and the journey moves. The program, how many of its lessons are done and the
 * chapters as stages, computed by the same rule and from the same data as the
 * Roadmap, so the progress just made shows here exactly as it will there.
 */
export function JourneyCheckpoint({
  program,
  progress,
  summaries,
  lessonId,
}: {
  program: StudyScope;
  progress: LessonProgressState;
  summaries: Summaries;
  lessonId: string;
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
        <span className="text-[13px] font-semibold text-blue-100">{name}</span>
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
