'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { KnowledgeNodeType } from '@/lib/knowledge-tree/knowledge-tree-types';

export interface NodeEditorData {
  title: string;
  description: string;
  nodeType: KnowledgeNodeType;
  hasLearningContent: boolean;
}
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  entityLabel?: string;
  initialData?: Partial<NodeEditorData>;
  onSave: (data: NodeEditorData) => Promise<void>;
}

export function NodeEditorDialog({
  open,
  onOpenChange,
  mode,
  entityLabel = 'nội dung',
  initialData,
  onSave,
}: Props) {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [titleError, setTitleError] = React.useState('');

  React.useEffect(() => {
    if (open) {
      // Reset the draft when a different editing session is opened.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(initialData?.title || '');
      setDescription(initialData?.description || '');
      setError('');
      setTitleError('');
    }
  }, [open, initialData?.title, initialData?.description]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return setTitleError(`Tên ${entityLabel} không được để trống.`);
    try {
      setSubmitting(true);
      setError('');
      await onSave({
        title,
        description,
        nodeType: initialData?.nodeType || 'CHUA_PHAN_LOAI',
        hasLearningContent: !!initialData?.hasLearningContent,
      });
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu thay đổi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? `Thêm ${entityLabel}` : `Sửa ${entityLabel}`}
            </DialogTitle>
            <DialogDescription>Nhập tên dễ nhận biết trong chương trình học.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-5">
            {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="grid gap-2">
              <Label htmlFor="node-title">
                Tên {entityLabel} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="node-title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (event.target.value.trim()) setTitleError('');
                }}
                aria-invalid={!!titleError}
                aria-describedby={titleError ? 'node-title-error' : undefined}
                autoFocus
              />
              {titleError && (
                <p id="node-title-error" className="text-sm text-red-600">
                  {titleError}
                </p>
              )}
            </div>
            {(mode === 'edit' || entityLabel === 'chương') && (
              <div className="grid gap-2">
                <Label htmlFor="node-desc">Mô tả (không bắt buộc)</Label>
                <Textarea
                  id="node-desc"
                  rows={3}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
            )}
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
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
