'use client';

import * as React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Lightbulb,
  Pause,
  Play,
  Quote,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react';
import { QuestionMath } from '@/components/shared/question-content-renderer';
import { initialState, KEYS, type KeyId } from '@/lib/calculator-tutor/fx570vn-plus';
import type { GuideLevel, GuideStep, StepOrigin } from '@/lib/calculator-tutor/types';
import { CalculatorDevice } from './calculator-device';
import { useCompact } from './calculator-tutor';
import { ORIGIN_LABEL } from './origin';

const AUTOPLAY_MS = 3200;
const POINTER_MS = 700;

function OriginBadge({ origin }: { origin: StepOrigin }) {
  const style = ORIGIN_LABEL[origin];
  return (
    <span
      className={`inline-flex h-5 items-center rounded-full px-2 text-[11px] font-bold ${style.className}`}
      data-testid="guided-origin"
      data-origin={origin}
    >
      {style.label}
    </span>
  );
}

function KeySequence({ keys, active }: { keys: KeyId[]; active: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="guided-keys">
      {keys.map((key, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="text-[11px] text-slate-400">→</span>}
          <kbd
            className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 font-sans text-[12px] font-bold transition-colors ${
              index === active
                ? 'border-amber-300 bg-amber-50 text-amber-900 ring-2 ring-amber-200'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {KEYS[key].label}
          </kbd>
        </React.Fragment>
      ))}
    </div>
  );
}

