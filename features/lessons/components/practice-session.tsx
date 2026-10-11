'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  RotateCcw,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import { QuestionMath } from '@/components/shared/question-content-renderer';
import type { PracticeFeedback, PracticeQuestion } from '@/lib/practice/grading';
import type { AttemptView } from '@/lib/practice/practice-service';

type Lesson = { id: string; title: string; chapterTitle: string };
type Answer =
  | { choice?: string; choices?: string[]; statements?: Record<string, boolean>; value?: string }
  | undefined;

const TYPE_HINT: Record<PracticeQuestion['type'], string> = {
  MULTIPLE_CHOICE_SINGLE: 'Chọn một đáp án',
  MULTIPLE_CHOICE_MULTIPLE: 'Chọn tất cả đáp án đúng',
  TRUE_FALSE: 'Chọn Đúng hoặc Sai cho từng ý',
  NUMERIC: 'Nhập kết quả là một số',
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Có lỗi xảy ra. Em thử lại nhé.');
  return body;
}

function isComplete(question: PracticeQuestion, answer: Answer): boolean {
  if (!answer) return false;
  switch (question.type) {
    case 'MULTIPLE_CHOICE_SINGLE':
      return !!answer.choice;
    case 'MULTIPLE_CHOICE_MULTIPLE':
      return (answer.choices?.length ?? 0) > 0;
    case 'TRUE_FALSE':
      return question.statements.every((s) => typeof answer.statements?.[s.id] === 'boolean');
    case 'NUMERIC':
      return /^\s*[+-]?(\d+([.,]\d*)?|[.,]\d+)\s*$/.test(answer.value ?? '');
  }
}

function Shell({ lesson, children }: { lesson: Lesson; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[720px] pb-28 sm:pb-12">
      <Link
        href={`/student/lessons/${encodeURIComponent(lesson.id)}`}
        className="inline-flex items-center gap-1.5 rounded-lg py-1 text-[13px] font-semibold text-slate-500 hover:text-blue-600"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> {lesson.title}
      </Link>
      {children}
    </div>
  );
}

