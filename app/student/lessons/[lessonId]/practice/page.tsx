import type { Metadata } from 'next';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { AssistProvider } from '@/components/learning/lesson-assist';
import { PracticeSession } from '@/features/lessons/components/practice-session';
import { getAssistAvailability } from '@/lib/learning/lesson-assist-service';
import { findLessonInCatalog } from '@/lib/knowledge-tree/learning-visibility';
import { getLearningCatalog } from '@/lib/knowledge-tree/knowledge-tree-service';
import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { getStudentLessonSummaries } from '@/lib/practice/practice-service';
import { practiceOrigin, programFor, ROADMAP_HREF } from '@/features/lessons/lib/study-plan';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Luyện tập | Tú Tài' };

type Props = {
  params: Promise<{ lessonId: string }>;
  /** `from=lesson` when opened from the lesson's summary; anything else means the Roadmap. */
  searchParams: Promise<{ attempt?: string; from?: string }>;
};

export default async function LessonPracticePage({ params, searchParams }: Props) {
  const lessonId = decodeURIComponent((await params).lessonId);
  const { attempt, from } = await searchParams;
  const catalog = await getLearningCatalog();
  const found = findLessonInCatalog(catalog, lessonId);
  if (!found) {
    return (
      <div className="mx-auto max-w-[520px] py-16 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-500">
          <Lock className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-[#091224]">
          Bài học này chưa mở
        </h1>
        <Link
          href={ROADMAP_HREF}
          className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#0052FF] px-5 text-[15px] font-bold text-white"
        >
          Về lộ trình
        </Link>
      </div>
    );
  }
  const { lesson } = found;
  // The next step after practice is chosen by the Roadmap's rule, from the lesson's program.
  const program = programFor(catalog, lesson.id);
  const scope = program?.lessons ?? [];
  const student = await getDemoStudentSession();
  const summaries = student
    ? await getStudentLessonSummaries(
        student.id,
        scope.map((item) => item.id)
      ).catch(() => ({}))
    : {};
  return (
    <AssistProvider
      settings={{
        lessonId: lesson.id,
        contentVersion: '',
        available: getAssistAvailability().available,
      }}
    >
      <PracticeSession
        lesson={{ id: lesson.id, title: lesson.title, chapterTitle: lesson.chapterTitle }}
        program={program}
        origin={practiceOrigin(from)}
        summaries={summaries}
        initialAttemptId={attempt ?? null}
      />
    </AssistProvider>
  );
}
