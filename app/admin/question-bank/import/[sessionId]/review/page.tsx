import type { Metadata } from 'next';
import { Suspense } from 'react';
import { QuestionDocumentImport } from '@/components/admin/question-bank/question-document-import';

export const metadata: Metadata = { title: 'Duy?t c�u h?i nh?p | Tu Tai Admin' };

export default async function QuestionImportReviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Đang tải…</p>}>
      <QuestionDocumentImport initialSessionId={sessionId} />
    </Suspense>
  );
}