function ChoiceButton({
  label,
  content,
  selected,
  state,
  disabled,
  onClick,
  multiple,
}: {
  label: string;
  content: string;
  selected: boolean;
  state: 'correct' | 'wrong' | 'missed' | null;
  disabled: boolean;
  onClick: () => void;
  multiple: boolean;
}) {
  const tone =
    state === 'correct'
      ? 'border-emerald-400 bg-emerald-50'
      : state === 'wrong'
        ? 'border-rose-300 bg-rose-50'
        : state === 'missed'
          ? 'border-emerald-300 border-dashed bg-white'
          : selected
            ? 'border-[#0052FF] bg-[#F4F8FF] ring-2 ring-[#0052FF]/15'
            : 'border-[#E5EBF3] bg-white hover:border-blue-200 hover:bg-[#F8FAFF]';
  const badge =
    state === 'correct'
      ? 'bg-emerald-600 text-white'
      : state === 'wrong'
        ? 'bg-rose-600 text-white'
        : selected
          ? 'bg-[#0052FF] text-white'
          : 'bg-slate-100 text-slate-600';
  return (
    <button
      type="button"
      role={multiple ? 'checkbox' : 'radio'}
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition sm:p-4 ${tone} disabled:cursor-default`}
      data-testid={`choice-${label}`}
    >
      <span
        className={`grid size-8 shrink-0 place-items-center text-sm font-bold ${multiple ? 'rounded-lg' : 'rounded-full'} ${badge}`}
      >
        {state === 'correct' ? (
          <Check className="size-4" />
        ) : state === 'wrong' ? (
          <X className="size-4" />
        ) : (
          label
        )}
      </span>
      <span className="pt-1 text-[15px] leading-6 text-[#091224]">
        <QuestionMath text={content} />
        {state === 'missed' && (
          <span className="ml-2 text-xs font-semibold text-emerald-700">Đáp án đúng</span>
        )}
      </span>
    </button>
  );
}

function QuestionBody({
  question,
  answer,
  setAnswer,
  feedback,
}: {
  question: PracticeQuestion;
  answer: Answer;
  setAnswer: (answer: Answer) => void;
  feedback: PracticeFeedback | undefined;
}) {
  const locked = !!feedback;
  const shown = (feedback?.response as Answer) ?? answer;
  const expected = feedback?.answer as Answer;

  if (question.type === 'MULTIPLE_CHOICE_SINGLE' || question.type === 'MULTIPLE_CHOICE_MULTIPLE') {
    const multiple = question.type === 'MULTIPLE_CHOICE_MULTIPLE';
    const picked = multiple ? (shown?.choices ?? []) : shown?.choice ? [shown.choice] : [];
    const right = expected?.choices ?? [];
    return (
      <div className="space-y-2.5" role={multiple ? 'group' : 'radiogroup'}>
        {question.options.map((option) => {
          const selected = picked.includes(option.key);
          const state = !feedback
            ? null
            : right.includes(option.key)
              ? selected
                ? 'correct'
                : 'missed'
              : selected
                ? 'wrong'
                : null;
          return (
            <ChoiceButton
              key={option.key}
              label={option.key}
              content={option.content}
              selected={selected}
              state={state}
              disabled={locked}
              multiple={multiple}
              onClick={() =>
                setAnswer(
                  multiple
                    ? {
                        choices: selected
                          ? picked.filter((key) => key !== option.key)
                          : [...picked, option.key],
                      }
                    : { choice: option.key }
                )
              }
            />
          );
        })}
      </div>
    );
  }

  if (question.type === 'TRUE_FALSE') {
    return (
      <ol className="space-y-2.5">
        {question.statements.map((statement, index) => {
          const given = shown?.statements?.[statement.id];
          const result = feedback?.statements?.find((s) => s.id === statement.id);
          return (
            <li
              key={statement.id}
              className={`rounded-2xl border p-3.5 sm:p-4 ${
                result
                  ? result.correct
                    ? 'border-emerald-300 bg-emerald-50/60'
                    : 'border-rose-300 bg-rose-50/60'
                  : 'border-[#E5EBF3] bg-white'
              }`}
            >
              <p className="text-[15px] leading-6 text-[#091224]">
                <span className="mr-1 font-bold">{String.fromCharCode(97 + index)})</span>
                <QuestionMath text={statement.content} />
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[true, false].map((value) => {
                  const selected = given === value;
                  return (
                    <button
                      key={String(value)}
                      type="button"
                      disabled={locked}
                      onClick={() =>
                        setAnswer({
                          statements: { ...(answer?.statements ?? {}), [statement.id]: value },
                        })
                      }
                      aria-pressed={selected}
                      className={`h-11 rounded-xl border text-sm font-bold transition ${
                        selected
                          ? value
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-rose-600 bg-rose-600 text-white'
                          : 'border-[#E5EBF3] bg-white text-slate-700 hover:bg-slate-50'
                      } disabled:cursor-default`}
                      data-testid={`statement-${index}-${value ? 'true' : 'false'}`}
                    >
                      {value ? 'Đúng' : 'Sai'}
                    </button>
                  );
                })}
              </div>
              {result && !result.correct && (
                <p className="mt-2 text-xs font-semibold text-rose-700">
                  Ý này {result.expected ? 'Đúng' : 'Sai'}.
                </p>
              )}
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor="numeric-answer" className="text-sm font-semibold text-slate-700">
        Đáp án của em
      </label>
      <input
        id="numeric-answer"
        inputMode="decimal"
        autoComplete="off"
        disabled={locked}
        value={shown?.value ?? ''}
        onChange={(event) => setAnswer({ value: event.target.value })}
        placeholder="Ví dụ: 2,5"
        className={`h-14 w-full rounded-2xl border px-4 text-lg font-semibold text-[#091224] focus:border-[#0052FF] focus:outline-none focus:ring-4 focus:ring-[#0052FF]/10 ${
          feedback
            ? feedback.correct
              ? 'border-emerald-400 bg-emerald-50'
              : 'border-rose-300 bg-rose-50'
            : 'border-[#D5DEEA] bg-white'
        }`}
        data-testid="numeric-input"
      />
      {feedback && !feedback.correct && (
        <p className="text-sm font-semibold text-emerald-700">Đáp án đúng: {expected?.value}</p>
      )}
    </div>
  );
}

function FeedbackPanel({ feedback }: { feedback: PracticeFeedback }) {
  return (
    <div
      id="practice-feedback"
      tabIndex={-1}
      className={`mt-5 rounded-2xl border p-4 outline-none sm:p-5 ${feedback.correct ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}
      role="status"
      data-testid="feedback"
      data-correct={feedback.correct}
    >
      <p
        className={`flex items-center gap-2 text-[16px] font-bold ${feedback.correct ? 'text-emerald-800' : 'text-amber-900'}`}
      >
        {feedback.correct ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
        {feedback.correct ? 'Chính xác!' : 'Chưa đúng, xem lời giải nhé'}
      </p>
      {feedback.explanation && (
        <div className="mt-3 border-t border-black/5 pt-3">
          <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">Lời giải</p>
          <div className="mt-1.5 text-[15px] leading-7 whitespace-pre-line text-slate-800">
            <QuestionMath text={feedback.explanation} />
          </div>
        </div>
      )}
    </div>
  );
}

function Results({
  view,
  lesson,
  next,
  onRestart,
  onMistakes,
  busy,
}: {
  view: AttemptView;
  lesson: Lesson;
  next: { id: string; title: string } | null;
  onRestart: () => void;
  onMistakes: () => void;
  busy: boolean;
}) {
  const { attempt, questions, feedback } = view;
  const correct = attempt.correctCount ?? 0;
  const wrong = attempt.totalCount - correct;
  const [open, setOpen] = React.useState<string | null>(null);
  return (
    <div data-testid="results">
      <section className="mt-4 rounded-[24px] border border-[#E5EBF3] bg-white p-6 text-center sm:p-8">
        <span
          className={`mx-auto grid size-16 place-items-center rounded-full ${attempt.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
        >
          {attempt.passed ? <Trophy className="size-8" /> : <RotateCcw className="size-7" />}
        </span>
        <p className="mt-4 text-[13px] font-semibold text-blue-600">
          {attempt.mode === 'MISTAKES' ? 'Luyện lại câu sai' : 'Luyện tập sau bài học'}
        </p>
        <h1
          className="mt-1 text-[40px] font-extrabold leading-none tracking-tight text-[#091224]"
          data-testid="score"
        >
          {correct}/{attempt.totalCount}
        </h1>
        <p className="mt-2 text-[15px] text-slate-600">
          {attempt.passed
            ? 'Tốt lắm! Em đã nắm được bài này.'
            : wrong === 1
              ? 'Chỉ còn 1 câu chưa đúng. Xem lại lời giải rồi luyện lại nhé.'
              : `Còn ${wrong} câu chưa đúng. Đọc lại phần lý thuyết rồi luyện lại các câu này.`}
        </p>
        <p className="mt-1 text-xs text-slate-400">Kết quả đã được lưu.</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {wrong > 0 ? (
            <button
              type="button"
              onClick={onMistakes}
              disabled={busy}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-[15px] font-bold text-white hover:bg-[#0044CC] disabled:opacity-60"
              data-testid="retry-mistakes"
            >
              <RotateCcw className="size-4" /> Luyện lại {wrong} câu sai
            </button>
          ) : next ? (
            <Link
              href={`/student/lessons/${encodeURIComponent(next.id)}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-[15px] font-bold text-white hover:bg-[#0044CC]"
              data-testid="next-lesson"
            >
              Học bài tiếp theo <ArrowRight className="size-4" />
            </Link>
          ) : null}
          <Link
            href={`/student/lessons/${encodeURIComponent(lesson.id)}`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#D5DEEA] bg-white px-5 text-[15px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <BookOpen className="size-4" /> Xem lại bài học
          </Link>
          {wrong === 0 && (
            <button
              type="button"
              onClick={onRestart}
              disabled={busy}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#D5DEEA] bg-white px-5 text-[15px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="size-4" /> Làm lại
            </button>
          )}
        </div>
        {wrong > 0 && next && (
          <Link
            href={`/student/lessons/${encodeURIComponent(next.id)}`}
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-600"
          >
            Hoặc học tiếp: {next.title} <ArrowRight className="size-3.5" />
          </Link>
        )}
      </section>

      <section className="mt-5">
        <h2 className="px-1 text-sm font-bold text-[#091224]">Từng câu</h2>
        <ol className="mt-2 space-y-2">
          {questions.map((question, index) => {
            const item = feedback[question.id];
            const expanded = open === question.id;
            return (
              <li key={question.id} className="rounded-2xl border border-[#E5EBF3] bg-white">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : question.id)}
                  className="flex w-full items-start gap-3 p-4 text-left"
                  aria-expanded={expanded}
                >
                  {item?.correct ? (
                    <CheckCircle2
                      className="mt-0.5 size-5 shrink-0 text-emerald-600"
                      aria-label="Đúng"
                    />
                  ) : (
                    <XCircle className="mt-0.5 size-5 shrink-0 text-rose-500" aria-label="Sai" />
                  )}
                  <span className="min-w-0 flex-1 text-sm leading-6 text-slate-800">
                    <span className="font-semibold">Câu {index + 1}. </span>
                    <QuestionMath text={question.stem} />
                  </span>
                  <ChevronDown
                    className={`mt-1 size-4 shrink-0 text-slate-400 transition ${expanded ? 'rotate-180' : ''}`}
                  />
                </button>
                {expanded && item && (
                  <div className="border-t border-[#EEF2F7] px-4 pt-3 pb-4">
                    <QuestionBody
                      question={question}
                      answer={undefined}
                      setAnswer={() => {}}
                      feedback={item}
                    />
                    {item.explanation && (
                      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-6 whitespace-pre-line text-slate-700">
                        <QuestionMath text={item.explanation} />
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

export function PracticeSession({
  lesson,
  next,
  initialAttemptId,
}: {
  lesson: Lesson;
  next: { id: string; title: string } | null;
  initialAttemptId: string | null;
}) {
  const router = useRouter();
  const [view, setView] = React.useState<AttemptView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [overview, setOverview] = React.useState<{ questionCount: number } | null>(null);
  const [index, setIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, Answer>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [showResults, setShowResults] = React.useState(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  // The attempt on screen, so the address update after starting one does not reload it.
  const shownAttemptId = React.useRef<string | null>(null);

  // State is only set after the request returns, never synchronously in the effect.
  const fetchState = React.useCallback(async () => {
    try {
      if (initialAttemptId) {
        const loaded = await api<AttemptView>(`/api/student/practice/attempts/${initialAttemptId}`);
        shownAttemptId.current = loaded.attempt.id;
        setView(loaded);
        const firstOpen = loaded.questions.findIndex((q) => !loaded.feedback[q.id]);
        setIndex(firstOpen === -1 ? 0 : firstOpen);
        setShowResults(loaded.attempt.status === 'COMPLETED');
      } else {
        const lessonOverview = await api<{ questionCount: number }>(
          `/api/student/practice/lessons/${encodeURIComponent(lesson.id)}`
        );
        setView(null);
        setShowResults(false);
        setOverview(lessonOverview);
      }
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, [initialAttemptId, lesson.id]);

  React.useEffect(() => {
    if (initialAttemptId && shownAttemptId.current === initialAttemptId) return;
    void fetchState();
  }, [fetchState, initialAttemptId]);

  const retry = () => {
    setLoading(true);
    setError(null);
    void fetchState();
  };

  async function start(mode: 'LESSON' | 'MISTAKES') {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const started = await api<AttemptView>(
        `/api/student/practice/lessons/${encodeURIComponent(lesson.id)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            mode,
            fromAttemptId: mode === 'MISTAKES' ? view?.attempt.id : undefined,
          }),
        }
      );
      shownAttemptId.current = started.attempt.id;
      setAnswers({});
      setIndex(0);
      setView(started);
      setShowResults(false);
      // The attempt id in the address keeps refresh and back navigation on this attempt.
      router.replace(
        `/student/lessons/${encodeURIComponent(lesson.id)}/practice?attempt=${started.attempt.id}`,
        {
          scroll: true,
        }
      );
    } catch (cause) {
      setSubmitError((cause as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const question = view?.questions[index];
  const feedback = question ? view?.feedback[question.id] : undefined;
  const answer = question ? answers[question.id] : undefined;
  const isLast = view ? index === view.questions.length - 1 : false;

  async function check() {
    if (!view || !question || !isComplete(question, answer)) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await api<{ feedback: PracticeFeedback; attempt: AttemptView['attempt'] }>(
        `/api/student/practice/attempts/${view.attempt.id}/answers`,
        {
          method: 'POST',
          body: JSON.stringify({ questionId: question.id, response: answer }),
        }
      );
      setView({
        ...view,
        attempt: result.attempt,
        feedback: { ...view.feedback, [question.id]: result.feedback },
      });
      // Move focus to the result so screen readers announce it and the answer buttons lose focus.
      requestAnimationFrame(() =>
        document.getElementById('practice-feedback')?.focus({ preventScroll: false })
      );
    } catch (cause) {
      setSubmitError((cause as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function advance() {
    if (!view) return;
    if (isLast || view.attempt.status === 'COMPLETED') {
      const firstOpen = view.questions.findIndex((q) => !view.feedback[q.id]);
      if (firstOpen === -1) return setShowResults(true);
      setIndex(firstOpen);
    } else {
      setIndex(index + 1);
    }
    setSubmitError(null);
    requestAnimationFrame(() => {
      headingRef.current?.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (loading) {
    return (
      <Shell lesson={lesson}>
        <div className="mt-6 space-y-3" aria-busy="true" aria-label="Đang tải">
          <div className="h-2 animate-pulse rounded-full bg-slate-200" />
          <div className="h-40 animate-pulse rounded-[24px] bg-white" />
          <div className="h-14 animate-pulse rounded-2xl bg-white" />
          <div className="h-14 animate-pulse rounded-2xl bg-white" />
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell lesson={lesson}>
        <div
          className="mt-6 rounded-[24px] border border-rose-200 bg-white p-6 text-center"
          role="alert"
          data-testid="practice-error"
        >
          <p className="text-[17px] font-bold text-[#091224]">Không mở được bài luyện tập</p>
          <p className="mt-1 text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 inline-flex h-11 items-center rounded-xl bg-[#0052FF] px-5 text-sm font-bold text-white"
          >
            Thử lại
          </button>
        </div>
      </Shell>
    );
  }

  if (!view) {
    const count = overview?.questionCount ?? 0;
    return (
      <Shell lesson={lesson}>
        <section
          className="mt-4 rounded-[24px] border border-[#E5EBF3] bg-white p-6 sm:p-8"
          data-testid="practice-intro"
        >
          <p className="text-[13px] font-semibold text-blue-600">{lesson.chapterTitle}</p>
          <h1 className="mt-1 text-[26px] font-extrabold leading-tight tracking-tight text-[#091224] sm:text-[30px]">
            Luyện tập: {lesson.title}
          </h1>
          {count === 0 ? (
            <p className="mt-3 text-[15px] leading-7 text-slate-600" data-testid="practice-empty">
              Bài này chưa có câu luyện tập. Thầy cô đang soạn câu hỏi, em quay lại sau nhé.
            </p>
          ) : (
            <>
              <ul className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  [`${count} câu`, 'bám sát bài vừa học'],
                  ['Chấm ngay', 'sau mỗi câu'],
                  ['Có lời giải', 'cho mọi câu'],
                ].map(([title, text]) => (
                  <li key={title} className="rounded-2xl bg-[#F4F8FF] p-4">
                    <p className="text-[15px] font-bold text-[#091224]">{title}</p>
                    <p className="text-xs text-slate-500">{text}</p>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => void start('LESSON')}
                disabled={submitting}
                className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-[15px] font-bold text-white hover:bg-[#0044CC] disabled:opacity-60 sm:w-auto"
                data-testid="practice-begin"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                Bắt đầu
              </button>
            </>
          )}
          {submitError && (
            <p className="mt-3 text-sm font-medium text-rose-700" role="alert">
              {submitError}
            </p>
          )}
        </section>
      </Shell>
    );
  }

  if (showResults || !question) {
    return (
      <Shell lesson={lesson}>
        <Results
          view={view}
          lesson={lesson}
          next={next}
          busy={submitting}
          onRestart={() => void start('LESSON')}
          onMistakes={() => void start('MISTAKES')}
        />
        {submitError && (
          <p className="mt-3 text-center text-sm font-medium text-rose-700" role="alert">
            {submitError}
          </p>
        )}
      </Shell>
    );
  }

  const answered = Object.keys(view.feedback).length;
  const progress = (answered / view.questions.length) * 100;
  const canCheck = isComplete(question, answer) && !submitting;

  return (
    <Shell lesson={lesson}>
      <div className="mt-4 flex items-center gap-3">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-[#E5EBF3]"
          role="progressbar"
          aria-valuenow={answered}
          aria-valuemin={0}
          aria-valuemax={view.questions.length}
          aria-label="Tiến độ"
        >
          <div
            className="h-full rounded-full bg-[#0052FF] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-slate-500" data-testid="progress-label">
          {index + 1}/{view.questions.length}
        </span>
      </div>

      <section
        className="mt-4 rounded-[24px] border border-[#E5EBF3] bg-white p-5 sm:p-7"
        data-testid="practice-question"
      >
        <p className="text-[13px] font-semibold text-blue-600">
          Câu {index + 1} · {TYPE_HINT[question.type]}
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-2 text-[17px] leading-8 font-semibold whitespace-pre-line text-[#091224] focus:outline-none sm:text-[18px]"
        >
          <QuestionMath text={question.stem} />
        </h1>
        <div className="mt-5">
          <QuestionBody
            question={question}
            answer={answer}
            feedback={feedback}
            setAnswer={(next) => setAnswers((all) => ({ ...all, [question.id]: next }))}
          />
        </div>
        {feedback && <FeedbackPanel feedback={feedback} />}
        {submitError && (
          <p
            className="mt-4 text-sm font-medium text-rose-700"
            role="alert"
            data-testid="submit-error"
          >
            {submitError}
          </p>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E5EBF3] bg-white/95 p-3 backdrop-blur sm:static sm:mt-4 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mx-auto flex max-w-[720px] justify-end">
          {feedback ? (
            <button
              type="button"
              onClick={advance}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-[15px] font-bold text-white hover:bg-[#0044CC] sm:w-auto"
              data-testid="practice-next"
            >
              {view.attempt.status === 'COMPLETED' ? 'Xem kết quả' : 'Câu tiếp theo'}
              <ArrowRight className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void check()}
              disabled={!canCheck}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-[15px] font-bold text-white hover:bg-[#0044CC] disabled:bg-slate-300 sm:w-auto"
              data-testid="practice-check"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Kiểm tra
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}
