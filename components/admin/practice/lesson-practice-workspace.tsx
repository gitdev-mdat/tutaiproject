'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import { QuestionMath } from '@/components/shared/question-content-renderer';
import { LESSON_PUBLICATION_LABELS } from '@/lib/knowledge-tree/learning-visibility';
import type { CoverageQuestion, LessonCoverage } from '@/lib/practice/practice-admin';
import type { QuestionSuggestion } from '@/lib/practice/ai-question-suggest';
import { PRACTICE_SESSION_SIZE } from '@/lib/practice/practice-rules';
import { isAiAssisted, type Question } from '@/lib/question-bank/qb-types';
import {
  Chip,
  DIFFICULTY_LABEL,
  QUESTION_STATE,
  QUESTION_TYPE_LABEL,
  READINESS,
} from './practice-labels';
import { QuestionEditor, draftFromQuestion, emptyDraft, type EditorDraft } from './question-editor';

type EditorState = { question: Question | null; draft: EditorDraft; key: number } | null;

function answerSummary(question: Question) {
  if (question.questionType === 'TRUE_FALSE') {
    return (question.trueFalseStatements ?? [])
      .map((s, i) => `${String.fromCharCode(97 + i)}) ${s.isTrue ? 'Đúng' : 'Sai'}`)
      .join(' · ');
  }
  return question.correctAnswer;
}

async function patchQuestion(id: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/question-bank/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!response) return 'Không kết nối được máy chủ.';
  if (response.ok) return null;
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    details?: { message: string }[];
  };
  return data.details?.map((d) => d.message).join(' ') || data.error || 'Không cập nhật được.';
}

