import { ArrowRight, Check, Circle, LockKeyhole, Play } from 'lucide-react';
import type { RoadmapActivity } from '@/features/roadmap/lib/types';

export function RoadmapActivityItem({
  activity,
  onStart,
}: {
  activity: RoadmapActivity;
  onStart?: (activityId: string) => void;
}) {
  const active = activity.status === 'in_progress';
  const completed = activity.status === 'completed';
  const locked = activity.status === 'locked';
  return (
    <article className={`relative flex gap-4 ${locked ? 'opacity-60' : ''}`}>
      <div
        className={`z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 ${completed ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : active ? 'border-blue-500 bg-blue-500 text-white shadow-[0_0_0_4px_rgba(0,82,255,0.1)]' : 'border-slate-200 bg-white text-slate-400'}`}
      >
        {completed ? (
          <Check size={18} />
        ) : locked ? (
          <LockKeyhole size={16} />
        ) : active ? (
          <Play size={15} fill="currentColor" />
        ) : (
          <Circle size={16} />
        )}
      </div>
      <div
        className={`min-w-0 flex-1 rounded-2xl border p-4 ${active ? 'border-blue-200 bg-blue-50/60' : 'border-slate-100 bg-slate-50/50'}`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-[#091224]">{activity.title}</h3>
              {active && (
                <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">
                  Đang học
                </span>
              )}
            </div>
            {activity.description && (
              <p className="mt-1 text-sm text-slate-500">{activity.description}</p>
            )}
          </div>
          <span className="shrink-0 text-xs font-semibold text-slate-400">
            {activity.estimatedMinutes} phút
          </span>
        </div>
        {active && onStart && (
          <button
            type="button"
            onClick={() => onStart(activity.id)}
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0052FF] px-4 text-sm font-bold text-white hover:bg-[#0044CC] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Học bước này <ArrowRight size={16} />
          </button>
        )}
      </div>
    </article>
  );
}
