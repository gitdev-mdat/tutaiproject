import type { Metadata } from 'next';
import { getLearningCatalog } from '@/lib/knowledge-tree/knowledge-tree-service';
import { getAuthSession } from '@/lib/auth/session';
import { learningPrograms } from '@/features/lessons/lib/study-plan';
import { chooseProgram } from '@/features/lessons/lib/program-match';
import { StudentRoadmap } from '@/features/roadmap/components/student-roadmap';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Học | Tú Tài',
  description: 'Các bài học đã mở và bài em nên học tiếp.',
};

/**
 * "Học" (route /student/roadmap): the student's place to read lessons. It
 * opens on the published program of the subject and grade in the student's
 * profile (or the one opened with `?subject=…&grade=…`) and shows the lesson
 * to read next and every lesson's reading progress (kept in the browser).
 * Practice results are on /student/practice only.
 */
export default async function RoadmapPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; grade?: string }>;
}) {
  const [{ subject, grade }, catalog, session] = await Promise.all([
    searchParams,
    getLearningCatalog(),
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
    />
  );
}
