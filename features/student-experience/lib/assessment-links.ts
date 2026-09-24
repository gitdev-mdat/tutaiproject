import type { CurriculumExamSet, ExamSessionMode } from '@/lib/exam-sets/types';
import type { StudentActivityKind } from './types';

export function studentAssessmentHref({
  set,
  kind,
  source,
  title,
  mode,
  rankingEligible = false,
  activityId,
}: {
  set: CurriculumExamSet;
  kind: StudentActivityKind;
  source: '/student/practice' | '/student/exams' | '/student/arena';
  title: string;
  mode: ExamSessionMode;
  rankingEligible?: boolean;
  activityId?: string;
}) {
  const query = new URLSearchParams({
    source,
    mode,
    experience: kind,
    experienceId: activityId ?? set.id,
    experienceTitle: title,
    rankingEligible: rankingEligible ? '1' : '0',
  });
  return `/exam-sets/${set.slug}/practice?${query.toString()}`;
}
