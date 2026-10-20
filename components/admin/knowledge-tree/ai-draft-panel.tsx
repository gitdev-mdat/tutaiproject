'use client';

import * as React from 'react';
import { AlertTriangle, BookMarked, Info, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
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
  type LessonDraftPlan,
  type LessonStage,
} from '@/lib/knowledge-tree/ai-lesson-draft';
import type { DraftCheck } from '@/lib/knowledge-tree/ai-lesson-quality';
import type { LessonDraftContextSummary } from '@/lib/knowledge-tree/ai-lesson-draft-service';
import { ARTICLE_BODY_BLOCKS } from '@/lib/knowledge-tree/knowledge-article';
import type { KnowledgeArticleBlock } from '@/lib/knowledge-tree/knowledge-tree-types';
import { InlineText } from '@/components/learning/rich-text';

const REFERENCE_KINDS: Record<string, string> = {
  THEORY: 'Lí thuyết',
  METHOD: 'Phương pháp',
  WORKED_EXAMPLE: 'Ví dụ',
  EXERCISE: 'Bài tập',
  SOLUTION: 'Lời giải',
};

/** Which approved textbook extracts ground the draft, with book and page. */
function ReferenceList({ items }: { items: LessonDraftContextSummary['references']['items'] }) {
  return (
    <ul className="mt-1.5 space-y-1 text-xs leading-5 text-slate-600">
      {items.map((item) => (
        <li key={item.artifactId} className="flex gap-1.5">
          <span className="shrink-0 font-medium text-slate-700">
            {REFERENCE_KINDS[item.kind] ?? item.kind}:
          </span>
          <span className="min-w-0">
            <InlineText text={item.title} />{' '}
            <span className="text-slate-400">
              · {item.documentTitle}, tr. {item.printedPages.join(', ')}
              {item.truncated ? ' · đã rút gọn' : ''}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

type Phase =
  | { kind: 'checking' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'compose' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'review';
      draft: AiLessonDraft;
      selected: Record<AiDraftBlockType, boolean>;
      plan: LessonDraftPlan;
      checks: DraftCheck[];
      context: LessonDraftContextSummary;
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
  onApply: (parts: Partial<Record<AiDraftBlockType, string>>) => void;
  onClose: () => void;
}

/**
 * Review-first AI drafting. The proposal lives only in this panel until the admin
 * applies chosen parts to the editor; saving and publishing stay separate actions.
 */
export function AiDraftPanel({ nodeId, repo, blocks, onApply, onClose }: Props) {
  const [phase, setPhase] = React.useState<Phase>({ kind: 'checking' });
  const [includeExisting, setIncludeExisting] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [context, setContext] = React.useState<LessonDraftContextSummary | null>(null);
  const [stage, setStage] = React.useState<LessonStage | ''>('');
  const [learnerLevel, setLearnerLevel] = React.useState<LearnerLevel | ''>('');
  const [prerequisites, setPrerequisites] = React.useState('');
  const [useReferences, setUseReferences] = React.useState(true);
  const controller = React.useRef<AbortController | null>(null);

  const current = React.useMemo(() => {
    const map = {} as Record<AiDraftBlockType, string>;
    for (const type of AI_DRAFT_BLOCK_TYPES) {
      map[type] = blocks.find((block) => block.type === type)?.content.trim() ?? '';
    }
    return map;
  }, [blocks]);
  const hasContent = AI_DRAFT_BLOCK_TYPES.some((type) => current[type]);

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
    setPhase({ kind: 'loading' });
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
        useReferences,
      },
      abort.signal
    );
    if (abort.signal.aborted) return;
    controller.current = null;
    if (!result.ok) {
      setPhase({ kind: 'error', message: result.error.message });
      return;
    }
    const { draft, plan, checks, context: used } = result.data;
    const selected = {} as Record<AiDraftBlockType, boolean>;
    for (const type of AI_DRAFT_BLOCK_TYPES) {
      // Never pre-select a part that would replace what the admin already wrote.
      selected[type] = !!draft[type] && !current[type];
    }
    setPhase({ kind: 'review', draft, selected, plan, checks, context: used });
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
    onApply(parts);
  };

  const selectedCount =
    phase.kind === 'review'
      ? AI_DRAFT_BLOCK_TYPES.filter((t) => phase.selected[t] && phase.draft[t].trim()).length
      : 0;

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
              AI soạn bản nháp theo bối cảnh dưới đây. Bạn chọn phần nào dùng; không có gì được lưu
              hay hiển thị cho học sinh tự động.
            </p>
            {context && (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
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
                      onChange={(event) => setLearnerLevel(event.target.value as LearnerLevel | '')}
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
                {context.references.approved > 0 ? (
                  <div className="rounded-md border border-emerald-200 bg-white px-3 py-2">
                    <label className="flex items-start gap-2 text-sm text-slate-800">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-violet-600"
                        checked={useReferences}
                        onChange={(event) => setUseReferences(event.target.checked)}
                      />
                      <span>
                        <BookMarked
                          className="mr-1 inline size-3.5 text-emerald-700"
                          aria-hidden="true"
                        />
                        Dựa trên {context.references.items.length} trích đoạn sách đã duyệt
                        {context.references.approved > context.references.items.length &&
                          ` (trong ${context.references.approved}, giới hạn để bản nháp tập trung)`}
                      </span>
                    </label>
                    <ReferenceList items={context.references.items} />
                  </div>
                ) : (
                  <p className="flex gap-1.5 text-xs leading-5 text-slate-500">
                    <BookMarked className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {context.references.error ??
                        'Bài này chưa có trích đoạn sách đã duyệt. Có thể thêm ở tab “Tư liệu”.'}
                    </span>
                  </p>
                )}
                {context.missing.length > 0 && (
                  <p className="flex gap-1.5 text-xs leading-5 text-slate-500">
                    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      Cây kiến thức chưa có {context.missing.join(', ')}. AI sẽ dùng mặc định ở trên
                      và tự nêu kiến thức nền nó giả định để bạn kiểm tra.
                    </span>
                  </p>
                )}
              </div>
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
            <div className="flex justify-end">
              <Button
                size="sm"
                className="bg-violet-600 text-white hover:bg-violet-700"
                onClick={() => void generate()}
              >
                <Sparkles /> {phase.kind === 'error' ? 'Thử lại' : 'Tạo bản nháp'}
              </Button>
            </div>
          </div>
        )}

        {phase.kind === 'loading' && (
          <div className="flex items-center gap-3" role="status">
            <Loader2 className="size-4 animate-spin text-violet-600" aria-hidden="true" />
            <span className="flex-1 text-slate-600">AI đang soạn nháp…</span>
            <Button size="sm" variant="ghost" onClick={cancel}>
              Hủy
            </Button>
          </div>
        )}

        {phase.kind === 'review' && (
          <div className="space-y-3">
            <p className="flex gap-2 text-xs leading-5 text-amber-800">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              AI có thể sai. Đọc và sửa lại trước khi lưu; hiển thị cho học sinh vẫn là bước riêng.
            </p>
            <p className="text-xs text-slate-500">
              Soạn cho: {STAGE_LABELS[phase.context.stage]} ·{' '}
              {LEARNER_LEVEL_LABELS[phase.context.learnerLevel]}
              {phase.context.references.used
                ? ` · dựa trên ${phase.context.references.items.length} trích đoạn sách đã duyệt`
                : ' · không dùng tư liệu sách'}
            </p>
            {phase.context.references.used && (
              <details className="rounded-lg border border-emerald-200 px-3 py-2 text-xs">
                <summary className="cursor-pointer font-semibold text-slate-700">
                  Nguồn tư liệu đã dùng (để đối chiếu)
                </summary>
                <ReferenceList items={phase.context.references.items} />
              </details>
            )}
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
                  AI giả định gì về học sinh
                </summary>
                {(
                  [
                    ['Kiến thức nền bài nhắc lại', phase.plan.prerequisites],
                    ['Ký hiệu, thuật ngữ mới đã giải thích', phase.plan.newNotation],
                    ['Gợi ý cho giáo viên', phase.plan.teacherNotes],
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
                      {current[type] && (
                        <span className="text-xs text-amber-700">
                          {phase.selected[type] ? 'Sẽ thay phần đang có' : 'Đã có nội dung'}
                        </span>
                      )}
                    </div>
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
                disabled={selectedCount === 0}
                onClick={apply}
              >
                Áp dụng {selectedCount} phần vào bài
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
