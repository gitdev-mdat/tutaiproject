'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export function QuestionBankHeader() {
  const searchParams = useSearchParams();
  const curriculumItemId = searchParams.get('curriculumItemId');
  const contextQuery = curriculumItemId
    ? `?curriculumItemId=${encodeURIComponent(curriculumItemId)}`
    : '';

  return (
    <div className="flex flex-wrap items-start gap-3 sm:items-center">
      {/* Left: title + description */}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Ngân hàng câu hỏi</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Quản lý câu hỏi dùng cho đề thi và lộ trình học tập.
        </p>
      </div>

      {/* Right: actions */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Link
          href={`/admin/question-bank/import${contextQuery}`}
          id="qb-import-questions-btn"
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground whitespace-nowrap transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Nhập câu hỏi
        </Link>

        <Link
          href={`/admin/question-bank/new${contextQuery}`}
          id="qb-add-question-btn"
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          Thêm câu hỏi
        </Link>
      </div>
    </div>
  );
}
