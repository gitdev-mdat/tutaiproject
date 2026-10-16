import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FileText } from 'lucide-react';
import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { getStudentExam } from '@/lib/exams/student-exam-service';
import { ExamDetailView } from '@/features/practice-exams/components/exam-detail-view';
import { EXAMS_PAGE } from '@/features/practice-exams/lib/links';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Đề thi | Tú Tài' };

export default async function StudentExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const student = await getDemoStudentSession();
  if (!student) redirect('/auth/login');
  const detail = await getStudentExam(student.id, decodeURIComponent((await params).examId));
  if (!detail) {
    return (
      <div className="mx-auto max-w-[520px] py-16 text-center" data-testid="exam-unavailable">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-500">
          <FileText className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-[#091224]">
          Đề thi này không còn mở
        </h1>
        <p className="mt-2 text-[15px] text-slate-600">Đề có thể đã được gỡ hoặc chưa xuất bản.</p>
        <Link
          href={EXAMS_PAGE}
          className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#0052FF] px-5 text-[15px] font-bold text-white"
        >
          Về Luyện thi
        </Link>
      </div>
    );
  }
  return <ExamDetailView detail={detail} />;
}
