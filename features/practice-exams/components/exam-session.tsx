'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { QuestionMath, QuestionPrompt } from '@/components/shared/question-content-renderer';
import {
  FeedbackPanel,
  QuestionBody,
  TYPE_HINT,
  isComplete,
  type Answer,
} from '@/features/lessons/components/practice-session';
import type { PracticeQuestion } from '@/lib/practice/grading';
import type { ExamAttemptView } from '@/lib/exams/student-exam-service';
import { EXAM_SCOPE_LABELS } from '@/lib/exams/student-exam-rules';
import { EXAMS_PAGE, examHref } from '../lib/links';
import { formatClock, formatScore } from '../lib/format';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const PART_NAMES: Record<PracticeQuestion['type'], string> = {
  MULTIPLE_CHOICE_SINGLE: 'Trắc nghiệm nhiều phương án',
  MULTIPLE_CHOICE_MULTIPLE: 'Trắc nghiệm chọn nhiều đáp án',
  TRUE_FALSE: 'Trắc nghiệm đúng sai',
  NUMERIC: 'Trả lời ngắn',
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok)
    throw Object.assign(new Error(body.error ?? 'Có lỗi xảy ra. Em thử lại nhé.'), {
      status: response.status,
    });
  return body;
}

const attemptUrl = (id: string) => `/api/student/exams/attempts/${encodeURIComponent(id)}`;

export function ExamSession({
  initial,
  error,
}: {
  initial: ExamAttemptView | null;
  error: string | null;
}) {
  const [data, setData] = React.useState<ExamAttemptView | null>(initial);

  if (error && !data) {
    return (
      <div className="mx-auto max-w-[520px] py-16 text-center" data-testid="exam-session-error">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-700">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-[#091224]">
          Không mở được bài làm
        </h1>
        <p className="mt-2 text-[15px] text-slate-600">{error}</p>
        <Link
          href={EXAMS_PAGE}
          className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#0052FF] px-5 text-[15px] font-bold text-white"
        >
          Về Luyện thi
        </Link>
      </div>
    );
  }
  if (!data) return null;
  if (data.attempt.status === 'SUBMITTED' && data.review) return <ExamResults data={data} />;
  return <RunningExam data={data} onSubmitted={setData} />;
}

/* ------------------------------------------------------------------ */
/* Running                                                             */
/* ------------------------------------------------------------------ */

