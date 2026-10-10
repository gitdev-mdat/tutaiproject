'use client';

import * as React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  X,
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
  buildStudioOverview,
  buildWorkQueue,
  type StudioChapter,
} from '@/lib/knowledge-tree/content-studio';
import {
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
import { WorkQueue } from './work-queue';
import { MigrationDialog } from './migration-dialog';

const repo = new ApiKnowledgeRepository();

type EditorKind = 'subject' | 'grade' | 'chapter' | 'item';
type EditorState = {
  mode: 'create' | 'edit';
  kind: EditorKind;
  parentId: string | null;
  node?: KnowledgeTreeNode;
} | null;
type StatusFilter = 'all' | Exclude<LessonPublicationState, 'ARCHIVED'>;

const ENTITY_LABELS: Record<EditorKind, string> = {
  subject: 'môn học',
  grade: 'lớp',
  chapter: 'chương',
  item: 'kiến thức',
};

const FILTER_LABELS: Record<Exclude<StatusFilter, 'all'>, string> = {
  NO_ARTICLE: 'Chưa có bài',
  DRAFT: 'Bản nháp',
  READY: 'Sẵn sàng',
  PUBLISHED: 'Đang hiển thị',
};

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
  const [showArchived, setShowArchived] = React.useState(false);
  const [editor, setEditor] = React.useState<EditorState>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<{ text: string; error?: boolean } | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<KnowledgeTreeNode | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [lessonNodeId, setLessonNodeId] = React.useState<string | null>(null);
  const [localDrafts, setLocalDrafts] = React.useState<LocalDraftSnapshot | null>(null);
  const [migrationOpen, setMigrationOpen] = React.useState(false);
  const noticeTimer = React.useRef<number | undefined>(undefined);
  const explorerRef = React.useRef<HTMLElement>(null);

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
  const subjectNode = subjects.find((s) => s.id === effectiveSubject);
  const gradeNode = grades.find((g) => g.id === effectiveGrade);

  const overview = React.useMemo(
    () => buildStudioOverview(nodes, summaries, effectiveGrade),
    [nodes, summaries, effectiveGrade]
  );
  const queue = React.useMemo(
    () => buildWorkQueue(overview, nodes, summaries),
    [overview, nodes, summaries]
  );

  const stateOf = React.useCallback(
    (node: KnowledgeTreeNode) => getLessonPublicationState(nodes, node.id, summaries[node.id]),
    [nodes, summaries]
  );

  const query = normalized(search);
  const filtering = !!query || filter !== 'all';
  const itemVisible = (chapter: KnowledgeTreeNode, item: KnowledgeTreeNode) =>
    (!query ||
      normalized(item.title).includes(query) ||
      normalized(chapter.title).includes(query)) &&
    (filter === 'all' || (item.kind === 'KNOWLEDGE' && stateOf(item) === filter));
  const chapterVisible = (chapter: KnowledgeTreeNode) =>
    !filtering ||
    (filter === 'all' && normalized(chapter.title).includes(query)) ||
    childrenOf(nodes, chapter.id).some((item) => itemVisible(chapter, item));
  const activeChapters = overview.chapters.filter((c) => !c.archived && chapterVisible(c.node));
  // Archived chapters have nothing actionable, so they leave the list while a filter is on.
  const archivedChapters = filter === 'all' ? overview.chapters.filter((c) => c.archived) : [];
  const shownArchived = archivedChapters.filter((c) => chapterVisible(c.node));

  const applyFilter = (next: StatusFilter) => {
    setFilter((current) => (current === next ? 'all' : next));
    explorerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const focusChapter = (chapterId: string) => {
    setSearch('');
    setFilter('all');
    setCollapsed((current) => ({ ...current, [chapterId]: false }));
    window.requestAnimationFrame(() => {
      const element = document.getElementById(`chapter-${chapterId}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    });
  };

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
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
          <div className="h-8 w-72 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-16 animate-pulse rounded-xl bg-slate-200/70" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-28 animate-pulse rounded-xl bg-slate-200/60" />
              ))}
            </div>
            <div className="hidden h-64 animate-pulse rounded-xl bg-slate-200/60 lg:block" />
          </div>
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

  const renderChapter = (chapter: StudioChapter, index: number | null) => {
    const { node } = chapter;
    const items = childrenOf(nodes, node.id);
    const shownItems = filtering ? items.filter((item) => itemVisible(node, item)) : items;
    const open = filtering ? true : !(collapsed[node.id] ?? chapter.archived);
    const caps = capsOf(node);
    const total = chapter.lessons.length;
    const published = chapter.counts.PUBLISHED;
    return (
      <li
        key={node.id}
        id={`chapter-${node.id}`}
        className="scroll-mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white"
      >
        <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setCollapsed((x) => ({ ...x, [node.id]: open }))}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <ChevronDown
              aria-hidden="true"
              className={`size-4 shrink-0 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`}
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                {index !== null && (
                  <span className="text-xs font-semibold tabular-nums text-slate-400">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                )}
                <h2 className="break-words text-[15px] font-semibold leading-6 text-slate-950">
                  {node.title}
                </h2>
              </span>
              <span className="block text-xs text-slate-500">
                {chapter.archived
                  ? 'Lưu trữ, học sinh không thấy'
                  : total === 0
                    ? 'Chưa có kiến thức'
                    : chapter.complete
                      ? `Hoàn chỉnh · ${total} bài đang hiển thị`
                      : `${published}/${total} bài đang hiển thị`}
              </span>
            </span>
          </button>
          {!chapter.archived && total > 0 && (
            <ChapterProgress counts={chapter.counts} total={total} complete={chapter.complete} />
          )}
          <RowMenu label={`Thao tác với chương ${node.title}`}>
            <DropdownMenuItem
              onClick={() => setEditor({ mode: 'create', kind: 'item', parentId: node.id })}
            >
              Thêm kiến thức
            </DropdownMenuItem>
            <DisabledAware
              disabledReason={caps.canEdit ? null : 'Dữ liệu hệ thống'}
              onClick={() =>
                setEditor({ mode: 'edit', kind: 'chapter', parentId: effectiveGrade, node })
              }
            >
              Đổi tên chương
            </DisabledAware>
            <DropdownMenuItem
              disabled={!caps.canMoveUp}
              onClick={() => void reorder(node.id, 'up')}
            >
              Di chuyển lên
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!caps.canMoveDown}
              onClick={() => void reorder(node.id, 'down')}
            >
              Di chuyển xuống
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DisabledAware
              destructive
              disabledReason={deleteBlockedReason(node)}
              onClick={() => setPendingDelete(node)}
            >
              Xóa chương
            </DisabledAware>
          </RowMenu>
        </div>
        {open && (
          <div className="border-t border-slate-100">
            {shownItems.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500 sm:pl-11">
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
                      setEditor({ mode: 'edit', kind: 'item', parentId: node.id, node: item })
                    }
                    onReorder={(direction) => void reorder(item.id, direction)}
                    onDelete={() => setPendingDelete(item)}
                  />
                ))}
              </ol>
            )}
            {!filtering && !chapter.archived && (
              <div className="border-t border-slate-100 px-2 py-1 sm:pl-8">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-700 hover:text-blue-800"
                  onClick={() => setEditor({ mode: 'create', kind: 'item', parentId: node.id })}
                >
                  <Plus /> Thêm kiến thức
                </Button>
              </div>
            )}
          </div>
        )}
      </li>
    );
  };

  const { totals } = overview;

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-6 sm:pt-6">
        {/* ── Header: title, scope, page actions ── */}
        <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
              Chương trình &amp; Kiến thức
            </h1>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
              <ScopePicker
                label="Môn"
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
                label="Lớp"
                items={grades}
                value={effectiveGrade}
                disabled={!effectiveSubject}
                onSelect={setGradeId}
                onAdd={() =>
                  setEditor({ mode: 'create', kind: 'grade', parentId: effectiveSubject })
                }
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
        ) : overview.chapters.length === 0 ? (
          <ContextPrompt
            title={`Chưa có chương nào cho ${subjectNode?.title ?? ''} ${gradeNode?.title ?? ''}`}
            text="Nhập chương trình có sẵn hoặc tạo chương đầu tiên."
            action="Tạo chương đầu tiên"
            onAction={() =>
              setEditor({ mode: 'create', kind: 'chapter', parentId: effectiveGrade })
            }
            secondary={{ label: 'Nhập chương trình', onClick: () => setImportOpen(true) }}
          />
        ) : (
          <>
            {/* ── Curriculum overview: every number is a filter ── */}
            <section aria-label="Tổng quan chương trình" className="mt-5">
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-6">
                <Metric
                  label="Kiến thức"
                  value={totals.lessons}
                  active={filter === 'all'}
                  onClick={() => setFilter('all')}
                />
                <Metric
                  label="Chưa có bài"
                  value={totals.NO_ARTICLE}
                  tone="slate"
                  active={filter === 'NO_ARTICLE'}
                  onClick={() => applyFilter('NO_ARTICLE')}
                />
                <Metric
                  label="Bản nháp"
                  value={totals.DRAFT}
                  tone="amber"
                  active={filter === 'DRAFT'}
                  onClick={() => applyFilter('DRAFT')}
                />
                <Metric
                  label="Sẵn sàng"
                  value={totals.READY}
                  tone="blue"
                  active={filter === 'READY'}
                  onClick={() => applyFilter('READY')}
                />
                <Metric
                  label="Đang hiển thị"
                  value={totals.PUBLISHED}
                  tone="emerald"
                  active={filter === 'PUBLISHED'}
                  onClick={() => applyFilter('PUBLISHED')}
                />
                <div className="flex flex-col justify-center bg-white px-3 py-2.5">
                  <span className="text-lg font-semibold tabular-nums leading-6 text-slate-900">
                    {overview.completeChapters}
                    <span className="text-sm font-normal text-slate-400">
                      /{overview.activeChapters}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">Chương hoàn chỉnh</span>
                </div>
              </div>
              {overview.archivedLessons > 0 && (
                <p className="mt-1.5 text-xs text-slate-500">
                  Không tính {overview.archivedLessons} kiến thức trong nhánh lưu trữ.
                </p>
              )}
            </section>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
              {/* ── Work queue (first on mobile, right rail on desktop) ── */}
              <aside className="lg:sticky lg:top-4 lg:order-2">
                <WorkQueue
                  items={queue}
                  migration={
                    localDrafts
                      ? {
                          nodes: localDrafts.nodes.length,
                          articles: localDrafts.articles.length,
                          onOpen: () => setMigrationOpen(true),
                        }
                      : null
                  }
                  onOpenLesson={setLessonNodeId}
                  onAddToChapter={(chapterId) => {
                    focusChapter(chapterId);
                    setEditor({ mode: 'create', kind: 'item', parentId: chapterId });
                  }}
                  onShowAll={(kind) => applyFilter(kind)}
                />
              </aside>

              {/* ── Curriculum explorer ── */}
              <section
                ref={explorerRef}
                aria-label="Danh sách chương"
                className="min-w-0 scroll-mt-4 lg:order-1"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative sm:w-80">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <Input
                      className="h-9 bg-white pl-9"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Tìm chương hoặc kiến thức…"
                      aria-label="Tìm trong chương trình"
                    />
                  </div>
                  {filter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setFilter('all')}
                      className="inline-flex h-8 items-center gap-1.5 self-start rounded-full bg-slate-900 pl-3 pr-2 text-sm font-medium text-white sm:self-auto"
                      aria-label={`Bỏ lọc ${FILTER_LABELS[filter]}`}
                    >
                      {FILTER_LABELS[filter]}
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {activeChapters.length === 0 && shownArchived.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white py-10 text-center text-sm text-slate-500">
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
                  <ol className="mt-3 space-y-2.5">
                    {activeChapters.map((chapter) =>
                      renderChapter(
                        chapter,
                        overview.chapters
                          .filter((item) => !item.archived)
                          .findIndex((item) => item.node.id === chapter.node.id)
                      )
                    )}
                  </ol>
                )}

                {shownArchived.length > 0 && (
                  <div className="mt-5">
                    <button
                      type="button"
                      aria-expanded={showArchived || !!query}
                      onClick={() => setShowArchived((value) => !value)}
                      className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-slate-500 outline-none hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <ChevronDown
                        aria-hidden="true"
                        className={`size-4 transition-transform ${showArchived || query ? '' : '-rotate-90'}`}
                      />
                      Đã lưu trữ ({shownArchived.length})
                    </button>
                    {(showArchived || !!query) && (
                      <ol className="mt-2 space-y-2.5 opacity-80">
                        {shownArchived.map((chapter) => renderChapter(chapter, null))}
                      </ol>
                    )}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
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
        existingNodes={overview.chapters.flatMap((ch) => [
          ch.node,
          ...childrenOf(nodes, ch.node.id),
        ])}
        onApply={applyImport}
      />

      {localDrafts && (
        <MigrationDialog
          open={migrationOpen}
          onOpenChange={setMigrationOpen}
          repo={repo}
          snapshot={localDrafts}
          serverNodes={nodes}
          serverArticleNodeIds={new Set(Object.keys(summaries))}
          onFinished={async (outcome) => {
            if (outcome !== 'failed') setLocalDrafts(null);
            if (outcome !== 'dismissed') await load();
          }}
        />
      )}

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

const METRIC_TONES = {
  slate: 'text-slate-600',
  amber: 'text-amber-700',
  blue: 'text-blue-700',
  emerald: 'text-emerald-700',
  default: 'text-slate-900',
} as const;

function Metric({
  label,
  value,
  tone = 'default',
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone?: keyof typeof METRIC_TONES;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex flex-col items-start justify-center px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
        active
          ? 'bg-blue-50 shadow-[inset_0_-2px_0_var(--color-blue-600)]'
          : 'bg-white hover:bg-slate-50'
      }`}
    >
      <span
        className={`text-lg font-semibold tabular-nums leading-6 ${value ? METRIC_TONES[tone] : 'text-slate-400'}`}
      >
        {value}
      </span>
      <span className="text-xs text-slate-500">{label}</span>
    </button>
  );
}

/** Stacked bar of real lesson states; width is the share of lessons in each state. */
function ChapterProgress({
  counts,
  total,
  complete,
}: {
  counts: StudioChapter['counts'];
  total: number;
  complete: boolean;
}) {
  if (complete) {
    return (
      <CheckCircle2
        className="hidden size-4 shrink-0 text-emerald-600 sm:block"
        aria-hidden="true"
      />
    );
  }
  const segments = [
    ['PUBLISHED', 'bg-emerald-500'],
    ['READY', 'bg-blue-500'],
    ['DRAFT', 'bg-amber-400'],
  ] as const;
  return (
    <div
      className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 sm:flex"
      aria-hidden="true"
    >
      {segments.map(([key, color]) =>
        counts[key] ? (
          <div key={key} className={color} style={{ width: `${(counts[key] / total) * 100}%` }} />
        ) : null
      )}
    </div>
  );
}

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
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-9 shrink-0 text-xs font-medium text-slate-500 sm:w-auto">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={item.id === value}
            disabled={disabled}
            onClick={() => onSelect(item.id)}
            className={`h-7 shrink-0 rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              item.id === value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200/70'
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
      className={`group flex items-center gap-2 px-3 py-1 sm:pl-11 sm:pr-4 ${highlight ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}
    >
      {isLesson ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <FileText aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1 break-words text-sm leading-6 text-slate-800 group-hover:text-slate-950">
            {item.title}
          </span>
          {state && <PublicationBadge state={state} variant="dot" />}
        </button>
      ) : (
        <span className="flex min-h-11 min-w-0 flex-1 items-center text-sm font-medium text-slate-700">
          {item.title}
        </span>
      )}
      <RowMenu label={`Thao tác với ${item.title}`}>
        {isLesson && <DropdownMenuItem onClick={onOpen}>Soạn bài học</DropdownMenuItem>}
        {state === 'PUBLISHED' && (
          <DropdownMenuItem
            onClick={() =>
              window.open(`/student/lessons/${encodeURIComponent(item.id)}`, '_blank', 'noopener')
            }
          >
            Mở trang học sinh
          </DropdownMenuItem>
        )}
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
    <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
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
