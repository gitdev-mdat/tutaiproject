'use client';

import * as React from 'react';
import {
  AlertCircle,
  ChevronDown,
  CloudUpload,
  Download,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
} from 'lucide-react';
import { ApiKnowledgeRepository } from '@/lib/knowledge-tree/api-knowledge-repository';
import { childrenOf, knowledgeBreadcrumb } from '@/lib/knowledge-tree/knowledge-tree';
import { getNodeCapabilities } from '@/lib/knowledge-tree/knowledge-node-capabilities';
import {
  getLessonPublicationState,
  type ArticleSummary,
  type LessonPublicationState,
} from '@/lib/knowledge-tree/learning-visibility';
import {
  markLocalDraftsHandled,
  migrateLocalDrafts,
  readLocalDraftSnapshot,
  type LocalDraftSnapshot,
} from '@/lib/knowledge-tree/local-draft-migration';
import {
  createImportDraft,
  type ImportPreviewResult,
} from '@/lib/knowledge-tree/knowledge-tree-import';
import type { KnowledgeTreeNode } from '@/lib/knowledge-tree/knowledge-tree-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { NodeEditorDialog, type NodeEditorData } from './node-editor-dialog';
import { TreeImportDialog } from './tree-import-dialog';
import { LessonEditorSheet } from './lesson-editor-sheet';
import { PublicationBadge } from './publication-badge';

const repo = new ApiKnowledgeRepository();

type EditorKind = 'subject' | 'grade' | 'chapter' | 'item';
type EditorState = {
  mode: 'create' | 'edit';
  kind: EditorKind;
  parentId: string | null;
  node?: KnowledgeTreeNode;
} | null;
type StatusFilter = 'all' | 'NO_ARTICLE' | 'DRAFT' | 'PUBLISHED';

const ENTITY_LABELS: Record<EditorKind, string> = {
  subject: 'môn học',
  grade: 'lớp',
  chapter: 'chương',
  item: 'kiến thức',
};

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'NO_ARTICLE', label: 'Chưa có bài' },
  { value: 'DRAFT', label: 'Đang soạn' },
  { value: 'PUBLISHED', label: 'Đang hiển thị' },
];

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

function matchesFilter(state: LessonPublicationState, filter: StatusFilter) {
  if (filter === 'all') return true;
  if (filter === 'DRAFT') return state === 'DRAFT' || state === 'READY';
  return state === filter;
}

function subtree(nodes: KnowledgeTreeNode[], id: string): KnowledgeTreeNode[] {
  return childrenOf(nodes, id).flatMap((child) => [child, ...subtree(nodes, child.id)]);
}