function useCountdown(deadlineAt: string, serverNow: string) {
  const [seconds, setSeconds] = React.useState(() =>
    Math.max(0, Math.ceil((Date.parse(deadlineAt) - Date.parse(serverNow)) / 1000))
  );
  React.useEffect(() => {
    // Correct the device clock by the server's, so a wrong phone clock does not change the time left.
    const offset = Date.parse(serverNow) - Date.now();
    const tick = () =>
      setSeconds(Math.max(0, Math.ceil((Date.parse(deadlineAt) - (Date.now() + offset)) / 1000)));
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [deadlineAt, serverNow]);
  return seconds;
}

function RunningExam({
  data,
  onSubmitted,
}: {
  data: ExamAttemptView;
  onSubmitted: (view: ExamAttemptView) => void;
}) {
  const { questions, attempt, exam } = data;
  const [answers, setAnswers] = React.useState<Record<string, Answer>>(
    () => data.responses as Record<string, Answer>
  );
  const [index, setIndex] = React.useState(() => {
    const first = questions.findIndex((q) => !isComplete(q, data.responses[q.id] as Answer));
    return first === -1 ? 0 : first;
  });
  const [save, setSave] = React.useState<SaveState>('idle');
  const [confirming, setConfirming] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const seconds = useCountdown(attempt.deadlineAt, data.serverNow);

  // What the server holds for each question, so only real changes are sent.
  const saved = React.useRef<Record<string, string>>(
    Object.fromEntries(
      Object.entries(data.responses).map(([id, value]) => [id, JSON.stringify(value)])
    )
  );
  const pending = React.useRef(new Map<string, number>());
  const inflight = React.useRef(new Set<Promise<void>>());

  const question = questions[index];
  const answered = questions.filter((q) => isComplete(q, answers[q.id])).length;
  const unanswered = questions.length - answered;

  const persist = React.useCallback(
    (questionId: string, answer: Answer) => {
      const target = questions.find((q) => q.id === questionId);
      if (!target) return;
      // An unfinished true/false question is cleared on the server rather than half-saved.
      const response = isComplete(target, answer) ? answer : null;
      const key = response === null ? '' : JSON.stringify(response);
      if ((saved.current[questionId] ?? '') === key) return;
      setSave('saving');
      const request = api(`${attemptUrl(attempt.id)}/responses`, {
        method: 'POST',
        body: JSON.stringify({ questionId, response }),
      })
        .then(() => {
          if (key) saved.current[questionId] = key;
          else delete saved.current[questionId];
          setSave('saved');
        })
        .catch(() => setSave('error'))
        .finally(() => inflight.current.delete(request));
      inflight.current.add(request);
    },
    [attempt.id, questions]
  );

  const setAnswer = (answer: Answer) => {
    const questionId = question.id;
    setAnswers((current) => ({ ...current, [questionId]: answer }));
    window.clearTimeout(pending.current.get(questionId));
    // Typed answers wait for a pause; a tap saves right away.
    const delay = question.type === 'NUMERIC' ? 600 : 0;
    pending.current.set(
      questionId,
      window.setTimeout(() => {
        pending.current.delete(questionId);
        persist(questionId, answer);
      }, delay)
    );
  };

  const answersRef = React.useRef(answers);
  React.useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const flush = React.useCallback(async () => {
    for (const [questionId, timer] of pending.current) {
      window.clearTimeout(timer);
      persist(questionId, answersRef.current[questionId]);
    }
    pending.current.clear();
    await Promise.allSettled([...inflight.current]);
  }, [persist]);

  const submit = React.useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await flush();
      onSubmitted(
        await api<ExamAttemptView>(`${attemptUrl(attempt.id)}/submit`, { method: 'POST' })
      );
      window.scrollTo({ top: 0 });
    } catch (cause) {
      setSubmitError((cause as Error).message);
      setSubmitting(false);
    }
  }, [attempt.id, flush, onSubmitted]);

  const autoSubmitted = React.useRef(false);
  React.useEffect(() => {
    if (seconds > 0 || autoSubmitted.current) return;
    autoSubmitted.current = true;
    setConfirming(false);
    void submit();
  }, [seconds, submit]);

  React.useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pending.current.size || inflight.current.size) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const urgency = seconds <= 60 ? 'critical' : seconds <= 300 ? 'low' : 'normal';
  const partStart = questions.findIndex((q) => q.type === question.type);

  return (
    <div
      className="mx-auto w-full max-w-[1080px] pb-14"
      data-testid="exam-session"
      data-tier={exam.accessTier}
    >
      <div className="sticky top-0 z-20 -mx-4 -mt-16 border-b border-[#E5EBF3] bg-white/95 px-4 pb-3 pt-4 backdrop-blur md:-mx-6 md:-mt-6 md:px-6 lg:mx-0 lg:mt-0 lg:rounded-2xl lg:border lg:py-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 pl-12 lg:pl-0">
            <p className="truncate text-[12px] font-bold uppercase tracking-[0.1em] text-slate-500">
              {exam.accessTier === 'PLUS' ? 'Đề tuyển chọn' : EXAM_SCOPE_LABELS[exam.scope]}
            </p>
            <p className="truncate text-[15px] font-extrabold text-[#091224]">{exam.name}</p>
          </div>
          <div
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-mono text-[17px] font-extrabold tabular-nums ${
              urgency === 'critical'
                ? 'bg-rose-600 text-white'
                : urgency === 'low'
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-[#F1F5FF] text-[#0A1F5C]'
            }`}
            role="timer"
            aria-label={`Còn ${formatClock(seconds)}`}
            data-testid="exam-timer"
            data-urgency={urgency}
          >
            <Clock3 className="size-4" aria-hidden="true" />
            {formatClock(seconds)}
          </div>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={submitting}
            className="hidden h-10 items-center rounded-xl bg-[#091224] px-4 text-[14px] font-bold text-white hover:bg-[#1B2740] disabled:opacity-60 sm:inline-flex"
            data-testid="exam-submit-open"
          >
            Nộp bài
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-[12px] text-slate-500">
          <span data-testid="exam-progress">
            Đã làm {answered}/{questions.length} câu
          </span>
          <span aria-live="polite" data-testid="exam-save-state" data-state={save}>
            {save === 'saving'
              ? 'Đang lưu…'
              : save === 'saved'
                ? 'Đã lưu câu trả lời'
                : save === 'error'
                  ? 'Chưa lưu được, kiểm tra mạng'
                  : 'Câu trả lời được lưu tự động'}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section
          className="min-w-0 rounded-[24px] border border-[#E5EBF3] bg-white p-5 sm:p-7"
          data-testid="exam-question"
        >
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#0052FF]">
            {PART_NAMES[question.type]}
          </p>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <h1 className="text-[18px] font-extrabold text-[#091224]">Câu {index + 1}</h1>
            <span className="text-[13px] text-slate-500">{TYPE_HINT[question.type]}</span>
          </div>
          <div className="mt-3 text-[16px] leading-8 text-slate-800">
            <QuestionPrompt
              questionId={question.id}
              stem={question.stem}
              content={question.content}
            />
          </div>
          <div className="mt-5">
            <QuestionBody
              key={question.id}
              question={question}
              answer={answers[question.id]}
              setAnswer={setAnswer}
              feedback={undefined}
              compact
            />
          </div>
          <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#EEF2F7] pt-4">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-[14px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              data-testid="exam-prev"
            >
              <ArrowLeft className="size-4" aria-hidden="true" /> Câu trước
            </button>
            {index < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
                className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#0052FF] px-5 text-[14px] font-bold text-white hover:bg-[#0044CC]"
                data-testid="exam-next"
              >
                Câu tiếp <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#091224] px-5 text-[14px] font-bold text-white hover:bg-[#1B2740]"
                data-testid="exam-submit-last"
              >
                Nộp bài
              </button>
            )}
          </div>
          {partStart === index && index > 0 && (
            <p className="sr-only">Bắt đầu phần {PART_NAMES[question.type]}</p>
          )}
        </section>

        <aside
          className="rounded-[24px] border border-[#E5EBF3] bg-white p-5 lg:sticky lg:top-28 lg:self-start"
          aria-label="Danh sách câu"
        >
          <p className="text-[13px] font-extrabold text-[#091224]">Danh sách câu</p>
          <div className="mt-3 space-y-3" data-testid="exam-navigator">
            {groupByPart(questions).map((group) => (
              <div key={group.type}>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                  {PART_NAMES[group.type]}
                </p>
                <div className="mt-1.5 grid grid-cols-6 gap-1.5 sm:grid-cols-10 lg:grid-cols-6">
                  {group.items.map(({ question: q, position }) => {
                    const done = isComplete(q, answers[q.id]);
                    const current = position === index;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setIndex(position)}
                        className={`h-9 rounded-lg text-[13px] font-bold tabular-nums ${
                          current
                            ? 'bg-[#091224] text-white'
                            : done
                              ? 'bg-[#DCE8FF] text-[#0A1F5C]'
                              : 'border border-[#E1E7F0] text-slate-500 hover:border-[#0052FF]'
                        }`}
                        aria-current={current ? 'step' : undefined}
                        aria-label={`Câu ${position + 1}${done ? ', đã làm' : ', chưa làm'}`}
                        data-testid="exam-nav-item"
                        data-done={done}
                      >
                        {position + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={submitting}
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#091224] text-[14px] font-bold text-white hover:bg-[#1B2740] disabled:opacity-60 sm:hidden"
            data-testid="exam-submit-mobile"
          >
            Nộp bài
          </button>
        </aside>
      </div>

      {(confirming || submitting) && (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-[#091224]/50 p-4 sm:place-items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exam-confirm-title"
        >
          <div
            className="w-full max-w-[420px] rounded-[24px] bg-white p-6 shadow-xl"
            data-testid="exam-confirm"
          >
            {submitting ? (
              <p className="flex items-center gap-2 text-[16px] font-bold text-[#091224]">
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                {seconds === 0 ? 'Hết giờ, đang nộp bài…' : 'Đang nộp bài…'}
              </p>
            ) : (
              <>
                <h2 id="exam-confirm-title" className="text-[18px] font-extrabold text-[#091224]">
                  Nộp bài bây giờ?
                </h2>
                <p
                  className="mt-2 text-[14px] leading-6 text-slate-600"
                  data-testid="exam-confirm-unanswered"
                >
                  {unanswered
                    ? `Em còn ${unanswered} câu chưa làm. Câu bỏ trống được tính là sai.`
                    : 'Em đã làm hết các câu.'}{' '}
                  Sau khi nộp sẽ không sửa được nữa.
                </p>
                {submitError && (
                  <p className="mt-2 text-sm font-medium text-rose-700" role="alert">
                    {submitError}
                  </p>
                )}
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="h-11 rounded-xl px-4 text-[14px] font-bold text-slate-600 hover:bg-slate-50"
                    data-testid="exam-confirm-cancel"
                  >
                    Làm tiếp
                  </button>
                  <button
                    type="button"
                    onClick={() => void submit()}
                    className="h-11 rounded-xl bg-[#091224] px-5 text-[14px] font-bold text-white hover:bg-[#1B2740]"
                    data-testid="exam-confirm-submit"
                  >
                    Nộp bài
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function groupByPart(questions: PracticeQuestion[]) {
  const groups: {
    type: PracticeQuestion['type'];
    items: { question: PracticeQuestion; position: number }[];
  }[] = [];
  questions.forEach((question, position) => {
    let group = groups.find((g) => g.type === question.type);
    if (!group) groups.push((group = { type: question.type, items: [] }));
    group.items.push({ question, position });
  });
  return groups;
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

type Filter = 'all' | 'wrong' | 'blank';

function ExamResults({ data }: { data: ExamAttemptView }) {
  const { attempt, exam, questions } = data;
  const review = data.review!;
  const [filter, setFilter] = React.useState<Filter>('all');
  const correct = attempt.correct ?? 0;
  const blank = questions.filter((q) => !review[q.id]?.answered).length;
  const wrong = questions.length - correct - blank;
  const usedSeconds = attempt.submittedAt
    ? Math.max(0, (Date.parse(attempt.submittedAt) - Date.parse(attempt.startedAt)) / 1000)
    : 0;
  const parts = groupByPart(questions).map((group) => ({
    type: group.type,
    total: group.items.length,
    correct: group.items.filter(({ question }) => review[question.id]?.correct).length,
  }));
  const shown = questions
    .map((question, position) => ({ question, position }))
    .filter(({ question }) => {
      const r = review[question.id];
      if (filter === 'wrong') return r?.answered && !r.correct;
      if (filter === 'blank') return !r?.answered;
      return true;
    });

  return (
    <div className="mx-auto w-full max-w-[860px] pb-14" data-testid="exam-results">
      <p className="-mt-12 ml-12 flex min-h-10 items-center md:mt-0 lg:ml-0 lg:min-h-0">
        <Link
          href={EXAMS_PAGE}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg py-1 text-[13px] font-semibold text-slate-500 hover:text-blue-600"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Luyện thi
        </Link>
      </p>

      <section className="mt-4 rounded-[24px] border border-[#DCE6F7] bg-white p-6 sm:p-8">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#0052FF]">
          Kết quả · {exam.accessTier === 'PLUS' ? 'Đề tuyển chọn' : EXAM_SCOPE_LABELS[exam.scope]}
        </p>
        <h1 className="mt-1.5 text-[22px] font-extrabold leading-tight tracking-tight text-[#091224] sm:text-[26px]">
          {exam.name}
        </h1>
        <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
          <p>
            <span
              className="text-[44px] font-extrabold leading-none tracking-tight text-[#091224]"
              data-testid="exam-score"
            >
              {formatScore(attempt.score ?? 0)}
            </span>
            <span className="ml-1 text-[18px] font-bold text-slate-400">/10</span>
          </p>
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
            <div>
              <dt className="text-slate-500">Câu đúng</dt>
              <dd className="font-extrabold text-[#091224]" data-testid="exam-correct">
                {correct}/{questions.length}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Thời gian làm</dt>
              <dd className="font-extrabold text-[#091224]">{formatClock(usedSeconds)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Bỏ trống</dt>
              <dd className="font-extrabold text-[#091224]">{blank} câu</dd>
            </div>
          </dl>
        </div>
        {attempt.autoSubmitted && (
          <p
            className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-900"
            data-testid="exam-auto-submitted"
          >
            Hết giờ nên bài được nộp tự động với những câu em đã làm.
          </p>
        )}
        <ul className="mt-5 grid gap-2 sm:grid-cols-2" data-testid="exam-part-breakdown">
          {parts.map((part) => (
            <li key={part.type} className="rounded-xl bg-[#F4F8FF] px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span className="font-semibold text-slate-700">{PART_NAMES[part.type]}</span>
                <span className="font-extrabold text-[#091224]">
                  {part.correct}/{part.total}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-[#0052FF]"
                  style={{ width: `${(part.correct / part.total) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href={examHref(exam.id)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-[15px] font-bold text-white hover:bg-[#0044CC]"
            data-testid="exam-retake"
          >
            <RotateCcw className="size-4" aria-hidden="true" /> Làm lại đề
          </Link>
          <Link
            href={EXAMS_PAGE}
            className="inline-flex h-12 items-center justify-center rounded-xl px-5 text-[15px] font-bold text-slate-600 hover:bg-slate-50"
          >
            Về Luyện thi
          </Link>
        </div>
      </section>

      <section className="mt-6" data-testid="exam-review">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[17px] font-extrabold text-[#091224]">Xem lại bài làm</h2>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
            {(
              [
                ['all', `Tất cả (${questions.length})`],
                ['wrong', `Sai (${wrong})`],
                ['blank', `Bỏ trống (${blank})`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                onClick={() => setFilter(value)}
                className={`h-8 rounded-lg px-3 text-[13px] font-bold ${filter === value ? 'bg-white text-[#091224] shadow-sm' : 'text-slate-500'}`}
                data-testid={`review-filter-${value}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-[#DCE3EE] p-6 text-center text-[14px] text-slate-500">
            {filter === 'wrong' ? 'Không có câu nào sai.' : 'Không có câu nào bỏ trống.'}
          </p>
        ) : (
          <ol className="mt-4 space-y-4">
            {shown.map(({ question, position }) => {
              const feedback = review[question.id];
              return (
                <li
                  key={question.id}
                  className="rounded-[24px] border border-[#E5EBF3] bg-white p-5 sm:p-6"
                  data-testid="review-item"
                  data-correct={feedback.correct}
                  data-answered={feedback.answered}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[15px] font-extrabold text-[#091224]">Câu {position + 1}</p>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ${
                        !feedback.answered
                          ? 'bg-slate-100 text-slate-600'
                          : feedback.correct
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {!feedback.answered ? null : feedback.correct ? (
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      ) : (
                        <XCircle className="size-3.5" aria-hidden="true" />
                      )}
                      {!feedback.answered ? 'Bỏ trống' : feedback.correct ? 'Đúng' : 'Sai'}
                    </span>
                  </div>
                  <div className="mt-2 text-[15px] leading-7 text-slate-800">
                    <QuestionMath text={question.stem} />
                  </div>
                  <div className="mt-4">
                    <QuestionBody
                      question={question}
                      answer={undefined}
                      setAnswer={() => undefined}
                      feedback={feedback}
                      compact
                    />
                  </div>
                  <FeedbackPanel feedback={feedback} id={`review-${question.id}`} />
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
