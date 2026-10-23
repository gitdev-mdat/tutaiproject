'use client';

import * as React from 'react';
import { AlertTriangle, Check, CircleAlert, Clock, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BookState, BookStateTone } from '@/lib/textbook-reference/processing-state';
import type {
  ExtractedArtifactKind,
  TextbookExtractionJob,
  TextbookWorkerStatus,
} from '@/lib/textbook-reference/types';

const TONE_PILL: Record<BookStateTone, string> = {
  waiting: 'bg-amber-50 text-amber-800 ring-amber-200',
  working: 'bg-blue-50 text-blue-800 ring-blue-200',
  attention: 'bg-amber-50 text-amber-800 ring-amber-200',
  error: 'bg-red-50 text-red-700 ring-red-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export const KIND_LABELS: Record<ExtractedArtifactKind, string> = {
  THEORY: 'Lí thuyết',
  METHOD: 'Phương pháp',
  WORKED_EXAMPLE: 'Ví dụ',
  EXERCISE: 'Bài tập',
  SOLUTION: 'Lời giải',
};

export function StatusPill({ state }: { state: BookState }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${TONE_PILL[state.tone]}`}
    >
      {state.tone === 'working' && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
      {state.label}
    </span>
  );
}

export function pageRange(start: number | null, end: number | null) {
  if (start === null) return 'chưa rõ trang';
  return end && end !== start ? `tr. ${start}–${end}` : `tr. ${start}`;
}

/**
 * Queued work starts by itself (the server runs it right after it is queued,
 * and again whenever this page is open). The Admin only hears about it when a
 * job has waited unusually long, and never gets operator instructions.
 */
export function WorkerNotice({
  worker,
  jobs,
}: {
  worker: TextbookWorkerStatus;
  jobs: TextbookExtractionJob[];
}) {
  const now = useNow(30_000);
  if (worker.online) return null;
  const late = jobs.filter(
    (job) => job.status === 'QUEUED' && now - new Date(job.createdAt).getTime() > 3 * 60_000
  ).length;
  if (!late) return null;
  return (
    <div
      role="status"
      className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900"
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <p>
        {late} việc đã chờ hơn 3 phút mà chưa bắt đầu. Việc vẫn được giữ nguyên; giữ trang này mở để
        hệ thống chạy lại, hoặc tải lại trang sau ít phút.
      </p>
    </div>
  );
}

/** Wall-clock time, refreshed on an interval, for real elapsed times. */
export function useNow(intervalMs = 1000, active = true) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [active, intervalMs]);
  return now;
}

function elapsed(fromIso: string, now: number) {
  const seconds = Math.max(0, Math.round((now - new Date(fromIso).getTime()) / 1000));
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} phút ${seconds % 60} giây`;
}

const TOC_STEPS = ['Thiết lập trang', 'Chờ xử lý', 'AI đọc mục lục', 'Lưu mục lục'] as const;
type StepMark = 'done' | 'current' | 'failed' | 'todo';

function tocSteps(state: BookState): StepMark[] | null {
  switch (state.key) {
    case 'NEEDS_SETUP':
      return ['current', 'todo', 'todo', 'todo'];
    case 'READY_TO_READ':
      return ['done', 'todo', 'todo', 'todo'];
    case 'TOC_WAITING':
      return ['done', 'current', 'todo', 'todo'];
    case 'TOC_RUNNING':
      return ['done', 'done', 'current', 'todo'];
    case 'INTERRUPTED':
      return state.job?.kind === 'INDEX_TOC' ? ['done', 'done', 'failed', 'todo'] : null;
    case 'TOC_FAILED':
      return ['done', 'done', 'failed', 'todo'];
    case 'TOC_READY':
      return ['done', 'done', 'done', 'done'];
    default:
      return null;
  }
}

