import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Layers } from 'lucide-react';
import { getDemoStudentSession } from '@/lib/auth/demo-session';
import { getSetContext } from '@/lib/practice/practice-catalog';
import { SET_LABELS, setKindFromSegment } from '@/lib/practice/practice-sets';
import { SetSession } from '@/features/practice-exams/components/set-session';
import { PRACTICE_PAGE } from '@/features/practice-exams/lib/links';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ kind: string; chapterId: string }>;
  searchParams: Promise<{ attempt?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const kind = setKindFromSegment((await params).kind);
  return { title: `${kind ? SET_LABELS[kind] : 'Luyện tập'} | Tú Tài` };
}

export default async function PracticeSetPage({ params, searchParams }: Props) {
  const { kind: segment, chapterId } = await params;
  const kind = setKindFromSegment(segment);
  if (!kind) notFound();
  const student = await getDemoStudentSession();
  if (!student) redirect('/auth/login');
  const context = await getSetContext(student.id, kind, decodeURIComponent(chapterId));
  if (!context) {
    return (
      <div className="mx-auto max-w-[520px] py-16 text-center" data-testid="set-unavailable">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-500">
          <Layers className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-[#091224]">
          Bộ luyện tập này chưa mở
        </h1>
        <p className="mt-2 text-[15px] text-slate-600">
          Chương chưa có đủ câu hỏi cho bộ này. Em luyện từng bài trước nhé.
        </p>
        <Link
          href={PRACTICE_PAGE}
          className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#0052FF] px-5 text-[15px] font-bold text-white"
        >
          Về Luyện tập
        </Link>
      </div>
    );
  }
  const { attempt } = await searchParams;
  return <SetSession context={context} initialAttemptId={attempt ?? null} />;
}
