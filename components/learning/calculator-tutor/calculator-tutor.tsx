'use client';

import * as React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Hand,
  Info,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';
import { QuestionMath } from '@/components/shared/question-content-renderer';
import {
  initialState,
  KEYS,
  press,
  replay,
  type CalcState,
  type KeyId,
} from '@/lib/calculator-tutor/fx570vn-plus';
import type { CalculatorTutorial, TutorialStep } from '@/lib/calculator-tutor/types';
import { CalculatorDevice, KEYBOARD } from './calculator-device';
import { ORIGIN_LABEL } from './origin';

type Mode = 'choose' | 'watch' | 'practice' | 'free';

/** Time between demonstrated key presses: slow enough to follow with the eye. */
const DEMO_KEY_MS = 1000;
const DEMO_FIRST_KEY_MS = 900;
const DEMO_NEXT_STEP_MS = 1600;
const FLASH_MS = 220;
const CHECKPOINT_MS = 400;

function KeyChip({ id, state }: { id: KeyId; state: 'done' | 'current' | 'todo' }) {
  return (
    <kbd
      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 font-sans text-[12px] font-bold transition-colors ${
        state === 'done'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : state === 'current'
            ? 'border-amber-300 bg-amber-50 text-amber-900 ring-2 ring-amber-200'
            : 'border-slate-200 bg-white text-slate-600'
      }`}
    >
      {KEYS[id].label}
    </kbd>
  );
}

function Checkpoint({ checkpoint }: { checkpoint: NonNullable<TutorialStep['checkpoint']> }) {
  const warning = checkpoint.tone === 'warning';
  return (
    <div
      className={`rounded-xl border p-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 ${
        warning ? 'border-amber-200 bg-amber-50' : 'border-sky-200 bg-sky-50'
      }`}
      data-testid="tutor-checkpoint"
    >
      <p
        className={`flex items-center gap-1.5 text-[13px] font-bold ${warning ? 'text-amber-900' : 'text-sky-900'}`}
      >
        {warning ? <TriangleAlert className="size-4" /> : <Lightbulb className="size-4" />}
        {checkpoint.title}
      </p>
      <p className="mt-1 text-[13px] leading-6 text-slate-700">
        <QuestionMath text={checkpoint.body} />
      </p>
    </div>
  );
}

/** True on phone widths, where the tutor opens as a full-screen workspace. */
export function useCompact(): boolean {
  return React.useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia('(max-width: 639px)');
      query.addEventListener('change', notify);
      return () => query.removeEventListener('change', notify);
    },
    () => window.matchMedia('(max-width: 639px)').matches,
    () => false
  );
}

export function CalculatorTutor({ tutorial }: { tutorial: CalculatorTutorial }) {
  const steps = tutorial.steps;
  const [mode, setMode] = React.useState<Mode>('choose');
  const [step, setStep] = React.useState(0);
  const [done, setDone] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [finished, setFinished] = React.useState(false);
  const [caption, setCaption] = React.useState<{
    text: string;
    tone: 'info' | 'wrong' | 'ok';
  } | null>(null);
  const [pressed, setPressed] = React.useState<KeyId | null>(null);
  const [misses, setMisses] = React.useState(0);
  const [hint, setHint] = React.useState(false);
  const [free, setFree] = React.useState<CalcState>(initialState);
  const flashTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const compact = useCompact();

  const current = steps[step];
  const stepComplete = done === current.keys.length;
  const isLast = step === steps.length - 1;

  const tutorState = React.useMemo(
    () => replay([...steps.slice(0, step).flatMap((s) => s.keys), ...current.keys.slice(0, done)]),
    [steps, step, current, done]
  );
  const shown = mode === 'free' ? free : tutorState;
  const expected = stepComplete ? null : current.keys[done];
  const target =
    mode === 'watch' || (mode === 'practice' && (hint || misses >= 2)) ? expected : null;

  const flash = React.useCallback((key: KeyId) => {
    setPressed(key);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setPressed(null), FLASH_MS);
  }, []);
  React.useEffect(() => () => clearTimeout(flashTimer.current), []);

  const goTo = React.useCallback((next: number, autoplay: boolean) => {
    setStep(next);
    setDone(0);
    setMisses(0);
    setHint(false);
    setCaption(null);
    setPlaying(autoplay);
  }, []);

  const advance = React.useCallback(
    (autoplay: boolean) => {
      if (isLast) {
        setFinished(true);
        setPlaying(false);
      } else goTo(step + 1, autoplay);
    },
    [goTo, isLast, step]
  );

  // The demonstration: one key at a time, a pause after each step with something to notice.
  React.useEffect(() => {
    if (mode !== 'watch' || !playing || finished) return;
    if (!stepComplete) {
      const key = current.keys[done];
      const timer = setTimeout(
        () => {
          flash(key);
          setCaption({ text: press(tutorState, key).message, tone: 'info' });
          setDone(done + 1);
        },
        done === 0 ? DEMO_FIRST_KEY_MS : DEMO_KEY_MS
      );
      return () => clearTimeout(timer);
    }
    const stop = Boolean(current.checkpoint) || isLast;
    const timer = setTimeout(
      () => {
        if (!stop) return advance(true);
        setPlaying(false);
        if (isLast && !current.checkpoint) setFinished(true);
      },
      stop ? CHECKPOINT_MS : DEMO_NEXT_STEP_MS
    );
    return () => clearTimeout(timer);
  }, [mode, playing, finished, stepComplete, current, done, tutorState, flash, isLast, advance]);

  function start(next: Mode) {
    setMode(next);
    setFinished(false);
    goTo(0, next === 'watch');
  }

  function onPress(key: KeyId) {
    if (mode === 'free') {
      const result = press(free, key);
      flash(key);
      setFree(result.state);
      setCaption({ text: result.message, tone: result.ok ? 'info' : 'wrong' });
      return;
    }
    if (mode === 'watch' || mode === 'choose') {
      setCaption({ text: 'Đang ở chế độ xem. Chọn "Tự bấm thử" để tự bấm phím.', tone: 'info' });
      return;
    }
    if (finished) return;
    if (stepComplete) {
      setCaption({
        text: `Bước này đã xong. Bấm "${isLast ? 'Hoàn thành' : 'Bước tiếp'}" để tiếp tục.`,
        tone: 'info',
      });
      return;
    }
    flash(key);
    if (key === expected) {
      setCaption({ text: press(tutorState, key).message, tone: 'ok' });
      setDone(done + 1);
      setMisses(0);
      setHint(false);
      return;
    }
    // A wrong key is not applied: the screen stays where the lesson is, and the student hears why.
    const result = press(tutorState, key);
    const what = result.ok
      ? `Phím ${KEYS[key].label} sẽ ${result.message.charAt(0).toLowerCase()}${result.message.slice(1)}`
      : `Phím ${KEYS[key].label} không dùng ở bước này.`;
    setCaption({
      text: `Chưa đúng phím. ${what} ${misses >= 1 ? 'Phím cần bấm đang được tô sáng.' : 'Đọc lại hướng dẫn và thử lại nhé.'}`,
      tone: 'wrong',
    });
    setMisses(misses + 1);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (mode === 'choose' || event.metaKey || event.ctrlKey || event.altKey) return;
    const onButton = (event.target as HTMLElement).tagName === 'BUTTON';
    if (onButton && (event.key === 'Enter' || event.key === ' ')) return;
    const key = KEYBOARD[event.key];
    if (!key) return;
    event.preventDefault();
    onPress(key);
  }

  const total = steps.reduce((sum, s) => sum + s.keys.length, 0);
  const progress = steps.slice(0, step).reduce((sum, s) => sum + s.keys.length, 0) + done;

  const modeButton = (value: 'watch' | 'practice', label: string, Icon: typeof Play) => (
    <button
      type="button"
      onClick={() => start(value)}
      aria-pressed={mode === value}
      data-testid={`tutor-mode-${value}`}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-bold transition-colors sm:flex-none ${compact ? 'h-8' : 'h-10'} ${
        mode === value
          ? 'bg-white text-blue-800 shadow-sm ring-1 ring-black/5'
          : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );

  const panel = (() => {
    if (mode === 'choose') {
      return (
        <div className="space-y-3" data-testid="tutor-intro">
          <p className="text-[15px] leading-7 text-slate-800">
            <QuestionMath text={tutorial.objective} />
          </p>
          {tutorial.intro && (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-[13px] leading-6 text-slate-700">
              <QuestionMath text={tutorial.intro} />
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => start('watch')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800"
              data-testid="tutor-start-watch"
            >
              <Play className="size-4" /> Xem hướng dẫn
            </button>
            <button
              type="button"
              onClick={() => start('practice')}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-50"
              data-testid="tutor-start-practice"
            >
              <Hand className="size-4" /> Tự bấm thử
            </button>
          </div>
          <p className="text-xs text-slate-500">
            {steps.length} bước · {total} lần bấm phím · có thể dùng bàn phím máy tính (số, Enter là
            =, Esc là AC, mũi tên).
          </p>
        </div>
      );
    }
    if (mode === 'free') {
      return (
        <div className="space-y-2" data-testid="tutor-free">
          <p className="text-[15px] font-bold text-slate-900">Thử tự do</p>
          <p className="text-[13px] leading-6 text-slate-700">
            {tutorial.freeHint ??
              'Máy mô phỏng nhận mọi phím của chức năng TABLE. Bấm AC để quay lại f(X), rồi thử một khoảng khác.'}
          </p>
          <button
            type="button"
            onClick={() => start('practice')}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-bold"
          >
            <RotateCcw className="size-4" /> Làm lại bài thực hành
          </button>
        </div>
      );
    }
    if (finished) {
      return (
        <div className="space-y-3" data-testid="tutor-complete">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 motion-safe:animate-[calc-pop_0.5s_ease-out]">
              <CheckCircle2 className="size-6" />
            </span>
            <div>
              <p className="text-[16px] font-bold text-emerald-800">
                {mode === 'practice' ? 'Em đã tự bấm xong cả bài!' : 'Đã xem hết hướng dẫn'}
              </p>
              <p className="text-[13px] text-slate-600">
                {total} lần bấm phím · {steps.length} bước
              </p>
            </div>
          </div>
          <ul className="space-y-1.5">
            {tutorial.conclusion.map((line) => (
              <li key={line} className="flex gap-2 text-[13px] leading-6 text-slate-700">
                <Sparkles className="mt-1 size-3.5 shrink-0 text-amber-500" />
                <span>
                  <QuestionMath text={line} />
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {mode === 'watch' ? (
              <button
                type="button"
                onClick={() => start('practice')}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-blue-700 px-3 text-[13px] font-bold text-white"
                data-testid="tutor-try-practice"
              >
                <Hand className="size-4" /> Giờ em tự bấm thử
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setFree(tutorState);
                  setMode('free');
                  setCaption(null);
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-blue-700 px-3 text-[13px] font-bold text-white"
                data-testid="tutor-free-mode"
              >
                <Sparkles className="size-4" /> Thử tự do
              </button>
            )}
            <button
              type="button"
              onClick={() => start(mode === 'watch' ? 'watch' : 'practice')}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-bold"
              data-testid="tutor-restart"
            >
              <RotateCcw className="size-4" /> {mode === 'watch' ? 'Xem lại' : 'Luyện lại'}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div
        className={compact ? 'space-y-2' : 'space-y-3'}
        data-testid="tutor-step"
        data-step={current.id}
        data-done={done}
        data-expected={expected ?? ''}
      >
        <div>
          <div
            className={`flex items-center justify-between text-[12px] font-semibold text-slate-500 ${compact ? 'sr-only' : ''}`}
          >
            <span data-testid="tutor-step-count">
              Bước {step + 1}/{steps.length}
            </span>
            <span>
              {progress}/{total} phím
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-[width] duration-500"
              style={{ width: `${(progress / total) * 100}%` }}
            />
          </div>
        </div>
        <div
          key={current.id}
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
        >
          <p className="text-[16px] font-bold text-slate-900">
            {compact && (
              <span className="mr-1.5 text-[13px] font-semibold text-slate-500">
                {step + 1}/{steps.length}
              </span>
            )}
            {current.title}
            {current.origin && current.origin !== 'SOURCE' && current.origin !== 'MODEL' && (
              <span
                className={`ml-2 inline-flex h-5 items-center rounded-full px-2 align-middle text-[11px] font-bold ${ORIGIN_LABEL[current.origin].className}`}
                data-testid="tutor-origin"
                data-origin={current.origin}
              >
                {ORIGIN_LABEL[current.origin].label}
              </span>
            )}
          </p>
          <p className="mt-1 text-[14px] leading-6 text-slate-800" data-testid="tutor-instruction">
            {current.instruction}
          </p>
          <div
            className="mt-2 flex flex-wrap gap-1.5"
            aria-label="Thứ tự phím"
            data-testid="tutor-keys"
          >
            {current.keys.map((id, index) => (
              <KeyChip
                key={index}
                id={id}
                state={index < done ? 'done' : index === done ? 'current' : 'todo'}
              />
            ))}
          </div>
          <details
            key={`${current.id}-${compact}`}
            className="mt-2 rounded-lg text-[13px] leading-6 text-slate-600"
            open={!compact}
          >
            <summary className="cursor-pointer list-none text-[12px] font-bold text-slate-500 select-none [&::-webkit-details-marker]:hidden">
              <Info className="mr-1 inline size-3.5" />
              Vì sao?
            </summary>
            <p className="mt-1">
              <QuestionMath text={current.explanation} />
            </p>
          </details>
        </div>
        {mode === 'practice' && hint && current.hint && !stepComplete && (
          <p
            className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900"
            data-testid="tutor-hint"
          >
            <Lightbulb className="mr-1 inline size-4" />
            {current.hint}
          </p>
        )}
        {stepComplete && (
          <div className="space-y-2">
            {mode === 'practice' && (
              <p
                className="flex items-center gap-1.5 text-[13px] font-bold text-emerald-700"
                data-testid="tutor-step-done"
              >
                <CheckCircle2 className="size-4" /> Đúng rồi! Màn hình đã như trên máy thật.
              </p>
            )}
            {current.checkpoint && <Checkpoint checkpoint={current.checkpoint} />}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1" data-testid="tutor-controls">
          <button
            type="button"
            onClick={() => goTo(Math.max(0, step - 1), false)}
            disabled={step === 0}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] font-semibold disabled:opacity-40"
            data-testid="tutor-prev"
          >
            <ArrowLeft className="size-4" /> Trước
          </button>
          {mode === 'watch' && (
            <>
              <button
                type="button"
                onClick={() => (stepComplete && !playing ? advance(true) : setPlaying(!playing))}
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-blue-700 px-3 text-[13px] font-bold text-white"
                data-testid="tutor-play"
                data-playing={playing}
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                {playing ? 'Tạm dừng' : stepComplete ? 'Tiếp tục' : 'Phát'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDone(0);
                  setCaption(null);
                  setPlaying(true);
                }}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] font-semibold"
                data-testid="tutor-replay"
              >
                <RotateCcw className="size-4" /> Phát lại bước
              </button>
            </>
          )}
          {mode === 'practice' && !stepComplete && (
            <>
              <button
                type="button"
                onClick={() => setHint(true)}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 text-[13px] font-semibold text-amber-900"
                data-testid="tutor-hint-button"
              >
                <Lightbulb className="size-4" /> Gợi ý
              </button>
              <button
                type="button"
                onClick={() => start('practice')}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] font-semibold"
                data-testid="tutor-reset"
              >
                <RotateCcw className="size-4" /> Làm lại
              </button>
            </>
          )}
          {(mode === 'practice' ? stepComplete : !playing) && (
            <button
              type="button"
              onClick={() => (stepComplete ? advance(false) : setDone(current.keys.length))}
              className={`ml-auto inline-flex h-9 items-center gap-1 rounded-lg px-3 text-[13px] font-bold ${
                mode === 'practice' ? 'bg-blue-700 text-white' : 'border border-slate-300 bg-white'
              }`}
              data-testid="tutor-next"
            >
              {stepComplete ? (isLast ? 'Hoàn thành' : 'Bước tiếp') : 'Bỏ qua bước'}
              <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    );
  })();

  const header = (
    <div className="flex flex-col gap-1.5">
      <div className="flex rounded-xl bg-slate-100 p-1" role="group" aria-label="Chế độ">
        {modeButton('watch', 'Xem hướng dẫn', Play)}
        {modeButton('practice', 'Tự bấm thử', Hand)}
      </div>
      <p className="text-[11px] leading-4 text-slate-500" data-testid="tutor-model">
        Mô phỏng dạy học theo <strong className="text-slate-700">{tutorial.model.name}</strong>,
        không phải trình giả lập máy thật.
      </p>
    </div>
  );
  const device = (
    <CalculatorDevice
      compact={compact}
      state={shown}
      target={finished || mode === 'free' ? null : target}
      pointer={mode === 'watch' && playing}
      pressed={pressed}
      onPress={onPress}
      caption={
        caption ? (
          <span
            className={
              caption.tone === 'wrong'
                ? 'text-amber-300'
                : caption.tone === 'ok'
                  ? 'text-emerald-300'
                  : ''
            }
            data-tone={caption.tone}
          >
            {caption.text}
          </span>
        ) : (
          <span className="text-slate-400">Mô phỏng dạy học theo {tutorial.model.name}</span>
        )
      }
    />
  );

  // On a phone the lesson becomes a full-screen workspace: the current instruction on top and
  // the whole keypad under it, both on screen at once. Closing it returns to the solution.
  if (compact && mode !== 'choose') {
    return (
      <section
        className="fixed inset-0 z-50 flex h-dvh flex-col bg-slate-50"
        onKeyDown={onKeyDown}
        data-testid="calculator-tutor"
        data-mode={mode}
        data-layout="focus"
        role="dialog"
        aria-modal="true"
        aria-label="Thực hành bấm máy tính"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-1.5">
          <Calculator className="size-4 shrink-0 text-blue-700" />
          <div
            className="flex flex-1 rounded-lg bg-slate-100 p-0.5"
            role="group"
            aria-label="Chế độ"
          >
            {modeButton('watch', 'Xem', Play)}
            {modeButton('practice', 'Tự bấm', Hand)}
          </div>
          <button
            type="button"
            onClick={() => {
              setMode('choose');
              setPlaying(false);
              setCaption(null);
            }}
            aria-label="Đóng thực hành"
            className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
            data-testid="tutor-close"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-2 pb-2">
          <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-3">
            {panel}
          </div>
        </div>
        <div className="shrink-0 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {device}
        </div>
      </section>
    );
  }

  return (
    <section
      className="@container"
      onKeyDown={onKeyDown}
      data-testid="calculator-tutor"
      data-mode={mode}
      aria-label="Thực hành bấm máy tính"
    >
      {header}
      <div className="mt-3 grid gap-4 @xl:grid-cols-[minmax(0,1fr)_300px] @xl:items-start">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4">
          {panel}
        </div>
        <div className="@xl:sticky @xl:top-4">{device}</div>
      </div>
    </section>
  );
}
