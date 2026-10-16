import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { getPracticeCatalog } from '@/lib/practice/practice-catalog';
import { PracticeCatalogView } from '@/features/practice-exams/components/practice-catalog-view';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Luyện tập | Tú Tài' };

type Props = { searchParams: Promise<{ subject?: string; grade?: string; view?: string }> };

export default async function StudentPracticePage({ searchParams }: Props) {
  const student = await getDemoStudentSession();
  if (!student) redirect('/auth/login');
  const { subject, grade, view } = await searchParams;
  const catalog = await getPracticeCatalog(student.id, subject, grade);
  return <PracticeCatalogView catalog={catalog} view={view === 'chapter' ? 'chapter' : 'lesson'} />;
}
