import type { Metadata } from 'next';
import { getLearningCatalog } from '@/lib/knowledge-tree/knowledge-tree-service';
import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { getStudentLessonSummaries } from '@/lib/practice/practice-service';
import { roadmapScope } from '@/features/lessons/lib/study-plan';
import { StudentRoadmap } from '@/features/roadmap/components/student-roadmap';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Lộ trình | Tú Tài',
  description: 'Bước học tiếp theo và tiến độ theo chương trình.',
};

/**
 * The Roadmap: the published program in order, where the student stands in
 * it and the one step to take next. Built from the curriculum the admin
 * published, the student's practice results (database) and reading progress
 * (browser); nothing on it is a template or an estimate.
 */
export default async function RoadmapPage() {
  const [catalog, student] = await Promise.all([getLearningCatalog(), getDemoStudentSession()]);
  const scope = roadmapScope(catalog);
  const summaries =
    student && scope
      ? await getStudentLessonSummaries(
          student.id,
          scope.lessons.map((lesson) => lesson.id)
        ).catch((error) => {
          console.error('[roadmap-summaries]', error);
          return null;
        })
      : {};
  return (
    <StudentRoadmap
      scope={scope}
      summaries={summaries}
      targetScore={student?.targetScore || null}
      otherSubjects={catalog
        .filter((subject) => subject.id !== scope?.subjectId)
        .map((s) => s.title)}
    />
  );
}
