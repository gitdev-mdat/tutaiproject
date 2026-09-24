'use client';

import { ArrowLeft, MoreHorizontal, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type ImportSaveState = 'IDLE' | 'SAVING' | 'SAVED' | 'ERROR';

function savedLabel(state: ImportSaveState, savedAt?: Date): string {
  if (state === 'SAVING') return 'Đang lưu…';
  if (state === 'ERROR') return 'Không thể lưu thay đổi';
  if (savedAt) {
    return `Đã lưu lúc ${savedAt.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }
  return 'Bản nháp chưa lưu';
}

export function ImportWorkflowHeader({
  saveState,
  savedAt,
  hasSession,
  onBack,
  onSaveAndExit,
  onCancel,
}: {
  saveState: ImportSaveState;
  savedAt?: Date;
  hasSession: boolean;
  onBack: () => void;
  onSaveAndExit: () => void;
  onCancel: () => void;
}) {
  return (
    <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-600 outline-none hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Quản lý đề thi</span>
        <span className="sm:hidden">Quay lại</span>
      </button>

      <div className="min-w-0 flex-1 border-l border-slate-200 pl-3">
        <p className="truncate text-sm font-semibold text-slate-900">Import đề từ ảnh</p>
        <p
          role="status"
          aria-live="polite"
          className={`truncate text-[11px] ${saveState === 'ERROR' ? 'text-red-600' : 'text-slate-500'}`}
        >
          {savedLabel(saveState, savedAt)}
        </p>
      </div>

      <Button
        variant="outline"
        onClick={onSaveAndExit}
        disabled={saveState === 'SAVING'}
        aria-label="Lưu nháp và thoát"
      >
        <Save />
        <span className="hidden md:inline">Lưu nháp và thoát</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label="Mở thêm thao tác" />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem variant="destructive" disabled={!hasSession} onClick={onCancel}>
            Hủy phiên import
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
