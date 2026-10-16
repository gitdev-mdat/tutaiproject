import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { listStudentExams } from '@/lib/exams/student-exam-service';
import {
  ExamCatalogView,
  parseScope,
} from '@/features/practice-exams/components/exam-catalog-view';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Luyện thi | Tú Tài' };

type Props = { searchParams: Promise<{ scope?: string }> };

export default async function StudentExamsPage({ searchParams }: Props) {
  const student = await getDemoStudentSession();
  if (!student) redirect('/auth/login');
  const [{ scope }, catalog] = await Promise.all([searchParams, listStudentExams(student.id)]);
  return <ExamCatalogView catalog={catalog} scope={parseScope(scope)} />;
}
