'use client';

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

export default function RoadmapError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto mt-6 max-w-[520px] rounded-[24px] border border-[#E5EBF3] bg-white px-6 py-10 text-center"
      data-testid="roadmap-error"
    >
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-red-50 text-red-500">
        <AlertCircle className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-[20px] font-extrabold text-[#091224]">Chưa tải được lộ trình</h1>
      <p className="mx-auto mt-2 max-w-[380px] text-[15px] leading-6 text-slate-500">
        Có lỗi khi lấy danh sách bài học. Tiến độ đọc của em vẫn được giữ nguyên.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center rounded-xl bg-[#0052FF] px-6 text-[15px] font-bold text-white hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          Thử lại
        </button>
        <Link
          href="/student/practice"
          className="text-[14px] font-semibold text-slate-600 hover:text-blue-700 hover:underline"
        >
          Sang Luyện tập
        </Link>
      </div>
    </div>
  );
}
