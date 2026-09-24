'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Question } from '@/lib/question-bank/qb-types';

interface QuestionBankBulkActionsProps {
  selectedIds: Set<string>;
  onClearSelection: () => void;
  onBulkStatusChange: (status: Question['editorialStatus']) => Promise<void>;
  onBulkSetAccessTier: (tier: 'OPEN' | 'PLUS') => Promise<void>;
  onBulkSetRoadmap: (eligible: boolean) => Promise<void>;
}

export function QuestionBankBulkActions({
  selectedIds,
  onClearSelection,
  onBulkStatusChange,
  onBulkSetAccessTier,
  onBulkSetRoadmap,
}: QuestionBankBulkActionsProps) {
  const count = selectedIds.size;
  const [busy, setBusy] = React.useState(false);

  if (count === 0) return null;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="region"
      aria-label={`${count} câu hỏi đã chọn`}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-2.5"
    >
      {/* Count label */}
      <span className="text-sm font-semibold text-blue-800">{count} câu đã chọn</span>

      <div className="mx-1 h-4 w-px bg-blue-200" aria-hidden="true" />

      {/* Primary actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-7 border-blue-200 bg-white text-xs font-medium text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200"
          disabled={busy}
          onClick={() => run(() => onBulkStatusChange('PUBLISHED'))}
        >
          Xuất bản
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-7 border-blue-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50"
          disabled={busy}
          onClick={() => run(() => onBulkStatusChange('DRAFT'))}
        >
          Chuyển về nháp
        </Button>

        {/* More actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex h-7 items-center gap-1 rounded-md border border-blue-200 bg-white px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={busy}
          >
            Thêm
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => run(() => onBulkStatusChange('IN_REVIEW'))}>
              Gửi phản biện
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run(() => onBulkStatusChange('ARCHIVED'))}>
              Lưu trữ
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => run(() => onBulkSetAccessTier('OPEN'))}>
              Đặt thành OPEN
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run(() => onBulkSetAccessTier('PLUS'))}>
              Đặt thành PLUS
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => run(() => onBulkSetRoadmap(true))}>
              Đánh dấu lộ trình
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run(() => onBulkSetRoadmap(false))}>
              Bỏ lộ trình
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Deselect */}
      <button
        onClick={onClearSelection}
        className="ml-auto text-xs text-blue-600 hover:underline focus-visible:outline-none"
        aria-label="Bỏ chọn tất cả"
      >
        Bỏ chọn
      </button>
    </div>
  );
}
