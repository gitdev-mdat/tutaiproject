'use client';

import * as React from 'react';
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  ChevronDown,
  Info,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ApiKnowledgeRepository } from '@/lib/knowledge-tree/api-knowledge-repository';
import {
  AI_DRAFT_BLOCK_TYPES,
  AI_DRAFT_LIMITS,
  LEARNER_LEVELS,
  LEARNER_LEVEL_LABELS,
  LESSON_STAGES,
  STAGE_LABELS,
  type AiDraftBlockType,
  type AiLessonDraft,
  type LearnerLevel,
  type LessonDraftMode,
  type LessonDraftPlan,
  type LessonStage,
} from '@/lib/knowledge-tree/ai-lesson-draft';
import type { DraftCheck } from '@/lib/knowledge-tree/ai-lesson-quality';
import type {
  LessonDraftContextSummary,
  LessonDraftPreview,
  LessonDraftResponse,
  ReferenceItem,
} from '@/lib/knowledge-tree/ai-lesson-draft-service';
import type { DraftGeneration } from '@/lib/knowledge-tree/draft-provenance';
import { ARTICLE_BODY_BLOCKS } from '@/lib/knowledge-tree/knowledge-article';
import type { KnowledgeArticleBlock } from '@/lib/knowledge-tree/knowledge-tree-types';
import { InlineText, RichText } from '@/components/learning/rich-text';

const REFERENCE_KINDS: Record<string, string> = {
  THEORY: 'Lí thuyết',
  METHOD: 'Phương pháp',
  WORKED_EXAMPLE: 'Ví dụ',
  EXERCISE: 'Bài tập',
  SOLUTION: 'Lời giải',
};

/** "math_book_3, tr. 13, 16" for each book in a set of extracts. */
function sourceLine(items: Array<{ documentTitle: string; printedPages: number[] }>) {
  const books = new Map<string, Set<number>>();
  for (const item of items) {
    const pages = books.get(item.documentTitle) ?? new Set<number>();
    item.printedPages.forEach((page) => pages.add(page));
    books.set(item.documentTitle, pages);
  }
  return [...books]
    .map(([title, pages]) => `${title}, tr. ${[...pages].sort((a, b) => a - b).join(', ')}`)
    .join('; ');
}

/**
 * The approved extracts with book and page; each opens to the exact text that
 * is (or was) placed in the model's input.
 */
