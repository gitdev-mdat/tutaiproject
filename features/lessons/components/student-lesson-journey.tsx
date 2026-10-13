'use client';

import { useStudentShell } from '@/components/student/student-shell';
import { LessonJourney, type LessonJourneyProps } from '@/components/learning/lesson-journey';

/** The lesson journey for the signed-in student, with progress kept under their id. */
export function StudentLessonJourney(props: Omit<LessonJourneyProps, 'mode' | 'studentKey'>) {
  const { model } = useStudentShell();
  return <LessonJourney {...props} mode="student" studentKey={model.identity.id} />;
}