export function KnowledgeTreeManager({ previewEmpty = false }: { previewEmpty?: boolean }) {
  const [nodes, setNodes] = React.useState<KnowledgeTreeNode[]>([]);
  const [summaries, setSummaries] = React.useState<Record<string, ArticleSummary>>({});
  const [loadState, setLoadState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [subjectId, setSubjectId] = React.useState('');
  const [gradeId, setGradeId] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState<StatusFilter>('all');
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const [editor, setEditor] = React.useState<EditorState>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<{ text: string; error?: boolean } | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<KnowledgeTreeNode | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [lessonNodeId, setLessonNodeId] = React.useState<string | null>(null);
  const [localDrafts, setLocalDrafts] = React.useState<LocalDraftSnapshot | null>(null);
  const [migrating, setMigrating] = React.useState(false);
  const noticeTimer = React.useRef<number | undefined>(undefined);

  const flash = React.useCallback((text: string, error = false) => {
    window.clearTimeout(noticeTimer.current);
    setNotice({ text, error });
    noticeTimer.current = window.setTimeout(() => setNotice(null), error ? 6000 : 3500);
  }, []);

  const load = React.useCallback(async () => {
    try {
      const result = await repo.getReadModel();
      setNodes(previewEmpty ? [] : result.tree.nodes);
      setSummaries(result.articleSummaries);
      setLoadState('ready');
    } catch {
      setLoadState((current) => (current === 'ready' ? current : 'error'));
      flash('Không tải được chương trình từ máy chủ.', true);
    }
  }, [previewEmpty, flash]);

  React.useEffect(() => {
    // Loading from the server and reading the legacy browser drafts are external syncs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    setLocalDrafts(readLocalDraftSnapshot());
  }, [load]);

  // ── Context: subject → grade (auto-selects the first so the page is never blank) ──
  const subjects = React.useMemo(
    () => childrenOf(nodes, null).filter((n) => nodeType(n) === 'MON_HOC'),
    [nodes]
  );
  const effectiveSubject = subjects.some((s) => s.id === subjectId)
    ? subjectId
    : (subjects[0]?.id ?? '');
  const grades = React.useMemo(
    () => childrenOf(nodes, effectiveSubject).filter((n) => nodeType(n) === 'LOP'),
    [nodes, effectiveSubject]
  );
  const effectiveGrade = grades.some((g) => g.id === gradeId) ? gradeId : (grades[0]?.id ?? '');
  const chapters = React.useMemo(
    () => (effectiveGrade ? childrenOf(nodes, effectiveGrade) : []),
    [nodes, effectiveGrade]
  );
  const subjectNode = subjects.find((s) => s.id === effectiveSubject);
  const gradeNode = grades.find((g) => g.id === effectiveGrade);

  const stateOf = React.useCallback(
    (node: KnowledgeTreeNode) => getLessonPublicationState(nodes, node.id, summaries[node.id]),
    [nodes, summaries]
  );

  const knowledgeItems = chapters.flatMap((chapter) =>
    subtree(nodes, chapter.id).filter((node) => node.kind === 'KNOWLEDGE')
  );
  const stats = {
    total: knowledgeItems.length,
    published: knowledgeItems.filter((node) => stateOf(node) === 'PUBLISHED').length,
    drafting: knowledgeItems.filter((node) => ['DRAFT', 'READY'].includes(stateOf(node))).length,
    empty: knowledgeItems.filter((node) => stateOf(node) === 'NO_ARTICLE').length,
  };

  const query = normalized(search);
  const filtering = !!query || filter !== 'all';
  const itemVisible = (chapter: KnowledgeTreeNode, item: KnowledgeTreeNode) =>
    (!query ||
      normalized(item.title).includes(query) ||
      normalized(chapter.title).includes(query)) &&
    (filter === 'all' || (item.kind === 'KNOWLEDGE' && matchesFilter(stateOf(item), filter)));
  const visibleChapters = chapters.filter(
    (chapter) =>
      !filtering ||
      (filter === 'all' && normalized(chapter.title).includes(query)) ||
      childrenOf(nodes, chapter.id).some((item) => itemVisible(chapter, item))
  );

  // ── Mutations ────────────────────────────────────────────────────────────
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
    flash(
      editor.mode === 'create'
        ? `Đã thêm ${ENTITY_LABELS[editor.kind]}.`
        : `Đã cập nhật ${ENTITY_LABELS[editor.kind]}.`
    );
    await load();
    if (editor.mode === 'create' && editor.kind === 'item') setLessonNodeId(res.data.id);
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const hasChildren = childrenOf(nodes, pendingDelete.id).length > 0;
    const res = await repo.deleteNode(pendingDelete.id, { cascade: hasChildren });
    setDeleting(false);
    if (!res.ok) return flash(res.error.message, true);
    flash(`Đã xóa “${pendingDelete.title}”.`);
    setPendingDelete(null);
    await load();
  };

  const reorder = async (id: string, direction: 'up' | 'down') => {
    const res = await repo.reorderNode(id, direction);
    if (!res.ok) return flash(res.error.message, true);
    await load();
    flash('Đã đổi thứ tự.');
  };

  const applyImport = async (preview: ImportPreviewResult) => {
    const res = await repo.importTree(createImportDraft(preview), effectiveGrade);
    if (!res.ok) throw new Error(res.error.message);
    flash(`Đã nhập ${preview.nodes.length} mục.`);
    await load();
  };

  const runMigration = async () => {
    if (!localDrafts) return;
    setMigrating(true);
    try {
      const result = await migrateLocalDrafts(
        repo,
        nodes,
        localDrafts,
        new Set(Object.keys(summaries))
      );
      setLocalDrafts(null);
      flash(
        `Đã chuyển ${result.nodes} mục và ${result.articles} bài học lên máy chủ` +
          (result.skipped ? `, bỏ qua ${result.skipped} mục không còn vị trí phù hợp.` : '.')
      );
      await load();
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Không chuyển được dữ liệu.', true);
    } finally {
      setMigrating(false);
    }
  };

  // ── Capability helpers (single source of truth: getNodeCapabilities) ───────
  const capsOf = (node: KnowledgeTreeNode) =>
    getNodeCapabilities(node, childrenOf(nodes, node.parentId));
  const deleteBlockedReason = (node: KnowledgeTreeNode): string | null => {
    const branch = [node, ...subtree(nodes, node.id)];
    if (branch.some((item) => !getNodeCapabilities(item, []).canDelete)) {
      return 'Có dữ liệu hệ thống, không thể xóa';
    }
    if (branch.some((item) => item.status !== 'DRAFT')) return 'Chỉ xóa được mục nháp';
    return null;
  };

  const lessonNode = lessonNodeId ? (nodes.find((n) => n.id === lessonNodeId) ?? null) : null;

  if (loadState === 'loading') {
    return (
      <div className="h-full overflow-y-auto bg-slate-50" aria-busy="true">
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
          <div className="h-8 w-72 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-36 animate-pulse rounded-xl bg-slate-200/60" />
          ))}
          <span className="sr-only">Đang tải chương trình…</span>
        </div>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="grid h-full place-items-center bg-slate-50 p-6">
        <div className="max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto size-8 text-red-500" aria-hidden="true" />
          <h1 className="mt-3 font-semibold text-slate-900">Không tải được chương trình</h1>
          <p className="mt-1 text-sm text-slate-500">
            Máy chủ chưa phản hồi. Dữ liệu không bị thay đổi.
          </p>
          <Button className="mt-4" onClick={() => void load()}>
            Thử lại
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
        {/* ── Page header ── */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Chương trình &amp; Kiến thức
            </h1>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Sắp xếp chương, kiến thức và soạn bài học. Bài được bật hiển thị sẽ xuất hiện trong
              mục Bài học của học sinh.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              disabled={!effectiveGrade}
            >
              <Download /> Nhập chương trình
            </Button>
            <Button
              onClick={() =>
                setEditor({ mode: 'create', kind: 'chapter', parentId: effectiveGrade })
              }
              disabled={!effectiveGrade}
            >
              <Plus /> Thêm chương
            </Button>
          </div>
        </header>

        {localDrafts && (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center">
            <CloudUpload className="size-5 shrink-0 text-amber-600" aria-hidden="true" />
            <p className="min-w-0 flex-1 leading-6">
              Trình duyệt này còn {localDrafts.nodes.length} mục và {localDrafts.articles.length}{' '}
              bài học tạo ở phiên bản cũ, chưa có trên máy chủ. Chuyển lên để học sinh và quản trị
              viên khác dùng được. Bài học sẽ được chuyển ở dạng bản nháp.
            </p>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={migrating}
                onClick={() => {
                  markLocalDraftsHandled('dismissed');
                  setLocalDrafts(null);
                }}
              >
                Bỏ qua
              </Button>
              <Button size="sm" disabled={migrating} onClick={() => void runMigration()}>
                {migrating ? 'Đang chuyển…' : 'Chuyển lên máy chủ'}
              </Button>
            </div>
          </div>
        )}

        {/* ── Context bar ── */}
        <section
          aria-label="Phạm vi chương trình"
          className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:gap-6">
            <ScopePicker
              label="Môn học"
              items={subjects}
              value={effectiveSubject}
              onSelect={(id) => {
                setSubjectId(id);
                setGradeId('');
              }}
              onAdd={() => setEditor({ mode: 'create', kind: 'subject', parentId: null })}
              onEdit={
                subjectNode && capsOf(subjectNode).canEdit
                  ? () =>
                      setEditor({
                        mode: 'edit',
                        kind: 'subject',
                        parentId: null,
                        node: subjectNode,
                      })
                  : undefined
              }
              addLabel="Thêm môn học"
            />
            <ScopePicker
              label="Khối lớp"
              items={grades}
              value={effectiveGrade}
              disabled={!effectiveSubject}
              onSelect={setGradeId}
              onAdd={() => setEditor({ mode: 'create', kind: 'grade', parentId: effectiveSubject })}
              onEdit={
                gradeNode && capsOf(gradeNode).canEdit
                  ? () =>
                      setEditor({
                        mode: 'edit',
                        kind: 'grade',
                        parentId: effectiveSubject,
                        node: gradeNode,
                      })
                  : undefined
              }
              addLabel="Thêm lớp"
            />
          </div>
          {effectiveGrade && (
            <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:flex sm:flex-wrap">
                <Stat label="kiến thức" value={stats.total} />
                <Stat label="đang hiển thị" value={stats.published} tone="text-emerald-700" />
                <Stat label="đang soạn" value={stats.drafting} tone="text-amber-700" />
                <Stat label="chưa có bài" value={stats.empty} tone="text-slate-500" />
              </dl>
              <div className="relative md:ml-auto md:w-72">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm chương hoặc kiến thức…"
                  aria-label="Tìm trong chương trình"
                />
              </div>
            </div>
          )}
        </section>

        {effectiveGrade && (
          <div
            role="radiogroup"
            aria-label="Lọc theo trạng thái bài học"
            className="mt-4 flex gap-2 overflow-x-auto pb-1"
          >
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={filter === item.value}
                onClick={() => setFilter(item.value)}
                className={`h-8 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  filter === item.value
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        <div
          role="status"
          aria-live="polite"
          className={
            notice
              ? `fixed right-4 top-4 z-[70] max-w-sm rounded-xl px-4 py-3 text-sm shadow-lg ring-1 ${notice.error ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-white text-slate-800 ring-slate-200'}`
              : 'sr-only'
          }
        >
          {notice?.text}
        </div>

        {/* ── Content ── */}
        <div className="mt-4">
          {!effectiveSubject ? (
            <ContextPrompt
              title="Chưa có môn học nào."
              text="Tạo môn học đầu tiên để bắt đầu xây dựng chương trình."
              action="Thêm môn học"
              onAction={() => setEditor({ mode: 'create', kind: 'subject', parentId: null })}
            />
          ) : !effectiveGrade ? (
            <ContextPrompt
              title={`${subjectNode?.title ?? 'Môn học'} chưa có khối lớp.`}
              text="Thêm khối lớp để tạo chương và kiến thức."
              action="Thêm lớp"
              onAction={() =>
                setEditor({ mode: 'create', kind: 'grade', parentId: effectiveSubject })
              }
            />
          ) : chapters.length === 0 ? (
            <ContextPrompt
              title={`Chưa có chương nào cho ${subjectNode?.title ?? ''} ${gradeNode?.title ?? ''}`}
              text="Nhập chương trình có sẵn hoặc tạo chương đầu tiên."
              action="Tạo chương đầu tiên"
              onAction={() =>
                setEditor({ mode: 'create', kind: 'chapter', parentId: effectiveGrade })
              }
              secondary={{ label: 'Nhập chương trình', onClick: () => setImportOpen(true) }}
            />
          ) : visibleChapters.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
              Không có kiến thức nào khớp bộ lọc.{' '}
              <button
                type="button"
                className="font-medium text-blue-700 hover:underline"
                onClick={() => {
                  setSearch('');
                  setFilter('all');
                }}
              >
                Xóa bộ lọc
              </button>
            </div>
          ) : (
            <ol className="space-y-3" aria-label="Danh sách chương">
              {visibleChapters.map((chapter, chapterIndex) => {
                const items = childrenOf(nodes, chapter.id);
                const shownItems = filtering
                  ? items.filter((item) => itemVisible(chapter, item))
                  : items;
                const chapterKnowledge = subtree(nodes, chapter.id).filter(
                  (node) => node.kind === 'KNOWLEDGE'
                );
                const chapterPublished = chapterKnowledge.filter(
                  (node) => stateOf(node) === 'PUBLISHED'
                ).length;
                const archived = chapter.status === 'ARCHIVED';
                const open = filtering ? true : !(collapsed[chapter.id] ?? archived);
                const caps = capsOf(chapter);
                const deleteReason = deleteBlockedReason(chapter);
                return (
                  <li
                    key={chapter.id}
                    className={`overflow-hidden rounded-xl border bg-white shadow-sm ${archived ? 'border-slate-200 opacity-80' : 'border-slate-200'}`}
                  >
                    <div className="flex items-center gap-2 px-3 py-3 sm:px-4">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setCollapsed((x) => ({ ...x, [chapter.id]: open }))}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <ChevronDown
                          aria-hidden="true"
                          className={`size-5 shrink-0 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-xs font-semibold tabular-nums text-slate-400">
                              {String(chapterIndex + 1).padStart(2, '0')}
                            </span>
                            <h2 className="break-words text-[15px] font-semibold leading-5 text-slate-950">
                              {chapter.title}
                            </h2>
                            {archived && <PublicationBadge state="ARCHIVED" />}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {chapterKnowledge.length} kiến thức
                            {chapterKnowledge.length > 0 &&
                              ` · ${chapterPublished} đang hiển thị cho học sinh`}
                          </span>
                        </span>
                      </button>
                      {chapterKnowledge.length > 0 && !archived && (
                        <div
                          className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 sm:block"
                          aria-hidden="true"
                        >
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{
                              width: `${(chapterPublished / chapterKnowledge.length) * 100}%`,
                            }}
                          />
                        </div>
                      )}
                      <RowMenu label={`Thao tác với chương ${chapter.title}`}>
                        <DropdownMenuItem
                          onClick={() =>
                            setEditor({ mode: 'create', kind: 'item', parentId: chapter.id })
                          }
                        >
                          Thêm kiến thức
                        </DropdownMenuItem>
                        <DisabledAware
                          disabledReason={caps.canEdit ? null : 'Dữ liệu hệ thống'}
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
                        </DisabledAware>
                        <DropdownMenuItem
                          disabled={!caps.canMoveUp}
                          onClick={() => void reorder(chapter.id, 'up')}
                        >
                          Di chuyển lên
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!caps.canMoveDown}
                          onClick={() => void reorder(chapter.id, 'down')}
                        >
                          Di chuyển xuống
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DisabledAware
                          destructive
                          disabledReason={deleteReason}
                          onClick={() => setPendingDelete(chapter)}
                        >
                          Xóa chương
                        </DisabledAware>
                      </RowMenu>
                    </div>
                    {open && (
                      <div className="border-t border-slate-100">
                        {shownItems.length === 0 ? (
                          <p className="px-4 py-4 text-sm text-slate-500 sm:pl-12">
                            Chương này chưa có kiến thức.
                          </p>
                        ) : (
                          <ol className="divide-y divide-slate-100">
                            {shownItems.map((item) => (
                              <KnowledgeRow
                                key={item.id}
                                item={item}
                                state={item.kind === 'KNOWLEDGE' ? stateOf(item) : null}
                                caps={capsOf(item)}
                                deleteReason={deleteBlockedReason(item)}
                                highlight={!!query && normalized(item.title).includes(query)}
                                onOpen={() => setLessonNodeId(item.id)}
                                onRename={() =>
                                  setEditor({
                                    mode: 'edit',
                                    kind: 'item',
                                    parentId: chapter.id,
                                    node: item,
                                  })
                                }
                                onReorder={(direction) => void reorder(item.id, direction)}
                                onDelete={() => setPendingDelete(item)}
                              />
                            ))}
                          </ol>
                        )}
                        {!filtering && (
                          <div className="border-t border-slate-100 px-2 py-1.5 sm:pl-9">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-700 hover:text-blue-800"
                              onClick={() =>
                                setEditor({ mode: 'create', kind: 'item', parentId: chapter.id })
                              }
                            >
                              <Plus /> Thêm kiến thức
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Xóa “{pendingDelete?.title}”?</DialogTitle>
            <DialogDescription className="leading-6">
              {pendingDelete && childrenOf(nodes, pendingDelete.id).length > 0
                ? `Toàn bộ ${subtree(nodes, pendingDelete.id).length} mục bên trong và bài học của chúng cũng sẽ bị xóa. Không thể hoàn tác.`
                : 'Mục này và bài học đi kèm (nếu có) sẽ bị xóa. Không thể hoàn tác.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setPendingDelete(null)}>
              Hủy
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void remove()}>
              {deleting ? 'Đang xóa…' : 'Xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NodeEditorDialog
        open={!!editor}
        onOpenChange={(open) => !open && setEditor(null)}
        mode={editor?.mode || 'create'}
        entityLabel={ENTITY_LABELS[editor?.kind || 'item']}
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
        destinationTitle={gradeNode?.title || null}
        existingNodes={chapters.flatMap((ch) => [ch, ...childrenOf(nodes, ch.id)])}
        onApply={applyImport}
      />

      <LessonEditorSheet
        node={lessonNode}
        nodes={nodes}
        breadcrumb={
          lessonNode
            ? knowledgeBreadcrumb(nodes, lessonNode.id)
                .slice(0, -1)
                .map((node) => node.title)
            : []
        }
        repo={repo}
        onClose={() => setLessonNodeId(null)}
        onSaved={(nodeId, summary, message) => {
          setSummaries((current) => ({ ...current, [nodeId]: summary }));
          flash(message);
        }}
      />
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function ScopePicker({
  label,
  items,
  value,
  disabled,
  onSelect,
  onAdd,
  onEdit,
  addLabel,
}: {
  label: string;
  items: KnowledgeTreeNode[];
  value: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit?: () => void;
  addLabel: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={item.id === value}
            disabled={disabled}
            onClick={() => onSelect(item.id)}
            className={`h-8 shrink-0 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              item.id === value
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {item.title}
          </button>
        ))}
        {onEdit && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Sửa ${label.toLowerCase()}`}
            onClick={onEdit}
          >
            <Pencil />
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={addLabel}
          title={addLabel}
          disabled={disabled}
          onClick={onAdd}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'text-slate-900',
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="sr-only">{label}</dt>
      <dd className={`text-base font-semibold tabular-nums ${tone}`}>{value}</dd>
      <span className="text-slate-500" aria-hidden="true">
        {label}
      </span>
    </div>
  );
}

function RowMenu({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label={label} />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Menu item that stays visible when blocked by a rule and says why. */
function DisabledAware({
  disabledReason,
  destructive,
  onClick,
  children,
}: {
  disabledReason: string | null;
  destructive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenuItem
      disabled={!!disabledReason}
      variant={destructive ? 'destructive' : undefined}
      onClick={onClick}
      className="flex-col items-start gap-0"
    >
      <span>{children}</span>
      {disabledReason && <span className="text-xs text-slate-400">{disabledReason}</span>}
    </DropdownMenuItem>
  );
}

function KnowledgeRow({
  item,
  state,
  caps,
  deleteReason,
  highlight,
  onOpen,
  onRename,
  onReorder,
  onDelete,
}: {
  item: KnowledgeTreeNode;
  state: LessonPublicationState | null;
  caps: ReturnType<typeof getNodeCapabilities>;
  deleteReason: string | null;
  highlight: boolean;
  onOpen: () => void;
  onRename: () => void;
  onReorder: (direction: 'up' | 'down') => void;
  onDelete: () => void;
}) {
  const isLesson = item.kind === 'KNOWLEDGE';
  return (
    <li
      className={`group flex items-center gap-2 px-3 py-1.5 sm:pl-12 sm:pr-4 ${highlight ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}
    >
      {isLesson ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center gap-1 rounded-md py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:flex-row sm:items-center sm:gap-3"
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <FileText aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
            <span className="min-w-0 break-words text-sm leading-6 text-slate-800 group-hover:text-slate-950">
              {item.title}
            </span>
          </span>
          {state && (
            <span className="pl-6 sm:pl-0">
              <PublicationBadge state={state} />
            </span>
          )}
        </button>
      ) : (
        <span className="flex min-h-11 min-w-0 flex-1 items-center text-sm font-medium text-slate-700">
          {item.title}
        </span>
      )}
      <RowMenu label={`Thao tác với ${item.title}`}>
        {isLesson && <DropdownMenuItem onClick={onOpen}>Soạn bài học</DropdownMenuItem>}
        <DisabledAware disabledReason={caps.canEdit ? null : 'Dữ liệu hệ thống'} onClick={onRename}>
          Đổi tên
        </DisabledAware>
        <DropdownMenuItem disabled={!caps.canMoveUp} onClick={() => onReorder('up')}>
          Di chuyển lên
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!caps.canMoveDown} onClick={() => onReorder('down')}>
          Di chuyển xuống
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DisabledAware destructive disabledReason={deleteReason} onClick={onDelete}>
          Xóa
        </DisabledAware>
      </RowMenu>
    </li>
  );
}

function ContextPrompt({
  title,
  text,
  action,
  onAction,
  secondary,
}: {
  title: string;
  text: string;
  action: string;
  onAction: () => void;
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <p className="mt-1.5 text-sm text-slate-500">{text}</p>
      <div className="mt-5 flex justify-center gap-2">
        {secondary && (
          <Button variant="outline" onClick={secondary.onClick}>
            {secondary.label}
          </Button>
        )}
        <Button onClick={onAction}>
          <Plus /> {action}
        </Button>
      </div>
    </div>
  );
}