function ReferenceList({ items }: { items: ReferenceItem[] }) {
  return (
    <ul className="mt-1.5 space-y-1 text-xs leading-5 text-slate-600">
      {items.map((item) => (
        <li key={item.artifactId}>
          <details className="group">
            <summary className="flex cursor-pointer list-none gap-1.5">
              <ChevronDown
                className="mt-0.5 size-3.5 shrink-0 -rotate-90 text-slate-400 transition-transform group-open:rotate-0"
                aria-hidden="true"
              />
              <span className="shrink-0 font-medium text-slate-700">
                {REFERENCE_KINDS[item.kind] ?? item.kind}:
              </span>
              <span className="min-w-0">
                <InlineText text={item.title} />{' '}
                <span className="text-slate-400">
                  · {item.documentTitle}, tr. {item.printedPages.join(', ')}
                  {item.truncated ? ' · đã rút gọn theo giới hạn độ dài' : ''}
                </span>
              </span>
            </summary>
            <div className="ml-5 mt-1 rounded-md border border-slate-200 bg-white px-2.5 py-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Nguyên văn gửi cho AI
              </p>
              <RichText content={item.content} className="text-xs leading-6 text-slate-700" />
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

type Phase =
  | { kind: 'checking' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'compose' }
  | { kind: 'loading'; mode: LessonDraftMode }
  | { kind: 'error'; message: string; code?: string }
  | {
      kind: 'review';
      draft: AiLessonDraft;
      selected: Record<AiDraftBlockType, boolean>;
      plan: LessonDraftPlan;
      checks: DraftCheck[];
      context: LessonDraftContextSummary;
      provenance: LessonDraftResponse['provenance'];
    };

const SOURCE_LABELS: Record<LessonDraftContextSummary['stageSource'], string> = {
  admin: 'bạn chọn',
  title: 'đoán từ tên bài',
  default: 'mặc định',
};

const LABELS = Object.fromEntries(
  ARTICLE_BODY_BLOCKS.map((meta) => [meta.type, meta.editorLabel])
) as Record<KnowledgeArticleBlock['type'], string>;

interface Props {
  nodeId: string;
  repo: ApiKnowledgeRepository;
  blocks: KnowledgeArticleBlock[];
  /** Whether students currently see this lesson. */
  published: boolean;
  onApply: (parts: Partial<Record<AiDraftBlockType, string>>, generationId: string | null) => void;
  onClose: () => void;
  /** Switches to the lesson's textbook material (link, extract, review). */
  onOpenReferences: () => void;
}

/** Why textbook drafting is not available yet, and the one step that fixes it. */
function textbookBlocker(context: LessonDraftContextSummary): { text: string; action: string } {
  const readiness = context.references.readiness;
  if (context.references.error) return { text: context.references.error, action: 'Mở Tư liệu' };
  if (!readiness)
    return {
      text: 'Kho sách tham chiếu chưa được bật trên máy chủ này.',
      action: 'Mở Tư liệu',
    };
  if (readiness.linkedSections === 0)
    return {
      text: 'Bài này chưa liên kết mục sách nào.',
      action: 'Liên kết mục sách',
    };
  if (readiness.needsReview > 0)
    return {
      text: `Đã liên kết ${readiness.linkedSections} mục sách và trích được ${readiness.needsReview} trích đoạn, nhưng chưa trích đoạn nào được duyệt. AI chỉ đọc trích đoạn đã duyệt.`,
      action: `Duyệt ${readiness.needsReview} trích đoạn`,
    };
  if (readiness.activeJobs > 0)
    return {
      text: `Đã liên kết ${readiness.linkedSections} mục sách; đang trích trang, chưa có gì để duyệt.`,
      action: 'Xem tiến trình',
    };
  if (readiness.failedSections > 0)
    return {
      text: `Đã liên kết ${readiness.linkedSections} mục sách nhưng lần trích gần nhất bị lỗi.`,
      action: 'Xem lỗi và thử lại',
    };
  return {
    text: `Đã liên kết ${readiness.linkedSections} mục sách nhưng chưa trích trang nào. Liên kết thôi chưa cho AI đọc được nội dung sách.`,
    action: 'Trích trang sách',
  };
}

const STATUS_LABELS: Record<DraftGeneration['status'], string> = {
  PROPOSED: 'chỉ xem, chưa dùng',
  APPLIED: 'đã đưa vào trình soạn, chưa lưu',
  SAVED: 'đã lưu vào bài',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

/** Recent drafts of the lesson and what each was really written from. */
function DraftHistory({ history }: { history: DraftGeneration[] }) {
  if (!history.length) return null;
  return (
    <details className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600">
      <summary className="cursor-pointer font-semibold text-slate-700">
        Các lần soạn nháp gần đây ({history.length})
      </summary>
      <ul className="mt-1.5 space-y-1.5">
        {history.map((item) => {
          const used = item.references.filter((reference) => reference.includedInPrompt);
          return (
            <li key={item.id} className="leading-5">
              <span className="tabular-nums text-slate-500">{formatTime(item.createdAt)}</span> ·{' '}
              {item.mode === 'TEXTBOOK' && used.length
                ? `theo sách: ${used.length} trích đoạn (${sourceLine(used)})`
                : 'soạn chung, không dùng sách'}{' '}
              · {STATUS_LABELS[item.status]}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/**
 * Review-first AI drafting. The admin picks the source before generating (the
 * approved textbook extracts, or general drafting), sees exactly what was sent,
 * and compares each proposed part with the current lesson. The proposal lives
 * only in this panel until chosen parts are applied to the editor; saving and
 * showing to students stay separate, explicit actions.
 */
export function AiDraftPanel({
  nodeId,
  repo,
  blocks,
  published,
  onApply,
  onClose,
  onOpenReferences,
}: Props) {
  const [phase, setPhase] = React.useState<Phase>({ kind: 'checking' });
  const [includeExisting, setIncludeExisting] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [context, setContext] = React.useState<LessonDraftPreview | null>(null);
  const [stage, setStage] = React.useState<LessonStage | ''>('');
  const [learnerLevel, setLearnerLevel] = React.useState<LearnerLevel | ''>('');
  const [prerequisites, setPrerequisites] = React.useState('');
  const [mode, setMode] = React.useState<LessonDraftMode | null>(null);
  const [compare, setCompare] = React.useState<Partial<Record<AiDraftBlockType, boolean>>>({});
  const controller = React.useRef<AbortController | null>(null);

  const current = React.useMemo(() => {
    const map = {} as Record<AiDraftBlockType, string>;
    for (const type of AI_DRAFT_BLOCK_TYPES) {
      map[type] = blocks.find((block) => block.type === type)?.content.trim() ?? '';
    }
    return map;
  }, [blocks]);
  const hasContent = AI_DRAFT_BLOCK_TYPES.some((type) => current[type]);
  const textbookReady = (context?.references.items.length ?? 0) > 0;
  const chosenMode: LessonDraftMode = mode ?? (textbookReady ? 'TEXTBOOK' : 'GENERAL');

  React.useEffect(() => {
    let cancelled = false;
    void repo.getAiDraftAvailability(nodeId).then((result) => {
      if (cancelled) return;
      setContext(result.context ?? null);
      setPhase(
        result.available
          ? { kind: 'compose' }
          : { kind: 'unavailable', reason: result.reason ?? 'Tính năng chưa được bật.' }
      );
    });
    return () => {
      cancelled = true;
      controller.current?.abort();
    };
  }, [repo, nodeId]);

  const generate = async () => {
    if (phase.kind === 'loading') return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setPhase({ kind: 'loading', mode: chosenMode });
    const existing = includeExisting
      ? Object.fromEntries(
          AI_DRAFT_BLOCK_TYPES.filter((t) => current[t]).map((t) => [t, current[t]])
        )
      : undefined;
    const result = await repo.requestAiDraft(
      nodeId,
      {
        existing,
        note: note.trim() || undefined,
        stage: stage || undefined,
        learnerLevel: learnerLevel || undefined,
        prerequisites: prerequisites.trim() || undefined,
        mode: chosenMode,
      },
      abort.signal
    );
    if (abort.signal.aborted) return;
    controller.current = null;
    if (!result.ok) {
      setPhase({ kind: 'error', message: result.error.message, code: result.error.code });
      return;
    }
    const { draft, plan, checks, context: used, provenance } = result.data;
    const selected = {} as Record<AiDraftBlockType, boolean>;
    for (const type of AI_DRAFT_BLOCK_TYPES) {
      // Never pre-select a part that would replace what the admin already wrote.
      selected[type] = !!draft[type] && !current[type];
    }
    setCompare({});
    setPhase({ kind: 'review', draft, selected, plan, checks, context: used, provenance });
  };

  const cancel = () => {
    controller.current?.abort();
    controller.current = null;
    setPhase({ kind: 'compose' });
  };

  const apply = () => {
    if (phase.kind !== 'review') return;
    const parts: Partial<Record<AiDraftBlockType, string>> = {};
    for (const type of AI_DRAFT_BLOCK_TYPES) {
      if (phase.selected[type] && phase.draft[type].trim()) parts[type] = phase.draft[type];
    }
    onApply(parts, phase.provenance.stored ? phase.provenance.id : null);
  };

  const chosen =
    phase.kind === 'review'
      ? AI_DRAFT_BLOCK_TYPES.filter((t) => phase.selected[t] && phase.draft[t].trim())
      : [];
  const replacing = chosen.filter((type) => current[type]);

  return (
    <section
      aria-label="Soạn nháp bằng AI"
      className="overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm"
    >
      <header className="flex items-center gap-2 border-b border-violet-100 bg-violet-50/60 px-4 py-2.5">
        <Sparkles className="size-4 text-violet-600" aria-hidden="true" />
        <h3 className="flex-1 text-sm font-semibold text-slate-900">Soạn nháp bằng AI</h3>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Đóng soạn nháp bằng AI"
          onClick={() => {
            controller.current?.abort();
            onClose();
          }}
        >
          <X />
        </Button>
      </header>

      <div className="px-4 py-3 text-sm">
        {phase.kind === 'checking' && (
          <p className="flex items-center gap-2 text-slate-500">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Đang kiểm tra…
          </p>
        )}

        {phase.kind === 'unavailable' && (
          <p className="text-slate-600" role="status">
            {phase.reason}
          </p>
        )}

        {(phase.kind === 'compose' || phase.kind === 'error') && (
          <div className="space-y-3">
            <p className="leading-6 text-slate-600">
              AI viết một <strong className="font-semibold text-slate-800">bản đề xuất</strong> ở
              khung này. Bài học {published ? 'học sinh đang học ' : ''}không đổi cho đến khi bạn
              chọn phần nào đưa vào trình soạn và tự bấm lưu.
            </p>
            {context && (
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-slate-700">
                  AI soạn dựa trên gì?
                </legend>
                <div
                  className={`rounded-lg border px-3 py-2.5 ${
                    chosenMode === 'TEXTBOOK'
                      ? 'border-emerald-300 bg-emerald-50/50'
                      : textbookReady
                        ? 'border-slate-200'
                        : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <label
                    className={`flex gap-2.5 ${textbookReady ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                  >
                    <input
                      type="radio"
                      name="ai-draft-mode"
                      className="mt-1 size-4 accent-emerald-600"
                      checked={chosenMode === 'TEXTBOOK'}
                      disabled={!textbookReady}
                      onChange={() => setMode('TEXTBOOK')}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-medium text-slate-900">
                        <BookMarked className="size-4 text-emerald-700" aria-hidden="true" />
                        Theo sách đã duyệt
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                        {textbookReady
                          ? `AI nhận nguyên văn ${context.references.items.length} trích đoạn đã duyệt (${sourceLine(context.references.items)})${
                              context.references.approved > context.references.items.length
                                ? `; ${context.references.approved - context.references.items.length} trích đoạn khác không gửi vì giới hạn độ dài`
                                : ''
                            }.`
                          : `Chưa dùng được. ${textbookBlocker(context).text}`}
                      </span>
                    </span>
                  </label>
                  <div className="pl-6.5">
                    {textbookReady ? (
                      <ReferenceList items={context.references.items} />
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-1.5 h-7 border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
                        onClick={onOpenReferences}
                      >
                        <BookOpen /> {textbookBlocker(context).action}
                      </Button>
                    )}
                  </div>
                </div>
                <label
                  className={`flex cursor-pointer gap-2.5 rounded-lg border px-3 py-2.5 ${
                    chosenMode === 'GENERAL'
                      ? 'border-violet-300 bg-violet-50/40'
                      : 'border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="ai-draft-mode"
                    className="mt-1 size-4 accent-violet-600"
                    checked={chosenMode === 'GENERAL'}
                    onChange={() => setMode('GENERAL')}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-slate-900">
                      Soạn chung, không dùng sách
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                      AI chỉ dựa vào vị trí bài trong chương trình và yêu cầu của bạn. Không đọc
                      sách nào.
                    </span>
                  </span>
                </label>
              </fieldset>
            )}
            {context && (
              <details className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                  Bối cảnh chương trình: {STAGE_LABELS[stage || context.stage]} ·{' '}
                  {LEARNER_LEVEL_LABELS[learnerLevel || context.learnerLevel]}
                </summary>
                <div className="mt-2 space-y-3">
                  <p className="text-xs leading-5 text-slate-600">
                    <span className="font-medium text-slate-800">{context.path}</span>
                    {context.sequence && context.sequence.total > 0 && (
                      <>
                        {' '}
                        · bài {context.sequence.position}/{context.sequence.total} của chương
                      </>
                    )}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-medium text-slate-600">
                      Giai đoạn học
                      <select
                        value={stage}
                        onChange={(event) => setStage(event.target.value as LessonStage | '')}
                        className="mt-1 block h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900"
                      >
                        <option value="">
                          {STAGE_LABELS[context.stage]} ({SOURCE_LABELS[context.stageSource]})
                        </option>
                        {LESSON_STAGES.map((value) => (
                          <option key={value} value={value}>
                            {STAGE_LABELS[value]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-medium text-slate-600">
                      Học sinh
                      <select
                        value={learnerLevel}
                        onChange={(event) =>
                          setLearnerLevel(event.target.value as LearnerLevel | '')
                        }
                        className="mt-1 block h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900"
                      >
                        <option value="">
                          {LEARNER_LEVEL_LABELS[context.learnerLevel]} (
                          {SOURCE_LABELS[context.learnerLevelSource]})
                        </option>
                        {LEARNER_LEVELS.map((value) => (
                          <option key={value} value={value}>
                            {LEARNER_LEVEL_LABELS[value]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div>
                    <label
                      htmlFor="ai-draft-prerequisites"
                      className="text-xs font-medium text-slate-600"
                    >
                      Kiến thức nền học sinh cần (không bắt buộc)
                    </label>
                    <Textarea
                      id="ai-draft-prerequisites"
                      value={prerequisites}
                      maxLength={AI_DRAFT_LIMITS.prerequisitesChars}
                      onChange={(event) => setPrerequisites(event.target.value)}
                      placeholder="Ví dụ: đạo hàm của hàm đa thức; xét dấu tam thức bậc hai"
                      className="mt-1 min-h-[52px] bg-white text-sm"
                    />
                  </div>
                  {context.missing.length > 0 && (
                    <p className="flex gap-1.5 text-xs leading-5 text-slate-500">
                      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        Cây kiến thức chưa có {context.missing.join(', ')}. AI sẽ dùng mặc định ở
                        trên và tự nêu kiến thức nền nó giả định để bạn kiểm tra.
                      </span>
                    </p>
                  )}
                </div>
              </details>
            )}
            <label
              className={`flex items-start gap-2 ${hasContent ? 'text-slate-700' : 'text-slate-400'}`}
            >
              <input
                type="checkbox"
                className="mt-1 size-4 accent-violet-600"
                checked={includeExisting && hasContent}
                disabled={!hasContent}
                onChange={(event) => setIncludeExisting(event.target.checked)}
              />
              <span>Gửi kèm nội dung đang soạn để AI dựa vào và bổ sung</span>
            </label>
            <div>
              <label htmlFor="ai-draft-note" className="text-xs font-medium text-slate-600">
                Yêu cầu thêm (không bắt buộc)
              </label>
              <Textarea
                id="ai-draft-note"
                value={note}
                maxLength={AI_DRAFT_LIMITS.noteChars}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ví dụ: thêm một ví dụ về bài toán thực tế"
                className="mt-1 min-h-[60px] text-sm"
              />
            </div>
            {phase.kind === 'error' && (
              <p role="alert" className="flex gap-2 rounded-lg bg-red-50 px-3 py-2 text-red-700">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{phase.message} Nội dung đang soạn vẫn giữ nguyên.</span>
              </p>
            )}
            {context && <DraftHistory history={context.history} />}
            <div className="flex justify-end">
              <Button
                size="sm"
                className="bg-violet-600 text-white hover:bg-violet-700"
                onClick={() => void generate()}
              >
                <Sparkles />{' '}
                {phase.kind === 'error'
                  ? 'Thử lại'
                  : chosenMode === 'TEXTBOOK'
                    ? 'Tạo bản nháp theo sách'
                    : 'Tạo bản nháp chung'}
              </Button>
            </div>
          </div>
        )}

        {phase.kind === 'loading' && (
          <div className="flex items-center gap-3" role="status">
            <Loader2 className="size-4 animate-spin text-violet-600" aria-hidden="true" />
            <span className="flex-1 text-slate-600">
              {phase.mode === 'TEXTBOOK'
                ? 'AI đang soạn nháp từ trích đoạn sách đã duyệt…'
                : 'AI đang soạn nháp (không dùng sách)…'}
            </span>
            <Button size="sm" variant="ghost" onClick={cancel}>
              Hủy
            </Button>
          </div>
        )}

        {phase.kind === 'review' && (
          <div className="space-y-3">
            <div
              className={`rounded-lg border px-3 py-2 text-xs leading-5 ${
                phase.context.references.used
                  ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
              role="status"
            >
              <p className="font-semibold">
                {phase.context.references.used
                  ? `Soạn theo sách: AI đã nhận nguyên văn ${phase.context.references.items.length} trích đoạn đã duyệt (${sourceLine(phase.context.references.items)}).`
                  : 'Soạn chung: AI không nhận nội dung sách nào cho bản nháp này.'}
              </p>
              <p className="mt-0.5 text-slate-600">
                Soạn cho {STAGE_LABELS[phase.context.stage]} ·{' '}
                {LEARNER_LEVEL_LABELS[phase.context.learnerLevel]}. Hệ thống chỉ ghi nhận tư liệu đã
                gửi, không kiểm chứng từng câu AI viết có đúng theo sách hay không.
              </p>
              {phase.context.references.used && (
                <ReferenceList items={phase.context.references.items} />
              )}
              <details className="mt-1 text-slate-500">
                <summary className="cursor-pointer">Chi tiết kỹ thuật</summary>
                <p className="mt-1 break-all">
                  Mã bản nháp {phase.provenance.id} · mô hình {phase.provenance.model} · phiên bản
                  lời nhắc {phase.provenance.promptVersion} · {phase.provenance.promptChars} ký tự
                  gửi đi · {formatTime(phase.provenance.createdAt)}
                  {phase.provenance.stored
                    ? ' · đã lưu nhật ký nguồn'
                    : ' · chưa lưu nhật ký nguồn'}
                </p>
              </details>
            </div>
            <p className="flex gap-2 text-xs leading-5 text-amber-800">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              AI có thể sai. Đây vẫn là đề xuất: bài {published ? 'học sinh đang học ' : ''}chưa
              thay đổi.
            </p>
            <section
              aria-label="Kiểm tra tự động"
              className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5"
            >
              <h4 className="text-xs font-semibold text-slate-700">Kiểm tra tự động</h4>
              {phase.checks.length ? (
                <ul className="mt-1.5 space-y-1.5">
                  {phase.checks.map((check) => (
                    <li
                      key={check.id}
                      className={`flex gap-2 text-xs leading-5 ${check.severity === 'warning' ? 'text-amber-800' : 'text-slate-600'}`}
                    >
                      {check.severity === 'warning' ? (
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span>{check.message}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Không thấy lỗi nào kiểm tra được bằng máy (công thức, cấu trúc, đạo hàm và kết
                  luận của ví dụ). Máy không đánh giá được bài có dạy tốt không, nên vẫn cần đọc kỹ.
                </p>
              )}
            </section>
            {(phase.plan.prerequisites.length > 0 ||
              phase.plan.newNotation.length > 0 ||
              phase.plan.teacherNotes.length > 0) && (
              <details className="rounded-lg border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-600">
                <summary className="cursor-pointer font-semibold text-slate-700">
                  Ghi chú của AI cho giáo viên
                </summary>
                {(
                  [
                    ['Kiến thức nền bài nhắc lại', phase.plan.prerequisites],
                    ['Ký hiệu, thuật ngữ mới đã giải thích', phase.plan.newNotation],
                    ['AI nói đã dùng tư liệu thế nào, cần kiểm tra gì', phase.plan.teacherNotes],
                  ] as const
                )
                  .filter(([, items]) => items.length)
                  .map(([label, items]) => (
                    <div key={label} className="mt-2">
                      <p className="font-medium text-slate-700">{label}</p>
                      <ul className="list-disc pl-4">
                        {items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </details>
            )}
            <ul className="space-y-2.5">
              {AI_DRAFT_BLOCK_TYPES.filter((type) => phase.draft[type].trim()).map((type) => {
                const id = `ai-draft-${type}`;
                const existing = current[type];
                return (
                  <li
                    key={type}
                    className={`rounded-lg border ${phase.selected[type] ? 'border-violet-300 bg-violet-50/40' : 'border-slate-200'}`}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-2">
                      <label className="flex items-center gap-2 font-medium text-slate-800">
                        <input
                          type="checkbox"
                          className="size-4 accent-violet-600"
                          checked={phase.selected[type]}
                          onChange={(event) =>
                            setPhase({
                              ...phase,
                              selected: { ...phase.selected, [type]: event.target.checked },
                            })
                          }
                        />
                        Dùng phần {LABELS[type]}
                      </label>
                      <span
                        className={`text-xs ${existing ? 'text-amber-700' : 'text-emerald-700'}`}
                      >
                        {existing
                          ? phase.selected[type]
                            ? 'Sẽ thay phần đang có'
                            : 'Bài đã có phần này'
                          : 'Phần mới, bài chưa có'}
                      </span>
                      {existing && (
                        <button
                          type="button"
                          className="ml-auto text-xs font-medium text-slate-600 underline-offset-2 hover:underline"
                          aria-expanded={!!compare[type]}
                          onClick={() => setCompare({ ...compare, [type]: !compare[type] })}
                        >
                          {compare[type] ? 'Ẩn bản hiện tại' : 'So với bản hiện tại'}
                        </button>
                      )}
                    </div>
                    {existing && compare[type] && (
                      <div className="mx-3 mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          Bản hiện tại{published ? ' (học sinh đang thấy)' : ''}
                        </p>
                        <RichText content={existing} className="text-sm leading-6 text-slate-600" />
                      </div>
                    )}
                    <Textarea
                      id={id}
                      aria-label={`Đề xuất cho ${LABELS[type]}`}
                      value={phase.draft[type]}
                      onChange={(event) =>
                        setPhase({
                          ...phase,
                          draft: { ...phase.draft, [type]: event.target.value },
                        })
                      }
                      className="min-h-[88px] resize-y border-0 bg-transparent text-sm leading-6 shadow-none focus-visible:ring-0"
                    />
                  </li>
                );
              })}
            </ul>
            <p className="text-xs leading-5 text-slate-600" role="status">
              {chosen.length === 0
                ? 'Chưa chọn phần nào.'
                : `Sẽ đưa ${chosen.length} phần vào trình soạn${
                    replacing.length
                      ? `, trong đó thay ${replacing.length} phần đang có (${replacing.map((t) => LABELS[t]).join(', ')})`
                      : ', không thay phần nào đang có'
                  }. Chưa lưu; có thể hoàn tác.`}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={onClose}>
                Bỏ bản nháp
              </Button>
              <Button size="sm" variant="outline" onClick={() => void generate()}>
                <RotateCcw /> Tạo lại
              </Button>
              <Button
                size="sm"
                className="bg-violet-600 text-white hover:bg-violet-700"
                disabled={chosen.length === 0}
                onClick={apply}
              >
                Đưa {chosen.length} phần vào trình soạn
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
