'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ImagePlus, Pencil, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { QuestionCandidate } from '@/lib/content-import/types';
import { KnowledgeNodePicker } from '@/components/admin/question-bank/knowledge-node-picker';
import { recomputeMediaReadiness, candidateContent } from '@/lib/content-import/media-readiness';
import {
  formatMathSnippet,
  QuestionContentRenderer,
} from '@/components/shared/question-content-renderer';

export { formatMathSnippet };

export const WARNING_ACTION_LABELS = {
  EDIT: 'Sửa nội dung',
  MERGE_NEXT_PAGE: 'Ghép trang tiếp theo',
  RESELECT_REGION: 'Chọn lại hình',
  NO_ANSWER: 'Xác nhận không có đáp án',
  CHECK_DUPLICATE: 'Kiểm tra câu trùng',
  SKIP: 'Bỏ qua câu',
} as const;

type Props = {
  candidate: QuestionCandidate;
  sessionId?: string;
  onChange: (candidate: QuestionCandidate) => void;
  onSave?: (candidate: QuestionCandidate) => Promise<boolean>;
  onEditingChange?: (editing: boolean, dirty: boolean) => void;
  onWarningAction: (
    id: string,
    action: QuestionCandidate['warnings'][number]['actions'][number]
  ) => void;
  onReplaceImage?: (assetId: string) => void;
  onChooseFromSource?: () => void;
};

