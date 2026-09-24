import type { Metadata } from 'next';
import { QuestionDocumentImport } from '@/components/admin/question-bank/question-document-import';

export const metadata: Metadata = { title: 'Import questions | Tu Tai Admin' };

export default async function QuestionImportPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session } = await searchParams;
  return <QuestionDocumentImport initialSessionId={session} />;
}
