import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getPracticeCoverage, type LessonCoverage } from '@/lib/practice/practice-admin';
import { Chip, READINESS } from '@/components/admin/practice/practice-labels';

export const metadata: Metadata = { title: 'Luyện tập theo bài | Tú Tài Admin' };
export const dynamic = 'force-dynamic';

function percent(value: number | null) {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

function Metric({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className={`text-xl font-bold ${tone ?? 'text-slate-900'}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function LessonRow({ lesson }: { lesson: LessonCoverage }) {
  const readiness = READINESS[lesson.readiness];
  const pending = lesson.counts.DRAFT + lesson.counts.IN_REVIEW;
  return (
    <Link
      href={`/admin/practice/${lesson.lessonId}`}
      className="group flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center"
      data-testid="practice-lesson-row"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">{lesson.title}</p>
          <Chip tone={readiness.tone}>{readiness.label}</Chip>
        </div>
        {lesson.attention.length > 0 && (
          <p className="mt-1 text-xs text-amber-700">{lesson.attention.join(' ')}</p>
        )}
      </div>
      <dl className="grid shrink-0 grid-cols-3 gap-4 text-xs sm:w-[300px]">
        <div>
          <dt className="text-slate-500">Học sinh nhận</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">{lesson.counts.IN_PRACTICE} câu</dd>
        </div>
        <div>
          <dt className="text-slate-500">Đang soạn</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">{pending} câu</dd>
        </div>
        <div>
          <dt className="text-slate-500">Điểm TB</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">
            {percent(lesson.students.averageScore)}
            <span className="font-normal text-slate-500"> · {lesson.students.students} HS</span>
          </dd>
        </div>
      </dl>
      <ChevronRight className="hidden size-4 text-slate-400 group-hover:text-slate-600 sm:block" />
    </Link>
  );
}

export default async function PracticeCoveragePage() {
  const lessons = await getPracticeCoverage();
  const open = lessons.filter((l) => l.publication === 'PUBLISHED');
  const groups = new Map<string, LessonCoverage[]>();
  for (const lesson of lessons) {
    const key = lesson.path.join(' › ') || 'Khác';
    groups.set(key, [...(groups.get(key) ?? []), lesson]);
  }
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Luyện tập theo bài</h1>
        <p className="mt-0.5 max-w-2xl text-sm text-slate-500">
          Sau mỗi bài học, học sinh làm các câu đã xuất bản gắn với bài đó. Mỗi câu cần đáp án và
          lời giải do người soạn kiểm tra.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric value={open.length} label="Bài học đang mở" />
        <Metric
          value={open.filter((l) => l.readiness === 'READY').length}
          label="Bài đủ câu luyện tập"
          tone="text-emerald-700"
        />
        <Metric
          value={open.filter((l) => l.readiness === 'NO_QUESTIONS').length}
          label="Bài mở nhưng chưa có câu"
          tone="text-rose-700"
        />
        <Metric
          value={lessons.reduce((sum, l) => sum + l.counts.IN_REVIEW, 0)}
          label="Câu đang chờ duyệt"
          tone="text-amber-700"
        />
      </div>

      {lessons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-slate-800">Chưa có mục kiến thức nào</p>
          <p className="mt-1 text-xs text-slate-500">
            Tạo chương và kiến thức trước, rồi quay lại đây để thêm câu luyện tập.
          </p>
          <Link
            href="/admin/knowledge"
            className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Mở Chương trình & Kiến thức
          </Link>
        </div>
      ) : (
        [...groups.entries()].map(([path, items]) => (
          <section
            key={path}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            <h2 className="border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              {path}
            </h2>
            <div className="divide-y divide-slate-100">
              {items.map((lesson) => (
                <LessonRow key={lesson.lessonId} lesson={lesson} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
