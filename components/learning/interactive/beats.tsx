'use client';

import * as React from 'react';
import { Check, ChevronDown, Lightbulb, Sparkles, X } from 'lucide-react';
import {
  FRESH_ATTEMPT,
  answer,
  askHint,
  outcomeOf,
  type Attempt,
} from '@/lib/learning/interactive-lesson';
import { recordActivityOutcome } from '@/features/lessons/lib/lesson-progress';
import { InlineText, RichText } from '../rich-text';
import { playChime } from './sound';

/**
 * The pieces every interactive part is made of: a beat (one question or one
 * task at a time), answer choices with immediate feedback, hints that open
 * one level at a time, and the card that names what the student just found.
 */

export interface LessonRuntime {
  lessonId: string;
  /** Null in the admin preview: nothing is saved. */
  studentKey: string | null;
  /** Re-reading a finished part: every activity shows its answer. */
  review: boolean;
  sound: boolean;
}

export const RuntimeContext = React.createContext<LessonRuntime>({
  lessonId: '',
  studentKey: null,
  review: false,
  sound: false,
});

/**
 * One activity's attempts. When it is answered (or shown after three misses)
 * the outcome is saved with the lesson progress, keeping the best one.
 */
export function useAttempt(activityId: string, maxHints = 2) {
  const runtime = React.useContext(RuntimeContext);
  const [state, setState] = React.useState<Attempt>(() =>
    runtime.review ? { misses: 0, hints: 0, status: 'correct' } : FRESH_ATTEMPT
  );
  const saved = React.useRef(runtime.review);
  React.useEffect(() => {
    const outcome = outcomeOf(state);
    if (!outcome || saved.current) return;
    saved.current = true;
    if (runtime.studentKey) {
      recordActivityOutcome(runtime.studentKey, runtime.lessonId, activityId, outcome);
    }
    if (runtime.sound && outcome !== 'revealed') playChime('correct');
  }, [state, activityId, runtime]);
  return {
    state,
    done: state.status !== 'open',
    submit: (correct: boolean) => {
      setState((current) => answer(current, correct, maxHints));
      if (!correct && runtime.sound) playChime('miss');
    },
    hint: () => setState((current) => askHint(current, maxHints)),
    /** For tasks that have no wrong answer (exploring): close it as done. */
    complete: () =>
      setState((current) =>
        current.status === 'open' ? { ...current, status: 'correct' } : current
      ),
  };
}

// ─── Beat ────────────────────────────────────────────────────────────────────

/** Which beat was answered last in a part, so only that one stays unfolded. */
export const BeatFocus = React.createContext<{ latest: number; bump: () => number }>({
  latest: 0,
  bump: () => 0,
});

export function BeatFocusProvider({ children }: { children: React.ReactNode }) {
  const [latest, setLatest] = React.useState(0);
  const counter = React.useRef(0);
  const value = React.useMemo(
    () => ({
      latest,
      bump: () => {
        counter.current += 1;
        setLatest(counter.current);
        return counter.current;
      },
    }),
    [latest]
  );
  return <BeatFocus.Provider value={value}>{children}</BeatFocus.Provider>;
}

/**
 * One step of a part. The active beat is open; a finished beat folds into one
 * line that can be reopened; later beats are not shown yet.
 */
