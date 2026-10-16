import { SET_SEGMENTS, type PracticeSetKind } from '@/lib/practice/practice-sets';
import { ROADMAP_PROGRAM } from '@/features/lessons/lib/study-plan';

export const PRACTICE_PAGE = '/student/practice';
export const EXAMS_PAGE = '/student/exams';

export type PracticeView = 'lesson' | 'chapter';

/** The Practice page on a program and view. The default program and view have the plain URL. */
export function practicePageHref(
  program?: { subjectId: string; gradeId: string } | null,
  view: PracticeView = 'lesson'
): string {
  const query = new URLSearchParams();
  if (
    program &&
    !(
      program.subjectId === ROADMAP_PROGRAM.subjectId && program.gradeId === ROADMAP_PROGRAM.gradeId
    )
  ) {
    query.set('subject', program.subjectId);
    query.set('grade', program.gradeId);
  }
  if (view === 'chapter') query.set('view', 'chapter');
  const search = query.toString();
  return `${PRACTICE_PAGE}${search ? `?${search}` : ''}`;
}

export function setHref(kind: PracticeSetKind, chapterId: string, attemptId?: string): string {
  const base = `${PRACTICE_PAGE}/${SET_SEGMENTS[kind]}/${encodeURIComponent(chapterId)}`;
  return attemptId ? `${base}?attempt=${encodeURIComponent(attemptId)}` : base;
}

export const examHref = (examId: string) => `${EXAMS_PAGE}/${encodeURIComponent(examId)}`;

export const examAttemptHref = (attemptId: string) =>
  `${EXAMS_PAGE}/attempts/${encodeURIComponent(attemptId)}`;
