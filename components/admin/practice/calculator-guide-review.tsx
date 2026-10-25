'use client';

import * as React from 'react';
import { Calculator, Eye, Loader2, Pencil, TriangleAlert } from 'lucide-react';
import { QuestionMath } from '@/components/shared/question-content-renderer';
import { LEVEL_LABEL } from '@/components/learning/calculator-tutor/solution-guide';
import { solutionGuideFor } from '@/lib/calculator-tutor/registry';
import type { CalculatorGuideReview as Review } from '@/lib/calculator-tutor/types';
import type { Question } from '@/lib/question-bank/qb-types';
import { StudentPreview } from './student-preview';

const DECISION_LABEL: Record<Review['status'], string> = {
  ACCEPTED: 'Đã chấp nhận',
  DISABLED: 'Đã tắt',
  ORIGINAL_ONLY: 'Giữ lời giải gốc',
};

/**
 * The calculator guide generated for a question, in the question's review card:
 * what was detected, the level, the steps and warnings, a student preview, and
 * one decision (accept, correct, disable, keep the original). The decision is
 * saved on the question with the content hash it was made on.
 */
export function CalculatorGuideReviewPanel({
  question,
  onChanged,
}: {
  question: Question;
  onChanged: (message: string) => void;
}) {
  const guide = React.useMemo(() => solutionGuideFor(question, 'admin'), [question]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [preview, setPreview] = React.useState(false);
  const steps = guide?.calculator?.steps ?? guide?.steps ?? [];
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  if (!guide?.admin) return null;
  const { admin } = guide;
  const reference = guide.origin === 'reference';
  const needsReview = admin.warnings.filter((warning) => warning.severity === 'review');
  const info = admin.warnings.filter((warning) => warning.severity === 'info');

  async function decide(review: Omit<Review, 'at' | 'sourceHash' | 'by'> | null, message: string) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/question-bank/${question.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        calculatorGuideReview: review && { ...review, sourceHash: admin.sourceHash },
      }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      const data = (await response?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(data?.error ?? 'Không lưu được quyết định.');
      return;
    }
    setEditing(false);
    onChanged(message);
  }

  const button =
    'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors disabled:opacity-50';

  return (
    <section
      className="mt-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs text-slate-700"
      data-testid="calculator-guide-review"
      data-level={guide.level}
      data-visible={admin.visibleToStudents}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Calculator className="size-4 text-blue-700" />
        <p className="font-bold text-slate-900">Hướng dẫn bấm máy</p>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${LEVEL_LABEL[guide.level].className}`}
        >
          Mức {guide.level} · {LEVEL_LABEL[guide.level].short}
        </span>
        {reference && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
            Bài mẫu đã kiểm chứng
          </span>
        )}
        {admin.review && (
          <span
            className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700"
            data-testid="guide-decision"
          >
            {DECISION_LABEL[admin.review.status]}
            {admin.review.corrections ? ' (có sửa)' : ''}
          </span>
        )}
      </div>
      <p className="mt-1">
        Nhận diện: <strong>{guide.operation.label}</strong>
        {admin.detection.model.name ? ` · ${admin.detection.model.name}` : ' · không ghi đời máy'}
        {' · '}
        {steps.length} bước
        {guide.calculator
          ? `, ${guide.calculator.steps.reduce((sum, step) => sum + step.keys.length, 0)} phím`
          : ''}
        {' · '}độ tin cậy{' '}
        {admin.detection.confidence === 'high'
          ? 'cao'
          : admin.detection.confidence === 'medium'
            ? 'vừa'
            : 'thấp'}
      </p>
      <p
        className={`mt-1 font-semibold ${admin.visibleToStudents ? 'text-emerald-800' : 'text-amber-900'}`}
        data-testid="guide-review-visibility"
      >
        {admin.visibleToStudents
          ? 'Học sinh sẽ thấy "Thực hành bằng máy tính" sau khi trả lời.'
          : admin.review?.status === 'DISABLED' || admin.review?.status === 'ORIGINAL_ONLY'
            ? 'Học sinh chỉ thấy lời giải gốc.'
            : 'Chưa hiện cho học sinh: cần chấp nhận sau khi xem các cảnh báo dưới đây.'}
      </p>
      {needsReview.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-amber-950" data-testid="guide-review-warnings">
          {needsReview.map((warning) => (
            <li key={warning.code} className="flex gap-1.5">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <QuestionMath text={warning.text} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {info.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer font-semibold text-slate-600">
            {info.length} ghi chú khác
          </summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {info.map((warning) => (
              <li key={warning.code + warning.text}>
                <QuestionMath text={warning.text} />
              </li>
            ))}
          </ul>
        </details>
      )}

      {editing && (
        <div
          className="mt-2 space-y-2 rounded-lg bg-white p-2 ring-1 ring-blue-200"
          data-testid="guide-corrections"
        >
          <p className="text-[11px] text-slate-500">
            Chỉ sửa được lời dặn của từng bước. Phím và giá trị do Tú Tài kiểm tra trên bản mô
            phỏng, không sửa tay.
          </p>
          {steps.map((step, index) => (
            <label key={step.id} className="block">
              <span className="font-semibold">
                {index + 1}. {step.title}
              </span>
              <textarea
                className="mt-0.5 block w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                rows={2}
                value={drafts[step.id] ?? step.instruction}
                onChange={(event) =>
                  setDrafts((previous) => ({ ...previous, [step.id]: event.target.value }))
                }
                data-testid={`guide-correction-${step.id}`}
              />
            </label>
          ))}
        </div>
      )}
      {error && (
        <p className="mt-1 font-medium text-rose-700" role="alert">
          {error}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setPreview(true)}
          className={`${button} border border-blue-200 bg-white text-blue-800 hover:bg-blue-50`}
          data-testid="guide-preview"
        >
          <Eye className="size-3.5" /> Xem trước như học sinh
        </button>
        {!reference &&
          (editing ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const corrections = Object.fromEntries(
                  Object.entries(drafts).filter(
                    ([id, text]) =>
                      text.trim() && text !== steps.find((step) => step.id === id)?.instruction
                  )
                );
                void decide(
                  { status: 'ACCEPTED', corrections },
                  'Đã lưu hướng dẫn đã sửa và cho học sinh xem.'
                );
              }}
              className={`${button} bg-blue-700 text-white`}
              data-testid="guide-save-corrections"
            >
              Lưu và chấp nhận
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busy || admin.review?.status === 'ACCEPTED'}
                onClick={() =>
                  void decide({ status: 'ACCEPTED' }, 'Đã chấp nhận hướng dẫn bấm máy.')
                }
                className={`${button} bg-emerald-600 text-white hover:bg-emerald-700`}
                data-testid="guide-accept"
              >
                Chấp nhận
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setDrafts(admin.review?.corrections ?? {});
                  setEditing(true);
                }}
                className={`${button} border border-slate-300 bg-white text-slate-700`}
                data-testid="guide-edit"
              >
                <Pencil className="size-3.5" /> Sửa lời dặn
              </button>
            </>
          ))}
        {editing && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className={`${button} text-slate-600`}
          >
            Huỷ
          </button>
        )}
        <button
          type="button"
          disabled={busy || admin.review?.status === 'DISABLED'}
          onClick={() => void decide({ status: 'DISABLED' }, 'Đã tắt hướng dẫn bấm máy.')}
          className={`${button} text-rose-700 hover:bg-rose-50`}
          data-testid="guide-disable"
        >
          Tắt hướng dẫn
        </button>
        <button
          type="button"
          disabled={busy || admin.review?.status === 'ORIGINAL_ONLY'}
          onClick={() =>
            void decide({ status: 'ORIGINAL_ONLY' }, 'Học sinh sẽ chỉ thấy lời giải gốc.')
          }
          className={`${button} text-slate-700 hover:bg-slate-100`}
          data-testid="guide-original"
        >
          Giữ lời giải gốc
        </button>
        {admin.review && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void decide(null, 'Đã bỏ quyết định, hướng dẫn trở lại chờ duyệt.')}
            className={`${button} text-slate-500 hover:bg-slate-100`}
            data-testid="guide-clear"
          >
            Bỏ quyết định
          </button>
        )}
        {busy && <Loader2 className="size-4 animate-spin self-center text-slate-400" />}
      </div>
      {preview && <StudentPreview questions={[question]} onClose={() => setPreview(false)} />}
    </section>
  );
}
