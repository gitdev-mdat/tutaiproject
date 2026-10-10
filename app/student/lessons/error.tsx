'use client';

import { AlertCircle } from 'lucide-react';

export default function LessonsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-[480px] py-16 text-center">
      <AlertCircle className="mx-auto size-10 text-red-500" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-bold text-[#091224]">Không tải được bài học</h1>
      <p className="mt-2 text-[15px] text-slate-500">
        Có lỗi khi lấy nội dung. Em thử tải lại sau ít phút nhé.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#0052FF] px-5 text-[15px] font-bold text-white hover:bg-[#0044CC]"
      >
        Thử lại
      </button>
    </div>
  );
}
