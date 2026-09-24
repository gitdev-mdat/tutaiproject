'use client';

import * as React from 'react';
import Image from 'next/image';
import { Maximize2, Minus, Plus, RotateCcw, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { SourcePage } from '@/lib/content-import/types';

function formatBytes(value: number): string {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

export function ImagePreviewDialog({
  page,
  sessionId,
  open,
  onOpenChange,
}: {
  page: SourcePage | null;
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [zoom, setZoom] = React.useState(1);
  const [localRotation, setLocalRotation] = React.useState(0);
  const [view, setView] = React.useState<'ORIGINAL' | 'PROCESSED'>('PROCESSED');

  if (!page) return null;
  const rotation = view === 'ORIGINAL' ? localRotation : page.rotation + localRotation;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setZoom(1);
          setLocalRotation(0);
          setView('PROCESSED');
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="h-dvh max-w-none gap-0 rounded-none p-0 sm:h-[min(88vh,820px)] sm:max-w-5xl sm:rounded-xl">
        <DialogHeader className="border-b border-slate-200 px-4 py-3 pr-12">
          <DialogTitle>Trang {String(page.order).padStart(2, '0')}</DialogTitle>
          <DialogDescription className="truncate">
            {page.originalFileName} · {page.width}×{page.height} · {formatBytes(page.sizeBytes)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setView('ORIGINAL')}
                aria-pressed={view === 'ORIGINAL'}
                className={`h-7 rounded-md px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${view === 'ORIGINAL' ? 'bg-slate-100 text-slate-900' : 'text-slate-500'}`}
              >
                Ảnh gốc
              </button>
              <button
                type="button"
                onClick={() => setView('PROCESSED')}
                aria-pressed={view === 'PROCESSED'}
                className={`h-7 rounded-md px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${view === 'PROCESSED' ? 'bg-slate-100 text-slate-900' : 'text-slate-500'}`}
              >
                Bản xử lý
              </button>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}
                aria-label="Thu nhỏ ảnh"
              >
                <Minus />
              </Button>
              <span className="w-11 text-center text-xs tabular-nums text-slate-600">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
                aria-label="Phóng to ảnh"
              >
                <Plus />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setZoom(1)}>
                <Maximize2 /> Vừa chiều rộng
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setLocalRotation((value) => value - 90)}
                aria-label="Xoay trái bản xem trước"
              >
                <RotateCcw />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setLocalRotation((value) => value + 90)}
                aria-label="Xoay phải bản xem trước"
              >
                <RotateCw />
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4 sm:p-6">
            <div
              className="relative mx-auto min-h-[420px] origin-top overflow-hidden border border-slate-200 bg-white shadow-sm"
              style={{
                width: `${Math.max(50, zoom * 100)}%`,
                aspectRatio: `${page.width || 1} / ${page.height || 1}`,
              }}
            >
              <Image
                src={`/api/content-import/sessions/${sessionId}/pages/${page.id}/source`}
                alt={`Bản xem trước trang ${page.order}`}
                fill
                sizes="(max-width: 640px) 100vw, 900px"
                unoptimized
                className="object-contain transition-transform"
                style={{ transform: `rotate(${rotation}deg)` }}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
