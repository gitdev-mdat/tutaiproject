export default function LessonsLoading() {
  return (
    <div className="mx-auto w-full max-w-[880px] space-y-4 pt-1" aria-busy="true">
      <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
      <div className="h-9 w-64 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-28 animate-pulse rounded-[20px] bg-slate-200/70" />
      {[0, 1].map((item) => (
        <div key={item} className="h-48 animate-pulse rounded-2xl bg-slate-200/60" />
      ))}
      <span className="sr-only">Đang tải bài học…</span>
    </div>
  );
}
