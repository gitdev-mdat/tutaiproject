'use client';

import * as React from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CURATOR_NOTE_MAX_LENGTH,
  EXAM_ACCESS_LABELS,
  EXAM_ACCESS_TIERS,
  type ExamAccessTier,
  type ExamRecord,
} from '@/lib/exams/exam-types';

/**
 * Who can take the exam (everyone, or Tú Tài Plus) and the curator's one-line
 * note. Not part of the frozen content, so it can change after publishing.
 * Keyed by the exam, so it starts from the saved values once the exam loads.
 */
export function ExamAccessPanel({
  record,
  onSaved,
}: {
  record: ExamRecord | null;
  onSaved: (record: ExamRecord) => void;
}) {
  const [tier, setTier] = React.useState<ExamAccessTier>(record?.accessTier ?? 'FREE');
  const [note, setNote] = React.useState(record?.curatorNote ?? '');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  const dirty =
    !!record &&
    (tier !== (record.accessTier ?? 'FREE') ||
      (tier === 'PLUS' && note.trim() !== (record.curatorNote ?? '')));

  async function save() {
    if (!record) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/exams/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SET_ACCESS',
          accessTier: tier,
          curatorNote: tier === 'PLUS' ? note : '',
        }),
      });
      const result = (await response.json()) as ExamRecord & { message?: string };
      if (!response.ok) throw new Error(result.message ?? 'Không lưu được quyền truy cập.');
      onSaved(result);
      setMessage({ ok: true, text: 'Đã lưu. Học sinh thấy thay đổi ngay ở trang Luyện thi.' });
    } catch (reason: unknown) {
      setMessage({
        ok: false,
        text: reason instanceof Error ? reason.message : 'Không lưu được quyền truy cập.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-4"
      data-testid="exam-access-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Quyền truy cập</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Đề Plus chỉ học sinh có Tú Tài Plus mới làm được. Có thể đổi cả sau khi xuất bản; bài đã
            làm vẫn được giữ.
          </p>
        </div>
        {record && (
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={busy || !dirty}
            data-testid="exam-access-save"
          >
            {busy && <LoaderCircle className="animate-spin" />} Lưu quyền truy cập
          </Button>
        )}
      </div>
      {!record ? (
        <p className="mt-3 text-xs text-slate-500">Lưu nháp trước, rồi chọn Miễn phí hoặc Plus.</p>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
          <div
            className="inline-flex rounded-lg border border-slate-200 p-0.5"
            role="radiogroup"
            aria-label="Quyền truy cập"
          >
            {EXAM_ACCESS_TIERS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={tier === value}
                onClick={() => setTier(value)}
                className={`h-8 rounded-md px-3 text-xs font-semibold ${
                  tier === value
                    ? value === 'PLUS'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                data-testid={`exam-access-${value.toLowerCase()}`}
              >
                {EXAM_ACCESS_LABELS[value]}
              </button>
            ))}
          </div>
          {tier === 'PLUS' && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                Ghi chú tuyển chọn (hiện cho học sinh, tối đa {CURATOR_NOTE_MAX_LENGTH} ký tự)
              </span>
              <Input
                value={note}
                maxLength={CURATOR_NOTE_MAX_LENGTH}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ví dụ: Tập trung câu vận dụng cao chương Đạo hàm"
                data-testid="exam-curator-note"
              />
            </label>
          )}
        </div>
      )}
      {message && (
        <p
          className={`mt-2 text-xs font-medium ${message.ok ? 'text-emerald-700' : 'text-red-700'}`}
          role="status"
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
