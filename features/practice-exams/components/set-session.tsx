'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Layers,
  Loader2,
  Lock,
  RotateCcw,
  Trophy,
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
import { PracticeStage } from '@/features/lessons/components/practice-stage';
import { practiceHref } from '@/features/lessons/lib/study-plan';
import type { PracticeFeedback } from '@/lib/practice/grading';
import type { SetContext } from '@/lib/practice/practice-catalog';
import type { AttemptView } from '@/lib/practice/practice-service';
import { SET_SEGMENTS } from '@/lib/practice/practice-sets';
import { AdminPreviewTag } from './admin-preview-note';
import { DifficultyLadder } from './difficulty-ladder';
import { PLUS_SURFACE, PlusRibbon, PlusTexture } from './plus-mark';
import { practicePageHref, setHref } from '../lib/links';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Có lỗi xảy ra. Em thử lại nhé.');
  return body;
}

const primaryClass =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-[15px] font-bold text-white hover:bg-[#0044CC] disabled:opacity-60';
const plusClass =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#F5B83D] px-6 text-[15px] font-extrabold text-[#2B1C00] hover:bg-[#FFC857] disabled:opacity-60';
const secondaryClass =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#D5DEEA] bg-white px-5 text-[15px] font-semibold text-slate-700 hover:bg-slate-50';

function Shell({
  context,
  wide = false,
  children,
}: {
  context: SetContext;
  /** The question view, which puts the solution beside the question where there is room. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mx-auto w-full pb-28 sm:pb-12 ${wide ? 'max-w-[1180px]' : 'max-w-[720px]'}`}
      data-testid="set-page"
    >
      <p className="-mt-12 ml-12 flex min-h-10 items-center md:mt-0 lg:ml-0 lg:min-h-0">
        <Link
          href={practicePageHref(context.program, 'chapter')}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg py-1 text-[13px] font-semibold text-slate-500 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          data-testid="set-back"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Luyện tập
        </Link>
      </p>
      {children}
    </div>
  );
}

function SetHeader({ context }: { context: SetContext }) {
  const { facts, kind, chapter } = context;
  const plus = kind === 'SYNTHESIS';
  const items = [
    [`${facts.questionCount} câu`, plus ? 'khó dần' : 'trộn từ các bài'],
    facts.lessonsLinked >= 2 ? [`${facts.lessonsLinked} bài`, 'được nối trong bộ'] : null,
    plus && facts.demandingCount ? [`${facts.demandingCount} câu`, 'mức nâng cao trở lên'] : null,
    plus && facts.curatedCount ? [`${facts.curatedCount} câu`, 'được chọn lọc, có ghi chú'] : null,
    !plus ? ['Chấm ngay', 'có lời giải mọi câu'] : null,
  ].filter((item): item is string[] => Boolean(item));
  return (
    <section
      className={
        plus
          ? `${PLUS_SURFACE} mt-4 p-6 sm:p-8`
          : 'relative mt-4 overflow-hidden rounded-[24px] border border-[#DCE6F7] bg-white p-6 sm:p-8'
      }
      data-testid="set-intro"
      data-kind={kind}
    >
      {plus ? (
        <>
          <PlusTexture />
          <PlusRibbon />
        </>
      ) : (
        <span className="absolute inset-y-0 left-0 w-1.5 bg-[#0052FF]" aria-hidden="true" />
      )}
      <div className="relative">
        <p
          className={`flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.14em] ${plus ? 'text-[#F5B83D]' : 'text-[#0052FF]'}`}
        >
          {plus ? (
            <>
              Tổng hợp · Tú Tài Plus
              {context.previewAsAdmin && <AdminPreviewTag />}
            </>
          ) : (
            <>
              <Layers className="size-3.5" aria-hidden="true" /> Ôn chương · Miễn phí
            </>
          )}
        </p>
        <h1
          className={`mt-1.5 pr-10 text-[24px] font-extrabold leading-tight tracking-tight sm:text-[28px] ${plus ? 'text-white' : 'text-[#091224]'}`}
        >
          {chapter.title}
        </h1>
        <p className={`mt-2 text-[15px] leading-7 ${plus ? 'text-white/75' : 'text-slate-600'}`}>
          {plus
            ? 'Câu hỏi đặt trong cả chương: một câu có thể cần kiến thức của nhiều bài. Các câu được xếp từ dễ đến khó, có lời giải ngay sau khi em trả lời.'
            : 'Câu luyện tập của các bài trong chương, đảo lẫn với nhau. Hợp để ôn trước bài kiểm tra.'}
        </p>
        <ul className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {items.map(([title, text]) => (
            <li
              key={title + text}
              className={`rounded-2xl p-3.5 ${plus ? 'bg-white/10 ring-1 ring-white/10' : 'bg-[#F4F8FF]'}`}
            >
              <p className={`text-[16px] font-extrabold ${plus ? 'text-white' : 'text-[#091224]'}`}>
                {title}
              </p>
              <p className={`text-[12px] ${plus ? 'text-white/65' : 'text-slate-500'}`}>{text}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <DifficultyLadder mix={facts.mix} tone={plus ? 'dark' : 'light'} />
        </div>
        <p className={`mt-4 text-[13px] ${plus ? 'text-white/60' : 'text-slate-500'}`}>
          Bài trong chương: {chapter.lessonTitles.join(' · ')}
        </p>
      </div>
    </section>
  );
}

function LockedPanel({ context }: { context: SetContext }) {
  const alternative = context.hasReview
    ? { href: setHref('CHAPTER', context.chapter.id), label: 'Ôn chương miễn phí' }
    : context.freeLessonId
      ? {
          href: practiceHref(context.freeLessonId, undefined, 'practice'),
          label: 'Luyện từng bài miễn phí',
        }
      : null;
  return (
    <section
      className="mt-4 rounded-[24px] border border-[#F3E2B8] bg-[#FFFBF0] p-5 sm:p-6"
      data-testid="set-locked"
    >
      <p className="flex items-center gap-2 text-[16px] font-bold text-[#5C3B00]">
        <Lock className="size-4" aria-hidden="true" /> Bộ này dành cho tài khoản Tú Tài Plus
      </p>
      <p className="mt-1.5 text-[14px] leading-6 text-[#6B4E12]">
        Tài khoản của em chưa có Plus nên chưa mở được câu hỏi của bộ này. Câu luyện tập của từng
        bài trong chương vẫn miễn phí.
      </p>
      {alternative && (
        <Link
          href={alternative.href}
          className={`${primaryClass} mt-4 w-full sm:w-auto`}
          data-testid="set-free-alternative"
        >
          {alternative.label} <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

function Results({
  view,
  context,
  onRestart,
  busy,
}: {
  view: AttemptView;
  context: SetContext;
  onRestart: () => void;
  busy: boolean;
}) {
  const { attempt, questions, feedback } = view;
  const correct = attempt.correctCount ?? 0;
  const [open, setOpen] = React.useState<string | null>(null);
  const plus = context.kind === 'SYNTHESIS';
  return (
    <div data-testid="results" data-outcome={attempt.passed ? 'passed' : 'retry'}>
      <section className="mt-4 rounded-[24px] border border-[#E5EBF3] bg-white p-6 text-center sm:p-8">
        <span
          className={`mx-auto grid size-16 place-items-center rounded-full ${attempt.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
        >
          {attempt.passed ? <Trophy className="size-8" /> : <RotateCcw className="size-7" />}
        </span>
        <p className="mt-4 text-[13px] font-semibold text-blue-600">
          {plus ? 'Tổng hợp' : 'Ôn chương'} · {context.chapter.title}
        </p>
        <h1
          className="mt-1 text-[40px] font-extrabold leading-none tracking-tight text-[#091224]"
          data-testid="score"
        >
          {correct}/{attempt.totalCount}
        </h1>
        <p className="mt-2 text-[15px] text-slate-600">
          {attempt.passed
            ? 'Em đã đạt từ 80% trở lên. Kết quả đã được lưu.'
            : 'Chưa tới 80%. Xem lời giải từng câu bên dưới rồi thử lại nhé.'}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onRestart}
            disabled={busy}
            className={plus ? plusClass : primaryClass}
            data-testid="set-restart"
          >
            <RotateCcw className="size-4" /> Làm lại bộ này
          </button>
          <Link href={practicePageHref(context.program, 'chapter')} className={secondaryClass}>
            Về Luyện tập
          </Link>
        </div>
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
                  <div className="border-t border-[#EEF2F7] px-4 pb-4 pt-3">
                    <QuestionBody
                      question={question}
                      answer={undefined}
                      setAnswer={() => {}}
                      feedback={item}
                    />
                    {item.explanation && (
                      <div className="mt-3 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
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

export function SetSession({
  context,
  initialAttemptId,
}: {
  context: SetContext;
  initialAttemptId: string | null;
}) {
  const router = useRouter();
  const segment = SET_SEGMENTS[context.kind];
  const plus = context.kind === 'SYNTHESIS';
  const [view, setView] = React.useState<AttemptView | null>(null);
  const [loading, setLoading] = React.useState(Boolean(initialAttemptId) && !context.locked);
  const [error, setError] = React.useState<string | null>(null);
  const [index, setIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, Answer>>({});
  const [busy, setBusy] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [showResults, setShowResults] = React.useState(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const shown = React.useRef<string | null>(null);

  const load = React.useCallback(async () => {
    if (!initialAttemptId || context.locked) return;
    try {
      const loaded = await api<AttemptView>(`/api/student/practice/attempts/${initialAttemptId}`);
      shown.current = loaded.attempt.id;
      setView(loaded);
      const firstOpen = loaded.questions.findIndex((q) => !loaded.feedback[q.id]);
      setIndex(firstOpen === -1 ? 0 : firstOpen);
      setShowResults(loaded.attempt.status === 'COMPLETED');
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, [initialAttemptId, context.locked]);

  React.useEffect(() => {
    if (initialAttemptId && shown.current === initialAttemptId) return;
    void load();
  }, [load, initialAttemptId]);

  async function start() {
    setBusy(true);
    setSubmitError(null);
    try {
      const started = await api<AttemptView>(
        `/api/student/practice/sets/${segment}/${encodeURIComponent(context.chapter.id)}`,
        { method: 'POST' }
      );
      shown.current = started.attempt.id;
      setAnswers({});
      setIndex(0);
      setView(started);
      setShowResults(false);
      router.replace(setHref(context.kind, context.chapter.id, started.attempt.id), {
        scroll: true,
      });
    } catch (cause) {
      setSubmitError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const question = view?.questions[index];
  const feedback = question ? view?.feedback[question.id] : undefined;
  const answer = question ? answers[question.id] : undefined;

  async function check() {
    if (!view || !question || !isComplete(question, answer)) return;
    setBusy(true);
    setSubmitError(null);
    try {
      const result = await api<{ feedback: PracticeFeedback; attempt: AttemptView['attempt'] }>(
        `/api/student/practice/attempts/${view.attempt.id}/answers`,
        { method: 'POST', body: JSON.stringify({ questionId: question.id, response: answer }) }
      );
      setView({
        ...view,
        attempt: result.attempt,
        feedback: { ...view.feedback, [question.id]: result.feedback },
      });
      requestAnimationFrame(() => document.getElementById('practice-feedback')?.focus());
    } catch (cause) {
      setSubmitError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function advance() {
    if (!view) return;
    const isLast = index === view.questions.length - 1;
    if (isLast || view.attempt.status === 'COMPLETED') {
      const firstOpen = view.questions.findIndex((q) => !view.feedback[q.id]);
      if (firstOpen === -1) return setShowResults(true);
      setIndex(firstOpen);
    } else setIndex(index + 1);
    setSubmitError(null);
    requestAnimationFrame(() => {
      headingRef.current?.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (context.locked) {
    return (
      <Shell context={context}>
        <SetHeader context={context} />
        <LockedPanel context={context} />
      </Shell>
    );
  }

  if (loading) {
    return (
      <Shell context={context}>
        <div className="mt-6 space-y-3" aria-busy="true" aria-label="Đang tải">
          <div className="h-2 animate-pulse rounded-full bg-slate-200" />
          <div className="h-40 animate-pulse rounded-[24px] bg-white" />
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell context={context}>
        <div
          className="mt-6 rounded-[24px] border border-rose-200 bg-white p-6 text-center"
          role="alert"
          data-testid="set-error"
        >
          <p className="text-[17px] font-bold text-[#091224]">Không mở được bộ luyện tập</p>
          <p className="mt-1 text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className={`${primaryClass} mt-4`}
          >
            Thử lại
          </button>
        </div>
      </Shell>
    );
  }

  if (!view) {
    const state = context.state;
    return (
      <Shell context={context}>
        <SetHeader context={context} />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] text-slate-600" data-testid="set-history">
            {state.best
              ? `Kết quả tốt nhất: ${state.best.correct}/${state.best.total} · đã làm ${state.completedCount} lần`
              : 'Em chưa làm bộ này lần nào.'}
          </p>
          {state.inProgress ? (
            <Link
              href={setHref(context.kind, context.chapter.id, state.inProgress.attemptId)}
              className={plus ? plusClass : primaryClass}
              data-testid="set-begin"
            >
              Làm tiếp câu {Math.min(state.inProgress.answered + 1, state.inProgress.total)}{' '}
              <ArrowRight className="size-4" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => void start()}
              disabled={busy}
              className={plus ? plusClass : primaryClass}
              data-testid="set-begin"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {state.best ? 'Làm lại' : 'Bắt đầu'}
            </button>
          )}
        </div>
        {submitError && (
          <p
            className="mt-3 text-sm font-medium text-rose-700"
            role="alert"
            data-testid="set-start-error"
          >
            {submitError}
          </p>
        )}
      </Shell>
    );
  }

  if (showResults || !question) {
    return (
      <Shell context={context}>
        <Results view={view} context={context} busy={busy} onRestart={() => void start()} />
        {submitError && (
          <p className="mt-3 text-center text-sm font-medium text-rose-700" role="alert">
            {submitError}
          </p>
        )}
      </Shell>
    );
  }

  const answered = Object.keys(view.feedback).length;
  const canCheck = isComplete(question, answer) && !busy;
  return (
    <Shell context={context} wide>
      <div className="mt-4 flex items-center gap-3">
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${plus ? 'bg-[#0A1F5C] text-[#F5B83D]' : 'bg-[#EAF1FF] text-[#0052FF]'}`}
        >
          {plus ? 'Tổng hợp' : 'Ôn chương'}
        </span>
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-[#E5EBF3]"
          role="progressbar"
          aria-valuenow={answered}
          aria-valuemin={0}
          aria-valuemax={view.questions.length}
          aria-label="Tiến độ"
        >
          <div
            className={`h-full rounded-full transition-all ${plus ? 'bg-[#0A1F5C]' : 'bg-[#0052FF]'}`}
            style={{ width: `${(answered / view.questions.length) * 100}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-slate-500" data-testid="progress-label">
          {index + 1}/{view.questions.length}
        </span>
      </div>
      <PracticeStage
        questionId={question.id}
        question={
          <section
            className="rounded-[24px] border border-[#E5EBF3] bg-white p-5 sm:p-7"
            data-testid="practice-question"
          >
            <p className="text-[13px] font-medium text-slate-500">
              Câu {index + 1} · {TYPE_HINT[question.type]}
            </p>
            <div
              role="heading"
              aria-level={2}
              ref={headingRef}
              tabIndex={-1}
              className="mt-2 whitespace-pre-line text-[17px] font-semibold leading-8 text-[#091224] focus:outline-none sm:text-[18px]"
            >
              <QuestionPrompt
                questionId={question.id}
                stem={question.stem}
                content={question.content}
              />
            </div>
            <div className="mt-5">
              <QuestionBody
                question={question}
                answer={answer}
                feedback={feedback}
                setAnswer={(next) => setAnswers((all) => ({ ...all, [question.id]: next }))}
                compact
              />
            </div>
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
        }
        feedback={feedback && <FeedbackPanel feedback={feedback} className="" />}
        actions={
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E5EBF3] bg-white/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <div className="mx-auto flex max-w-[720px] justify-end sm:max-w-none">
              {feedback ? (
                <button
                  type="button"
                  onClick={advance}
                  className={`${primaryClass} w-full sm:w-auto`}
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
                  className={`${primaryClass} w-full disabled:bg-slate-300 sm:w-auto`}
                  data-testid="practice-check"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  Kiểm tra
                </button>
              )}
            </div>
          </div>
        }
      />
    </Shell>
  );
}