export function Beat({
  number,
  title,
  status,
  summary,
  children,
  testId,
}: {
  number: number;
  title: string;
  status: 'active' | 'done';
  summary?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
}) {
  const focus = React.useContext(BeatFocus);
  const [toggled, setOpen] = React.useState<boolean | null>(null);
  const [finishedAs, setFinishedAs] = React.useState<number | null>(null);
  const was = React.useRef(status);
  React.useEffect(() => {
    // The beat just answered stays open (its feedback is worth reading) until the next one is.

    if (was.current === 'active' && status === 'done') setFinishedAs(focus.bump());
    was.current = status;
  }, [status, focus]);
  const open = toggled ?? (finishedAs !== null && finishedAs === focus.latest);
  if (status === 'done') {
    return (
      <div
        className="rounded-2xl border border-slate-200 bg-white"
        data-testid={testId}
        data-beat="done"
      >
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
            <Check className="size-3.5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 text-[14px] leading-5 text-slate-700">
            {summary ?? <InlineText text={title} />}
          </span>
          <ChevronDown
            className={`size-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        {open && <div className="border-t border-slate-100 px-4 pb-4 pt-3">{children}</div>}
      </div>
    );
  }
  return (
    <section
      className="tt-rise rounded-2xl border border-blue-200 bg-white p-4 shadow-[0_10px_30px_rgba(0,82,255,0.08)] ring-1 ring-blue-100 sm:p-5"
      aria-label={title}
      data-testid={testId}
      data-beat="active"
    >
      <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-blue-600">
        <span className="grid size-5 place-items-center rounded-full bg-blue-600 text-[11px] text-white">
          {number}
        </span>
        <InlineText text={title} />
      </p>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

export function Prompt({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[16px] font-semibold leading-7 text-[#091224] sm:text-[17px]">
      {children}
    </div>
  );
}

// ─── Choices ─────────────────────────────────────────────────────────────────

export interface Choice {
  id: string;
  label: React.ReactNode;
  correct: boolean;
  /** Said when this wrong option is picked. */
  why?: string;
}

/**
 * Answer buttons. A wrong pick is marked and stays marked while the student
 * tries again; the right one turns green and closes the question.
 */
export function Choices({
  choices,
  attempt,
  onAnswer,
  columns = 1,
  testId,
}: {
  choices: Choice[];
  attempt: ReturnType<typeof useAttempt>;
  onAnswer?: (choice: Choice) => void;
  columns?: 1 | 2 | 3;
  testId?: string;
}) {
  const [picked, setPicked] = React.useState<string[]>([]);
  const closed = attempt.done;
  const grid = columns === 3 ? 'grid-cols-3' : columns === 2 ? 'grid-cols-2' : 'grid-cols-1';
  return (
    <div className={`mt-3 grid gap-2 ${grid}`} role="group" data-testid={testId}>
      {choices.map((choice) => {
        const chosen = picked.includes(choice.id);
        const showRight = closed && choice.correct;
        const wrong = chosen && !choice.correct;
        return (
          <button
            key={choice.id}
            type="button"
            disabled={closed || wrong}
            onClick={() => {
              setPicked((current) => [...current, choice.id]);
              attempt.submit(choice.correct);
              onAnswer?.(choice);
            }}
            className={`group flex min-h-12 items-center gap-2.5 rounded-xl border-2 px-3.5 py-2 text-left text-[15px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
              showRight
                ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                : wrong
                  ? 'border-amber-300 bg-amber-50 text-amber-900 line-through decoration-amber-400/70'
                  : closed
                    ? 'border-slate-200 bg-white text-slate-400'
                    : 'border-slate-200 bg-white text-[#091224] hover:-translate-y-px hover:border-blue-400 hover:shadow-[0_6px_16px_rgba(0,82,255,0.12)] active:translate-y-0'
            }`}
            data-testid={`choice-${choice.id}`}
          >
            <span className="min-w-0 flex-1">{choice.label}</span>
            {showRight && (
              <Check className="tt-pop size-5 shrink-0 text-emerald-600" aria-hidden="true" />
            )}
            {wrong && <X className="size-4 shrink-0 text-amber-600" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Feedback and hints ──────────────────────────────────────────────────────

export function Feedback({
  tone,
  title,
  children,
  testId = 'feedback',
}: {
  tone: 'right' | 'wrong' | 'shown' | 'info';
  title?: string;
  children?: React.ReactNode;
  testId?: string;
}) {
  const styles = {
    right: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    wrong: 'border-amber-200 bg-amber-50 text-amber-950',
    shown: 'border-sky-200 bg-sky-50 text-sky-950',
    info: 'border-slate-200 bg-slate-50 text-slate-800',
  }[tone];
  return (
    <div
      className={`tt-rise mt-3 rounded-xl border px-4 py-3 text-[15px] leading-6 ${styles}`}
      role="status"
      data-testid={testId}
      data-tone={tone}
    >
      {title && <p className="font-bold">{title}</p>}
      {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
    </div>
  );
}

/** Feedback for a closed attempt: right, or shown after three misses. */
export function Outcome({
  attempt,
  right,
  shown,
}: {
  attempt: ReturnType<typeof useAttempt>;
  right: React.ReactNode;
  shown?: React.ReactNode;
}) {
  if (attempt.state.status === 'correct') {
    const help = attempt.state.misses > 0 || attempt.state.hints > 0;
    return (
      <Feedback tone="right" title={help ? 'Đúng rồi!' : 'Chính xác, em tự tìm ra!'}>
        {right}
      </Feedback>
    );
  }
  if (attempt.state.status === 'revealed') {
    return (
      <Feedback tone="shown" title="Không sao, mình cùng xem đáp án nhé.">
        {shown ?? right}
      </Feedback>
    );
  }
  return null;
}

/**
 * Hints, one level at a time. A miss opens the next one on its own; the
 * student can also ask before answering.
 */
export function Hints({
  attempt,
  hints,
  extra,
}: {
  attempt: ReturnType<typeof useAttempt>;
  hints: React.ReactNode[];
  /** Said right after a wrong pick, before the general hints. */
  extra?: React.ReactNode;
}) {
  if (attempt.done) return null;
  const shown = hints.slice(0, attempt.state.hints);
  const more = attempt.state.hints < hints.length;
  return (
    <div className="mt-3 space-y-2" data-testid="hints">
      {extra && (
        <Feedback tone="wrong" title="Chưa đúng, thử lại nhé.">
          {extra}
        </Feedback>
      )}
      {shown.map((hint, index) => (
        <div
          key={index}
          className="tt-rise flex gap-2.5 rounded-xl bg-amber-50/70 px-3.5 py-2.5 text-[14px] leading-6 text-amber-950"
          data-testid={`hint-${index + 1}`}
        >
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
          <div>
            <span className="font-bold">Gợi ý {index + 1}: </span>
            {hint}
          </div>
        </div>
      ))}
      {more && (
        <button
          type="button"
          onClick={attempt.hint}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-[14px] font-semibold text-amber-700 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          data-testid="ask-hint"
        >
          <Lightbulb className="size-4" aria-hidden="true" />
          {shown.length ? 'Thêm gợi ý' : 'Gợi ý'}
        </button>
      )}
    </div>
  );
}

// ─── Discovery ───────────────────────────────────────────────────────────────

/**
 * "Em vừa tìm ra …": the formal statement, in the admin's words, arriving
 * right after the student found it on the graph. Inline, never a modal.
 */
export function DiscoveryCard({
  title,
  lead,
  children,
  testId = 'discovery',
}: {
  title: string;
  lead?: string | null;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="tt-rise relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0A1F5C] via-[#0F2D7A] to-[#0052FF] p-[1.5px] shadow-[0_18px_40px_rgba(0,82,255,0.25)]"
      data-testid={testId}
    >
      <div className="rounded-[15px] bg-white px-4 py-4 sm:px-5">
        <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-blue-600">
          <Sparkles className="size-4" aria-hidden="true" /> Em vừa tìm ra
        </p>
        <h3 className="mt-1 text-[18px] font-extrabold leading-snug text-[#091224]">
          <InlineText text={title} />
        </h3>
        {lead && (
          <p className="mt-1 text-[14px] italic leading-6 text-slate-500">
            <InlineText text={lead} />
          </p>
        )}
        <div className="mt-2 text-[15px] leading-7 text-slate-800">{children}</div>
      </div>
    </div>
  );
}

/** The admin's own step text, shown after the student has done the step. */
export function ModelStep({ label, body }: { label: string | null; body: string }) {
  return (
    <div
      className="tt-rise mt-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3"
      data-testid="model-step"
    >
      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-slate-500">
        Lời giải mẫu{label ? ` · ${label}` : ''}
      </p>
      <RichText content={body} className="mt-1 text-[15px] leading-7 text-slate-800" />
    </div>
  );
}
