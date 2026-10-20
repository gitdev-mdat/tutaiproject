'use client';

import * as React from 'react';
import { AlertTriangle, CircleDot, Loader2 } from 'lucide-react';
import type {
  ExtractedArtifactKind,
  TextbookExtractionJob,
  TextbookProcessingStatus,
  TextbookWorkerStatus,
} from '@/lib/textbook-reference/types';

export const DOCUMENT_STATUS: Record<TextbookProcessingStatus, { label: string; tone: string }> = {
  VERIFYING: { label: 'Đang chờ kiểm tra tệp', tone: 'bg-amber-50 text-amber-800 ring-amber-200' },
  REGISTERED: { label: 'Cần thiết lập trang', tone: 'bg-blue-50 text-blue-800 ring-blue-200' },
  INDEXING: { label: 'Đang đọc mục lục', tone: 'bg-amber-50 text-amber-800 ring-amber-200' },
  INDEXED: { label: 'Có mục lục', tone: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  FAILED: { label: 'Lỗi', tone: 'bg-red-50 text-red-700 ring-red-200' },
};

export const KIND_LABELS: Record<ExtractedArtifactKind, string> = {
  THEORY: 'Lí thuyết',
  METHOD: 'Phương pháp',
  WORKED_EXAMPLE: 'Ví dụ',
  EXERCISE: 'Bài tập',
  SOLUTION: 'Lời giải',
};

export function StatusPill({ status }: { status: TextbookProcessingStatus }) {
  const { label, tone } = DOCUMENT_STATUS[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${tone}`}
    >
      {label}
    </span>
  );
}

export function pageRange(start: number | null, end: number | null) {
  if (start === null) return 'chưa rõ trang';
  return end && end !== start ? `tr. ${start}–${end}` : `tr. ${start}`;
}

/**
 * The worker is a separate process. Its state comes from heartbeats only, so
 * the Admin is told plainly when queued work is waiting for it.
 */
export function WorkerNotice({
  worker,
  waiting,
  compact = false,
}: {
  worker: TextbookWorkerStatus;
  waiting: number;
  compact?: boolean;
}) {
  if (worker.online)
    return (
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <CircleDot className="size-3.5 text-emerald-600" aria-hidden="true" />
        Bộ xử lý đang chạy{worker.currentJobId ? ', đang làm một việc' : ''}.
      </p>
    );
  if (!waiting && compact) return null;
  return (
    <div
      role="status"
      className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900"
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <p>
        {waiting ? `${waiting} việc đang chờ vì bộ xử lý chưa chạy. ` : 'Bộ xử lý chưa chạy. '}
        Việc được giữ nguyên trong hàng đợi và tự chạy khi bộ xử lý bật
        {!compact && (
          <>
            {' '}
            (<code className="rounded bg-amber-100 px-1">pnpm textbooks:worker</code> trên máy đã
            cấu hình)
          </>
        )}
        .
        {worker.lastSeenAt && (
          <span className="text-amber-700">
            {' '}
            Lần cuối hoạt động: {formatTime(worker.lastSeenAt)}.
          </span>
        )}
      </p>
    </div>
  );
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

export function JobLine({
  job,
  onCancel,
  showError = true,
}: {
  job: TextbookExtractionJob;
  onCancel?: () => void;
  showError?: boolean;
}) {
  const what =
    job.kind === 'VERIFY'
      ? 'Kiểm tra tệp'
      : job.kind === 'INDEX_TOC'
        ? 'Đọc mục lục'
        : `Trích tr. ${job.printedPages.join(', ')}`;
  const text =
    job.status === 'QUEUED'
      ? 'đang chờ bộ xử lý'
      : job.status === 'RUNNING'
        ? `đang xử lý${job.attempts > 1 ? ` (lần ${job.attempts})` : ''}`
        : job.status === 'COMPLETED'
          ? job.cacheHit
            ? 'dùng lại kết quả đã có, không gọi AI'
            : 'hoàn tất'
          : job.status === 'CANCELLED'
            ? 'đã hủy'
            : 'thất bại';
  const tone =
    job.status === 'FAILED'
      ? 'text-red-700'
      : job.status === 'COMPLETED'
        ? 'text-slate-500'
        : 'text-amber-800';
  return (
    <p className={`flex flex-wrap items-center gap-x-1.5 text-xs ${tone}`}>
      {job.status === 'RUNNING' && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
      <span className="font-medium">{what}</span>
      <span>· {text}</span>
      <span className="text-slate-400">· {formatTime(job.updatedAt)}</span>
      {showError && job.status === 'FAILED' && job.error && (
        <span className="basis-full text-red-700">{job.error}</span>
      )}
      {job.status === 'QUEUED' && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="font-medium text-slate-600 underline-offset-2 hover:underline"
        >
          Hủy
        </button>
      )}
    </p>
  );
}

/** Polls while something is queued or running; stops when nothing is pending. */
export function usePolling(active: boolean, refresh: () => void, intervalMs = 4000) {
  React.useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(timer);
  }, [active, refresh, intervalMs]);
}
