import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { getLearningCatalog } from '@/lib/knowledge-tree/knowledge-tree-service';
import { LessonsOverview } from '@/features/lessons/components/lessons-overview';
import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { getStudentPracticeResults } from '@/lib/practice/practice-service';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Bài học | Tú Tài',
  description: 'Học theo chương và bài trong chương trình.',
};

export default async function StudentLessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const [{ subject: subjectId }, catalog] = await Promise.all([searchParams, getLearningCatalog()]);

  if (catalog.length === 0) {
    return (
      <div className="mx-auto max-w-[560px] py-16 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-50 text-blue-600">
          <BookOpen className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-[#091224]">
          Chưa có bài học nào được mở
        </h1>
        <p className="mt-2 text-[15px] leading-7 text-slate-500">
          Thầy cô đang chuẩn bị nội dung. Trong lúc chờ, em có thể luyện đề để giữ nhịp học.
        </p>
        <Link
          href="/student/practice"
          className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#0052FF] px-5 text-[15px] font-bold text-white hover:bg-[#0044CC]"
        >
          Đi tới Luyện đề
        </Link>
      </div>
    );
  }

  const subject = catalog.find((item) => item.id === subjectId) ?? catalog[0];
  const student = await getDemoStudentSession();
  const practiceResults = student
    ? await getStudentPracticeResults(student.id).catch(() => ({}))
    : {};
  return <LessonsOverview catalog={catalog} subject={subject} practiceResults={practiceResults} />;
}
