import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLessonPracticeDetail } from '@/lib/practice/practice-admin';
import { LessonPracticeWorkspace } from '@/components/admin/practice/lesson-practice-workspace';

export const metadata: Metadata = { title: 'Câu luyện tập của bài | Tú Tài Admin' };
export const dynamic = 'force-dynamic';

export default async function LessonPracticePage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const detail = await getLessonPracticeDetail(lessonId);
  if (!detail) notFound();
  return <LessonPracticeWorkspace coverage={detail.coverage} questions={detail.questions} />;
}
