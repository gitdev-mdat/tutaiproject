'use client';

import * as React from 'react';
import { Plus, Sparkles, Trash2, X } from 'lucide-react';
import { QuestionMath } from '@/components/shared/question-content-renderer';
import type { Question } from '@/lib/question-bank/qb-types';
import { DIFFICULTY_LABEL, QUESTION_TYPE_LABEL } from './practice-labels';

/**
 * Create or edit one practice question. Saves through the question bank API
 * (POST /api/question-bank, PATCH /api/question-bank/[id]), so the question
 * bank stays the single place questions live.
 */

const TYPES = [
  'MULTIPLE_CHOICE_SINGLE',
  'MULTIPLE_CHOICE_MULTIPLE',
  'TRUE_FALSE',
  'NUMERIC',
] as const;
type EditorType = (typeof TYPES)[number];
const KEYS = ['A', 'B', 'C', 'D'];
const COGNITIVE: Record<string, string> = {
  RECOGNITION: 'Nhận biết',
  COMPREHENSION: 'Thông hiểu',
  APPLICATION: 'Vận dụng',
  HIGHER_APPLICATION: 'Vận dụng cao',
};

export type EditorDraft = {
  questionType: EditorType;
  stem: string;
  options: string[];
  choices: string[];
  statements: { id: string; content: string; isTrue: boolean | null }[];
  numeric: string;
  explanation: string;
  solutionGuidance: string;
  difficulty: string;
  cognitiveLevel: string;
  aiAssisted: boolean;
};

let statementCounter = 0;
const statementId = () => `s-${Date.now().toString(36)}-${(statementCounter += 1)}`;

export function emptyDraft(): EditorDraft {
  return {
    questionType: 'MULTIPLE_CHOICE_SINGLE',
    stem: '',
    options: ['', '', '', ''],
    choices: [],
    statements: [0, 1, 2, 3].map(() => ({ id: statementId(), content: '', isTrue: null })),
    numeric: '',
    explanation: '',
    solutionGuidance: '',
    difficulty: 'FOUNDATIONAL',
    cognitiveLevel: 'COMPREHENSION',
    aiAssisted: false,
  };
}

export function draftFromQuestion(question: Question): EditorDraft {
  const base = emptyDraft();
  const type = (TYPES as readonly string[]).includes(question.questionType)
    ? (question.questionType as EditorType)
    : 'MULTIPLE_CHOICE_SINGLE';
  return {
    ...base,
    questionType: type,
    stem: question.stem,
    options: KEYS.map((key) => question.options.find((o) => o.key === key)?.content ?? ''),
    choices: question.correctAnswer
      .split(',')
      .map((k) => k.trim().toUpperCase())
      .filter((k) => KEYS.includes(k)),
    statements: question.trueFalseStatements?.length
      ? question.trueFalseStatements.map((s) => ({ ...s }))
      : base.statements,
    numeric: type === 'NUMERIC' ? question.correctAnswer : '',
    explanation: question.explanation ?? '',
    solutionGuidance: question.solutionGuidance ?? '',
    difficulty: question.difficulty,
    cognitiveLevel: question.cognitiveLevel ?? 'COMPREHENSION',
    aiAssisted: false,
  };
}

function payloadFrom(draft: EditorDraft) {
  const isChoice =
    draft.questionType === 'MULTIPLE_CHOICE_SINGLE' ||
    draft.questionType === 'MULTIPLE_CHOICE_MULTIPLE';
  return {
    questionType: draft.questionType,
    stem: draft.stem.trim(),
    options: isChoice ? KEYS.map((key, i) => ({ key, content: draft.options[i].trim() })) : [],
    ...(draft.questionType === 'TRUE_FALSE'
      ? {
          trueFalseStatements: draft.statements.map((s) => ({
            id: s.id,
            content: s.content.trim(),
            isTrue: s.isTrue,
          })),
        }
      : {}),
    correctAnswer:
      draft.questionType === 'NUMERIC'
        ? draft.numeric.trim()
        : draft.questionType === 'TRUE_FALSE'
          ? draft.statements.map((s) => (s.isTrue ? 'TRUE' : 'FALSE')).join(',')
          : [...draft.choices].sort().join(','),
    explanation: draft.explanation.trim(),
    solutionGuidance: draft.solutionGuidance.trim(),
    difficulty: draft.difficulty,
    cognitiveLevel: draft.cognitiveLevel,
  };
}

