import { Route } from 'lucide-react';

export function RoadmapSupportBanner({ targetScore }: { targetScore: number }) {
  return (
    <aside
      className="flex items-start gap-3.5 rounded-[18px] border border-blue-100 bg-gradient-to-r from-blue-50/80 to-slate-50/60 px-4 py-4 sm:items-center sm:px-5"
      aria-labelledby="roadmap-support-heading"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 ring-1 ring-blue-100">
        <Route size={18} strokeWidth={2} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h2 id="roadmap-support-heading" className="text-sm font-extrabold text-slate-900">
          Cứ đi từng bước một
        </h2>
        <p className="mt-1 text-sm leading-5 text-slate-600">
          Hoàn thành từng hoạt động nhỏ, Tú Tài sẽ điều chỉnh lộ trình để đưa em tiến gần hơn tới
          mục tiêu {targetScore}+.
        </p>
      </div>
    </aside>
  );
}
