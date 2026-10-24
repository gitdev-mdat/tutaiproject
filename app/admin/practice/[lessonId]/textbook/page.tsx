import type { Metadata } from 'next';
import { TextbookExercisesWorkspace } from '@/components/admin/practice/textbook-exercises-workspace';

export const metadata: Metadata = { title: 'Bài tập từ sách | Tú Tài Admin' };
export const dynamic = 'force-dynamic';

export default async function TextbookExercisesPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  return <TextbookExercisesWorkspace lessonId={lessonId} />;
}