/** Problems the admin can fix before saving; the server checks again. */
export function draftProblems(draft: EditorDraft): string[] {
  const problems: string[] = [];
  if (!draft.stem.trim()) problems.push('Nhập nội dung câu hỏi.');
  if (draft.questionType.startsWith('MULTIPLE_CHOICE')) {
    if (draft.options.some((o) => !o.trim())) problems.push('Điền đủ 4 lựa chọn A–D.');
    if (draft.choices.length === 0) problems.push('Chọn đáp án đúng.');
    if (draft.questionType === 'MULTIPLE_CHOICE_SINGLE' && draft.choices.length > 1) {
      problems.push('Câu một đáp án chỉ được chọn một đáp án đúng.');
    }
  }
  if (draft.questionType === 'TRUE_FALSE') {
    if (draft.statements.length < 2) problems.push('Cần ít nhất 2 mệnh đề.');
    if (draft.statements.some((s) => !s.content.trim()))
      problems.push('Điền nội dung mọi mệnh đề.');
    if (draft.statements.some((s) => s.isTrue === null)) {
      problems.push('Chọn Đúng hoặc Sai cho mọi mệnh đề.');
    }
  }
  if (draft.questionType === 'NUMERIC' && !/^[+-]?\d+([.,]\d+)?$/.test(draft.numeric.trim())) {
    problems.push('Đáp án phải là một số, ví dụ 2 hoặc -1,5.');
  }
  if (!draft.explanation.trim()) problems.push('Viết lời giải để học sinh hiểu vì sao.');
  return problems;
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

function Preview({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed whitespace-pre-line text-slate-800">
      <QuestionMath text={text} />
    </div>
  );
}

export function QuestionEditor({
  lessonId,
  question,
  initial,
  onCancel,
  onSaved,
}: {
  lessonId: string;
  question: Question | null;
  initial: EditorDraft;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [draft, setDraft] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [tried, setTried] = React.useState(false);
  const problems = draftProblems(draft);
  const set = (patch: Partial<EditorDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const isChoice = draft.questionType.startsWith('MULTIPLE_CHOICE');

  async function save() {
    setTried(true);
    if (problems.length) return;
    setSaving(true);
    setErrors([]);
    const payload = payloadFrom(draft);
    const response = question
      ? await fetch(`/api/question-bank/${question.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/question-bank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            primaryKnowledgeNodeId: lessonId,
            knowledgeCoverage: 'FOCUS',
            aiAssisted: draft.aiAssisted,
          }),
        }).catch(() => null);
    setSaving(false);
    if (!response) return setErrors(['Không kết nối được máy chủ. Thử lại.']);
    if (response.ok) return onSaved(question ? 'Đã lưu thay đổi.' : 'Đã lưu câu hỏi ở dạng nháp.');
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      details?: { message: string }[];
    };
    if (response.status === 409) return setErrors(['Câu hỏi này đã có trong ngân hàng.']);
    setErrors(body.details?.map((d) => d.message) ?? [body.error ?? 'Không lưu được câu hỏi.']);
  }

  return (
    <section
      className="rounded-2xl border border-primary/30 bg-white p-4 shadow-sm ring-4 ring-primary/5 sm:p-5"
      data-testid="question-editor"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            {question ? 'Sửa câu hỏi' : 'Câu hỏi mới'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {question
              ? question.editorialStatus === 'PUBLISHED'
                ? 'Câu đang hiển thị: học sinh sẽ thấy thay đổi ngay khi lưu.'
                : 'Thay đổi được lưu vào ngân hàng câu hỏi.'
              : 'Câu mới được lưu ở dạng nháp. Học sinh chỉ thấy sau khi duyệt và xuất bản.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          aria-label="Đóng"
        >
          <X className="size-4" />
        </button>
      </div>

      {draft.aiAssisted && (
        <div className="mt-4 flex gap-2 rounded-xl bg-violet-50 px-3 py-2.5 text-xs text-violet-800 ring-1 ring-violet-200">
          <Sparkles className="mt-0.5 size-3.5 shrink-0" />
          <p>
            Câu này do AI gợi ý. Đáp án và lời giải <strong>chưa được kiểm chứng</strong>: hãy tự
            giải lại trước khi gửi duyệt.
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Dạng câu hỏi">
          <select
            className={inputClass}
            value={draft.questionType}
            onChange={(e) => set({ questionType: e.target.value as EditorType, choices: [] })}
            data-testid="editor-type"
          >
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {QUESTION_TYPE_LABEL[type]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Độ khó">
          <select
            className={inputClass}
            value={draft.difficulty}
            onChange={(e) => set({ difficulty: e.target.value })}
          >
            {Object.entries(DIFFICULTY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mức độ tư duy">
          <select
            className={inputClass}
            value={draft.cognitiveLevel}
            onChange={(e) => set({ cognitiveLevel: e.target.value })}
          >
            {Object.entries(COGNITIVE).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-4 space-y-2">
        <Field label="Nội dung câu hỏi" hint="Viết công thức trong $...$, ví dụ $y = x^2 - 3x$.">
          <textarea
            className={`${inputClass} min-h-[88px]`}
            value={draft.stem}
            onChange={(e) => set({ stem: e.target.value })}
            placeholder="Hàm số nào sau đây đồng biến trên ℝ?"
            data-testid="editor-stem"
          />
        </Field>
        <Preview text={draft.stem} />
      </div>

      {isChoice && (
        <fieldset className="mt-4 space-y-2">
          <legend className="text-xs font-semibold text-slate-700">
            Các lựa chọn · đánh dấu{' '}
            {draft.questionType === 'MULTIPLE_CHOICE_SINGLE' ? 'đáp án đúng' : 'mọi đáp án đúng'}
          </legend>
          {KEYS.map((key, index) => {
            const checked = draft.choices.includes(key);
            return (
              <div key={key} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    set({
                      choices:
                        draft.questionType === 'MULTIPLE_CHOICE_SINGLE'
                          ? [key]
                          : checked
                            ? draft.choices.filter((c) => c !== key)
                            : [...draft.choices, key],
                    })
                  }
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ring-1 transition-colors ${
                    checked
                      ? 'bg-emerald-600 text-white ring-emerald-600'
                      : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                  }`}
                  aria-pressed={checked}
                  aria-label={`Đáp án ${key} đúng`}
                  data-testid={`editor-correct-${key}`}
                >
                  {key}
                </button>
                <input
                  className={inputClass}
                  value={draft.options[index]}
                  onChange={(e) =>
                    set({
                      options: draft.options.map((o, i) => (i === index ? e.target.value : o)),
                    })
                  }
                  placeholder={`Lựa chọn ${key}`}
                  data-testid={`editor-option-${key}`}
                />
              </div>
            );
          })}
        </fieldset>
      )}

      {draft.questionType === 'TRUE_FALSE' && (
        <fieldset className="mt-4 space-y-2">
          <legend className="text-xs font-semibold text-slate-700">Mệnh đề và đáp án</legend>
          {draft.statements.map((statement, index) => (
            <div key={statement.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                className={inputClass}
                value={statement.content}
                onChange={(e) =>
                  set({
                    statements: draft.statements.map((s) =>
                      s.id === statement.id ? { ...s, content: e.target.value } : s
                    ),
                  })
                }
                placeholder={`Mệnh đề ${String.fromCharCode(97 + index)})`}
                data-testid={`editor-statement-${index}`}
              />
              <div className="flex shrink-0 gap-1.5">
                {[true, false].map((value) => (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() =>
                      set({
                        statements: draft.statements.map((s) =>
                          s.id === statement.id ? { ...s, isTrue: value } : s
                        ),
                      })
                    }
                    className={`h-9 rounded-lg px-3 text-xs font-semibold ring-1 ${
                      statement.isTrue === value
                        ? value
                          ? 'bg-emerald-600 text-white ring-emerald-600'
                          : 'bg-rose-600 text-white ring-rose-600'
                        : 'bg-white text-slate-600 ring-slate-200'
                    }`}
                    data-testid={`editor-statement-${index}-${value ? 'true' : 'false'}`}
                  >
                    {value ? 'Đúng' : 'Sai'}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={draft.statements.length <= 2}
                  onClick={() =>
                    set({ statements: draft.statements.filter((s) => s.id !== statement.id) })
                  }
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                  aria-label="Xoá mệnh đề"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
          {draft.statements.length < 6 && (
            <button
              type="button"
              onClick={() =>
                set({
                  statements: [
                    ...draft.statements,
                    { id: statementId(), content: '', isTrue: null },
                  ],
                })
              }
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
            >
              <Plus className="size-3.5" /> Thêm mệnh đề
            </button>
          )}
        </fieldset>
      )}

      {draft.questionType === 'NUMERIC' && (
        <div className="mt-4 max-w-xs">
          <Field label="Đáp án (số)" hint="Học sinh nhập dấu phẩy hay dấu chấm đều được.">
            <input
              className={inputClass}
              inputMode="decimal"
              value={draft.numeric}
              onChange={(e) => set({ numeric: e.target.value })}
              placeholder="2,5"
              data-testid="editor-numeric"
            />
          </Field>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <Field
          label="Lời giải"
          hint="Học sinh thấy lời giải ngay sau khi trả lời, kể cả khi làm đúng."
        >
          <textarea
            className={`${inputClass} min-h-[96px]`}
            value={draft.explanation}
            onChange={(e) => set({ explanation: e.target.value })}
            placeholder="Ta có $y' = ...$ nên ..."
            data-testid="editor-explanation"
          />
        </Field>
        <Preview text={draft.explanation} />
      </div>

      {(tried && problems.length > 0) || errors.length > 0 ? (
        <ul
          className="mt-4 space-y-1 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-700 ring-1 ring-rose-200"
          role="alert"
        >
          {[...(tried ? problems : []), ...errors].map((message) => (
            <li key={message}>• {message}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Huỷ
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          data-testid="editor-save"
        >
          {saving ? 'Đang lưu…' : question ? 'Lưu thay đổi' : 'Lưu nháp'}
        </button>
      </div>
    </section>
  );
}
