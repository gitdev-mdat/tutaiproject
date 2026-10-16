import type { Metadata } from 'next';
import { getLearningCatalog } from '@/lib/knowledge-tree/knowledge-tree-service';
import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { getAuthSession } from '@/lib/auth/session';
import { getStudentLessonSummaries } from '@/lib/practice/practice-service';
import { learningPrograms } from '@/features/lessons/lib/study-plan';
import { chooseProgram } from '@/features/lessons/lib/program-match';
import { StudentRoadmap } from '@/features/roadmap/components/student-roadmap';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Lộ trình | Tú Tài',
  description: 'Mọi bài học đã mở, bước học tiếp theo và tiến độ của em.',
};

/**
 * The Roadmap: the student's one place to learn. It opens on the published
 * program of the subject and grade in the student's profile (or the one they
 * opened with `?subject=…&grade=…`), says why, and shows where the student
 * stands and the one step to take next. Built from the curriculum the admin
 * published, the student's practice results (database) and reading progress
 * (browser); nothing on it is a template or an estimate.
 */
export default async function RoadmapPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; grade?: string }>;
}) {
  const [{ subject, grade }, catalog, student, session] = await Promise.all([
    searchParams,
    getLearningCatalog(),
    getDemoStudentSession(),
    getAuthSession(),
  ]);
  const programs = learningPrograms(catalog);
  const declaration = session
    ? { primarySubject: session.learning?.primarySubject ?? null, grade: session.profile.grade }
    : null;
  // The profile's program, and the one shown (a program the student opened wins).
  const fromProfile = chooseProgram(programs, declaration);
  const choice = chooseProgram(programs, declaration, { subjectId: subject, gradeId: grade });
  const program = choice.program;
  const basis =
    choice.basis === 'CHOSEN' && program?.id === fromProfile.program?.id ? fromProfile : choice;
  // Every program's results, so the program switch can show each one's progress.
  const summaries =
    student && programs.length
      ? await getStudentLessonSummaries(
          student.id,
          programs.flatMap((item) => item.lessons.map((lesson) => lesson.id))
        ).catch((error) => {
          console.error('[roadmap-summaries]', error);
          return null;
        })
      : {};
  return (
    <StudentRoadmap
      programs={programs}
      program={program}
      choice={{
        basis: basis.basis,
        requested: basis.requested,
        profileProgram: fromProfile.program
          ? { id: fromProfile.program.id, title: fromProfile.program.title }
          : null,
      }}
      summaries={summaries}
      targetScore={student?.targetScore || null}
    />
  );
}
