'use client';

import * as React from 'react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import type { ImportJob } from '@/lib/question-bank/qb-types';
import { IMPORT_JOB_STATUS_LABELS } from '@/lib/question-bank/qb-types';

function StatusDot({ status }: { status: ImportJob['status'] }) {
  const colorMap: Record<ImportJob['status'], string> = {
    PENDING: 'bg-slate-300',
    VALIDATING: 'bg-blue-400 animate-pulse',
    READY: 'bg-blue-400',
    IMPORTING: 'bg-amber-400 animate-pulse',
    COMPLETED: 'bg-emerald-500',
    PARTIAL: 'bg-amber-500',
    FAILED: 'bg-red-500',
    CANCELLED: 'bg-slate-300',
  };
  return (
    <span
      className={`inline-block size-2 rounded-full ${colorMap[status]}`}
      aria-label={IMPORT_JOB_STATUS_LABELS[status]}
    />
  );
}

function formatDuration(createdAt: string, completedAt?: string): string {
  if (!completedAt) return '—';
  const ms = new Date(completedAt).getTime() - new Date(createdAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

interface ImportJobHistoryProps {
  jobs: ImportJob[];
  loading: boolean;
}

export function ImportJobHistory({ jobs, loading }: ImportJobHistoryProps) {
  const questionBankJobs = jobs.filter((job) => job.domain === 'QUESTION_BANK');
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">Lịch sử nhập liệu</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-xs" aria-label="Lịch sử nhập liệu">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-500">Trạng thái</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-500">File</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-500">Định dạng</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-500">Tổng</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-500">Thành công</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-500">Lỗi</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-500">Trùng</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-500">Thời gian</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-500">Tạo lúc</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-500">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {Array.from({ length: 10 }).map((_, j) => (
                    <td key={j} className="px-3 py-2.5">
                      <Skeleton className="h-3 w-14" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && questionBankJobs.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-400">
                  Chưa có lần nhập nào.
                </td>
              </tr>
            )}
            {!loading &&
              questionBankJobs.map((job) => (
                <tr key={job.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <StatusDot status={job.status} />
                      <span>{IMPORT_JOB_STATUS_LABELS[job.status]}</span>
                    </div>
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2.5 text-slate-700">
                    {job.fileName}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-500">{job.format}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{job.totalRows}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600">
                    {job.successRows}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-red-600">
                    {job.failedRows}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                    {job.duplicateRows}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">
                    {formatDuration(job.createdAt, job.completedAt)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-400">
                    {new Date(job.createdAt).toLocaleString('vi-VN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {job.resumeSessionId ? (
                      <Link
                        href={`/admin/question-bank/import?session=${encodeURIComponent(job.resumeSessionId)}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        Tiếp tục
                      </Link>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
