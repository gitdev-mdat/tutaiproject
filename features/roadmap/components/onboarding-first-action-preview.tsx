import { ArrowRight, Clock3 } from 'lucide-react';

export interface PreviewActivity {
  id: string;
  title: string;
  estimatedMinutes: number;
}
export function OnboardingFirstActionPreview({
  activities,
  onStart,
  isStarting = false,
}: {
  activities: PreviewActivity[];
  onStart: () => void;
  isStarting?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-3xl bg-[#091224] p-5 text-white shadow-sm sm:p-8 lg:p-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
            Bước đầu tiên
          </p>
          <h2 className="mt-2 break-words text-2xl font-extrabold">Bắt đầu với tuần đầu tiên</h2>
          <p className="mt-2 text-sm text-slate-300">Một vài hoạt động ngắn để tạo đà học tập.</p>
        </div>
        <button
          type="button"
          onClick={onStart}
          disabled={isStarting}
          aria-busy={isStarting}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-[#0052FF] hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white disabled:pointer-events-none disabled:opacity-70 sm:w-auto"
        >
          Bắt đầu lộ trình <ArrowRight size={16} />
        </button>
      </div>
      <div className="mt-6 grid gap-x-8 gap-y-3 sm:mt-7 sm:grid-cols-3">
        {activities.slice(0, 3).map((activity, index) => (
          <div key={activity.id} className="flex items-center gap-3 border-t border-slate-700 pt-4">
            <span className="text-sm font-bold text-blue-300">0{index + 1}</span>
            <span className="min-w-0 flex-1 font-semibold">{activity.title}</span>
            <span className="flex shrink-0 items-center gap-1 text-xs text-slate-300">
              <Clock3 size={14} />
              {activity.estimatedMinutes} phút
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
