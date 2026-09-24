import { AlertCircle, CheckCircle2, Inbox } from 'lucide-react';
export function RoadmapLoadingView() {
  return (
    <div className="space-y-4" aria-label="Đang tải lộ trình">
      <div className="h-24 animate-pulse rounded-3xl bg-slate-100" />
      <div className="h-64 animate-pulse rounded-3xl bg-slate-100" />
    </div>
  );
}
export function RoadmapErrorView({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-red-100 bg-red-50 p-8 text-center">
      <AlertCircle className="mx-auto text-red-500" />
      <h2 className="mt-3 font-bold text-red-900">Không thể tải lộ trình</h2>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
      >
        Thử lại
      </button>
    </div>
  );
}
export function RoadmapEmptyView({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
      <Inbox className="mx-auto text-slate-400" />
      <h2 className="mt-3 font-bold text-[#091224]">Em chưa có lộ trình học</h2>
      {onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 rounded-xl bg-[#0052FF] px-4 py-2 text-sm font-bold text-white"
        >
          Tạo lộ trình
        </button>
      )}
    </div>
  );
}
export function RoadmapCompletedView() {
  return (
    <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-10 text-center">
      <CheckCircle2 className="mx-auto text-emerald-600" />
      <h2 className="mt-3 font-bold text-emerald-900">Em đã hoàn thành lộ trình hiện tại</h2>
      <p className="mt-2 text-sm text-emerald-700">Hãy xem lại tiến độ hoặc đặt mục tiêu mới.</p>
    </div>
  );
}
