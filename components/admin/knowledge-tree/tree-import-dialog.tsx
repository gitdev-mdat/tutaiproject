'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  parseOutlineText,
  type ImportPreviewNode,
  type ImportPreviewResult,
} from '@/lib/knowledge-tree/knowledge-tree-import';
import type { KnowledgeTreeNode } from '@/lib/knowledge-tree/knowledge-tree-types';
import { ChevronDown, ChevronRight, FileText, Upload } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destinationNodeId: string | null;
  destinationTitle: string | null;
  existingNodes?: KnowledgeTreeNode[];
  onApply: (preview: ImportPreviewResult) => Promise<void>;
}
const key = (s: string) => s.trim().toLocaleLowerCase('vi');

export function TreeImportDialog({
  open,
  onOpenChange,
  destinationTitle,
  existingNodes = [],
  onApply,
}: Props) {
  const [step, setStep] = React.useState<1 | 2>(1);
  const [text, setText] = React.useState('');
  const [preview, setPreview] = React.useState<ImportPreviewResult | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [duplicates, setDuplicates] = React.useState<Set<string>>(new Set());
  const [importDuplicates, setImportDuplicates] = React.useState(false);
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setStep(1);
      setText('');
      setPreview(null);
      setError('');
      setImportDuplicates(false);
    }
    onOpenChange(nextOpen);
  };
  const roots = preview?.nodes.filter((n) => n.parentTemporaryId === null) || [];
  const children = (id: string) => preview?.nodes.filter((n) => n.parentTemporaryId === id) || [];
  const parse = () => {
    if (!text.trim()) return setError('Hãy dán nội dung hoặc chọn một tệp TXT/Markdown.');
    const result = parseOutlineText(text);
    if (!result.nodes.some((node) => node.parentTemporaryId === null)) {
      return setError(
        'Chưa tìm thấy tiêu đề chương. Hãy thêm dấu # trước tên chương. Ví dụ: # Ứng dụng đạo hàm'
      );
    }
    const rootIds = new Set(
      result.nodes.filter((n) => n.parentTemporaryId === null).map((n) => n.temporaryId)
    );
    setPreview(result);
    setSelected(rootIds);
    setExpanded(rootIds);
    const duplicateIds = new Set<string>();
    const existingChapters = existingNodes.filter((node) => node.nodeType === 'CHUONG');
    const importedRoots = result.nodes.filter((node) => node.parentTemporaryId === null);

    importedRoots.forEach((root, rootIndex) => {
      const existingChapter = existingChapters.find(
        (chapter) => key(chapter.title) === key(root.title)
      );
      if (
        existingChapter ||
        importedRoots.slice(0, rootIndex).some((node) => key(node.title) === key(root.title))
      ) {
        duplicateIds.add(root.temporaryId);
      }

      const importedItems = result.nodes.filter(
        (node) => node.parentTemporaryId === root.temporaryId
      );
      const existingItemTitles = new Set(
        existingChapter
          ? existingNodes
              .filter((node) => node.parentId === existingChapter.id)
              .map((node) => key(node.title))
          : []
      );
      importedItems.forEach((item, itemIndex) => {
        const repeatedInImport = importedItems
          .slice(0, itemIndex)
          .some((node) => key(node.title) === key(item.title));
        if (existingItemTitles.has(key(item.title)) || repeatedInImport) {
          duplicateIds.add(item.temporaryId);
        }
      });
    });
    setDuplicates(duplicateIds);
    setError('');
    setStep(2);
  };
  const toggle = (root: ImportPreviewNode) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(root.temporaryId)) next.delete(root.temporaryId);
      else next.add(root.temporaryId);
      return next;
    });
  const finalPreview = React.useMemo(() => {
    if (!preview) return null;
    const allowed = new Set<string>();
    const add = (id: string) => {
      allowed.add(id);
      preview.nodes.filter((n) => n.parentTemporaryId === id).forEach((n) => add(n.temporaryId));
    };
    selected.forEach(add);
    const blocked = new Set<string>();
    if (!importDuplicates) {
      const block = (id: string) => {
        blocked.add(id);
        preview.nodes
          .filter((node) => node.parentTemporaryId === id)
          .forEach((node) => block(node.temporaryId));
      };
      duplicates.forEach(block);
    }
    return {
      ...preview,
      nodes: preview.nodes.filter((n) => allowed.has(n.temporaryId) && !blocked.has(n.temporaryId)),
    };
  }, [preview, selected, duplicates, importDuplicates]);
  const finalCounts = React.useMemo(() => {
    const nodes = finalPreview?.nodes ?? [];
    const chapters = nodes.filter((node) => node.parentTemporaryId === null).length;
    return { chapters, items: nodes.length - chapters };
  }, [finalPreview]);
  const apply = async () => {
    if (!finalPreview?.nodes.length) return setError('Hãy chọn ít nhất một chương để nhập.');
    try {
      setSubmitting(true);
      await onApply(finalPreview);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể nhập chương trình.');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-3xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>Nhập chương trình</DialogTitle>
          <DialogDescription>
            {destinationTitle
              ? `Thêm chương và nội dung vào ${destinationTitle}.`
              : 'Chọn một khối lớp trước khi nhập.'}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {step === 1 ? (
            <div className="grid gap-4">
              <div className="space-y-2 text-sm text-slate-600">
                <p>
                  Dòng bắt đầu bằng <strong>#</strong> là chương.
                </p>
                <p>Các dòng bên dưới sẽ được nhập thành nội dung của chương đó.</p>
              </div>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm text-blue-700 hover:bg-blue-50">
                <Upload className="size-4" /> Chọn tệp .txt hoặc .md
                <input
                  type="file"
                  className="sr-only"
                  accept=".txt,.md,text/plain,text/markdown"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (!/\.(txt|md)$/i.test(f.name)) {
                      setError('Chỉ hỗ trợ tệp .txt và .md.');
                      return;
                    }
                    setText(await f.text());
                    setError('');
                  }}
                />
              </label>
              <div className="rounded-md bg-slate-50 p-3 font-mono text-xs text-slate-500">
                # Tên chương
                <br />• Bài học 1
                <br />• Bài học 2
              </div>
              <Textarea
                className="h-64 min-h-48 max-h-[40dvh] resize-none overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words font-mono text-sm [field-sizing:fixed]"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Dán chương trình tại đây…"
              />
            </div>
          ) : (
            preview && (
              <div className="grid gap-4">
                <div className="text-sm text-slate-700">
                  Tìm thấy <strong>{roots.length} chương</strong> và{' '}
                  <strong>{preview.nodes.length - roots.length} nội dung</strong>
                  {preview.warnings.length > 0 && (
                    <> · {preview.warnings.length} mục cần kiểm tra</>
                  )}
                  . Bỏ chọn những chương không muốn nhập.
                </div>
                {preview.warnings.length > 0 && (
                  <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-medium">Cần kiểm tra trước khi nhập:</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {preview.warnings.map((warning, index) => (
                        <li key={`${warning}-${index}`}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {duplicates.size > 0 && (
                  <label className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                    <input
                      className="mt-1"
                      type="checkbox"
                      checked={importDuplicates}
                      onChange={(e) => setImportDuplicates(e.target.checked)}
                    />
                    <span>
                      Có {duplicates.size} tên đã tồn tại. Mặc định các mục này sẽ được bỏ qua. Chọn
                      để vẫn nhập.
                    </span>
                  </label>
                )}
                <div className="min-w-0 divide-y overflow-hidden rounded-lg border">
                  {roots.map((root) => {
                    const items = children(root.temporaryId);
                    const isOpen = expanded.has(root.temporaryId);
                    return (
                      <div key={root.temporaryId}>
                        <div className="flex min-w-0 items-start gap-2 p-3">
                          <input
                            className="mt-1 shrink-0"
                            type="checkbox"
                            checked={selected.has(root.temporaryId)}
                            onChange={() => toggle(root)}
                            aria-label={`Chọn ${root.title}`}
                          />
                          <button
                            className="flex min-w-0 flex-1 items-start gap-2 text-left"
                            onClick={() =>
                              setExpanded((s) => {
                                const n = new Set(s);
                                if (n.has(root.temporaryId)) n.delete(root.temporaryId);
                                else n.add(root.temporaryId);
                                return n;
                              })
                            }
                          >
                            {isOpen ? (
                              <ChevronDown className="mt-0.5 size-4 shrink-0" />
                            ) : (
                              <ChevronRight className="mt-0.5 size-4 shrink-0" />
                            )}
                            <span className="min-w-0 flex-1 whitespace-normal break-words font-semibold leading-5">
                              {root.title}
                            </span>
                            <span className="shrink-0 text-xs text-slate-500">
                              {items.length} nội dung
                            </span>
                            {duplicates.has(root.temporaryId) && (
                              <span className="text-xs text-amber-700">Trùng</span>
                            )}
                          </button>
                        </div>
                        {isOpen && (
                          <div className="border-t bg-slate-50 px-10 py-2">
                            {items.map((item) => (
                              <div
                                key={item.temporaryId}
                                className="flex min-w-0 items-start gap-2 py-1.5 text-sm text-slate-600"
                              >
                                <FileText className="mt-0.5 size-3.5 shrink-0" />
                                <span className="min-w-0 flex-1 break-words">{item.title}</span>
                                {duplicates.has(item.temporaryId) && (
                                  <span className="shrink-0 text-xs text-amber-700">Sẽ bỏ qua</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>
        <DialogFooter className="shrink-0 border-t bg-white px-6 py-4">
          <Button
            variant="outline"
            onClick={() => (step === 2 ? setStep(1) : onOpenChange(false))}
            disabled={submitting}
          >
            {step === 2 ? 'Quay lại' : 'Hủy'}
          </Button>
          {step === 1 ? (
            <Button onClick={parse} disabled={!text.trim()}>
              Phân tích & xem trước
            </Button>
          ) : (
            <Button onClick={apply} disabled={submitting || !finalPreview?.nodes.length}>
              {submitting
                ? 'Đang nhập…'
                : `Nhập ${finalCounts.chapters} chương • ${finalCounts.items} nội dung`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
