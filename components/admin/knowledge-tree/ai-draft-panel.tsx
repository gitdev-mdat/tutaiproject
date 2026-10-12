'use client';

import * as React from 'react';
import { AlertTriangle, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ApiKnowledgeRepository } from '@/lib/knowledge-tree/api-knowledge-repository';
import {
  AI_DRAFT_BLOCK_TYPES,
  AI_DRAFT_LIMITS,
  type AiDraftBlockType,
  type AiLessonDraft,
} from '@/lib/knowledge-tree/ai-lesson-draft';
import { ARTICLE_BODY_BLOCKS } from '@/lib/knowledge-tree/knowledge-article';
import type { KnowledgeArticleBlock } from '@/lib/knowledge-tree/knowledge-tree-types';

type Phase =
  | { kind: 'checking' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'compose' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'review'; draft: AiLessonDraft; selected: Record<AiDraftBlockType, boolean> };

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
      { existing, note: note.trim() || undefined },
      abort.signal
    );
    if (abort.signal.aborted) return;
    controller.current = null;
    if (!result.ok) {
      setPhase({ kind: 'error', message: result.error.message });
      return;
    }
    const selected = {} as Record<AiDraftBlockType, boolean>;
    for (const type of AI_DRAFT_BLOCK_TYPES) {
      // Never pre-select a part that would replace what the admin already wrote.
      selected[type] = !!result.data[type] && !current[type];
    }
    setPhase({ kind: 'review', draft: result.data, selected });
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
              AI dựa vào môn, lớp, chương và tên kiến thức để đề xuất từng phần. Bạn chọn phần nào
              dùng; không có gì được lưu hay hiển thị cho học sinh tự động.
            </p>
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
