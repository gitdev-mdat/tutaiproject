'use client';

import { useStudentShell } from '@/components/student/student-shell';
import { LessonJourney, type LessonJourneyProps } from '@/components/learning/lesson-journey';
import { InteractiveLesson } from '@/components/learning/interactive/interactive-lesson';
import type { InteractivePlan } from '@/lib/learning/interactive-lesson';

/**
 * The lesson journey for the signed-in student, with progress kept under their id.
 * A lesson with an interactive plan (config/interactive-lessons.ts) opens as the
 * interactive lesson instead; every other lesson keeps the text journey.
 */
export function StudentLessonJourney({
  interactive = null,
  ...props
}: Omit<LessonJourneyProps, 'mode' | 'studentKey'> & { interactive?: InteractivePlan | null }) {
  const { model } = useStudentShell();
  if (interactive) {
    return (
      <InteractiveLesson
        studentKey={model.identity.id}
        lessonId={props.lessonId}
        title={props.title}
        subjectTitle={props.subjectTitle}
        chapterTitle={props.chapterTitle}
        backHref={props.backHref}
        backLabel={props.backLabel}
        trail={props.trail}
        plan={interactive}
        journey={props.journey}
        checks={props.checks}
        practiceCard={props.practiceCard}
      />
    );
  }
  return <LessonJourney {...props} mode="student" studentKey={model.identity.id} />;
}
