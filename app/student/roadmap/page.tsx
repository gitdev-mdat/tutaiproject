import type { Metadata } from 'next';
import { getLearningCatalog } from '@/lib/knowledge-tree/knowledge-tree-service';
import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { getStudentLessonSummaries } from '@/lib/practice/practice-service';
import { learningPrograms, selectProgram } from '@/features/lessons/lib/study-plan';
import { StudentRoadmap } from '@/features/roadmap/components/student-roadmap';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Lộ trình | Tú Tài',
  description: 'Mọi bài học đã mở, bước học tiếp theo và tiến độ của em.',
};

/**
 * The Roadmap: the student's one place to learn. Every published program
 * (`?subject=…&grade=…`, Mathematics grade 12 by default), where the student
 * stands in it and the one step to take next. Built from the curriculum the
 * admin published, the student's practice results (database) and reading
 * progress (browser); nothing on it is a template or an estimate.
 */
export default async function RoadmapPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; grade?: string }>;
}) {
  const [{ subject, grade }, catalog, student] = await Promise.all([
    searchParams,
    getLearningCatalog(),
    getDemoStudentSession(),
  ]);
  const programs = learningPrograms(catalog);
  const program = selectProgram(programs, subject, grade);
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
      summaries={summaries}
      targetScore={student?.targetScore || null}
    />
  );
}
