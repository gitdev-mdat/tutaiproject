import type { Metadata } from 'next';
import { QuestionDocumentImport } from '@/components/admin/question-bank/question-document-import';

export const metadata: Metadata = { title: 'Duy?t c�u h?i nh?p | Tu Tai Admin' };

export default async function QuestionImportReviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <QuestionDocumentImport initialSessionId={sessionId} />;
}
