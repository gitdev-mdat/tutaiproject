'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  GripVertical,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PAGE_TYPE_LABELS,
  type ImportSession,
  type PageType,
  type SourcePage,
} from '@/lib/content-import/types';

function formatBytes(value: number): string {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

const WARNING_LABELS: Record<string, string> = {
  DUPLICATE_IMAGE: 'Trùng ảnh',
  LOW_RESOLUTION: 'Độ phân giải thấp',
  LANDSCAPE: 'Cần kiểm tra hướng',
};

export function ExamImageList({
  session,
  selected,
  bulkType,
  onSelectedChange,
  onBulkTypeChange,
  onBulkApply,
  onAddFiles,
  onUpdate,
  onDelete,
  onReplace,
  onPreview,
}: {
  session: ImportSession;
  selected: Set<string>;
  bulkType: PageType;
  onSelectedChange: (ids: Set<string>) => void;
  onBulkTypeChange: (type: PageType) => void;
  onBulkApply: () => void;
  onAddFiles: (files: File[]) => void;
  onUpdate: (pages: SourcePage[]) => void;
  onDelete: (page: SourcePage) => void;
  onReplace: (page: SourcePage, file: File) => void;
  onPreview: (page: SourcePage) => void;
}) {
  const dragId = React.useRef<string | null>(null);
  const addInputRef = React.useRef<HTMLInputElement>(null);
  const replaceRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const warningCount = session.pages.reduce((sum, page) => sum + page.warnings.length, 0);

  function reorder(targetId: string): void {
    if (!dragId.current || dragId.current === targetId) return;
    const pages = [...session.pages];
    const from = pages.findIndex((page) => page.id === dragId.current);
    const to = pages.findIndex((page) => page.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = pages.splice(from, 1);
    pages.splice(to, 0, moved);
    onUpdate(pages.map((page, index) => ({ ...page, order: index + 1 })));
  }

  function moveTo(pageId: string, targetIndex: number): void {
    const pages = [...session.pages];
    const from = pages.findIndex((page) => page.id === pageId);
    if (from < 0 || targetIndex < 0 || targetIndex >= pages.length || from === targetIndex) return;
    const [moved] = pages.splice(from, 1);
    pages.splice(targetIndex, 0, moved);
    onUpdate(pages.map((page, index) => ({ ...page, order: index + 1 })));
  }

  function rotate(pageId: string, amount: -90 | 90): void {
    onUpdate(
      session.pages.map((page) =>
        page.id === pageId
          ? {
              ...page,
              rotation: ((page.rotation + amount + 360) % 360) as 0 | 90 | 180 | 270,
            }
          : page
      )
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <label className="flex min-h-8 items-center gap-2 text-xs font-medium text-slate-700">
          <Checkbox
            checked={selected.size === session.pages.length}
            onCheckedChange={(value) =>
              onSelectedChange(value ? new Set(session.pages.map((page) => page.id)) : new Set())
            }
            aria-label="Chọn tất cả ảnh"
          />
          {session.pages.length} ảnh
        </label>
        {warningCount > 0 && (
          <span className="text-[11px] text-amber-700">· {warningCount} cảnh báo</span>
        )}

        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          <input
            ref={addInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(event) => {
              if (event.target.files) onAddFiles(Array.from(event.target.files));
              event.target.value = '';
            }}
          />
          <Button variant="outline" size="sm" onClick={() => addInputRef.current?.click()}>
            <Upload /> Thêm ảnh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onSelectedChange(
                selected.size === session.pages.length
                  ? new Set()
                  : new Set(session.pages.map((page) => page.id))
              )
            }
          >
            {selected.size > 0 ? 'Bỏ chọn' : 'Chọn nhiều'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
              onUpdate(
                [...session.pages]
                  .sort((a, b) => collator.compare(a.originalFileName, b.originalFileName))
                  .map((page, index) => ({ ...page, order: index + 1 }))
              );
            }}
          >
            Sắp xếp tự động
          </Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-blue-100 bg-blue-50 px-3 py-2">
          <span className="text-xs font-semibold text-blue-800">Đã chọn {selected.size} trang</span>
          <select
            value={bulkType}
            onChange={(event) => onBulkTypeChange(event.target.value as PageType)}
            aria-label="Loại trang áp dụng hàng loạt"
            className="h-7 rounded-md border border-blue-200 bg-white px-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(PAGE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button size="xs" onClick={onBulkApply}>
            Gán loại trang
          </Button>
        </div>
      )}

      <ul className="divide-y divide-slate-100">
        {session.pages.map((page) => (
          <li
            key={page.id}
            draggable
            onDragStart={() => {
              dragId.current = page.id;
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => reorder(page.id)}
            className="group grid grid-cols-[auto_auto_56px_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 sm:grid-cols-[auto_auto_56px_minmax(160px,1fr)_148px_auto] lg:grid-cols-[auto_auto_56px_minmax(200px,1fr)_160px_auto]"
          >
            <button
              type="button"
              className="hidden cursor-grab touch-none rounded p-1 text-slate-300 outline-none hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-blue-500 sm:block"
              aria-label={`Kéo để đổi vị trí trang ${page.order}`}
            >
              <GripVertical className="size-4" />
            </button>
            <Checkbox
              checked={selected.has(page.id)}
              onCheckedChange={(value) => {
                const next = new Set(selected);
                if (value) next.add(page.id);
                else next.delete(page.id);
                onSelectedChange(next);
              }}
              aria-label={`Chọn trang ${page.order}`}
            />
            <button
              type="button"
              onClick={() => onPreview(page)}
              className="relative h-[72px] w-14 overflow-hidden rounded border border-slate-200 bg-slate-50 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={`Xem lớn trang ${page.order}`}
            >
              <Image
                src={`/api/content-import/sessions/${session.id}/pages/${page.id}/source`}
                alt=""
                fill
                sizes="56px"
                unoptimized
                className="object-cover"
                style={{ transform: `rotate(${page.rotation}deg)` }}
              />
            </button>

            <div className="min-w-0 self-start pt-0.5">
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`page-order-${page.id}`}>
                  Vị trí trang {page.order}
                </label>
                <select
                  id={`page-order-${page.id}`}
                  value={page.order}
                  onChange={(event) => moveTo(page.id, Number(event.target.value) - 1)}
                  className="h-6 rounded border border-slate-200 bg-slate-50 px-1 text-[11px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {session.pages.map((_, index) => (
                    <option key={index + 1} value={index + 1}>
                      Trang {String(index + 1).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1.5 truncate text-xs font-medium text-slate-800">
                {page.originalFileName}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {formatBytes(page.sizeBytes)} · {page.width}×{page.height}
              </p>
              {page.warnings.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {page.warnings.map((warning) => (
                    <span
                      key={warning}
                      className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800"
                    >
                      {WARNING_LABELS[warning] ?? warning}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <label className="col-span-3 grid gap-1 text-[11px] font-medium text-slate-500 sm:col-span-1">
              <span className="sm:sr-only">Loại trang</span>
              <select
                aria-label={`Loại trang ${page.order}`}
                value={page.pageType}
                onChange={(event) =>
                  onUpdate(
                    session.pages.map((item) =>
                      item.id === page.id
                        ? { ...item, pageType: event.target.value as PageType }
                        : item
                    )
                  )
                }
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                {Object.entries(PAGE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <div className="col-start-5 row-start-1 flex items-center justify-end self-start sm:col-start-auto sm:row-start-auto sm:self-center">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => rotate(page.id, 90)}
                aria-label={`Xoay phải trang ${page.order}`}
              >
                <RotateCw />
              </Button>
              <input
                ref={(node) => {
                  replaceRefs.current[page.id] = node;
                }}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onReplace(page, file);
                  event.target.value = '';
                }}
              />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Thêm thao tác cho trang ${page.order}`}
                    />
                  }
                >
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => onPreview(page)}>
                    <Eye /> Xem lớn
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => rotate(page.id, -90)}>
                    <RotateCcw /> Xoay trái
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => rotate(page.id, 90)}>
                    <RotateCw /> Xoay phải
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={page.order === 1}
                    onClick={() => moveTo(page.id, page.order - 2)}
                  >
                    <ChevronUp /> Chuyển lên
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={page.order === session.pages.length}
                    onClick={() => moveTo(page.id, page.order)}
                  >
                    <ChevronDown /> Chuyển xuống
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => replaceRefs.current[page.id]?.click()}>
                    <RefreshCw /> Thay ảnh
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(page)}>
                    <Trash2 /> Xóa ảnh
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
