'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  PenLine,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { LessonJourney } from '@/components/learning/lesson-journey';
import { GraphFieldStatus } from './graph-field-status';
import { buildLessonJourney } from '@/lib/knowledge-tree/lesson-journey';
import {
  ArticleValidationError,
  type ApiKnowledgeRepository,
} from '@/lib/knowledge-tree/api-knowledge-repository';
import {
  ARTICLE_BODY_BLOCKS,
  normalizeArticleBlocks,
  validateArticle,
} from '@/lib/knowledge-tree/knowledge-article';
import {
  getLessonPublicationState,
  summarizeArticle,
  type ArticleSummary,
} from '@/lib/knowledge-tree/learning-visibility';
import type {
  KnowledgeArticle,
  KnowledgeArticleBlock,
  KnowledgeTreeNode,
} from '@/lib/knowledge-tree/knowledge-tree-types';
import type { AiDraftBlockType } from '@/lib/knowledge-tree/ai-lesson-draft';
import { AiDraftPanel } from './ai-draft-panel';
import { PublicationBadge } from './publication-badge';

interface Props {
  node: KnowledgeTreeNode | null;
  nodes: KnowledgeTreeNode[];
  breadcrumb: string[];
  repo: ApiKnowledgeRepository;
  onClose: () => void;
  onSaved: (nodeId: string, summary: ArticleSummary, message: string) => void;
}

const REQUIRED_LABELS: Record<string, string> = {
  TITLE: 'Tiêu đề',
  OBJECTIVE: 'Mục tiêu',
  MAIN_CONTENT: 'Nội dung chính',
  EXAMPLE: 'Ví dụ',
};

export function LessonEditorSheet(props: Props) {
  return (
    <Sheet open={!!props.node} onOpenChange={(open) => !open && props.onClose()}>
      <SheetContent
        showCloseButton={false}
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[760px]"
        aria-describedby={undefined}
      >
        {props.node && <LessonEditor key={props.node.id} {...props} node={props.node} />}
      </SheetContent>
    </Sheet>
  );
}

