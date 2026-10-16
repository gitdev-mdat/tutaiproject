import { redirect } from 'next/navigation';
import { getLearningCatalog } from '@/lib/knowledge-tree/knowledge-tree-service';
import { learningPrograms, programHref, selectProgram } from '@/features/lessons/lib/study-plan';

export const dynamic = 'force-dynamic';

/**
 * The lesson catalog is part of the Roadmap now: every published lesson is
 * listed there, program by program. Old links and bookmarks
 * (`/student/lessons`, `?subject=…`) open the same subject on the Roadmap.
 * Lessons themselves keep their address, /student/lessons/[lessonId].
 */
export default async function StudentLessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const { subject } = await searchParams;
  const program = subject
    ? selectProgram(learningPrograms(await getLearningCatalog()), subject)
    : null;
  redirect(programHref(program));
}
