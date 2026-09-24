'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useStudentProgress } from '@/features/progress/hooks/use-student-progress';

function LoadingState() {
  return (
    <div className="space-y-5" aria-label="Đang tải tiến bộ">
      <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

export function StudentProgressView() {
  const { data, error, isLoading } = useStudentProgress();

  if (isLoading) return <LoadingState />;
  if (error || !data) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600"
      >
        {error ?? 'Chưa có dữ liệu tiến bộ.'}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1080px] pb-10">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">
            {data.subject} · Báo cáo học tập
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-[30px]">
            Tiến bộ của em
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Theo dõi những thay đổi đã có bằng kết quả học và luyện tập gần đây.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">
          <Target size={16} aria-hidden="true" /> Mục tiêu {data.targetScore}+
        </div>
      </header>

      <section
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
        aria-labelledby="overall-progress-title"
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="overall-progress-title" className="text-base font-extrabold text-slate-900">
              Tiến độ lộ trình
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {data.overall.masteredTopics}/{data.overall.totalTopics} nội dung đã vững
            </p>
          </div>
          <strong className="text-3xl font-extrabold tracking-tight text-blue-600">
            {data.overall.roadmapPercentage}%
          </strong>
        </div>
        <div
          className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-label="Tiến độ lộ trình"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={data.overall.roadmapPercentage}
        >
          <div
            className="h-full rounded-full bg-blue-600"
            style={{ width: `${Math.min(100, Math.max(0, data.overall.roadmapPercentage))}%` }}
          />
        </div>
      </section>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section
          className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
          aria-labelledby="recent-improvement-title"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 id="recent-improvement-title" className="font-extrabold text-slate-900">
                Tiến bộ gần đây
              </h2>
              <p className="text-xs text-slate-500">
                Chỉ hiển thị thay đổi có kết quả làm bài đi kèm
              </p>
            </div>
          </div>

          <div className="mt-5 divide-y divide-slate-100">
            {data.recentImprovements.map((item) => (
              <article key={item.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800">{item.knowledgePoint}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <ClipboardCheck size={14} className="text-slate-400" aria-hidden="true" />
                      {item.evidence.label}
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    aria-label={`Độ vững từ ${item.before}% lên ${item.after}%`}
                  >
                    <span className="text-sm font-bold text-slate-400">{item.before}%</span>
                    <ArrowRight size={15} className="text-emerald-500" aria-hidden="true" />
                    <strong className="rounded-lg bg-emerald-50 px-2.5 py-1 text-base text-emerald-700">
                      {item.after}%
                    </strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
          aria-labelledby="weak-knowledge-title"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Target size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 id="weak-knowledge-title" className="font-extrabold text-slate-900">
                Cần củng cố
              </h2>
              <p className="text-xs text-slate-500">Ưu tiên từ bằng chứng học gần nhất</p>
            </div>
          </div>

          <div className="mt-5 divide-y divide-slate-100">
            {data.weakKnowledgePoints.map((item) => (
              <article key={item.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800">{item.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.evidence.label}</p>
                  </div>
                  {item.mastery !== null && (
                    <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                      {item.mastery}%
                    </span>
                  )}
                </div>
                {item.action && (
                  <Link
                    href={item.action.href}
                    className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg text-sm font-bold text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {item.action.label} <ChevronRight size={15} aria-hidden="true" />
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>

      <section
        className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
        aria-labelledby="recent-activity-title"
      >
        <div className="flex items-center gap-2.5">
          <BookCheck size={19} className="text-blue-600" aria-hidden="true" />
          <h2 id="recent-activity-title" className="font-extrabold text-slate-900">
            Hoạt động đã hoàn thành gần đây
          </h2>
        </div>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.recentActivity.map((item) => (
            <li key={item.id} className="flex gap-3 rounded-xl bg-slate-50 p-3.5">
              <CheckCircle2
                size={18}
                className="mt-0.5 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-bold text-slate-800">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