export function QuestionCandidateEditor({
  candidate,
  sessionId,
  onChange,
  onSave,
  onEditingChange,
  onWarningAction,
  onChooseFromSource,
}: Props) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(candidate);
  const [saving, setSaving] = React.useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(candidate);
  React.useEffect(() => onEditingChange?.(editing, dirty), [editing, dirty, onEditingChange]);

  const patch = (value: Partial<QuestionCandidate>) =>
    setDraft(
      recomputeMediaReadiness({
        ...draft,
        ...value,
        status:
          draft.status === 'APPROVED' || draft.status === 'UNREVIEWED' ? 'EDITED' : draft.status,
        updatedAt: new Date().toISOString(),
      })
    );
  const blocks = candidateContent(editing ? draft : candidate);
  const resolveAssetUrl = (assetId: string) => {
    const active = editing ? draft : candidate;
    const pageId = active.sourcePageIds.includes(assetId) ? assetId : active.sourcePageIds[0];
    return sessionId && pageId
      ? `/api/content-import/sessions/${encodeURIComponent(sessionId)}/pages/${encodeURIComponent(pageId)}/source`
      : `/api/question-bank/assets/${encodeURIComponent(active.questionId ?? '')}/${encodeURIComponent(assetId)}`;
  };
  const chooseFromSource = () => {
    const attached = new Set(
      candidateContent(draft)
        .filter((b) => b.type === 'IMAGE')
        .map((b) => (b.type === 'IMAGE' ? b.media.assetId : ''))
    );
    const media = draft.mediaCandidates?.find((m) => !attached.has(m.id));
    if (!media) return onChooseFromSource?.();
    const image = {
      id: `image-${media.id}`,
      type: 'IMAGE' as const,
      media: {
        assetId: media.id,
        alt: media.alt || 'Hình minh họa câu hỏi',
        sourcePage: media.sourcePage,
        sourceRegion: media.sourceRegion,
      },
    };
    const current = candidateContent(draft);
    const text = current.findIndex((b) => b.type === 'TEXT');
    patch({
      orderedContent: [
        ...current.slice(0, text < 0 ? current.length : text + 1),
        image,
        ...current.slice(text < 0 ? current.length : text + 1),
      ],
    });
  };
  async function save() {
    setSaving(true);
    const ok = onSave ? await onSave(draft) : true;
    setSaving(false);
    if (ok) {
      onChange(draft);
      setEditing(false);
    }
  }
  function cancel() {
    if (dirty && !window.confirm('Hủy các thay đổi chưa lưu?')) return;
    setDraft(candidate);
    setEditing(false);
  }
  const active = editing ? draft : candidate;

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-5 shadow-xs ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Câu {candidate.number}
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Xem trước câu hỏi</h2>
          </div>
          {!editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> Sửa câu hỏi
            </Button>
          )}
          {editing && (
            <span
              className={`text-xs font-semibold ${dirty ? 'text-amber-700' : 'text-slate-500'}`}
            >
              {dirty ? 'Có thay đổi chưa lưu' : 'Chế độ chỉnh sửa'}
            </span>
          )}
        </div>

        {candidate.warnings[0] && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <span className="font-medium">{candidate.warnings[0].message}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {candidate.warnings[0].actions.map((action) => (
                <Button
                  key={action}
                  size="xs"
                  variant="outline"
                  className="bg-white"
                  onClick={() =>
                    action === 'EDIT'
                      ? setEditing(true)
                      : onWarningAction(candidate.warnings[0].id, action)
                  }
                >
                  {WARNING_ACTION_LABELS[action]}
                </Button>
              ))}
            </div>
          </div>
        )}

        {editing ? (
          <div className="space-y-4">
            <label className="block text-xs font-semibold text-slate-700">
              Nội dung câu hỏi
              <Textarea
                className="mt-1 min-h-28 text-sm"
                value={draft.content}
                onChange={(e) => {
                  const content = e.target.value;
                  patch({
                    content,
                    orderedContent: candidateContent(draft).map((b) =>
                      b.type === 'TEXT' ? { ...b, text: content } : b
                    ),
                  });
                }}
              />
            </label>
            {draft.options.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {draft.options.map((option, index) => (
                  <label
                    key={`${option.key}-${index}`}
                    className="text-xs font-semibold text-slate-600"
                  >
                    Phương án {option.key}
                    <Input
                      className="mt-1"
                      value={option.content}
                      onChange={(e) =>
                        patch({
                          options: draft.options.map((o, i) =>
                            i === index ? { ...o, content: e.target.value } : o
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            )}
            {draft.statements.length > 0 && (
              <div className="space-y-2">
                {draft.statements.map((statement, index) => (
                  <div
                    key={`${statement.key}-${index}`}
                    className="grid grid-cols-[1fr_110px] gap-2"
                  >
                    <Input
                      value={statement.content}
                      onChange={(e) =>
                        patch({
                          statements: draft.statements.map((s, i) =>
                            i === index ? { ...s, content: e.target.value } : s
                          ),
                        })
                      }
                    />
                    <select
                      className="rounded-md border border-slate-200 px-2 text-sm"
                      value={statement.correct === undefined ? '' : String(statement.correct)}
                      onChange={(e) =>
                        patch({
                          statements: draft.statements.map((s, i) =>
                            i === index
                              ? {
                                  ...s,
                                  correct:
                                    e.target.value === '' ? undefined : e.target.value === 'true',
                                }
                              : s
                          ),
                        })
                      }
                    >
                      <option value="">Chưa rõ</option>
                      <option value="true">Đúng</option>
                      <option value="false">Sai</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
            <label className="block text-xs font-semibold text-slate-700">
              Đáp án đúng
              <Input
                className="mt-1"
                value={draft.correctAnswer}
                onChange={(e) => patch({ correctAnswer: e.target.value })}
                placeholder="Ví dụ: C"
              />
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button variant="outline" onClick={cancel}>
                <X className="size-4" />
                Hủy
              </Button>
              <Button onClick={() => void save()} disabled={!dirty || saving}>
                <Save className="size-4" />
                {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-[15px] leading-7 text-slate-900">
              <QuestionContentRenderer blocks={blocks} resolveAssetUrl={resolveAssetUrl} />
            </div>
            {!blocks.some((b) => b.type === 'IMAGE') &&
              candidate.fieldConfidence.asset === 'REVIEW' && (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle className="size-4" />
                  <span className="mr-auto font-medium">Thiếu hình minh họa cần thiết.</span>
                  <Button
                    size="xs"
                    variant="outline"
                    className="bg-white"
                    onClick={() => {
                      setEditing(true);
                      chooseFromSource();
                    }}
                  >
                    <ImagePlus className="size-3" />
                    Chọn từ tài liệu
                  </Button>
                </div>
              )}
            {active.options.length > 0 && (
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {active.options.map((o) => (
                  <div key={o.key} className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                    <strong className="mr-2 text-blue-700">{o.key}.</strong>
                    {formatMathSnippet(o.content) || '—'}
                  </div>
                ))}
              </div>
            )}
            {active.statements.length > 0 && (
              <div className="mt-5 space-y-2">
                {active.statements.map((s) => (
                  <div key={s.key} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <strong>{s.key}.</strong> {formatMathSnippet(s.content)}{' '}
                    <span className="float-right font-semibold text-slate-600">
                      {s.correct === undefined ? 'Chưa rõ' : s.correct ? 'Đúng' : 'Sai'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div
              className="mt-6 border-t border-slate-200 pt-5"
              aria-label="Thông tin chỉ dành cho quản trị viên"
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Chỉ dành cho quản trị viên
              </p>
              <div
                className={`rounded-lg px-4 py-3 ${active.correctAnswer ? 'bg-emerald-50 text-emerald-900' : 'border border-red-200 bg-red-50 text-red-800'}`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4" />
                  <strong>Đáp án đúng:</strong>
                  <span>{active.correctAnswer || 'Chưa có đáp án'}</span>
                  {!active.correctAnswer && (
                    <Button
                      size="xs"
                      variant="outline"
                      className="ml-auto bg-white"
                      onClick={() => setEditing(true)}
                    >
                      Chọn đáp án
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <details className="rounded-lg border border-slate-200 bg-white p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-700">
          Chi tiết nâng cao <ChevronDown className="size-4" />
        </summary>
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <label className="block text-xs font-semibold text-slate-600">
            Kiến thức gắn kèm
            <KnowledgeNodePicker
              value={active.primaryKnowledgeNodeId ?? ''}
              placeholder="Chọn mục kiến thức…"
              onChange={(id) => (editing ? patch({ primaryKnowledgeNodeId: id }) : undefined)}
            />
          </label>
          <dl className="grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
            <div>
              <dt>Loại câu hỏi</dt>
              <dd className="font-medium text-slate-700">{active.questionType}</dd>
            </div>
            <div>
              <dt>Trang nguồn</dt>
              <dd className="font-medium text-slate-700">
                {(active.sourcePages ?? []).join(', ') || '—'}
              </dd>
            </div>
          </dl>
        </div>
      </details>
    </div>
  );
}

export const CONFIDENCE_LABELS = {
  HIGH: 'Tin cậy cao',
  REVIEW: 'Cần kiểm tra',
  UNCERTAIN: 'Không chắc chắn',
} as const;