function QuestionCard({
  item,
  onEdit,
  onChanged,
}: {
  item: CoverageQuestion;
  onEdit: (question: Question) => void;
  onChanged: (message: string) => void;
}) {
  const { question, state, reason, stats } = item;
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [verified, setVerified] = React.useState(false);
  const ai = isAiAssisted(question);

  async function run(body: Record<string, unknown>, message: string) {
    setBusy(true);
    setError(null);
    const failure = await patchQuestion(question.id, body);
    setBusy(false);
    if (failure) setError(failure);
    else onChanged(message);
  }

  const withPractice = [...new Set([...question.usageContexts, 'OPEN_PRACTICE'])];
  const pinned = question.usageContexts.includes('LESSON_CHECK');
  const togglePinned = pinned
    ? question.usageContexts.filter((context) => context !== 'LESSON_CHECK')
    : [...question.usageContexts, 'LESSON_CHECK'];
  const button =
    'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors disabled:opacity-50';

  return (
    <article
      className="rounded-xl border border-slate-200 bg-white p-4"
      data-testid="practice-question"
      data-state={state}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tone={QUESTION_STATE[state].tone}>{QUESTION_STATE[state].label}</Chip>
        <span className="text-[11px] text-slate-500">
          {QUESTION_TYPE_LABEL[question.questionType]} · {DIFFICULTY_LABEL[question.difficulty]} ·{' '}
          {question.code}
        </span>
        {ai && (
          <Chip tone="bg-violet-50 text-violet-700 ring-violet-200">
            <Sparkles className="mr-1 size-3" />
            AI gợi ý
          </Chip>
        )}
        {pinned && state === 'IN_PRACTICE' && (
          <Chip tone="bg-sky-50 text-sky-700 ring-sky-200">Hỏi nhanh trong bài</Chip>
        )}
      </div>
      <div className="mt-2 text-sm leading-relaxed whitespace-pre-line text-slate-900">
        <QuestionMath text={question.stem} />
      </div>
      {question.options.length > 0 && (
        <ul className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
          {question.options.map((option) => (
            <li
              key={option.key}
              className={
                question.correctAnswer.split(',').includes(option.key)
                  ? 'font-semibold text-emerald-700'
                  : ''
              }
            >
              {option.key}. <QuestionMath text={option.content} />
            </li>
          ))}
        </ul>
      )}
      {question.questionType === 'TRUE_FALSE' && (
        <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
          {(question.trueFalseStatements ?? []).map((s, i) => (
            <li key={s.id}>
              {String.fromCharCode(97 + i)}) <QuestionMath text={s.content} />{' '}
              <strong className={s.isTrue ? 'text-emerald-700' : 'text-rose-700'}>
                {s.isTrue ? 'Đúng' : 'Sai'}
              </strong>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>
          Đáp án: <strong className="text-slate-800">{answerSummary(question)}</strong>
        </span>
        {stats.answers > 0 && (
          <span>
            {stats.correct}/{stats.answers} lượt trả lời đúng
          </span>
        )}
        {question.explanation && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-0.5 font-semibold text-primary"
          >
            Lời giải <ChevronDown className={`size-3 transition ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      {open && (
        <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed whitespace-pre-line text-slate-700">
          <QuestionMath text={question.explanation ?? ''} />
        </div>
      )}
      {reason && <p className="mt-2 text-xs font-medium text-rose-700">{reason}</p>}
      {error && (
        <p className="mt-2 text-xs font-medium text-rose-700" role="alert">
          {error}
        </p>
      )}

      {confirming && (
        <div className="mt-3 space-y-2 rounded-xl bg-violet-50 p-3 ring-1 ring-violet-200">
          <label className="flex items-start gap-2 text-xs text-violet-900">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
              data-testid="confirm-verified"
            />
            Tôi đã tự giải lại câu này: đáp án và lời giải đều đúng.
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!verified || busy}
              onClick={() =>
                run({ editorialStatus: 'IN_REVIEW', answerVerified: true }, 'Đã gửi duyệt.')
              }
              className={`${button} bg-violet-700 text-white`}
              data-testid="confirm-submit-review"
            >
              Gửi duyệt
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className={`${button} text-violet-800`}
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        {state !== 'ARCHIVED' && (
          <button
            type="button"
            onClick={() => onEdit(question)}
            className={`${button} border border-slate-200 text-slate-700 hover:bg-slate-50`}
          >
            <Pencil className="size-3.5" /> Sửa
          </button>
        )}
        {state === 'DRAFT' && !confirming && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              ai ? setConfirming(true) : run({ editorialStatus: 'IN_REVIEW' }, 'Đã gửi duyệt.')
            }
            className={`${button} bg-amber-500 text-white hover:bg-amber-600`}
            data-testid="action-submit-review"
          >
            Gửi duyệt
          </button>
        )}
        {state === 'IN_REVIEW' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  { editorialStatus: 'PUBLISHED', usageContexts: withPractice },
                  'Đã xuất bản. Học sinh sẽ nhận câu này trong lượt luyện tập tiếp theo.'
                )
              }
              className={`${button} bg-emerald-600 text-white hover:bg-emerald-700`}
              data-testid="action-publish"
            >
              <CheckCircle2 className="size-3.5" /> Duyệt và xuất bản
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run({ editorialStatus: 'DRAFT' }, 'Đã trả về nháp.')}
              className={`${button} text-slate-600 hover:bg-slate-100`}
            >
              Trả về nháp
            </button>
          </>
        )}
        {state === 'IN_PRACTICE' && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(
                { usageContexts: togglePinned },
                pinned
                  ? 'Đã bỏ khỏi phần hỏi nhanh trong bài.'
                  : 'Học sinh sẽ gặp câu này ngay trong bài, sau ví dụ mẫu.'
              )
            }
            title="Tối đa 2 câu được hỏi ngay trong bài. Nếu chưa chọn, Tú Tài dùng 2 câu cơ bản nhất."
            className={`${button} border border-sky-200 text-sky-800 hover:bg-sky-50`}
            data-testid="action-toggle-lesson-check"
          >
            {pinned ? 'Bỏ khỏi hỏi nhanh' : 'Hỏi nhanh trong bài'}
          </button>
        )}
        {state === 'PUBLISHED_ELSEWHERE' && question.accessTier === 'OPEN' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run({ usageContexts: withPractice }, 'Đã đưa vào luyện tập.')}
            className={`${button} bg-emerald-600 text-white hover:bg-emerald-700`}
          >
            Đưa vào luyện tập
          </button>
        )}
        {(state === 'IN_PRACTICE' || state === 'PUBLISHED_ELSEWHERE' || state === 'NOT_USABLE') &&
          question.editorialStatus === 'PUBLISHED' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Gỡ câu này? Học sinh sẽ không nhận câu này nữa.')) {
                  run({ editorialStatus: 'ARCHIVED' }, 'Đã gỡ câu hỏi.');
                }
              }}
              className={`${button} text-rose-700 hover:bg-rose-50`}
            >
              Gỡ khỏi luyện tập
            </button>
          )}
        {state === 'ARCHIVED' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run({ editorialStatus: 'DRAFT' }, 'Đã khôi phục về nháp.')}
            className={`${button} border border-slate-200 text-slate-700 hover:bg-slate-50`}
          >
            Khôi phục về nháp
          </button>
        )}
        {busy && <Loader2 className="size-4 animate-spin self-center text-slate-400" />}
      </div>
    </article>
  );
}

function SuggestionPanel({
  lessonId,
  onUse,
  onClose,
}: {
  lessonId: string;
  onUse: (suggestion: QuestionSuggestion) => void;
  onClose: () => void;
}) {
  const [availability, setAvailability] = React.useState<{
    available: boolean;
    reason?: string;
  } | null>(null);
  const [count, setCount] = React.useState(3);
  const [note, setNote] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [suggestions, setSuggestions] = React.useState<QuestionSuggestion[]>([]);

  React.useEffect(() => {
    fetch(`/api/admin/practice/${lessonId}/suggestions`)
      .then((r) => r.json())
      .then(setAvailability)
      .catch(() =>
        setAvailability({ available: false, reason: 'Không kiểm tra được dịch vụ AI.' })
      );
  }, [lessonId]);

  async function generate() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/admin/practice/${lessonId}/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count, note }),
    }).catch(() => null);
    setLoading(false);
    const body = (await response?.json().catch(() => ({}))) as {
      suggestions?: QuestionSuggestion[];
      error?: string;
    };
    if (!response?.ok) return setError(body?.error ?? 'Không tạo được gợi ý.');
    setSuggestions(body.suggestions ?? []);
  }

  return (
    <section
      className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4 sm:p-5"
      data-testid="suggestion-panel"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-bold text-slate-900">
            <Sparkles className="size-4 text-violet-600" /> Gợi ý câu hỏi bằng AI
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            AI đọc nội dung bài học và đề xuất câu kèm đáp án, lời giải. Không có gì được lưu cho
            tới khi bạn chọn, sửa và tự kiểm tra đáp án.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500">
          Đóng
        </button>
      </div>
      {availability && !availability.available ? (
        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
          {availability.reason}
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} câu
              </option>
            ))}
          </select>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="Yêu cầu thêm (không bắt buộc), ví dụ: tập trung vào bảng biến thiên"
            className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          />
          <button
            type="button"
            onClick={generate}
            disabled={loading || !availability}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white disabled:opacity-60"
            data-testid="suggest-generate"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {loading ? 'Đang soạn…' : 'Tạo gợi ý'}
          </button>
        </div>
      )}
      {error && (
        <p className="mt-2 text-xs font-medium text-rose-700" role="alert">
          {error}
        </p>
      )}
      {suggestions.length > 0 && (
        <ul className="mt-4 space-y-3">
          {suggestions.map((s, index) => (
            <li
              key={index}
              className="rounded-xl bg-white p-3 ring-1 ring-slate-200"
              data-testid="suggestion"
            >
              <p className="text-[11px] text-slate-500">
                {QUESTION_TYPE_LABEL[s.questionType]} · {DIFFICULTY_LABEL[s.difficulty]} · Đáp án AI
                đề xuất:{' '}
                <strong>
                  {s.questionType === 'TRUE_FALSE'
                    ? s.statements.map((x) => (x.isTrue ? 'Đ' : 'S')).join(' ')
                    : s.correctAnswer}
                </strong>
              </p>
              <div className="mt-1 text-sm whitespace-pre-line text-slate-900">
                <QuestionMath text={s.stem} />
              </div>
              <button
                type="button"
                onClick={() => onUse(s)}
                className="mt-2 inline-flex h-8 items-center rounded-lg border border-violet-300 px-3 text-xs font-semibold text-violet-800 hover:bg-violet-50"
                data-testid="suggestion-use"
              >
                Xem lại và lưu nháp
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function draftFromSuggestion(s: QuestionSuggestion): EditorDraft {
  const base = emptyDraft();
  return {
    ...base,
    questionType: s.questionType,
    stem: s.stem,
    options: s.options.length ? s.options.map((o) => o.content) : base.options,
    choices: s.questionType === 'MULTIPLE_CHOICE_SINGLE' ? [s.correctAnswer] : [],
    statements: s.statements.length
      ? s.statements.map((x, i) => ({ id: `s-ai-${Date.now().toString(36)}-${i}`, ...x }))
      : base.statements,
    numeric: s.questionType === 'NUMERIC' ? s.correctAnswer : '',
    explanation: s.explanation,
    difficulty: s.difficulty,
    aiAssisted: true,
  };
}

const GROUPS: { title: string; states: CoverageQuestion['state'][]; empty?: string }[] = [
  { title: 'Cần xử lý', states: ['IN_REVIEW', 'NOT_USABLE', 'PUBLISHED_ELSEWHERE'] },
  {
    title: 'Học sinh đang nhận',
    states: ['IN_PRACTICE'],
    empty: 'Chưa có câu nào. Thêm câu, gửi duyệt rồi xuất bản để học sinh luyện tập.',
  },
  { title: 'Bản nháp', states: ['DRAFT'] },
  { title: 'Đã gỡ', states: ['ARCHIVED'] },
];

export function LessonPracticeWorkspace({
  coverage,
  questions,
}: {
  coverage: LessonCoverage;
  questions: CoverageQuestion[];
}) {
  const router = useRouter();
  const [editor, setEditor] = React.useState<EditorState>(null);
  const [suggesting, setSuggesting] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const readiness = READINESS[coverage.readiness];
  const editorRef = React.useRef<HTMLDivElement>(null);

  const changed = (message: string) => {
    setNotice(message);
    router.refresh();
  };
  const openEditor = (question: Question | null, draft: EditorDraft) => {
    setEditor({ question, draft, key: Date.now() });
    requestAnimationFrame(() =>
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
      <div>
        <Link
          href="/admin/practice"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="size-3.5" /> Luyện tập theo bài
        </Link>
        <p className="mt-3 text-xs text-slate-500">{coverage.path.join(' › ')}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{coverage.title}</h1>
          <Chip tone={readiness.tone}>{readiness.label}</Chip>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Học sinh nhận được gì">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Bài học</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {LESSON_PUBLICATION_LABELS[coverage.publication]}
          </p>
          {coverage.publication === 'PUBLISHED' ? (
            <Link
              href={`/student/lessons/${coverage.lessonId}`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary"
              target="_blank"
            >
              <Eye className="size-3.5" /> Xem như học sinh
            </Link>
          ) : (
            <Link
              href="/admin/knowledge"
              className="mt-2 inline-flex text-xs font-semibold text-primary"
            >
              Soạn và xuất bản bài học
            </Link>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Học sinh nhận được</p>
          <p className="mt-1 text-sm font-semibold text-slate-900" data-testid="students-receive">
            {coverage.publication === 'PUBLISHED'
              ? `${Math.min(coverage.counts.IN_PRACTICE, PRACTICE_SESSION_SIZE)} câu mỗi lượt`
              : 'Chưa nhận gì'}
          </p>
          <p className="mt-1 text-xs text-slate-500">{readiness.hint}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <Users className="size-3.5" /> Kết quả học sinh
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {coverage.students.attempts
              ? `${coverage.students.students} học sinh · ${coverage.students.attempts} lượt`
              : 'Chưa có lượt làm'}
          </p>
          {coverage.students.averageScore !== null && (
            <p className="mt-1 text-xs text-slate-500">
              Đúng trung bình {Math.round(coverage.students.averageScore * 100)}%
            </p>
          )}
        </div>
      </section>

      {notice && (
        <p
          className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200"
          role="status"
          data-testid="workspace-notice"
        >
          {notice}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => openEditor(null, emptyDraft())}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          data-testid="add-question"
        >
          <Plus className="size-4" /> Thêm câu hỏi
        </button>
        <button
          type="button"
          onClick={() => setSuggesting(true)}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-violet-300 bg-white px-4 text-sm font-semibold text-violet-800 hover:bg-violet-50"
          data-testid="open-suggestions"
        >
          <Sparkles className="size-4" /> Gợi ý bằng AI
        </button>
        <Link
          href={`/admin/practice/${coverage.lessonId}/textbook`}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          data-testid="open-textbook-exercises"
        >
          <BookOpen className="size-4" /> Bài tập từ sách
        </Link>
      </div>

      <div ref={editorRef} className="scroll-mt-4">
        {editor && (
          <QuestionEditor
            key={editor.key}
            lessonId={coverage.lessonId}
            question={editor.question}
            initial={editor.draft}
            onCancel={() => setEditor(null)}
            onSaved={(message) => {
              setEditor(null);
              changed(message);
            }}
          />
        )}
      </div>

      {suggesting && (
        <SuggestionPanel
          lessonId={coverage.lessonId}
          onClose={() => setSuggesting(false)}
          onUse={(s) => openEditor(null, draftFromSuggestion(s))}
        />
      )}

      {GROUPS.map((group) => {
        const items = questions.filter((q) => group.states.includes(q.state));
        if (items.length === 0 && !group.empty) return null;
        return (
          <section key={group.title} className="space-y-2">
            <h2 className="text-sm font-bold text-slate-900">
              {group.title} <span className="font-normal text-slate-500">({items.length})</span>
            </h2>
            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-xs text-slate-500">
                {group.empty}
              </p>
            ) : (
              items.map((item) => (
                <QuestionCard
                  key={`${item.question.id}-${item.question.updatedAt}`}
                  item={item}
                  onEdit={(question) => openEditor(question, draftFromQuestion(question))}
                  onChanged={changed}
                />
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}
