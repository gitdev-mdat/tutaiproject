import type { Metadata } from 'next';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { AssistProvider } from '@/components/learning/lesson-assist';
import { PracticeSession } from '@/features/lessons/components/practice-session';
import { getAssistAvailability } from '@/lib/learning/lesson-assist-service';
import { findLessonInCatalog } from '@/lib/knowledge-tree/learning-visibility';
import { getLearningCatalog } from '@/lib/knowledge-tree/knowledge-tree-service';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Luyện tập | Tú Tài' };

type Props = {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ attempt?: string }>;
};

export default async function LessonPracticePage({ params, searchParams }: Props) {
  const lessonId = decodeURIComponent((await params).lessonId);
  const { attempt } = await searchParams;
  const found = findLessonInCatalog(await getLearningCatalog(), lessonId);
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
          href="/student/lessons"
          className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#0052FF] px-5 text-[15px] font-bold text-white"
        >
          Về danh sách bài học
        </Link>
      </div>
    );
  }
  const { lesson, lessons, index } = found;
  const next = lessons[index + 1];
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
        next={next ? { id: next.id, title: next.title } : null}
        initialAttemptId={attempt ?? null}
      />
    </AssistProvider>
  );
}
