'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
export function RoadmapWeekNavigation({
  current,
  total,
  onPrevious,
  onNext,
  canPrevious = true,
  canNext = true,
}: {
  current: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious?: boolean;
  canNext?: boolean;
}) {
  return (
    <nav
      className="flex items-center justify-between border-b border-slate-100 pb-4"
      aria-label="Chọn tuần học"
    >
      <button
        type="button"
        disabled={!canPrevious}
        onClick={onPrevious}
        className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-blue-600 disabled:opacity-40"
      >
        <ChevronLeft size={18} /> Tuần trước
      </button>
      <span className="text-sm font-bold text-[#091224]">
        Tuần {current} / {total}
      </span>
      <button
        type="button"
        disabled={!canNext}
        onClick={onNext}
        className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-blue-600 disabled:opacity-40"
      >
        Tuần sau <ChevronRight size={18} />
      </button>
    </nav>
  );
}
