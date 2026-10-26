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
import { LessonAssist } from '@/components/learning/lesson-assist';
import { SolutionGuideView } from '@/components/learning/calculator-tutor/solution-guide';
import { QuestionMath, QuestionPrompt } from '@/components/shared/question-content-renderer';
import type { PracticeFeedback, PracticeQuestion } from '@/lib/practice/grading';
import type { AttemptView, LessonPracticeOverview } from '@/lib/practice/practice-service';
import { useStudentShell } from '@/components/student/student-shell';
import { JourneyCheckpoint } from '@/features/roadmap/components/journey-checkpoint';
import { useLessonProgress } from '../lib/lesson-progress';
import {
  lessonHref,
  lessonSummaryHref,
  pickNextStep,
  practiceHref,
  PRACTICE_HREF,
  programHref,
  type PracticeOrigin,
  type StudyScope,
  type Summaries,
} from '../lib/study-plan';
import { nextStepLabel } from './lesson-practice-card';
import { PracticeStage } from './practice-stage';

type Lesson = { id: string; title: string; chapterTitle: string };
export type Answer =
  | { choice?: string; choices?: string[]; statements?: Record<string, boolean>; value?: string }
  | undefined;

export const TYPE_HINT: Record<PracticeQuestion['type'], string> = {
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

export function isComplete(question: PracticeQuestion, answer: Answer): boolean {
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

/** Where the plan goes after this lesson, by the Roadmap's rule; null until reading progress is read. */
type Plan = { href: string; label: string } | null;

/** The lesson's program on the Roadmap. */
const ProgramContext = React.createContext<StudyScope | null>(null);
/** Where this session was opened from: its way back returns there. */
const OriginContext = React.createContext<PracticeOrigin>('roadmap');

/**
 * The page, under its way back. Opened from the lesson, it returns to the
 * lesson's summary, where practice was started; from anywhere else (the
 * Roadmap, a bookmark, a typed URL) it returns to the lesson's journey on the
 * Roadmap. Browser Back follows real history on its own.
 */
function Shell({
  lesson,
  wide = false,
  children,
}: {
  lesson: Lesson;
  /** The question view, which puts the solution beside the question where there is room. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const program = React.useContext(ProgramContext);
  const origin = React.useContext(OriginContext);
  return (
    <div className={`mx-auto w-full pb-28 sm:pb-12 ${wide ? 'max-w-[1180px]' : 'max-w-[720px]'}`}>
      <p className="-mt-12 ml-12 flex min-h-10 items-center md:mt-0 lg:ml-0 lg:min-h-0">
        {origin === 'practice' ? (
          <Link
            href={PRACTICE_HREF}
            className="inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-lg py-1 text-[13px] font-semibold text-slate-500 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            data-testid="practice-back"
            data-origin="practice"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Luyện tập</span>
          </Link>
        ) : origin === 'lesson' ? (
          <Link
            href={lessonSummaryHref(lesson.id)}
            className="inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-lg py-1 text-[13px] font-semibold text-slate-500 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            data-testid="practice-back"
            data-origin="lesson"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{lesson.title}</span>
          </Link>
        ) : (
          <Link
            href={programHref(program)}
            className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-full bg-[#0A1F5C] pl-2.5 pr-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#15307A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            data-testid="practice-back"
            data-origin="roadmap"
          >
            <ArrowLeft className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{program ? `Hành trình ${program.title}` : 'Lộ trình'}</span>
          </Link>
        )}
      </p>
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
      ? 'border-emerald-500 bg-emerald-50'
      : state === 'wrong'
        ? 'border-rose-400 bg-rose-50'
        : state === 'missed'
          ? 'border-emerald-500 bg-white'
          : selected
            ? 'border-[#0052FF] bg-[#F4F8FF] ring-2 ring-[#0052FF]/15'
            : 'border-[#E5EBF3] bg-white hover:border-blue-200 hover:bg-[#F8FAFF]';
  const badge =
    state === 'correct' || state === 'missed'
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
      className={`flex min-h-14 w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 enabled:active:scale-[0.99] motion-reduce:transition-none motion-reduce:enabled:active:scale-100 sm:p-4 ${tone} disabled:cursor-default`}
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
        {state === 'missed' && <span className="sr-only"> (đáp án đúng)</span>}
      </span>
    </button>
  );
}

/** Roughly how long an option reads, without LaTeX markup. */
function visibleLength(content: string) {
  return content
    .replace(/\\[a-zA-Z]+/g, 'x')
    .replace(/[$\\{}]/g, '')
    .trim().length;
}

export function QuestionBody({
  question,
  answer,
  setAnswer,
  feedback,
  compact = false,
}: {
  question: PracticeQuestion;
  answer: Answer;
  setAnswer: (answer: Answer) => void;
  feedback: PracticeFeedback | undefined;
  /** Lay short answer choices out two per row, so the whole question fits on screen. */
  compact?: boolean;
}) {
  const numericId = React.useId();
  const locked = !!feedback;
  const shown = (feedback?.response as Answer) ?? answer;
  const expected = feedback?.answer as Answer;

  if (question.type === 'MULTIPLE_CHOICE_SINGLE' || question.type === 'MULTIPLE_CHOICE_MULTIPLE') {
    const multiple = question.type === 'MULTIPLE_CHOICE_MULTIPLE';
    const picked = multiple ? (shown?.choices ?? []) : shown?.choice ? [shown.choice] : [];
    const right = expected?.choices ?? [];
    return (
      <div
        className={
          compact && question.options.every((option) => visibleLength(option.content) <= 22)
            ? 'grid grid-cols-2 gap-2.5'
            : 'space-y-2.5'
        }
        role={multiple ? 'group' : 'radiogroup'}
      >
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
                    ? 'border-[#E5EBF3] bg-white'
                    : 'border-rose-400 bg-rose-50'
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
                          ? locked
                            ? 'border-slate-300 bg-slate-100 text-[#091224]'
                            : 'border-[#0052FF] bg-[#0052FF] text-white'
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
      <label htmlFor={numericId} className="text-sm font-semibold text-slate-700">
        Đáp án của em
      </label>
      <input
        id={numericId}
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

/** "A" for a missed choice question: the right answer, stated rather than hunted for. */
function rightChoices(feedback: PracticeFeedback): string | null {
  const right = (feedback.answer as Answer)?.choices;
  return right?.length ? right.join(', ') : null;
}

/**
 * One step per line, except that a line inside an unclosed `$…$` or `$$…$$` formula
 * belongs to the step it started in, so the formula still renders.
 */
function solutionLines(text: string): string[] {
  const steps: string[] = [];
  let open = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (open) steps[steps.length - 1] += ` ${line}`;
    else if (line) steps.push(line);
    if ((line.replace(/\\\$/g, '').match(/\$\$|\$/g)?.length ?? 0) % 2 === 1) open = !open;
  }
  return steps.filter(Boolean);
}

/**
 * The worked solution, one line per step, appearing in order so the eye
 * follows the reasoning. Without motion, every step is simply there.
 */
function SolutionSteps({ text }: { text: string }) {
  const steps = solutionLines(text);
  if (steps.length < 2)
    return (
      <div className="mt-2 text-[15px] leading-7 whitespace-pre-line text-slate-800">
        <QuestionMath text={text} />
      </div>
    );
  return (
    <ol className="mt-2 space-y-1" data-testid="solution-steps">
      {steps.map((step, index) => (
        <li key={`${index}-${step}`} className="flex gap-3 text-[15px] leading-7 text-slate-800">
          <span className="w-5 shrink-0 text-right text-slate-400 tabular-nums" aria-hidden="true">
            {index + 1}.
          </span>
          <span className="min-w-0 flex-1">
            <QuestionMath text={step} />
          </span>
        </li>
      ))}
    </ol>
  );
}

export function FeedbackPanel({
  feedback,
  id = 'practice-feedback',
  audience = 'student',
  className = 'mt-5',
  children,
}: {
  feedback: PracticeFeedback;
  id?: string;
  /** Spacing from what comes before it; none when it stands in its own column. */
  className?: string;
  /** Admin previews also see how the solution guide was verified. */
  audience?: 'student' | 'admin';
  /** Extra help under the solution, e.g. "Vì sao em sai?". */
  children?: React.ReactNode;
}) {
  return (
    <div
      id={id}
      tabIndex={-1}
      className={`${className} rounded-[24px] border border-[#E5EBF3] bg-white p-5 outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 sm:p-6`}
      role="status"
      data-testid="feedback"
      data-correct={feedback.correct}
    >
      <p
        className={`text-[16px] font-bold ${feedback.correct ? 'text-emerald-700' : 'text-rose-700'}`}
      >
        {feedback.correct ? 'Chính xác' : 'Chưa đúng'}
        {!feedback.correct && rightChoices(feedback) && (
          <span className="font-semibold text-slate-700" data-testid="answer-comparison">
            {' '}
            · Đáp án đúng là {rightChoices(feedback)}
          </span>
        )}
      </p>
      {feedback.explanation && (
        <div className="mt-4">
          <h3 className="text-[15px] font-semibold text-[#091224]">Lời giải</h3>
          {feedback.guide ? (
            <SolutionGuideView
              guide={feedback.guide}
              explanation={feedback.explanation}
              audience={audience}
              renderSource={(text) => <SolutionSteps text={text} />}
            />
          ) : (
            <SolutionSteps text={feedback.explanation} />
          )}
        </div>
      )}
      {children && <div className="mt-4 border-t border-[#EEF2F7] pt-3">{children}</div>}
    </div>
  );
}

/**
 * The result, then one decision: a primary action and one alternative.
 * - Missed questions: retry those; or reread the lesson first.
 * - All right in a retry of missed questions: that is not a score for the
 *   lesson, so the way to complete it is the whole practice again.
 * - Passed: the plan's next step (same rule as the Roadmap); or the Roadmap,
 *   where the lesson now counts as completed.
 */
function Results({
  view,
  lesson,
  plan,
  summaries,
  onRestart,
  onMistakes,
  busy,
}: {
  view: AttemptView;
  lesson: Lesson;
  plan: Plan;
  summaries: Summaries;
  onRestart: () => void;
  onMistakes: () => void;
  busy: boolean;
}) {
  const program = React.useContext(ProgramContext);
  const { model } = useStudentShell();
  const reading = useLessonProgress(model.identity.id);
  const { attempt, questions, feedback } = view;
  const correct = attempt.correctCount ?? 0;
  const wrong = attempt.totalCount - correct;
  const fixedMistakes = attempt.mode === 'MISTAKES' && wrong === 0;
  const [open, setOpen] = React.useState<string | null>(null);
  // To read the lesson again from the start: the place to understand mistakes.
  const lessonLink = lessonHref(lesson.id);
  const primaryClass =
    'inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-[15px] font-bold text-white hover:bg-[#0044CC] disabled:opacity-60';
  const secondaryClass =
    'inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#D5DEEA] bg-white px-5 text-[15px] font-semibold text-slate-700 hover:bg-slate-50';
  const lessonPassed = attempt.passed && attempt.mode === 'LESSON';
  // The summaries were read when the page opened: count the pass just made.
  const current = summaries[lesson.id];
  const withThisPass: Summaries = lessonPassed
    ? {
        ...summaries,
        [lesson.id]: {
          questionCount: current?.questionCount ?? attempt.totalCount,
          inProgress: null,
          best: { correctCount: correct, totalCount: attempt.totalCount, passed: true },
        },
      }
    : summaries;
  return (
    <div
      data-testid="results"
      data-outcome={lessonPassed ? 'passed' : fixedMistakes ? 'fixed' : 'retry'}
    >
      <section className="mt-4 overflow-hidden rounded-[24px] border border-[#E5EBF3] bg-white text-center">
        {lessonPassed && program && reading && (
          <div className="text-left">
            <JourneyCheckpoint
              program={program}
              progress={reading}
              summaries={withThisPass}
              lessonId={lesson.id}
            />
          </div>
        )}
        <div className="p-6 sm:p-8">
          <span
            className={`mx-auto grid size-16 place-items-center rounded-full ${lessonPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
          >
            {lessonPassed ? <Trophy className="size-8" /> : <RotateCcw className="size-7" />}
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
            {lessonPassed
              ? 'Tốt lắm! Em đã hoàn thành bài này.'
              : fixedMistakes
                ? 'Em đã làm đúng hết các câu từng sai. Làm lại cả bài và đạt 80% để hoàn thành bài này.'
                : wrong === 1
                  ? 'Chỉ còn 1 câu chưa đúng. Xem lời giải bên dưới rồi luyện lại nhé.'
                  : `Còn ${wrong} câu chưa đúng. Xem lời giải bên dưới rồi luyện lại các câu này.`}
          </p>
          <p className="mt-1 text-xs text-slate-400">Kết quả đã được lưu.</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {lessonPassed ? (
              <>
                <Link
                  href={plan?.href ?? programHref(program)}
                  className={primaryClass}
                  data-testid="next-lesson"
                >
                  {plan?.label ?? 'Xem lộ trình của em'} <ArrowRight className="size-4" />
                </Link>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={fixedMistakes ? onRestart : onMistakes}
                  disabled={busy}
                  className={primaryClass}
                  data-testid={fixedMistakes ? 'retry-lesson' : 'retry-mistakes'}
                >
                  <RotateCcw className="size-4" />{' '}
                  {fixedMistakes ? 'Luyện tập lại cả bài' : `Luyện lại ${wrong} câu sai`}
                </button>
                <Link href={lessonLink} className={secondaryClass} data-testid="review-lesson">
                  <BookOpen className="size-4" /> Xem lại bài học
                </Link>
              </>
            )}
          </div>
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
                  <div className="border-t border-[#EEF2F7] px-4 pt-3 pb-4">
                    <QuestionBody
                      question={question}
                      answer={undefined}
                      setAnswer={() => {}}
                      feedback={item}
                    />
                    {item.guide ? (
                      <SolutionGuideView
                        guide={item.guide}
                        explanation={item.explanation}
                        renderSource={(text) => <SolutionSteps text={text} />}
                      />
                    ) : (
                      item.explanation && (
                        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-6 whitespace-pre-line text-slate-700">
                          <QuestionMath text={item.explanation} />
                        </div>
                      )
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
  program,
  origin,
  ...props
}: {
  lesson: Lesson;
  /** The lesson's program on the Roadmap: the next step is chosen from its lessons. */
  program: StudyScope | null;
  origin: PracticeOrigin;
  summaries: Summaries;
  initialAttemptId: string | null;
}) {
  return (
    <ProgramContext.Provider value={program}>
      <OriginContext.Provider value={origin}>
        <PracticeFlow {...props} />
      </OriginContext.Provider>
    </ProgramContext.Provider>
  );
}

function PracticeFlow({
  lesson,
  summaries,
  initialAttemptId,
}: {
  lesson: Lesson;
  summaries: Summaries;
  initialAttemptId: string | null;
}) {
  const router = useRouter();
  const program = React.useContext(ProgramContext);
  const origin = React.useContext(OriginContext);
  const { model } = useStudentShell();
  const reading = useLessonProgress(model.identity.id);
  const nextStep = reading
    ? pickNextStep(program?.lessons ?? [], reading, summaries, {
        exclude: lesson.id,
        currentScore: model.learning?.currentScore,
      })
    : null;
  const plan: Plan = nextStep ? { href: nextStep.href, label: nextStepLabel(nextStep) } : null;
  const [view, setView] = React.useState<AttemptView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [overview, setOverview] = React.useState<LessonPracticeOverview | null>(null);
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
        const lessonOverview = await api<LessonPracticeOverview>(
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

  /** Back to the session the student left: the answers given so far are kept on the server. */
  async function resume(attemptId: string) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const loaded = await api<AttemptView>(`/api/student/practice/attempts/${attemptId}`);
      shownAttemptId.current = loaded.attempt.id;
      setAnswers({});
      setView(loaded);
      const firstOpen = loaded.questions.findIndex((q) => !loaded.feedback[q.id]);
      setIndex(firstOpen === -1 ? 0 : firstOpen);
      setShowResults(loaded.attempt.status === 'COMPLETED');
      router.replace(practiceHref(lesson.id, loaded.attempt.id, origin), { scroll: true });
    } catch (cause) {
      setSubmitError((cause as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

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
      // The attempt id in the address keeps refresh and back navigation on
      // this attempt; replacing the entry keeps one history step per visit.
      router.replace(practiceHref(lesson.id, started.attempt.id, origin), { scroll: true });
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
    const open = overview?.inProgress ?? null;
    const best = overview?.best ?? null;
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
              {(best || open) && (
                <p className="mt-4 text-sm text-slate-600" data-testid="practice-history">
                  {best
                    ? `Kết quả tốt nhất của em: ${best.correctCount ?? 0}/${best.totalCount}${best.passed ? ' · đã hoàn thành' : ''}. `
                    : ''}
                  {open
                    ? `Em đang làm dở: đã trả lời ${open.answeredCount}/${open.totalCount} câu.`
                    : `Đã làm ${overview?.completedCount ?? 0} lượt.`}
                </p>
              )}
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                {open && (
                  <button
                    type="button"
                    onClick={() => void resume(open.id)}
                    disabled={submitting}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-[15px] font-bold text-white hover:bg-[#0044CC] disabled:opacity-60 sm:w-auto"
                    data-testid="practice-resume"
                  >
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                    Làm tiếp ({open.answeredCount}/{open.totalCount})
                    <ArrowRight className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void start('LESSON')}
                  disabled={submitting}
                  className={
                    open
                      ? 'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#D5DEEA] bg-white px-5 text-[15px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 sm:w-auto'
                      : 'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-6 text-[15px] font-bold text-white hover:bg-[#0044CC] disabled:opacity-60 sm:w-auto'
                  }
                  data-testid="practice-begin"
                >
                  {submitting && !open ? <Loader2 className="size-4 animate-spin" /> : null}
                  {open ? 'Làm lượt mới' : best ? 'Luyện lại' : 'Bắt đầu'}
                </button>
              </div>
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
          plan={plan}
          summaries={summaries}
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
    <Shell lesson={lesson} wide>
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
            className="h-full rounded-full bg-[#0052FF] transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
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
              aria-level={1}
              ref={headingRef}
              tabIndex={-1}
              className="mt-2 text-[17px] leading-8 font-semibold whitespace-pre-line text-[#091224] focus:outline-none sm:text-[18px]"
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
        feedback={
          feedback && (
            <FeedbackPanel feedback={feedback} className="">
              {!feedback.correct && (
                <LessonAssist
                  key={question.id}
                  target={{ kind: 'practice', attemptId: view.attempt.id, questionId: question.id }}
                  topic={`Câu ${index + 1}`}
                  label="Vì sao em sai?"
                />
              )}
            </FeedbackPanel>
          )
        }
        actions={
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#E5EBF3] bg-white/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <div className="mx-auto flex max-w-[720px] justify-end sm:max-w-none">
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
        }
      />
    </Shell>
  );
}
