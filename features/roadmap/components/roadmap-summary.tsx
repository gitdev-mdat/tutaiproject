'use client';

import Link from 'next/link';
import { Check, Circle, LockKeyhole, RotateCcw, Target } from 'lucide-react';
import type { RoadmapStageItem, StudentRoadmapDashboard } from '@/features/roadmap/lib/types';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const STAGE_ITEM_ICONS = {
  completed: Check,
  current: Circle,
  upcoming: Circle,
  locked: LockKeyhole,
  needs_review: RotateCcw,
} as const;

function getCurrentChapterContext(dashboard: StudentRoadmapDashboard) {
  const orderedStages = [...dashboard.stages].sort((first, second) => first.order - second.order);
  const stage =
    orderedStages.find((candidate) => candidate.items.some((item) => item.status === 'current')) ??
    orderedStages[0];

  if (!stage) return null;

  const foundCurrentIndex = stage.items.findIndex((item) => item.status === 'current');
  const currentIndex = foundCurrentIndex >= 0 ? foundCurrentIndex : 0;

  return {
    stage,
    currentPosition: currentIndex + 1,
    visibleItems: stage.items.slice(Math.max(0, currentIndex - 2), currentIndex + 2),
  };
}

function CompactLessonRow({ item }: { item: RoadmapStageItem }) {
  const ItemIcon = STAGE_ITEM_ICONS[item.status];
  const isCurrent = item.status === 'current';
  const isCompleted = item.status === 'completed';
  const isLocked = item.status === 'locked';
  const isInteractive = Boolean(item.href) && !isLocked;
  const rowClassName = `flex min-h-10 items-center gap-2.5 rounded-lg px-2 py-2 transition-colors ${
    isCurrent ? 'bg-blue-50/70' : isInteractive ? 'hover:bg-slate-50 focus-visible:bg-slate-50' : ''
  }`;
  const content = (
    <>
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
          isCompleted
            ? 'bg-emerald-50 text-emerald-600'
            : isCurrent
              ? 'bg-blue-100 text-blue-700'
              : 'text-slate-400'
        }`}
      >
        <ItemIcon size={isLocked ? 13 : 12} strokeWidth={isCurrent ? 3 : 2.5} aria-hidden="true" />
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          isCurrent
            ? 'font-extrabold text-blue-950'
            : isLocked
              ? 'font-medium text-slate-500'
              : 'font-semibold text-slate-700'
        }`}
      >
        {item.title}
      </span>
      {isCurrent ? (
        <span className="shrink-0 text-[11px] font-bold text-blue-600">Đang học</span>
      ) : item.status === 'upcoming' || isLocked ? (
        <span className="shrink-0 text-[11px] font-semibold text-slate-400">Tiếp theo</span>
      ) : null}
    </>
  );

  if (isInteractive && item.href) {
    return (
      <Link
        href={item.href}
        className={`${rowClassName} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1`}
        aria-label={
          isCompleted ? `Ôn lại ${item.title}` : `${isCurrent ? 'Học tiếp' : 'Mở'} ${item.title}`
        }
      >
        {content}
      </Link>
    );
  }

  return <div className={rowClassName}>{content}</div>;
}

function FullRoadmapSheet({ dashboard }: { dashboard: StudentRoadmapDashboard }) {
  return (
    <Sheet>
      <SheetTrigger className="mt-3 w-full rounded-xl border border-slate-200 py-2 text-sm font-bold text-blue-600 transition hover:border-blue-200 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
        Xem toàn bộ lộ trình
      </SheetTrigger>
      <SheetContent className="w-[min(92vw,440px)] overflow-y-auto sm:max-w-[440px]">
        <SheetHeader className="border-b border-slate-100 p-6 pr-12">
          <SheetTitle className="text-xl font-extrabold text-slate-900">Lộ trình của em</SheetTitle>
          <SheetDescription className="mt-2 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <Target size={14} aria-hidden="true" /> Mục tiêu {dashboard.targetScore}+
            </span>
            <span>{dashboard.progress.roadmapPercentage}% hoàn thành</span>
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-6 pb-8">
          {[...dashboard.stages]
            .sort((first, second) => first.order - second.order)
            .map((stage) => (
              <section key={stage.id} aria-labelledby={`${stage.id}-heading`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-600">
                  Giai đoạn {stage.order}
                </p>
                <h3 id={`${stage.id}-heading`} className="mt-1 font-extrabold text-slate-900">
                  {stage.title}
                </h3>
                <ol className="mt-3 space-y-1">
                  {stage.items.map((item) => {
                    const ItemIcon = STAGE_ITEM_ICONS[item.status];
                    return (
                      <li key={item.id} className="flex items-center gap-3 px-2 py-2.5">
                        <span
                          className={`flex size-7 items-center justify-center rounded-full ${item.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : item.status === 'current' ? 'bg-blue-50 text-blue-600' : item.status === 'needs_review' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}
                        >
                          <ItemIcon size={14} aria-hidden="true" />
                        </span>
                        <span
                          className={`text-sm font-semibold ${item.status === 'locked' ? 'text-slate-400' : 'text-slate-700'}`}
                        >
                          {item.title}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function RoadmapSummary({ dashboard }: { dashboard: StudentRoadmapDashboard }) {
  const percentage = dashboard.progress.roadmapPercentage;
  const chapterContext = getCurrentChapterContext(dashboard);

  return (
    <aside
      className="rounded-[18px] border border-slate-200 bg-white p-4"
      aria-labelledby="roadmap-summary-heading"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="roadmap-summary-heading" className="text-lg font-extrabold text-slate-900">
            Lộ trình của em
          </h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Mục tiêu {dashboard.targetScore}+
          </p>
        </div>
        <strong className="pt-0.5 text-sm text-blue-700">{percentage}%</strong>
      </div>
      <div
        className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100"
        aria-label={`Tiến độ lộ trình ${percentage}%`}
      >
        <div
          className="h-full rounded-full bg-blue-600 transition-[width] duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {chapterContext ? (
        <section
          className="mt-4 border-t border-slate-100 pt-3"
          aria-labelledby="current-chapter-heading"
        >
          <div className="flex items-center justify-between gap-3 px-2">
            <h3
              id="current-chapter-heading"
              className="truncate text-xs font-extrabold uppercase tracking-[0.09em] text-slate-700"
            >
              {chapterContext.stage.title}
            </h3>
            <span className="shrink-0 text-xs font-bold tabular-nums text-slate-500">
              {chapterContext.currentPosition}/{chapterContext.stage.items.length}
            </span>
          </div>
          <ol className="mt-1">
            {chapterContext.visibleItems.map((item) => (
              <li key={item.id}>
                <CompactLessonRow item={item} />
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <FullRoadmapSheet dashboard={dashboard} />
    </aside>
  );
}