function Steps({ marks }: { marks: StepMark[] }) {
  return (
    <ol className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-4">
      {TOC_STEPS.map((label, index) => {
        const mark = marks[index];
        return (
          <li
            key={label}
            aria-current={mark === 'current' ? 'step' : undefined}
            className={`flex items-center gap-1.5 ${
              mark === 'todo'
                ? 'text-slate-400'
                : mark === 'failed'
                  ? 'font-medium text-red-700'
                  : mark === 'current'
                    ? 'font-medium text-slate-900'
                    : 'text-slate-600'
            }`}
          >
            <span
              className={`flex size-4 shrink-0 items-center justify-center rounded-full ring-1 ${
                mark === 'done'
                  ? 'bg-emerald-600 text-white ring-emerald-600'
                  : mark === 'failed'
                    ? 'bg-red-600 text-white ring-red-600'
                    : mark === 'current'
                      ? 'bg-white text-blue-700 ring-blue-500'
                      : 'bg-white ring-slate-300'
              }`}
              aria-hidden="true"
            >
              {mark === 'done' ? (
                <Check className="size-3" />
              ) : mark === 'failed' ? (
                <X className="size-3" />
              ) : mark === 'current' ? (
                <span className="size-1.5 rounded-full bg-blue-600" />
              ) : null}
            </span>
            {label}
            <span className="sr-only">
              {mark === 'done'
                ? ' (xong)'
                : mark === 'failed'
                  ? ' (thất bại)'
                  : mark === 'current'
                    ? ' (đang ở bước này)'
                    : ' (chưa tới)'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const CARD_TONE: Record<BookStateTone, string> = {
  waiting: 'border-amber-200 bg-amber-50/60',
  working: 'border-blue-200 bg-blue-50/60',
  attention: 'border-amber-200 bg-amber-50/60',
  error: 'border-red-200 bg-red-50/70',
  success: 'border-emerald-200 bg-emerald-50/50',
  neutral: 'border-slate-200 bg-white',
};

function StateIcon({ tone }: { tone: BookStateTone }) {
  const className = 'mt-0.5 size-4 shrink-0';
  if (tone === 'working')
    return <Loader2 className={`${className} animate-spin text-blue-700`} aria-hidden="true" />;
  if (tone === 'waiting')
    return <Clock className={`${className} text-amber-700`} aria-hidden="true" />;
  if (tone === 'error')
    return <CircleAlert className={`${className} text-red-700`} aria-hidden="true" />;
  if (tone === 'attention')
    return <AlertTriangle className={`${className} text-amber-700`} aria-hidden="true" />;
  if (tone === 'success')
    return <Check className={`${className} text-emerald-700`} aria-hidden="true" />;
  return null;
}

/**
 * The one primary status of a book: what is happening now, the real elapsed
 * time while something runs, the next action, and the technical facts behind
 * it folded away under "Chi tiết kỹ thuật".
 */
export function ProcessingCard({
  state,
  worker,
  action,
  onCancel,
}: {
  state: BookState;
  worker: TextbookWorkerStatus;
  action?: React.ReactNode;
  onCancel?: () => void;
}) {
  const running = state.key === 'TOC_RUNNING' || state.key === 'CHECK_RUNNING';
  const now = useNow(1000, running || state.key === 'TOC_WAITING' || state.key === 'CHECK_WAITING');
  const marks = tocSteps(state);
  const job = state.job;
  return (
    <section
      aria-labelledby="book-state-title"
      className={`rounded-xl border p-4 ${CARD_TONE[state.tone]}`}
    >
      <div role="status" aria-live="polite" className="flex gap-2.5">
        <StateIcon tone={state.tone} />
        <div className="min-w-0 flex-1">
          <h3 id="book-state-title" className="text-sm font-semibold text-slate-950">
            {state.title}
          </h3>
          <p className="mt-0.5 text-sm leading-6 text-slate-700">{state.description}</p>
          {running && job?.startedAt && (
            <p className="mt-1 text-xs text-slate-600">
              Bắt đầu lúc {formatTime(job.startedAt)} · đã chạy {elapsed(job.startedAt, now)}
              {job.attempts > 1 ? ` · lần thử ${job.attempts}` : ''}
            </p>
          )}
          {(state.key === 'TOC_WAITING' || state.key === 'CHECK_WAITING') && job && (
            <p className="mt-1 text-xs text-slate-600">Đã chờ {elapsed(job.createdAt, now)}</p>
          )}
        </div>
      </div>
      {marks && <Steps marks={marks} />}
      {(action || (onCancel && job?.status === 'QUEUED')) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {action}
          {onCancel && job?.status === 'QUEUED' && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Hủy yêu cầu
            </Button>
          )}
        </div>
      )}
      {job && <Diagnostics job={job} worker={worker} />}
    </section>
  );
}

const JOB_KIND: Record<TextbookExtractionJob['kind'], string> = {
  VERIFY: 'Kiểm tra tệp',
  INDEX_TOC: 'Đọc mục lục',
  EXTRACT: 'Trích trang',
};

function Diagnostics({
  job,
  worker,
}: {
  job: TextbookExtractionJob;
  worker: TextbookWorkerStatus;
}) {
  const rows: Array<[string, string]> = [
    ['Việc', `${JOB_KIND[job.kind]} · ${job.status}`],
    ['Mã việc', job.id],
    ['Số lần chạy', String(job.attempts)],
    ['Tạo lúc', formatTime(job.createdAt)],
  ];
  if (job.startedAt) rows.push(['Bắt đầu lần gần nhất', formatTime(job.startedAt)]);
  rows.push(['Cập nhật', formatTime(job.updatedAt)]);
  if (job.durationMs) rows.push(['Thời gian chạy', `${Math.round(job.durationMs / 1000)} giây`]);
  if (job.tocPdfPages?.length) rows.push(['Trang PDF', job.tocPdfPages.join(', ')]);
  if (job.errorCode)
    rows.push([
      'Loại lỗi',
      `${job.errorCode}${job.retryable === false ? ' · cần xử lý nguyên nhân trước khi thử lại' : ''}`,
    ]);
  if (job.errorDetail) rows.push(['Chi tiết lỗi', job.errorDetail]);
  rows.push([
    'Bộ xử lý',
    worker.online
      ? 'đang hoạt động'
      : worker.lastSeenAt
        ? `không hoạt động · lần cuối ${formatTime(worker.lastSeenAt)}`
        : 'không hoạt động',
  ]);
  return (
    <details className="group mt-3 text-xs text-slate-600">
      <summary className="cursor-pointer select-none font-medium text-slate-500 hover:text-slate-700">
        Chi tiết kỹ thuật
      </summary>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-white/70 p-3 ring-1 ring-slate-200">
        {rows.map(([term, value]) => (
          <React.Fragment key={term}>
            <dt className="text-slate-500">{term}</dt>
            <dd className="min-w-0 break-words font-mono text-[11px] text-slate-800">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </details>
  );
}

/** Earlier file checks and outline reads, folded away below the status. */
export function JobHistory({ jobs }: { jobs: TextbookExtractionJob[] }) {
  if (!jobs.length) return null;
  return (
    <details className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
      <summary className="cursor-pointer select-none font-medium text-slate-700">
        Lịch sử xử lý ({jobs.length})
      </summary>
      <ul className="mt-2 space-y-1.5">
        {jobs.map((job) => (
          <li key={job.id}>
            <JobLine job={job} />
          </li>
        ))}
      </ul>
    </details>
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
    job.kind === 'EXTRACT' ? `Trích tr. ${job.printedPages.join(', ')}` : JOB_KIND[job.kind];
  const text =
    job.status === 'QUEUED'
      ? 'đang chờ bắt đầu'
      : job.status === 'RUNNING'
        ? `đang chạy${job.attempts > 1 ? ` (lần ${job.attempts})` : ''}`
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
