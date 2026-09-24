'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { KnowledgeSource } from '@/lib/knowledge-tree/knowledge-tree-types';

interface SourceImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scopeNodeTitle: string;
  onAttach: (input: Omit<KnowledgeSource, 'id' | 'scopeNodeId' | 'createdAt'>) => Promise<void>;
}

export function SourceImportDialog({
  open,
  onOpenChange,
  scopeNodeTitle,
  onAttach,
}: SourceImportDialogProps) {
  const [name, setName] = React.useState('');
  const [sourceType, setSourceType] = React.useState<'PDF' | 'DOCX' | 'NOTE' | 'URL'>('PDF');
  const [submitting, setSubmitting] = React.useState(false);

  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName('');
      setSourceType('PDF');
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSubmitting(true);
      await onAttach({
        name,
        sourceType,
        status: 'ATTACHED',
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Thêm nguồn tài liệu</DialogTitle>
            <DialogDescription>
              Tài liệu sẽ được gắn vào phạm vi: <strong>{scopeNodeTitle} và các mục con</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
              <p className="font-semibold mb-1">AI sẽ dùng tài liệu này để:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Hiểu nội dung nguồn trong phạm vi {scopeNodeTitle}</li>
                <li>Tìm phần phù hợp với các mục trong cây</li>
                <li>Hỗ trợ viết nội dung học và ghi lại nguồn tham khảo</li>
              </ul>
            </div>

            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <strong>An toàn:</strong> AI không tự thay đổi cấu trúc cây. Nếu phát hiện thiếu sót,
              AI sẽ đề xuất để bạn xem xét.
            </div>

            <div className="grid gap-2">
              <Label htmlFor="source-type">Định dạng</Label>
              <select
                id="source-type"
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                value={sourceType}
                onChange={(event) =>
                  setSourceType(event.target.value as KnowledgeSource['sourceType'])
                }
              >
                <option value="PDF">Tài liệu PDF</option>
                <option value="DOCX">Tài liệu Word (.docx)</option>
                <option value="NOTE">Ghi chú (Text)</option>
                <option value="URL">Đường dẫn trang web</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="source-name">
                Tên / Tập tin <span className="text-red-500">*</span>
              </Label>
              <Input
                id="source-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Toan12_KetNoiTriThuc_Tap1.pdf"
                autoFocus
              />
              <p className="text-xs text-slate-500">
                Trong phiên bản thử nghiệm này, bạn chỉ cần nhập tên giả lập.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={!name.trim() || submitting}>
              {submitting ? 'Đang thêm...' : 'Thêm tài liệu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
