'use client';

import * as React from 'react';
import { CheckCircle2, ChevronRight, LifeBuoy, Loader2, ShieldCheck, X } from 'lucide-react';
import type { AssistHelp, AssistTarget } from '@/lib/learning/lesson-assist';
import { FunctionGraph, VariationTable } from './function-graph';
import { InlineText, RichText } from './rich-text';

/**
 * "Chưa hiểu chỗ này?": a quiet link beside an idea, a worked example or an
 * answered question. Asking opens help right there, under the spot the
 * student is stuck on, and "Đã hiểu" closes it again. The AI is called only
 * when the student asks, once per spot (answers are kept for this visit).
 */

export interface AssistSettings {
  lessonId: string;
  /** The article version the page was rendered from. */
  contentVersion: string;
  /** False when the server has no AI configured: the link then opens the lesson's own help. */
  available: boolean;
}

export const AssistContext = React.createContext<AssistSettings | null>(null);

/** Enables the assistant links below it (the lesson page and the practice page). */
export function AssistProvider({
  settings,
  children,
}: {
  settings: AssistSettings;
  children: React.ReactNode;
}) {
  return <AssistContext.Provider value={settings}>{children}</AssistContext.Provider>;
}

type State =
  | { kind: 'closed' }
  | { kind: 'loading' }
  | { kind: 'ready'; help: AssistHelp }
  | { kind: 'error'; message: string; retry: boolean };

/** Answers already given in this visit, so reopening costs nothing. */
const answers = new Map<string, AssistHelp>();