function LessonEditor({
  node,
  nodes,
  breadcrumb,
  repo,
  onClose,
  onSaved,
}: Props & { node: KnowledgeTreeNode }) {
  const [loadState, setLoadState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [saved, setSaved] = React.useState<KnowledgeArticle | null>(null);
  const [title, setTitle] = React.useState(node.title);
  const [blocks, setBlocks] = React.useState<KnowledgeArticleBlock[]>(normalizeArticleBlocks([]));
  const [dirty, setDirty] = React.useState(false);
  const [tab, setTab] = React.useState<'edit' | 'preview'>('edit');
  const scrollRef = React.useRef<HTMLDivElement>(null);
  // The preview is read from its first stage, not from wherever the editor was scrolled.
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [tab]);
  const [saving, setSaving] = React.useState<null | 'draft' | 'publish' | 'unpublish'>(null);
  const [error, setError] = React.useState<{ text: string; missing: string[] } | null>(null);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);
  const [aiUndo, setAiUndo] = React.useState<{
    blocks: KnowledgeArticleBlock[];
    dirty: boolean;
    count: number;
  } | null>(null);

  const load = React.useCallback(async () => {
    setLoadState('loading');
    const result = await repo.getArticle(node.id);
    if (!result.ok) {
      setLoadState('error');
      return;
    }
    setSaved(result.data);
    setTitle(result.data?.title || node.title);
    setBlocks(normalizeArticleBlocks(result.data?.blocks ?? []));
    setDirty(false);
    setLoadState('ready');
  }, [repo, node.id, node.title]);

  React.useEffect(() => {
    // Loading the article from the server is the external sync this effect performs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const draftArticle = { title: title.trim() || node.title, blocks } as KnowledgeArticle;
  const validation = validateArticle(draftArticle);
  const state = getLessonPublicationState(nodes, node.id, saved);
  const archived = state === 'ARCHIVED';
  const published = !!saved && saved.status === 'PUBLISHED' && saved.publishToLearning;

  const updateBlock = (type: KnowledgeArticleBlock['type'], content: string) => {
    setBlocks((current) =>
      current.map((block) => (block.type === type ? { ...block, content } : block))
    );
    setDirty(true);
  };

  /** Applies reviewed AI parts to the editor only; the admin still saves explicitly. */
  const applyAiDraft = (parts: Partial<Record<AiDraftBlockType, string>>) => {
    setAiUndo({ blocks, dirty, count: Object.keys(parts).length });
    setBlocks((current) =>
      current.map((block) =>
        parts[block.type as AiDraftBlockType] !== undefined
          ? { ...block, content: parts[block.type as AiDraftBlockType]! }
          : block
      )
    );
    setDirty(true);
    setAiOpen(false);
  };

  const undoAiDraft = () => {
    if (!aiUndo) return;
    setBlocks(aiUndo.blocks);
    setDirty(aiUndo.dirty);
    setAiUndo(null);
  };

  const save = async (mode: 'draft' | 'publish' | 'unpublish') => {
    setSaving(mode);
    setError(null);
    const publishToLearning = mode === 'publish' || (mode === 'draft' && published);
    const result = await repo.upsertArticle(node.id, {
      title: title.trim() || node.title,
      blocks: [
        { id: 'block-title', type: 'TITLE', content: title.trim() || node.title },
        ...blocks,
      ],
      publishToLearning,
    });
    setSaving(null);
    if (!result.ok) {
      setError({
        text: result.error.message,
        missing: result.error instanceof ArticleValidationError ? result.error.missing : [],
      });
      return;
    }
    setSaved(result.data);
    setDirty(false);
    setAiUndo(null);
    const message =
      mode === 'publish'
        ? 'Đã lưu và hiển thị bài học cho học sinh.'
        : mode === 'unpublish'
          ? 'Đã ẩn bài học khỏi học sinh.'
          : 'Đã lưu bài học.';
    onSaved(node.id, summarizeArticle(result.data), message);
  };

  const primarySave = () => {
    if (saving || loadState !== 'ready' || !dirty) return;
    if (published && !validation.isValid) return;
    void save('draft');
  };

  const requestClose = () => {
    if (dirty && !saving) setConfirmClose(true);
    else onClose();
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          primarySave();
        }
      }}
    >
      {/* Header */}
      <div className="border-b border-slate-200 px-5 pb-4 pt-5 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-500">{breadcrumb.join(' › ')}</p>
            <SheetTitle className="mt-1 text-lg font-bold leading-snug text-slate-950">
              {node.title}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Soạn bài học cho mục kiến thức này
            </SheetDescription>
          </div>
          <PublicationBadge state={state} />
          <Button variant="ghost" size="sm" onClick={requestClose} aria-label="Đóng trình soạn bài">
            Đóng
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Chế độ soạn bài"
            className="inline-flex rounded-lg bg-slate-100 p-1"
          >
            {(
              [
                ['edit', 'Soạn bài', PenLine],
                ['preview', 'Xem như học sinh', Eye],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  tab === value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800"
            disabled={loadState !== 'ready'}
            aria-expanded={aiOpen}
            onClick={() => {
              setTab('edit');
              setAiOpen(true);
            }}
          >
            <Sparkles /> Soạn nháp bằng AI
          </Button>
        </div>
      </div>

      {confirmClose && (
        <div
          role="alertdialog"
          aria-label="Thay đổi chưa lưu"
          className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900 sm:px-6"
        >
          <span className="min-w-0 flex-1">Bài học có thay đổi chưa lưu.</span>
          <Button size="sm" variant="outline" onClick={() => setConfirmClose(false)}>
            Tiếp tục soạn
          </Button>
          <Button size="sm" variant="destructive" onClick={onClose}>
            Bỏ thay đổi
          </Button>
        </div>
      )}

      {/* Body */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-5 py-5 sm:px-6">
        {loadState === 'loading' ? (
          <div className="space-y-4" aria-busy="true" aria-label="Đang tải bài học">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-28 animate-pulse rounded-xl bg-slate-200/70" />
            ))}
          </div>
        ) : loadState === 'error' ? (
          <div className="rounded-xl border border-red-200 bg-white p-6 text-center">
            <p className="font-semibold text-slate-900">Không tải được bài học.</p>
            <p className="mt-1 text-sm text-slate-500">Nội dung trên máy chủ chưa bị thay đổi.</p>
            <Button className="mt-4" variant="outline" onClick={() => void load()}>
              Thử lại
            </Button>
          </div>
        ) : tab === 'preview' ? (
          <article className="mx-auto max-w-[1040px] rounded-2xl border border-slate-200 bg-[#FBFCFE] p-5 sm:p-8">
            <LessonJourney
              mode="preview"
              studentKey={null}
              lessonId={node.id}
              title={title.trim() || node.title}
              subjectTitle={breadcrumb[0] ?? ''}
              chapterTitle={breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 1] : ''}
              backHref={null}
              journey={buildLessonJourney(blocks, { checks: 0 })}
              checks={[]}
              practice={null}
              practiceHref="#"
              next={null}
            />
          </article>
        ) : (
          <div className="space-y-4">
            {aiOpen && (
              <AiDraftPanel
                nodeId={node.id}
                repo={repo}
                blocks={blocks}
                onApply={applyAiDraft}
                onClose={() => setAiOpen(false)}
              />
            )}
            {aiUndo && (
              <div
                role="status"
                className="flex flex-wrap items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm text-violet-900"
              >
                <span className="min-w-0 flex-1">
                  Đã đưa {aiUndo.count} phần do AI đề xuất vào bài. Chưa lưu, hãy đọc lại trước khi
                  lưu.
                </span>
                <Button size="sm" variant="ghost" onClick={undoAiDraft}>
                  Hoàn tác
                </Button>
              </div>
            )}
            {!saved && !aiOpen && (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600">
                Mục này chưa có bài học. Bắt đầu với Mục tiêu, Nội dung chính và Ví dụ, đó là ba
                phần bắt buộc trước khi hiển thị cho học sinh. Có thể dùng “Soạn nháp bằng AI” để có
                bản đầu tiên.
              </p>
            )}
            <label className="block rounded-xl border border-slate-200 bg-white p-4 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tiêu đề bài học
              </span>
              <input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setDirty(true);
                }}
                className="mt-1 w-full bg-transparent text-lg font-semibold text-slate-950 outline-none placeholder:text-slate-300"
                placeholder={node.title}
              />
            </label>
            {ARTICLE_BODY_BLOCKS.map((meta) => {
              const block = blocks.find((item) => item.type === meta.type)!;
              const missing = meta.required && validation.missing.includes(meta.type);
              const fieldId = `article-${meta.type}`;
              return (
                <div
                  key={meta.type}
                  className="rounded-xl border border-slate-200 bg-white focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100"
                >
                  <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
                    <label htmlFor={fieldId} className="text-sm font-semibold text-slate-800">
                      {meta.editorLabel}
                      {meta.required && (
                        <span className="ml-1 text-red-500" aria-hidden="true">
                          *
                        </span>
                      )}
                    </label>
                    {meta.required && (
                      <span
                        className={`text-xs ${missing ? 'text-slate-400' : 'text-emerald-600'}`}
                      >
                        {missing ? 'Bắt buộc' : 'Đã có'}
                      </span>
                    )}
                  </div>
                  <Textarea
                    id={fieldId}
                    value={block.content}
                    onChange={(event) => updateBlock(meta.type, event.target.value)}
                    placeholder={meta.editorHint}
                    aria-required={meta.required}
                    className={`${meta.type === 'GRAPH' ? 'min-h-[56px] font-mono' : 'min-h-[96px]'} resize-y rounded-none border-0 bg-transparent px-4 py-3 text-[15px] leading-7 shadow-none focus-visible:ring-0`}
                  />
                  {meta.type === 'GRAPH' && (
                    <GraphFieldStatus
                      value={block.content}
                      example={blocks.find((item) => item.type === 'EXAMPLE')?.content ?? ''}
                      onUse={(value) => updateBlock('GRAPH', value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Publication footer */}
      {loadState === 'ready' && (
        <div className="border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
          {error && (
            <div role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error.text}
              {error.missing.length > 0 &&
                ` Còn thiếu: ${error.missing.map((item) => REQUIRED_LABELS[item] ?? item).join(', ')}.`}
            </div>
          )}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1 text-sm">
              {archived ? (
                <p className="text-slate-500">
                  Mục này nằm trong nhánh lưu trữ nên học sinh không thấy. Vẫn có thể lưu nội dung.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Điều kiện hiển thị">
                  {(['OBJECTIVE', 'MAIN_CONTENT', 'EXAMPLE'] as const).map((type) => {
                    const done = !validation.missing.includes(type);
                    const Icon = done ? CheckCircle2 : Circle;
                    return (
                      <li
                        key={type}
                        className={`inline-flex items-center gap-1.5 ${done ? 'text-emerald-700' : 'text-slate-500'}`}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                        {REQUIRED_LABELS[type]}
                        <span className="sr-only">{done ? 'đã có' : 'còn thiếu'}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {published && !archived && (
                <Link
                  href={`/student/lessons/${encodeURIComponent(node.id)}`}
                  target="_blank"
                  className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
                >
                  Mở trang học sinh <ExternalLink className="size-3.5" aria-hidden="true" />
                </Link>
              )}
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {published ? (
                <>
                  <Button
                    variant="outline"
                    disabled={!!saving}
                    onClick={() => void save('unpublish')}
                  >
                    {saving === 'unpublish' ? <Loader2 className="animate-spin" /> : <EyeOff />}
                    Ẩn khỏi học sinh
                  </Button>
                  <Button
                    disabled={!!saving || !dirty || !validation.isValid}
                    onClick={() => void save('draft')}
                  >
                    {saving === 'draft' && <Loader2 className="animate-spin" />}
                    Lưu thay đổi
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    disabled={!!saving || (!dirty && !!saved)}
                    onClick={() => void save('draft')}
                  >
                    {saving === 'draft' && <Loader2 className="animate-spin" />}
                    Lưu bản nháp
                  </Button>
                  {!archived && (
                    <Button
                      disabled={!!saving || !validation.isValid}
                      onClick={() => void save('publish')}
                    >
                      {saving === 'publish' ? <Loader2 className="animate-spin" /> : <Eye />}
                      Lưu và hiển thị cho học sinh
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          {published && dirty && !validation.isValid && (
            <p className="mt-2 text-xs text-amber-700">
              Bài đang hiển thị nên cần đủ Mục tiêu, Nội dung chính và Ví dụ mới lưu được.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
