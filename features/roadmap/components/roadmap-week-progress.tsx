export function RoadmapWeekProgress({
  completed,
  total,
  percentage = total ? Math.round((completed / total) * 100) : 0,
}: {
  completed: number;
  total: number;
  percentage?: number;
}) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
      <div className="flex justify-between text-sm font-bold text-blue-700">
        <span>Tiến độ tuần này</span>
        <span>
          {completed} / {total}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
        <div
          className="h-full rounded-full bg-[#0052FF] transition-all"
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
    </div>
  );
}
