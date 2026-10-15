'use client';

import * as React from 'react';
import { ArrowRight, CheckCircle2, Lightbulb, Loader2, XCircle } from 'lucide-react';
import { QuestionMath } from '@/components/shared/question-content-renderer';
import {
  QuestionBody,
  TYPE_HINT,
  isComplete,
  type Answer,
} from '@/features/lessons/components/practice-session';
import type { PracticeFeedback, PracticeQuestion } from '@/lib/practice/grading';
import { LessonAssist } from './lesson-assist';
import { InlineText } from './rich-text';

/**
 * "Đến lượt em": the lesson's own published practice questions, one at a time,
 * as an exercise rather than a list. The question and its answers come first;
 * beside them (below on phones) sits what the student needs at that moment:
 * an optional hint before answering, then the result, the worked solution,
 * the traps for this kind of problem and "Vì sao em sai?". The server grades
 * each answer; nothing is stored, so this is a check, not a score.
 */
export function QuickCheck({
  lessonId,
  questions,
  onAnswered,
  hint,
  traps = [],
}: {
  lessonId: string;
  questions: PracticeQuestion[];
  /** Called with the number of questions answered so far. */
  onAnswered?: (count: number) => void;
  /** The lesson's method, offered on request before the student answers. */
  hint?: { title: string; steps: string[] } | null;
  /** The lesson's common mistakes, shown with the solution once the student has tried. */
  traps?: string[];
}) {
  const [feedback, setFeedback] = React.useState<Record<string, PracticeFeedback>>({});
  const [active, setActive] = React.useState(0);
  const box = React.useRef<HTMLDivElement>(null);
  const answered = Object.keys(feedback).length;
  React.useEffect(() => {
    if (answered) onAnswered?.(answered);
  }, [answered, onAnswered]);

  if (!questions.length) return null;
  const total = questions.length;

  const go = (index: number) => {
    setActive(index);
    window.requestAnimationFrame(() => {
      const rect = box.current?.getBoundingClientRect();
      if (rect && rect.top < 0) box.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById(`check-stem-${questions[index].id}`)?.focus({ preventScroll: true });
    });
  };
  const nextOpen = (from: number) => {
    for (let step = 1; step < total; step += 1) {
      const index = (from + step) % total;
      if (!feedback[questions[index].id]) return index;
    }
    return null;
  };

  return (
    <div
      ref={box}
      className="scroll-mt-20 rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_3px_rgba(9,18,36,0.05)] lg:scroll-mt-6"
      data-testid="exercise"
      data-active={active}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2 sm:px-6">
        <p className="min-w-0 truncate text-[13px] text-slate-500">
          {total > 1 && (
            <span className="font-bold text-[#091224]">
              Câu {active + 1}/{total}
              <span className="font-normal text-slate-400"> · </span>
            </span>
          )}
          {TYPE_HINT[questions[active].type]}
        </p>
        {total > 1 && (
          <ol className="flex shrink-0 gap-1.5" aria-label="Các câu">
            {questions.map((question, index) => {
              const result = feedback[question.id];
              const status = result ? (result.correct ? 'đã đúng' : 'chưa đúng') : 'chưa làm';
              return (
                <li key={question.id}>
                  <button
                    type="button"
                    onClick={() => go(index)}
                    aria-current={index === active ? 'step' : undefined}
                    aria-label={`Câu ${index + 1} (${status})`}
                    className={`grid size-9 place-items-center rounded-full text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      result
                        ? result.correct
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                        : index === active
                          ? 'bg-[#091224] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    } ${index === active ? 'ring-2 ring-[#091224]/80 ring-offset-2' : ''}`}
                    data-testid={`check-tab-${index}`}
                  >
                    {result ? (
                      result.correct ? (
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                      ) : (
                        <XCircle className="size-4" aria-hidden="true" />
                      )
                    ) : (
                      index + 1
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      {questions.map((question, index) => (
        <CheckQuestion
          key={question.id}
          hidden={index !== active}
          lessonId={lessonId}
          question={question}
          label={total > 1 ? `Câu ${index + 1}` : 'Câu hỏi'}
          feedback={feedback[question.id]}
          hint={hint}
          traps={traps}
          next={nextOpen(index)}
          onNext={go}
          onFeedback={(result) => setFeedback((current) => ({ ...current, [question.id]: result }))}
        />
      ))}
    </div>
  );
}

function CheckQuestion({
  hidden,
  lessonId,
  question,
  label,
  feedback,
  hint,
  traps,
  next,
  onNext,
  onFeedback,
}: {
  hidden: boolean;
  lessonId: string;
  question: PracticeQuestion;
  label: string;
  feedback: PracticeFeedback | undefined;
  hint?: { title: string; steps: string[] } | null;
  traps: string[];
  /** The next question not answered yet, if any. */
  next: number | null;
  onNext: (index: number) => void;
  onFeedback: (feedback: PracticeFeedback) => void;
}) {
  const [answer, setAnswer] = React.useState<Answer>(undefined);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const feedbackId = `check-feedback-${question.id}`;
  const showHint = !feedback && !!hint?.steps.length;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/student/lessons/${encodeURIComponent(lessonId)}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, response: answer }),
      });
      const body = (await response.json().catch(() => ({}))) as PracticeFeedback & {
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? 'Chưa chấm được câu này. Em thử lại nhé.');
      onFeedback(body);
      window.requestAnimationFrame(() => {
        const panel = document.getElementById(feedbackId);
        panel?.focus({ preventScroll: true });
        const rect = panel?.getBoundingClientRect();
        if (rect && rect.top > window.innerHeight - 160) {
          panel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      hidden={hidden}
      className={`gap-x-8 gap-y-5 p-4 sm:p-6 ${
        hidden ? '' : 'grid'
      } ${feedback || showHint ? '@4xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]' : ''}`}
      data-testid="quick-check"
      data-answered={!!feedback}
    >
      <div className="min-w-0">
        <h3
          id={`check-stem-${question.id}`}
          tabIndex={-1}
          className="text-[17px] font-medium leading-8 text-[#091224] focus:outline-none sm:text-[18px]"
        >
          <InlineText text={question.stem} />
        </h3>
        <div className="mt-4">
          <QuestionBody
            question={question}
            answer={answer}
            setAnswer={setAnswer}
            feedback={feedback}
            compact
          />
        </div>
        {!feedback && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!isComplete(question, answer) || busy}
              onClick={() => void submit()}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#091224] px-6 text-[15px] font-bold text-white transition hover:bg-[#1c2740] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
              data-testid="check-submit"
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Kiểm tra
            </button>
            {!isComplete(question, answer) && (
              <span className="text-[13px] text-slate-500">Chọn đáp án rồi bấm Kiểm tra.</span>
            )}
            {error && (
              <p role="alert" className="text-sm font-medium text-rose-700">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
      {showHint && hint && <Hint title={hint.title} steps={hint.steps} />}
      {feedback && (
        <Feedback
          id={feedbackId}
          feedback={feedback}
          question={question}
          label={label}
          traps={traps}
          next={next === null ? null : { label: `Câu ${next + 1}`, go: () => onNext(next) }}
        />
      )}
    </div>
  );
}

/** Before answering: the lesson's method, only if the student asks for it. */
function Hint({ title, steps }: { title: string; steps: string[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="self-start rounded-2xl bg-slate-50 p-4" data-testid="exercise-hint">
      <p className="flex items-center gap-2 text-[14px] font-semibold text-slate-800">
        <Lightbulb className="size-4 text-amber-500" aria-hidden="true" />
        Chưa biết bắt đầu từ đâu?
      </p>
      {!open ? (
        <>
          <p className="mt-1 text-[13px] leading-5 text-slate-500">
            Em cứ thử trước, sai cũng không sao. Cần thì xem lại các bước làm của bài.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={false}
            className="mt-3 inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3.5 text-[14px] font-semibold text-slate-700 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            data-testid="exercise-hint-open"
          >
            Xem gợi ý
          </button>
        </>
      ) : (
        <>
          <ol className="mt-2 space-y-1.5" aria-label={title}>
            {steps.map((step, index) => (
              <li key={index} className="flex gap-2.5 text-[14px] leading-6 text-slate-800">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-blue-700 ring-1 ring-blue-100">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <InlineText text={step} />
                </span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-expanded
            className="mt-2 text-[13px] font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
          >
            Ẩn gợi ý
          </button>
        </>
      )}
    </div>
  );
}

/** After answering: result, solution, help and the traps of this kind of problem. */
function Feedback({
  id,
  feedback,
  question,
  label,
  traps,
  next,
}: {
  id: string;
  feedback: PracticeFeedback;
  question: PracticeQuestion;
  label: string;
  traps: string[];
  next: { label: string; go: () => void } | null;
}) {
  const expected = (feedback.answer as Answer)?.choices;
  const single = question.type === 'MULTIPLE_CHOICE_SINGLE' && expected?.length === 1;
  return (
    <div
      id={id}
      tabIndex={-1}
      role="status"
      className="min-w-0 self-start outline-none"
      data-testid="feedback"
      data-correct={feedback.correct}
    >
      <div
        className={`flex items-start gap-3 rounded-2xl px-4 py-3 ${
          feedback.correct ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'
        }`}
      >
        {feedback.correct ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" />
        ) : (
          <XCircle className="mt-0.5 size-5 shrink-0 text-rose-600" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="text-[16px] font-bold">{feedback.correct ? 'Chính xác!' : 'Chưa đúng'}</p>
          {!feedback.correct && single && (
            <p className="text-[14px]">Đáp án đúng là {expected?.[0]}. Xem lời giải bên dưới.</p>
          )}
        </div>
      </div>
      {feedback.explanation && (
        <div className="mt-4 px-1">
          <p className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Lời giải</p>
          <div className="mt-1 whitespace-pre-line text-[15px] leading-7 text-slate-800">
            <QuestionMath text={feedback.explanation} />
          </div>
        </div>
      )}
      {!feedback.correct && (
        <LessonAssist
          className="mt-2"
          target={{ kind: 'check', questionId: question.id, response: feedback.response }}
          topic={label}
          label="Vì sao em sai?"
        />
      )}
      {traps.length > 0 && (
        <div className="mt-4 border-l-2 border-amber-400 pl-3" data-testid="check-traps">
          <p className="text-[13px] font-bold text-amber-900">Bẫy hay gặp ở dạng bài này</p>
          <ul className="mt-1 space-y-1 text-[14px] leading-6 text-slate-700">
            {traps.map((item, index) => (
              <li key={index} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2.5 size-1 shrink-0 rounded-full bg-amber-500"
                />
                <span className="min-w-0">
                  <InlineText text={item} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!next && (
        <p className="mt-5 text-[14px] text-slate-500" data-testid="check-all-done">
          Em đã làm hết các câu. Bấm Tiếp tục để sang phần cuối.
        </p>
      )}
      {next && (
        <button
          type="button"
          onClick={next.go}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#091224] px-5 text-[15px] font-bold text-white hover:bg-[#1c2740] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          data-testid="check-next"
        >
          Làm {next.label.toLowerCase()} <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
