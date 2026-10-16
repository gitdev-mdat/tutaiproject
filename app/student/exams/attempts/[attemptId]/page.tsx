import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { getExamAttempt, type ExamAttemptView } from '@/lib/exams/student-exam-service';
import { PracticeError } from '@/lib/practice/practice-service';
import { ExamSession } from '@/features/practice-exams/components/exam-session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Làm bài thi | Tú Tài' };

export default async function ExamAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const student = await getDemoStudentSession();
  if (!student) redirect('/auth/login');
  const { attemptId } = await params;
  let view: ExamAttemptView | null = null;
  let error: string | null = null;
  try {
    view = await getExamAttempt(student.id, decodeURIComponent(attemptId));
  } catch (cause) {
    if (!(cause instanceof PracticeError)) throw cause;
    error = cause.message;
  }
  return <ExamSession key={view?.attempt.status ?? 'error'} initial={view} error={error} />;
}