export function LessonAssist({
  target,
  topic,
  label = 'Chưa hiểu chỗ này?',
  fallback,
  className = '',
}: {
  target: AssistTarget;
  /** What the help is about, e.g. the idea's title. */
  topic: string;
  label?: string;
  /** The lesson's own material, shown when the assistant is unavailable. */
  fallback?: React.ReactNode;
  className?: string;
}) {
  const settings = React.useContext(AssistContext);
  const [state, setState] = React.useState<State>({ kind: 'closed' });
  const controller = React.useRef<AbortController | null>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const panelId = React.useId();
  const key = settings
    ? `${settings.lessonId}|${settings.contentVersion}|${JSON.stringify(target)}`
    : '';

  React.useEffect(() => () => controller.current?.abort(), []);
  if (!settings) return null;

  const open = state.kind !== 'closed';

  async function ask() {
    if (!settings) return;
    const known = answers.get(key);
    if (known) return show({ kind: 'ready', help: known });
    if (!settings.available) {
      return show({
        kind: 'error',
        message: 'Trợ lý chưa được bật. Em xem lại phần giải thích có sẵn của bài nhé.',
        retry: false,
      });
    }
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    show({ kind: 'loading' });
    try {
      const response = await fetch(
        `/api/student/lessons/${encodeURIComponent(settings.lessonId)}/assist`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target, contentVersion: settings.contentVersion }),
          signal: request.signal,
        }
      );
      const body = (await response.json().catch(() => ({}))) as {
        help?: AssistHelp;
        error?: string;
        code?: string;
      };
      if (!response.ok || !body.help) {
        const code = body.code ?? '';
        setState({
          kind: 'error',
          message: body.error ?? 'Trợ lý chưa trả lời được.',
          retry: !['UNAVAILABLE', 'RATE_LIMITED', 'STALE', 'FORBIDDEN', 'UNAUTHORIZED'].includes(
            code
          ),
        });
        return;
      }
      answers.set(key, body.help);
      setState({ kind: 'ready', help: body.help });
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      setState({ kind: 'error', message: 'Mất kết nối tới trợ lý.', retry: true });
    }
  }

  function show(next: State) {
    setState(next);
    window.requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }));
  }

  function close() {
    controller.current?.abort();
    setState({ kind: 'closed' });
    window.requestAnimationFrame(() => trigger.current?.focus());
  }

  return (
    <div className={className} data-testid="assist" data-state={state.kind}>
      {!open && (
        <button
          ref={trigger}
          type="button"
          onClick={() => void ask()}
          aria-expanded={false}
          aria-controls={panelId}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-1 text-[14px] font-semibold text-slate-500 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          data-testid="assist-open"
        >
          <LifeBuoy className="size-4" aria-hidden="true" />
          {label}
        </button>
      )}
      {open && (
        <div
          id={panelId}
          ref={panel}
          tabIndex={-1}
          role="region"
          aria-label={`Trợ giúp: ${topic}`}
          className="rounded-2xl border border-blue-100 bg-[#F6F9FF] p-3.5 outline-none sm:p-5"
          data-testid="assist-panel"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2 text-[13px] font-bold uppercase tracking-[0.1em] text-blue-700">
              <LifeBuoy className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">
                Gỡ rối · <InlineText text={topic} />
              </span>
            </p>
            <button
              type="button"
              onClick={close}
              className="-m-1 grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Đóng trợ giúp, quay lại bài"
              data-testid="assist-close"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          {state.kind === 'loading' && (
            <p
              className="mt-3 flex items-center gap-2 text-[15px] text-slate-600"
              aria-live="polite"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Đang tìm cách giải thích dễ hơn…
            </p>
          )}
          {state.kind === 'error' && (
            <div className="mt-3" role="alert" data-testid="assist-error">
              <p className="text-[15px] leading-6 text-slate-700">{state.message}</p>
              {fallback && (
                <div className="mt-3 rounded-xl bg-white p-4" data-testid="assist-fallback">
                  <p className="text-[13px] font-bold text-slate-500">Xem lại trong bài</p>
                  <div className="mt-1">{fallback}</div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {state.retry && (
                  <button
                    type="button"
                    onClick={() => void ask()}
                    className="inline-flex h-10 items-center rounded-xl bg-[#091224] px-4 text-[14px] font-bold text-white hover:bg-[#1c2740] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    Thử lại
                  </button>
                )}
                <BackButton onClick={close} />
              </div>
            </div>
          )}
          {state.kind === 'ready' && <HelpBody help={state.help} onDone={close} />}
        </div>
      )}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[14px] font-semibold text-slate-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      data-testid="assist-done"
    >
      <CheckCircle2 className="size-4" aria-hidden="true" /> Đã hiểu, quay lại bài
    </button>
  );
}

/**
 * One idea at a time: a simpler explanation and the key point first, then the
 * reasoning step by step on request, then one question to check.
 */
function HelpBody({ help, onDone }: { help: AssistHelp; onDone: () => void }) {
  const explanation = help.explanation;
  const steps = explanation?.steps ?? help.verifiedSteps ?? [];
  // Verified walk-throughs are short and correct by construction: show them whole.
  const [shown, setShown] = React.useState(explanation ? 0 : steps.length);
  const [answerOpen, setAnswerOpen] = React.useState(false);
  const stepRefs = React.useRef<Array<HTMLLIElement | null>>([]);
  const allShown = shown >= steps.length;
  const reveal = (count: number) => {
    setShown(count);
    window.requestAnimationFrame(() => stepRefs.current[count - 1]?.focus());
  };
  const check = explanation?.checkQuestion;

  return (
    <div className="mt-3 space-y-4" data-testid="assist-help" data-math={help.math.status}>
      {help.notice && (
        <p
          className="rounded-xl bg-amber-50 px-4 py-3 text-[14px] leading-6 text-amber-900"
          data-testid="assist-notice"
        >
          {help.notice}
        </p>
      )}
      {explanation && (
        <>
          <RichText
            content={explanation.summary}
            className="text-[16px] leading-7 text-slate-800"
          />
          <p className="rounded-xl border-l-4 border-blue-500 bg-white px-4 py-3 text-[16px] font-semibold leading-7 text-[#091224]">
            <InlineText text={explanation.keyIdea} />
          </p>
        </>
      )}
      {help.visual && (
        <div data-testid="assist-visual" data-kind={help.visual.kind}>
          {help.visual.kind === 'table' ? (
            <VariationTable source={help.visual.source} />
          ) : (
            <FunctionGraph source={help.visual.source} layer="derivative" />
          )}
          <p className="mt-1.5 flex items-center gap-1.5 px-1 text-[13px] text-emerald-800">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Hình này do Tú Tài tự tính từ hàm số, không phải do AI vẽ.
          </p>
        </div>
      )}
      {steps.length > 0 && (
        <div>
          {!explanation && (
            <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-emerald-800">
              <ShieldCheck className="size-4" aria-hidden="true" /> Lời giải Tú Tài đã tự tính
            </p>
          )}
          {shown > 0 && (
            <ol className="space-y-3" data-testid="assist-steps" data-shown={shown}>
              {steps.slice(0, shown).map((step, index) => (
                <li
                  key={index}
                  ref={(element) => {
                    stepRefs.current[index] = element;
                  }}
                  tabIndex={-1}
                  className="relative pl-10 focus:outline-none"
                >
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-0.5 grid size-7 place-items-center rounded-full bg-white text-[13px] font-bold text-blue-700 ring-1 ring-blue-100"
                  >
                    {index + 1}
                  </span>
                  <p className="text-[14px] font-bold text-[#091224]">
                    <InlineText text={step.title} />
                  </p>
                  <RichText
                    content={step.detail}
                    className="text-[15px] leading-7 text-slate-700"
                  />
                </li>
              ))}
            </ol>
          )}
          {!allShown && (
            <button
              type="button"
              onClick={() => reveal(shown + 1)}
              className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#091224] px-4 text-[14px] font-bold text-white hover:bg-[#1c2740] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              data-testid="assist-next-step"
            >
              {shown === 0
                ? `Giải thích từng bước (${steps.length} bước)`
                : `Bước tiếp theo (${shown + 1}/${steps.length})`}
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      {check && allShown && (
        <div className="rounded-xl bg-white p-4" data-testid="assist-check">
          <p className="text-[13px] font-bold text-slate-500">Thử trả lời trong đầu</p>
          <div className="mt-1 text-[15px] leading-7 text-[#091224]">
            <InlineText text={check.question} />
          </div>
          {answerOpen ? (
            <RichText
              content={check.answer}
              className="mt-2 text-[15px] leading-7 text-slate-700"
            />
          ) : (
            <button
              type="button"
              onClick={() => setAnswerOpen(true)}
              className="mt-2 text-[14px] font-semibold text-blue-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Xem đáp án
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-blue-100 pt-3">
        <BackButton onClick={onDone} />
        <p
          className="min-w-0 flex-1 text-[12.5px] leading-5 text-slate-500"
          data-testid="assist-provenance"
        >
          {provenance(help)}
        </p>
      </div>
    </div>
  );
}

function provenance(help: AssistHelp): string {
  const who = help.provider === 'mock' ? 'Trợ lý giả lập (chỉ dùng khi kiểm thử)' : 'Trợ lý AI';
  if (!help.explanation) return 'Phần AI đã bị ẩn. Lời giải trên do Tú Tài tự tính.';
  if (help.math.status === 'verified' && help.math.checked.length) {
    return `${who} viết lời giải thích. Tú Tài đã tự tính lại ${help.math.checked.join(', ')}: khớp.`;
  }
  return `${who} viết lời giải thích, có thể chưa hoàn hảo. Lời giải và điểm chấm trong bài vẫn là chuẩn.`;
}
