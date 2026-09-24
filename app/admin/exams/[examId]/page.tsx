import type { Metadata } from 'next';
import { ExamComposer } from '@/components/admin/exams/exam-composer';

export const metadata: Metadata = { title: 'Biên soạn đề | Tú Tài Admin' };

export default async function ExamDetailPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  return <ExamComposer examId={examId} />;
}
