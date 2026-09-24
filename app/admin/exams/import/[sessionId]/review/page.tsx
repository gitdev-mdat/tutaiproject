import type { Metadata } from 'next';
import { ExamReviewWorkspace } from '@/components/admin/exams/exam-review-workspace';

export const metadata: Metadata = { title: 'Kiểm tra đề nhập | Tú Tài Admin' };

export default async function ExamImportReviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <ExamReviewWorkspace sessionId={sessionId} />;
}
