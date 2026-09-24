'use client';

import * as React from 'react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { EditorialStatusBadge } from './qb-badges';
import type { Question } from '@/lib/question-bank/qb-types';
import {
  QUESTION_TYPE_LABELS,
  DIFFICULTY_LABELS,
  SUBJECT_LABELS,
} from '@/lib/question-bank/qb-types';

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <tr>
      <td colSpan={9} className="py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-slate-100">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-slate-400"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-700">Không tìm thấy câu hỏi phù hợp</p>
          <p className="text-xs text-slate-500">Thử thay đổi từ khóa hoặc xóa bớt bộ lọc.</p>
          <button
            onClick={onClearFilters}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            Xóa bộ lọc
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Row action menu ──────────────────────────────────────────────────────────

function RowActions({
  question,
  onStatusChange,
}: {
  question: Question;
  onStatusChange: (id: string, status: Question['editorialStatus']) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="Thao tác"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem>
          <Link
            href={`/admin/question-bank/${question.id}`}
            className="flex w-full items-center gap-2"
          >
            Xem chi tiết
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link
            href={`/admin/question-bank/${question.id}?edit=true`}
            className="flex w-full items-center gap-2"
          >
            Chỉnh sửa
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {question.editorialStatus === 'DRAFT' && (
          <DropdownMenuItem onClick={() => onStatusChange(question.id, 'IN_REVIEW')}>
            Gửi phản biện
          </DropdownMenuItem>
        )}
        {question.editorialStatus === 'IN_REVIEW' && (
          <DropdownMenuItem onClick={() => onStatusChange(question.id, 'PUBLISHED')}>
            Xuất bản
          </DropdownMenuItem>
        )}
        {question.editorialStatus !== 'ARCHIVED' && (
          <DropdownMenuItem
            onClick={() => onStatusChange(question.id, 'ARCHIVED')}
            className="text-slate-500"
          >
            Lưu trữ
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Table skeleton ───────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100">
          <td className="px-3 py-3">
            <Skeleton className="size-4" />
          </td>
          <td className="px-3 py-3">
            <Skeleton className="h-3.5 w-24 font-mono" />
          </td>
          <td className="px-3 py-3">
            <Skeleton className="h-3.5 w-56" />
          </td>
          <td className="px-3 py-3">
            <Skeleton className="h-3 w-32" />
          </td>
          <td className="px-3 py-3">
            <Skeleton className="h-5 w-16 rounded-full" />
          </td>
          <td className="px-3 py-3">
            <Skeleton className="h-3.5 w-16" />
          </td>
          <td className="px-3 py-3">
            <Skeleton className="h-5 w-20 rounded-full" />
          </td>
          <td className="px-3 py-3">
            <Skeleton className="h-3.5 w-16" />
          </td>
          <td className="px-3 py-3">
            <Skeleton className="size-7" />
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Knowledge breadcrumb cell ────────────────────────────────────────────────

function KnowledgeCell({ question }: { question: Question }) {
  // Build a breadcrumb from available curriculum/concept data
  const parts: string[] = [];

  if (question.subjectId) {
    parts.push(SUBJECT_LABELS[question.subjectId]);
  }
  if (question.chapterId) parts.push(question.chapterId);
  if (question.lessonId) parts.push(question.lessonId);
  if (question.conceptCodes?.[0]) parts.push(question.conceptCodes[0]);

  if (parts.length === 0) return <span className="text-slate-300">—</span>;

  // Show at most 3 levels, truncate gracefully
  const visible = parts.slice(0, 3);

  return (
    <span
      className="inline-flex max-w-[220px] items-center gap-0.5 text-xs text-slate-600"
      title={parts.join(' › ')}
    >
      {visible.map((p, i) => (
        <React.Fragment key={`${p}-${i}`}>
          {i > 0 && (
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-slate-300"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          )}
          <span className="truncate">{p}</span>
        </React.Fragment>
      ))}
    </span>
  );
}

// ─── Main table ───────────────────────────────────────────────────────────────

interface QuestionBankTableProps {
  questions: Question[];
  loading: boolean;
  initialLoad?: boolean;
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: string, checked: boolean) => void;
  onClearFilters: () => void;
  onStatusChange: (id: string, status: Question['editorialStatus']) => void;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}

export function QuestionBankTable({
  questions,
  loading,
  initialLoad = false,
  selectedIds,
  onSelectAll,
  onSelectOne,
  onClearFilters,
  onStatusChange,
  total,
  page,
  pageSize,
  onPageChange,
}: QuestionBankTableProps) {
  const allSelected = questions.length > 0 && questions.every((q) => selectedIds.has(q.id));
  const someSelected = !allSelected && questions.some((q) => selectedIds.has(q.id));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm" role="grid" aria-label="Danh sách câu hỏi">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {/* Checkbox */}
              <th scope="col" className="w-10 px-3 py-2.5">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={(v) => onSelectAll(!!v)}
                  aria-label="Chọn tất cả"
                />
              </th>
              {/* Mã */}
              <th
                scope="col"
                className="w-32 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"
              >
                Mã
              </th>
              {/* Câu hỏi — gets most space */}
              <th
                scope="col"
                className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"
              >
                Câu hỏi
              </th>
              {/* Kiến thức breadcrumb */}
              <th
                scope="col"
                className="hidden w-52 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 lg:table-cell"
              >
                Kiến thức
              </th>
              {/* Loại */}
              <th
                scope="col"
                className="hidden w-28 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:table-cell"
              >
                Loại
              </th>
              {/* Độ khó */}
              <th
                scope="col"
                className="hidden w-24 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 md:table-cell"
              >
                Độ khó
              </th>
              {/* Trạng thái */}
              <th
                scope="col"
                className="w-28 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"
              >
                Trạng thái
              </th>
              {/* Cập nhật */}
              <th
                scope="col"
                className="hidden w-28 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 xl:table-cell"
              >
                Cập nhật
              </th>
              {/* Actions */}
              <th scope="col" className="w-10 px-3 py-2.5">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody
            className={
              loading && !initialLoad ? 'opacity-60 pointer-events-none transition-opacity' : ''
            }
          >
            {initialLoad ? (
              <TableSkeleton />
            ) : questions.length === 0 ? (
              <EmptyState onClearFilters={onClearFilters} />
            ) : (
              questions.map((q) => (
                <tr
                  key={q.id}
                  className="group border-b border-slate-100 transition-colors hover:bg-slate-50/70 focus-within:bg-slate-50/70"
                >
                  {/* Checkbox */}
                  <td className="px-3 py-3">
                    <Checkbox
                      checked={selectedIds.has(q.id)}
                      onCheckedChange={(v) => onSelectOne(q.id, !!v)}
                      aria-label={`Chọn câu ${q.code}`}
                    />
                  </td>

                  {/* Code */}
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/question-bank/${q.id}`}
                      className="font-mono text-xs font-medium text-blue-600 hover:underline"
                    >
                      {q.code}
                    </Link>
                  </td>

                  {/* Stem preview — widest column */}
                  <td className="px-3 py-3">
                    <div className="line-clamp-2 max-w-[340px] text-xs text-slate-800">
                      {q.hasMedia && (
                        <svg
                          className="mr-1 inline-block text-slate-400"
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-label="Có hình ảnh"
                        >
                          <rect width="18" height="18" x="3" y="3" rx="2" />
                          <circle cx="9" cy="9" r="2" />
                          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                        </svg>
                      )}
                      {q.stem}
                    </div>
                    {/* Secondary text on narrow screens: type + code */}
                    <p className="mt-0.5 text-[10px] text-slate-400 sm:hidden">
                      {q.code} · {QUESTION_TYPE_LABELS[q.questionType]}
                    </p>
                  </td>

                  {/* Kiến thức breadcrumb — hidden on small screens */}
                  <td className="hidden px-3 py-3 lg:table-cell">
                    <KnowledgeCell question={q} />
                  </td>

                  {/* Loại — hidden on mobile */}
                  <td className="hidden px-3 py-3 sm:table-cell">
                    <span className="text-xs text-slate-600">
                      {QUESTION_TYPE_LABELS[q.questionType]}
                    </span>
                  </td>

                  {/* Độ khó — hidden on mobile+tablet */}
                  <td className="hidden px-3 py-3 md:table-cell">
                    <span className="text-xs text-slate-600">
                      {DIFFICULTY_LABELS[q.difficulty]}
                    </span>
                  </td>

                  {/* Trạng thái */}
                  <td className="px-3 py-3">
                    <EditorialStatusBadge status={q.editorialStatus} />
                  </td>

                  {/* Cập nhật — hidden except xl */}
                  <td className="hidden px-3 py-3 xl:table-cell">
                    <span className="text-xs text-slate-400">
                      {new Date(q.updatedAt).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-3">
                    <RowActions question={q} onStatusChange={onStatusChange} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-500">
            Hiển thị {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} /{' '}
            {total.toLocaleString('vi-VN')} câu
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              aria-label="Trang trước"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Button>
            <span className="px-2 text-xs text-slate-600">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              aria-label="Trang sau"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
