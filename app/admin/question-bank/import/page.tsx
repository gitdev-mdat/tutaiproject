import type { Metadata } from 'next';
import { Suspense } from 'react';
import { QuestionDocumentImport } from '@/components/admin/question-bank/question-document-import';

export const metadata: Metadata = { title: 'Import questions | Tu Tai Admin' };

export default async function QuestionImportPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session } = await searchParams;
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Đang tải…</p>}>
      <QuestionDocumentImport initialSessionId={session} />
    </Suspense>
  );
}
