'use client';

import * as React from 'react';
import {
  LocalKnowledgeRepository,
  type IKnowledgeRepository,
} from '@/lib/knowledge-tree/knowledge-repository';
import type { KnowledgeTreeNode } from '@/lib/knowledge-tree/knowledge-tree-types';
import { childrenOf } from '@/lib/knowledge-tree/knowledge-tree';
import { NodeEditorDialog, type NodeEditorData } from './node-editor-dialog';
import { TreeImportDialog } from './tree-import-dialog';
import type { ImportPreviewResult } from '@/lib/knowledge-tree/knowledge-tree-import';
import { createImportDraft } from '@/lib/knowledge-tree/knowledge-tree-import';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ChevronDown,
  Download,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const repo: IKnowledgeRepository = new LocalKnowledgeRepository();
type EditorState = {
  mode: 'create' | 'edit';
  kind: 'subject' | 'grade' | 'chapter' | 'item';
  parentId: string | null;
  node?: KnowledgeTreeNode;
} | null;

const nodeType = (node: KnowledgeTreeNode) =>
  node.nodeType ||
  (node.sourceGraphNodeType === 'SUBJECT'
    ? 'MON_HOC'
    : node.sourceGraphNodeType === 'GRADE'
      ? 'LOP'
      : node.kind === 'KNOWLEDGE'
        ? 'KIEN_THUC'
        : 'CHUONG');
const normalized = (value: string) => value.trim().toLocaleLowerCase('vi');

