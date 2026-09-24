'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Check, LockKeyhole } from 'lucide-react';
import type { DailyLearningActivity } from '@/features/roadmap/lib/types';

export function LearningActivityCard({ activity }: { activity: DailyLearningActivity }) {
  const [lockExplanationOpen, setLockExplanationOpen] = useState(false);
  const locked = activity.status === 'locked';
  const completed = activity.status === 'completed';
  const current = activity.status === 'in_progress' || activity.status === 'recommended';
  const insertedReview = activity.status === 'needs_review';
  const progress = Math.min(100, Math.max(0, activity.progress ?? 0));

  return (
    <article
      className={`relative grid gap-3 rounded-[18px] border bg-white p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
        current || insertedReview
          ? 'border-blue-200 shadow-[0_10px_28px_rgba(0,82,255,0.06)]'
          : locked
            ? 'border-violet-100 bg-violet-50/30'
            : 'border-slate-200'
      }`}
    >
      <span
        className={`absolute -left-2.5 -top-2.5 flex size-7 items-center justify-center rounded-full border-2 border-white text-xs font-extrabold text-white shadow-sm ${
          current || insertedReview
            ? 'bg-blue-600'
            : locked
              ? 'bg-violet-600'
              : completed
                ? 'bg-emerald-500'
                : 'bg-slate-500'
        }`}
        aria-label={`Bước ${activity.order}`}
      >
        {completed ? <Check size={14} strokeWidth={3} /> : activity.order}
      </span>

      <div className="min-w-0">
        {insertedReview && (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-600">
            Tú Tài vừa thêm
          </p>
        )}
        <h2 className="text-[17px] font-extrabold tracking-[-0.01em] text-slate-900 sm:text-lg">
          {activity.title}
        </h2>
        {!locked && activity.description && (
          <p className="mt-1 line-clamp-1 text-[13px] text-slate-500">{activity.description}</p>
        )}
        {locked && activity.dependencyLabel && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-violet-600">
            <LockKeyhole aria-hidden="true" size={13} />
            {activity.dependencyLabel}
          </p>
        )}

        {!locked && (
          <div className="mt-3 flex items-center gap-3" aria-label={`Tiến độ ${progress}%`}>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${completed ? 'bg-emerald-500' : 'bg-blue-600'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="w-9 text-right text-xs font-bold text-slate-500">{progress}%</span>
          </div>
        )}
      </div>

      <div className="relative sm:pl-3">
        {locked ? (
          <button
            type="button"
            aria-expanded={lockExplanationOpen}
            onClick={() => setLockExplanationOpen((open) => !open)}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-4 text-sm font-bold text-violet-600 transition hover:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-400 sm:w-auto"
          >
            {activity.action?.label ?? 'Đang khóa'}
            <LockKeyhole aria-hidden="true" size={15} />
          </button>
        ) : activity.action?.href ? (
          <Link
            href={activity.action.href}
            className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto ${
              current || insertedReview
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-200 hover:bg-blue-700'
                : 'border border-slate-200 bg-white text-blue-600 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            {activity.action.label}
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        ) : null}
        {locked && lockExplanationOpen && (
          <div
            role="status"
            className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl bg-slate-900 p-3 text-xs font-medium leading-5 text-white shadow-xl"
          >
            Em đang ở bước trước. Hoàn thành bài đang học để tiếp tục hoạt động này.
          </div>
        )}
      </div>
    </article>
  );
}

export function DailyLearningQueue({
  activities,
  recommendation,
}: {
  activities: DailyLearningActivity[];
  recommendation: string;
}) {
  return (
    <section aria-labelledby="today-queue-heading">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h1 id="today-queue-heading" className="text-lg font-extrabold text-slate-900">
            Kế hoạch hôm nay
          </h1>
          <span className="text-sm font-semibold text-slate-400">· Toán</span>
        </div>
        <p className="mt-1 text-[13px] text-slate-500">{recommendation}</p>
      </div>
      <div className="relative space-y-3 pl-2">
        <div
          className="absolute bottom-4 left-[5px] top-4 w-px bg-gradient-to-b from-blue-300 to-violet-200"
          aria-hidden="true"
        />
        {[...activities]
          .sort((first, second) => first.order - second.order)
          .map((activity) => (
            <LearningActivityCard key={activity.id} activity={activity} />
          ))}
      </div>
    </section>
  );
}