function ValuesTable({ values }: { values: NonNullable<GuideStep['values']> }) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-emerald-200 bg-white"
      data-testid="guided-values"
    >
      <div className="grid grid-cols-2 bg-emerald-50 px-3 py-1.5 text-[12px] font-bold text-emerald-900">
        <span>X</span>
        <span className="text-right">f(X)</span>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {values.map((row, index) => (
          <div
            key={index}
            className={`grid grid-cols-2 px-3 py-1 font-mono text-[13px] tabular-nums ${index % 2 ? 'bg-slate-50/60' : ''}`}
          >
            <span>{row.x}</span>
            <span className={`text-right ${row.y === 'ERROR' ? 'font-bold text-rose-700' : ''}`}>
              {row.y}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Levels B and C: the steps of a calculator method the simulation does not run.
 * B highlights the keys the source names on the same keypad, without drawing a
 * screen; C shows the source's own lines, one at a time, with what is missing
 * marked. Same controls and look as the simulated lesson.
 */
export function GuidedSteps({
  steps,
  level,
  modelNote,
}: {
  steps: GuideStep[];
  level: Exclude<GuideLevel, 'A'>;
  modelNote: string;
}) {
  const compact = useCompact();
  const [index, setIndex] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [pointer, setPointer] = React.useState(0);
  const [seen, setSeen] = React.useState<Set<number>>(() => new Set([0]));
  const step = steps[index];
  const keys = step.keys ?? [];
  const isLast = index === steps.length - 1;

  const go = React.useCallback(
    (next: number) => {
      const bounded = Math.max(0, Math.min(steps.length - 1, next));
      setIndex(bounded);
      setPointer(0);
      setSeen((previous) => new Set(previous).add(bounded));
    },
    [steps.length]
  );

  // The pointer walks along the step's keys, so the order is visible on the keypad.
  React.useEffect(() => {
    if (keys.length < 2) return;
    const timer = setInterval(() => setPointer((value) => (value + 1) % keys.length), POINTER_MS);
    return () => clearInterval(timer);
  }, [keys.length, index]);

  React.useEffect(() => {
    if (!playing) return;
    if (isLast) {
      const stop = setTimeout(() => setPlaying(false), AUTOPLAY_MS);
      return () => clearTimeout(stop);
    }
    const timer = setTimeout(() => go(index + 1), AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [playing, index, isLast, go]);

  const levelLabel =
    level === 'B'
      ? 'Minh hoạ có hướng dẫn: phím được tô sáng, máy không được mô phỏng'
      : 'Hướng dẫn từng bước theo lời giải: không có mô phỏng phím';

  const card = (
    <div
      className="space-y-3"
      data-testid="guided-step"
      data-step={index}
      data-origin={step.origin}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-bold text-blue-700">
          Bước {index + 1}/{steps.length}
        </span>
        <OriginBadge origin={step.origin} />
      </div>
      <h4 className="text-[17px] font-bold leading-snug text-slate-900">{step.title}</h4>
      <p className="text-[15px] leading-7 text-slate-800" data-testid="guided-instruction">
        <QuestionMath text={step.instruction} />
      </p>
      {step.math && !step.instruction.includes(step.math) && (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-[15px]">
          <QuestionMath text={step.math} />
        </p>
      )}
      {keys.length > 0 && <KeySequence keys={keys} active={pointer} />}
      {step.explanation && (
        <p className="text-[13px] leading-6 text-slate-600">
          <QuestionMath text={step.explanation} />
        </p>
      )}
      {step.values && level === 'B' && <ValuesTable values={step.values} />}
      {step.checkpoint && (
        <div
          className={`rounded-xl border p-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 ${
            step.checkpoint.tone === 'warning'
              ? 'border-amber-200 bg-amber-50'
              : 'border-sky-200 bg-sky-50'
          }`}
          data-testid="guided-checkpoint"
        >
          <p
            className={`flex items-center gap-1.5 text-[13px] font-bold ${step.checkpoint.tone === 'warning' ? 'text-amber-900' : 'text-sky-900'}`}
          >
            {step.checkpoint.tone === 'warning' ? (
              <TriangleAlert className="size-4 shrink-0" />
            ) : (
              <Lightbulb className="size-4 shrink-0" />
            )}
            <span>
              <QuestionMath text={step.checkpoint.title} />
            </span>
          </p>
          <p className="mt-1 text-[13px] leading-6 text-slate-700">
            <QuestionMath text={step.checkpoint.body} />
          </p>
        </div>
      )}
      {step.source && step.source !== step.instruction && (
        <p
          className="flex gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[12px] leading-5 text-slate-600"
          data-testid="guided-source"
        >
          <Quote className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
          <span>
            Nguyên văn lời giải: <QuestionMath text={step.source} />
          </span>
        </p>
      )}
    </div>
  );

  const controls = (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={() => go(index - 1)}
        disabled={index === 0}
        className="inline-flex h-10 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-bold text-slate-700 disabled:opacity-40"
        data-testid="guided-prev"
      >
        <ArrowLeft className="size-4" /> Bước trước
      </button>
      <button
        type="button"
        onClick={() => setPlaying((value) => !value)}
        className="inline-flex h-10 items-center gap-1 rounded-lg px-3 text-[13px] font-bold text-blue-800 hover:bg-blue-50"
        data-testid="guided-play"
        aria-pressed={playing}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        {playing ? 'Dừng' : 'Tự chạy'}
      </button>
      <button
        type="button"
        onClick={() => {
          setPlaying(false);
          go(0);
        }}
        className="inline-flex h-10 items-center gap-1 rounded-lg px-2 text-[13px] font-bold text-slate-600 hover:bg-slate-100"
        data-testid="guided-replay"
        aria-label="Xem lại từ đầu"
      >
        <RotateCcw className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => go(index + 1)}
        disabled={isLast}
        className="ml-auto inline-flex h-10 items-center gap-1 rounded-lg bg-blue-700 px-4 text-[13px] font-bold text-white disabled:bg-emerald-600"
        data-testid="guided-next"
      >
        {isLast ? (
          <>
            <CheckCircle2 className="size-4" /> Đã xem hết
          </>
        ) : (
          <>
            {step.checkpoint ? 'Đã hiểu, tiếp' : 'Bước tiếp'} <ArrowRight className="size-4" />
          </>
        )}
      </button>
    </div>
  );

  const progress = (
    <div className="flex gap-1" aria-hidden="true">
      {steps.map((entry, position) => (
        <span
          key={entry.id}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            position === index
              ? 'bg-blue-600'
              : seen.has(position)
                ? 'bg-blue-200'
                : entry.origin === 'MISSING' || entry.origin === 'UNCERTAIN'
                  ? 'bg-amber-200'
                  : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  );

  const side =
    level === 'B' ? (
      <CalculatorDevice
        compact={compact}
        state={initialState()}
        target={keys[pointer] ?? null}
        highlights={keys}
        pointer={keys.length > 0}
        pressed={null}
        onPress={() => undefined}
        label="MINH HOẠ"
        screen={
          <div className="space-y-1">
            <p className="text-[10px] font-bold tracking-wider text-amber-300 uppercase">
              Minh hoạ · không mô phỏng màn hình
            </p>
            <div className="text-[14px] leading-snug">
              {step.math ? (
                <QuestionMath text={step.math} />
              ) : (
                <span className="text-slate-300">{step.title}</span>
              )}
            </div>
          </div>
        }
        caption={
          keys.length ? (
            <span>Phím cần bấm được tô sáng theo thứ tự.</span>
          ) : (
            <span className="text-slate-400">Bước này không có phím cụ thể.</span>
          )
        }
      />
    ) : (
      <ol className="space-y-1.5" data-testid="guided-timeline">
        {steps.map((entry, position) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => go(position)}
              className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] leading-5 transition-colors ${
                position === index
                  ? 'bg-blue-50 text-blue-900 ring-1 ring-blue-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {entry.origin === 'MISSING' || entry.origin === 'UNCERTAIN' ? (
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
              ) : seen.has(position) ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              ) : (
                <CircleDashed className="mt-0.5 size-4 shrink-0 text-slate-400" />
              )}
              <span className="font-semibold">{entry.title}</span>
            </button>
          </li>
        ))}
      </ol>
    );

  return (
    <div className="@container space-y-3" data-testid="guided-steps" data-level={level}>
      <div className="flex flex-col gap-1">
        <p className="text-[12px] font-semibold text-slate-600" data-testid="guided-level">
          {levelLabel}
        </p>
        <p className="text-[11px] leading-4 text-slate-500">{modelNote}</p>
      </div>
      {progress}
      <div className="grid gap-4 @xl:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {card}
          <div className="mt-3">{controls}</div>
        </div>
        <div className={level === 'C' ? 'max-@xl:hidden' : ''}>{side}</div>
      </div>
    </div>
  );
}