export function KnowledgeTreeManager({ previewEmpty = false }: { previewEmpty?: boolean }) {
  const [nodes, setNodes] = React.useState<KnowledgeTreeNode[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [subjectId, setSubjectId] = React.useState('');
  const [gradeId, setGradeId] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [editor, setEditor] = React.useState<EditorState>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<{ text: string; error?: boolean } | null>(null);
  const [editingChapterId, setEditingChapterId] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<KnowledgeTreeNode | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const result = await repo.getReadModel();
      setNodes(previewEmpty ? [] : result.tree.nodes);
    } catch {
      setNotice({ text: 'Không thể tải chương trình.', error: true });
    }
    setLoading(false);
  }, [previewEmpty]);
  React.useEffect(() => {
    // Repository loading is the external synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const subjects = React.useMemo(
    () =>
      nodes
        .filter((n) => n.parentId === null && nodeType(n) === 'MON_HOC')
        .sort((a, b) => a.order - b.order),
    [nodes]
  );
  const effectiveSubject = subjects.some((s) => s.id === subjectId) ? subjectId : '';
  const grades = React.useMemo(
    () =>
      childrenOf(nodes, effectiveSubject)
        .filter((n) => nodeType(n) === 'LOP')
        .sort((a, b) => a.order - b.order),
    [nodes, effectiveSubject]
  );
  const effectiveGrade = grades.some((g) => g.id === gradeId) ? gradeId : '';
  const chapters = React.useMemo(
    () => childrenOf(nodes, effectiveGrade).sort((a, b) => a.order - b.order),
    [nodes, effectiveGrade]
  );
  const query = normalized(search);
  const visibleChapters = chapters.filter(
    (ch) =>
      !query ||
      normalized(ch.title).includes(query) ||
      childrenOf(nodes, ch.id).some((i) => normalized(i.title).includes(query))
  );

  const flash = (text: string, error = false) => {
    setNotice({ text, error });
    window.setTimeout(() => setNotice(null), 3500);
  };
  const save = async (data: NodeEditorData) => {
    if (!editor) return;
    const types = {
      subject: { kind: 'GROUP' as const, nodeType: 'MON_HOC' as const, content: false },
      grade: { kind: 'GROUP' as const, nodeType: 'LOP' as const, content: false },
      chapter: { kind: 'GROUP' as const, nodeType: 'CHUONG' as const, content: false },
      item: { kind: 'KNOWLEDGE' as const, nodeType: 'KIEN_THUC' as const, content: true },
    }[editor.kind];
    const res =
      editor.mode === 'create'
        ? await repo.createNode({
            title: data.title.trim(),
            description: data.description.trim(),
            parentId: editor.parentId,
            kind: types.kind,
            nodeType: types.nodeType,
            hasLearningContent: types.content,
          })
        : await repo.updateNode(editor.node!.id, {
            title: data.title.trim(),
            description: data.description.trim(),
          });
    if (!res.ok) throw new Error(res.error.message);
    if (editor.mode === 'create' && editor.kind === 'subject') {
      setSubjectId(res.data.id);
      setGradeId('');
    }
    if (editor.mode === 'create' && editor.kind === 'grade') setGradeId(res.data.id);
    const labels = { subject: 'môn học', grade: 'lớp', chapter: 'chương', item: 'nội dung' };
    flash(
      editor.mode === 'create'
        ? `Đã thêm ${labels[editor.kind]}.`
        : `Đã cập nhật ${labels[editor.kind]}.`
    );
    await load();
  };
  const remove = async () => {
    if (!pendingDelete) return;
    const descendants =
      pendingDelete.kind === 'GROUP' ? childrenOf(nodes, pendingDelete.id).length : 0;
    setDeleting(true);
    const res = await repo.deleteNode(pendingDelete.id, { cascade: descendants > 0 });
    setDeleting(false);
    if (!res.ok) return flash(res.error.message, true);
    flash(pendingDelete.kind === 'GROUP' ? 'Đã xóa chương.' : 'Đã xóa nội dung.');
    setPendingDelete(null);
    await load();
  };
  const reorder = async (id: string, direction: 'up' | 'down') => {
    const res = await repo.reorderNode(id, direction);
    if (!res.ok) return flash(res.error.message, true);
    flash('Đã thay đổi thứ tự.');
    await load();
  };
  const applyImport = async (preview: ImportPreviewResult) => {
    const res = await repo.importTree(createImportDraft(preview), effectiveGrade);
    if (!res.ok) throw new Error(res.error.message);
    flash(`Đã nhập ${preview.nodes.length} mục.`);
    await load();
  };

  if (loading)
    return (
      <div className="grid h-full place-items-center text-sm text-slate-500">
        Đang tải chương trình…
      </div>
    );
  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-7">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Chương trình & Kiến thức
              </h1>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">
                Quản lý cấu trúc chương trình theo môn học và khối lớp.
              </p>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setImportOpen(true)}
                disabled={!effectiveGrade}
              >
                <Download className="size-4" /> Nhập chương trình
              </Button>
              <Button
                onClick={() =>
                  setEditor({ mode: 'create', kind: 'chapter', parentId: effectiveGrade })
                }
                disabled={!effectiveGrade}
              >
                <Plus className="size-4" /> Thêm chương
              </Button>
            </div>
          </div>
          <div className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[220px_190px_1fr] sm:p-5">
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Môn học
              <div className="flex gap-1">
                <select
                  className="h-9 min-w-0 flex-1 rounded-md border bg-white px-3 text-sm"
                  value={effectiveSubject}
                  onChange={(e) => {
                    setSubjectId(e.target.value);
                    setGradeId('');
                  }}
                >
                  <option value="">Chọn môn học</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
                {effectiveSubject && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label="Sửa môn học"
                    onClick={() =>
                      setEditor({
                        mode: 'edit',
                        kind: 'subject',
                        parentId: null,
                        node: subjects.find((subject) => subject.id === effectiveSubject),
                      })
                    }
                  >
                    <Pencil />
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Thêm môn học"
                  onClick={() => setEditor({ mode: 'create', kind: 'subject', parentId: null })}
                >
                  <Plus />
                </Button>
              </div>
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Khối lớp
              <div className="flex gap-1">
                <select
                  disabled={!effectiveSubject}
                  className="h-9 min-w-0 flex-1 rounded-md border bg-white px-3 text-sm"
                  value={effectiveGrade}
                  onChange={(e) => setGradeId(e.target.value)}
                >
                  <option value="">Chọn lớp</option>
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
                {effectiveGrade && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label="Sửa lớp"
                    onClick={() =>
                      setEditor({
                        mode: 'edit',
                        kind: 'grade',
                        parentId: effectiveSubject,
                        node: grades.find((grade) => grade.id === effectiveGrade),
                      })
                    }
                  >
                    <Pencil />
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={!effectiveSubject}
                  aria-label="Thêm lớp"
                  onClick={() =>
                    setEditor({ mode: 'create', kind: 'grade', parentId: effectiveSubject })
                  }
                >
                  <Plus />
                </Button>
              </div>
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              Tìm trong chương trình
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tên chương hoặc nội dung…"
                />
              </div>
            </label>
          </div>
        </header>
        {notice && (
          <div
            role="status"
            className={`fixed right-4 top-4 z-[70] max-w-sm rounded-xl px-4 py-3 text-sm shadow-lg ring-1 ${notice.error ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-white text-slate-800 ring-slate-200'}`}
          >
            {notice.text}
          </div>
        )}
        {!effectiveSubject ? (
          <ContextPrompt
            title="Chọn môn học để tiếp tục."
            action="Thêm môn học"
            onAction={() => setEditor({ mode: 'create', kind: 'subject', parentId: null })}
          />
        ) : !effectiveGrade ? (
          <ContextPrompt
            title="Chọn lớp để xem hoặc tạo chương trình."
            action="Thêm lớp"
            onAction={() =>
              setEditor({ mode: 'create', kind: 'grade', parentId: effectiveSubject })
            }
          />
        ) : chapters.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white px-6 py-16 text-center">
            <h2 className="font-semibold text-slate-900">
              Chưa có chương trình cho{' '}
              {subjects.find((s) => s.id === effectiveSubject)?.title || 'môn học'}{' '}
              {grades.find((g) => g.id === effectiveGrade)?.title || ''}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Nhập chương trình có sẵn hoặc tạo chương đầu tiên.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button
                variant="outline"
                disabled={!effectiveGrade}
                onClick={() => setImportOpen(true)}
              >
                Nhập chương trình
              </Button>
              <Button
                disabled={!effectiveGrade}
                onClick={() =>
                  setEditor({ mode: 'create', kind: 'chapter', parentId: effectiveGrade })
                }
              >
                Tạo chương đầu tiên
              </Button>
            </div>
          </div>
        ) : visibleChapters.length === 0 ? (
          <div className="rounded-xl border bg-white py-12 text-center text-sm text-slate-500">
            Không tìm thấy chương hoặc nội dung phù hợp.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleChapters.map((chapter) => {
              const items = childrenOf(nodes, chapter.id).sort((a, b) => a.order - b.order);
              const open = query ? true : expanded[chapter.id] !== false;
              return (
                <section
                  key={chapter.id}
                  className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow ${
                    editingChapterId === chapter.id
                      ? 'border-blue-300 ring-2 ring-blue-100'
                      : 'border-slate-200 hover:shadow-md'
                  }`}
                >
                  <div
                    className={`flex min-w-0 items-center gap-2 border-l-4 px-3 py-3.5 sm:px-5 sm:py-4 ${
                      editingChapterId === chapter.id
                        ? 'border-l-blue-600 bg-blue-50/60'
                        : open
                          ? 'border-l-slate-400 bg-slate-100/80'
                          : 'border-l-slate-300 bg-slate-50'
                    }`}
                  >
                    <button
                      className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      aria-expanded={open}
                      onClick={() => setExpanded((x) => ({ ...x, [chapter.id]: !open }))}
                    >
                      <div className="flex min-w-0 items-start gap-2.5">
                        <ChevronDown
                          className={`mt-0.5 size-5 shrink-0 text-slate-500 transition-transform ${open ? '' : '-rotate-90'}`}
                        />
                        <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-3">
                          <h2 className="break-words text-[15px] font-bold leading-5 text-slate-950 sm:text-base">
                            {chapter.title}
                          </h2>
                          <span className="mt-1 block shrink-0 text-xs font-medium text-slate-500 sm:mt-0">
                            {items.length} nội dung
                          </span>
                        </div>
                      </div>
                    </button>
                    {editingChapterId === chapter.id ? (
                      <Button size="sm" variant="outline" onClick={() => setEditingChapterId(null)}>
                        Xong
                      </Button>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Thao tác với chương ${chapter.title}`}
                            />
                          }
                        >
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setEditingChapterId(chapter.id)}>
                            Chỉnh sửa cấu trúc
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setEditor({
                                mode: 'edit',
                                kind: 'chapter',
                                parentId: effectiveGrade,
                                node: chapter,
                              })
                            }
                          >
                            Đổi tên chương
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setEditor({ mode: 'create', kind: 'item', parentId: chapter.id })
                            }
                          >
                            Thêm nội dung
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setPendingDelete(chapter)}
                          >
                            Xóa chương
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  {open && (
                    <div className="border-t border-slate-200 bg-white">
                      <div className="divide-y divide-slate-100 sm:pl-8">
                        {items
                          .filter(
                            (i) =>
                              !query ||
                              normalized(chapter.title).includes(query) ||
                              normalized(i.title).includes(query)
                          )
                          .map((item) => (
                            <div
                              key={item.id}
                              className={`group flex min-h-11 items-start gap-2 border-l-2 px-4 py-2.5 transition-colors sm:px-5 ${
                                editingChapterId === chapter.id
                                  ? 'border-l-blue-200 hover:bg-blue-50/50'
                                  : 'border-l-transparent hover:bg-slate-50'
                              } ${
                                query && normalized(item.title).includes(query)
                                  ? 'border-l-blue-500 bg-blue-50 text-blue-950'
                                  : ''
                              }`}
                            >
                              {editingChapterId === chapter.id && (
                                <GripVertical className="mt-0.5 size-4 shrink-0 text-blue-400" />
                              )}
                              <span className="min-w-0 flex-1 whitespace-normal break-words text-sm leading-6 text-slate-700">
                                {item.title}
                              </span>
                              {editingChapterId === chapter.id && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    render={
                                      <Button
                                        size="icon-sm"
                                        variant="ghost"
                                        aria-label={`Thao tác với nội dung ${item.title}`}
                                      />
                                    }
                                  >
                                    <MoreHorizontal />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44">
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setEditor({
                                          mode: 'edit',
                                          kind: 'item',
                                          parentId: chapter.id,
                                          node: item,
                                        })
                                      }
                                    >
                                      Chỉnh sửa
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={items.findIndex((x) => x.id === item.id) === 0}
                                      onClick={() => reorder(item.id, 'up')}
                                    >
                                      Di chuyển lên
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      disabled={
                                        items.findIndex((x) => x.id === item.id) ===
                                        items.length - 1
                                      }
                                      onClick={() => reorder(item.id, 'down')}
                                    >
                                      Di chuyển xuống
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={() => setPendingDelete(item)}
                                    >
                                      Xóa
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          ))}
                      </div>
                      {editingChapterId === chapter.id && (
                        <Button
                          variant="ghost"
                          className="m-2 text-blue-700"
                          onClick={() =>
                            setEditor({ mode: 'create', kind: 'item', parentId: chapter.id })
                          }
                        >
                          <Plus /> Thêm nội dung
                        </Button>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {pendingDelete?.kind === 'GROUP' ? 'Xóa chương?' : 'Xóa nội dung?'}
            </DialogTitle>
            <DialogDescription className="leading-6">
              {pendingDelete?.kind === 'GROUP'
                ? `“${pendingDelete.title}” đang có ${childrenOf(nodes, pendingDelete.id).length} nội dung. Xóa chương sẽ xóa toàn bộ nội dung bên trong khỏi cấu trúc chương trình hiện tại.`
                : `“${pendingDelete?.title}” sẽ bị xóa khỏi chương này.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setPendingDelete(null)}>
              Hủy
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={remove}>
              {deleting ? 'Đang xóa…' : pendingDelete?.kind === 'GROUP' ? 'Xóa chương' : 'Xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <NodeEditorDialog
        open={!!editor}
        onOpenChange={(open) => !open && setEditor(null)}
        mode={editor?.mode || 'create'}
        entityLabel={
          { subject: 'môn học', grade: 'lớp', chapter: 'chương', item: 'nội dung' }[
            editor?.kind || 'item'
          ]
        }
        initialData={
          editor?.node
            ? {
                title: editor.node.title,
                description: editor.node.description,
                nodeType: nodeType(editor.node),
                hasLearningContent: !!editor.node.hasLearningContent,
              }
            : { nodeType: editor?.kind === 'item' ? 'KIEN_THUC' : 'CHUONG' }
        }
        onSave={save}
      />
      <TreeImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        destinationNodeId={effectiveGrade}
        destinationTitle={grades.find((g) => g.id === effectiveGrade)?.title || null}
        existingNodes={chapters.flatMap((ch) => [ch, ...childrenOf(nodes, ch.id)])}
        onApply={applyImport}
      />
    </div>
  );
}

function ContextPrompt({
  title,
  action,
  onAction,
}: {
  title: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-white px-6 py-16 text-center">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">Bạn có thể chọn ở phía trên hoặc tạo mới ngay.</p>
      <Button className="mt-5" onClick={onAction}>
        <Plus /> {action}
      </Button>
    </div>
  );
}
