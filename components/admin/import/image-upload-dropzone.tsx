'use client';

import * as React from 'react';
import { ClipboardPaste, Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ImageUploadDropzone({
  compact = false,
  disabled = false,
  remaining,
  onFiles,
}: {
  compact?: boolean;
  disabled?: boolean;
  remaining: number;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  function acceptFiles(files: FileList | null): void {
    if (files && !disabled) onFiles(Array.from(files));
  }

  return (
    <div
      role="group"
      aria-disabled={disabled}
      aria-label="Chọn hoặc thả ảnh đề thi"
      className={`group rounded-lg border border-dashed outline-none transition-colors ${
        dragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/30'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${
        compact ? 'flex items-center gap-3 px-4 py-3' : 'px-6 py-7 text-center'
      }`}
      onClick={() => inputRef.current?.click()}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        acceptFiles(event.dataTransfer.files);
      }}
      onPaste={(event) => {
        const files = Array.from(event.clipboardData.files).filter((file) =>
          file.type.startsWith('image/')
        );
        if (files.length > 0) {
          event.preventDefault();
          onFiles(files);
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          acceptFiles(event.target.files);
          event.target.value = '';
        }}
      />

      <span
        className={`grid shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 ${compact ? 'size-9' : 'mx-auto size-10'}`}
      >
        {compact ? <Plus className="size-4" /> : <Upload className="size-5" />}
      </span>
      <div className={compact ? 'min-w-0 flex-1' : ''}>
        <p className="text-sm font-semibold text-slate-800">
          {compact ? 'Thêm ảnh vào phiên import' : 'Kéo ảnh vào đây hoặc chọn từ máy'}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          JPG, JPEG, PNG, WEBP · tối đa {remaining} ảnh nữa · 12 MB mỗi ảnh
        </p>
      </div>
      {compact ? (
        <Button
          type="button"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Thêm ảnh
        </Button>
      ) : (
        <>
          <Button
            type="button"
            className="mt-4"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              inputRef.current?.click();
            }}
          >
            Chọn ảnh
          </Button>
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-500">
            <ClipboardPaste className="size-3" aria-hidden="true" /> Có thể dán ảnh từ clipboard
          </p>
        </>
      )}
    </div>
  );
}
