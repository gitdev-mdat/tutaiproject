'use client';

import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { QuestionBankMetrics } from '@/lib/question-bank/qb-types';

interface QuestionBankMetricsProps {
  metrics: QuestionBankMetrics | null;
  loading: boolean;
}

/**
 * Compact inline summary line — replaces the 7-card KPI grid.
 * Renders as subtle secondary text, e.g.:
 * "1.248 câu hỏi · 1.102 đã xuất bản · 46 cần kiểm tra"
 */
export function QuestionBankMetricsRow({ metrics, loading }: QuestionBankMetricsProps) {
  if (loading) {
    return (
      <div role="status" aria-label="Đang tải số liệu" className="flex items-center gap-2">
        <Skeleton className="h-3.5 w-16" />
        <span className="text-slate-200" aria-hidden="true">
          ·
        </span>
        <Skeleton className="h-3.5 w-24" />
        <span className="text-slate-200" aria-hidden="true">
          ·
        </span>
        <Skeleton className="h-3.5 w-20" />
      </div>
    );
  }

  if (!metrics || metrics.total === 0) return null;

  const needsReview = (metrics.draft ?? 0) + (metrics.inReview ?? 0);

  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-slate-500">
      <span>{(metrics.total ?? 0).toLocaleString('vi-VN')} câu hỏi</span>
      <span className="select-none text-slate-300" aria-hidden="true">
        ·
      </span>
      <span>{(metrics.published ?? 0).toLocaleString('vi-VN')} đã xuất bản</span>
      {needsReview > 0 && (
        <>
          <span className="select-none text-slate-300" aria-hidden="true">
            ·
          </span>
          <span className="text-amber-600">{needsReview.toLocaleString('vi-VN')} cần kiểm tra</span>
        </>
      )}
    </p>
  );
}
