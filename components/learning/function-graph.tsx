'use client';

import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, Check, X } from 'lucide-react';
import {
  analyzeFunction,
  derivative,
  evaluate,
  formatInterval,
  formatNumber,
  type FunctionAnalysis,
  type MonotonePiece,
} from '@/lib/learning/function-model';
import type { GraphLayer } from '@/lib/knowledge-tree/lesson-journey';
import { InlineText } from './rich-text';

/**
 * The lesson's function, drawn from the GRAPH block the admin typed. Every
 * point, sign and interval is computed from that function, so the picture
 * always agrees with the maths.
 *
 * Layers follow the lesson:
 * - predict: the student says where the curve goes up or down, then checks;
 * - values: two points x₁ < x₂, comparing f(x₁) and f(x₂) (the definition);
 * - derivative: one point with its tangent, and the sign of f′ under the graph.
 */

const STRIP_H = 64;
const PAD = 18;

type View = { xMin: number; xMax: number; yMin: number; yMax: number };

function computeView(a: FunctionAnalysis): View {
  const marks = [...a.criticalPoints, ...a.breaks];
  let xMin = -3;
  let xMax = 3;
  if (marks.length) {
    const lo = Math.min(...marks);
    const hi = Math.max(...marks);
    const pad = Math.max(2.2, (hi - lo) * 0.6);
    xMin = lo - pad;
    xMax = hi + pad;
  }
  const critical = a.criticalPoints.map((x) => evaluate(a.fn, x));
  let yMin: number;
  let yMax: number;
  if (critical.length) {
    const lo = Math.min(...critical);
    const hi = Math.max(...critical);
    const pad = Math.max(1, (hi - lo) * 0.6);
    yMin = lo - pad;
    yMax = hi + pad;
  } else {
    const samples: number[] = [];
    for (let i = 0; i <= 200; i += 1) {
      const x = xMin + ((xMax - xMin) * i) / 200;
      if (a.breaks.some((b) => Math.abs(x - b) < (xMax - xMin) / 40)) continue;
      const y = evaluate(a.fn, x);
      if (Number.isFinite(y)) samples.push(y);
    }
    samples.sort((p, q) => p - q);
    const lo = samples[Math.floor(samples.length * 0.1)] ?? -3;
    const hi = samples[Math.floor(samples.length * 0.9)] ?? 3;
    const pad = Math.max(1, (hi - lo) * 0.5);
    yMin = lo - pad;
    yMax = hi + pad;
  }
  return { xMin, xMax, yMin, yMax };
}

function useAnalysis(source: string) {
  return React.useMemo(() => {
    const result = analyzeFunction(source);
    return result.ok ? { analysis: result.analysis, view: computeView(result.analysis) } : null;
  }, [source]);
}

const decimal = (value: number) =>
  Math.abs(value) >= 100
    ? formatNumber(Math.round(value))
    : value.toFixed(2).replace('.', ',').replace('-', '−');

function pieceOf(a: FunctionAnalysis, x: number): MonotonePiece | undefined {
  return a.pieces.find((piece) => x > piece.from && x < piece.to);
}

/** Width of a container in CSS pixels, so SVGs can be drawn 1:1 instead of scaled down. */
function useMeasuredWidth(initial = 560) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(initial);
  React.useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function Plot({
  analysis: a,
  view,
  colored,
  highlight,
  children,
  strip,
  label,
}: {
  analysis: FunctionAnalysis;
  view: View;
  colored: boolean;
  highlight?: number | null;
  children?: (scale: {
    sx: (x: number) => number;
    sy: (y: number) => number;
    bottom: number;
  }) => React.ReactNode;
  strip?: boolean;
  label: string;
}) {
  const clipId = React.useId().replace(/:/g, '');
  // Drawn at the container's real width so labels keep a readable size on phones.
  const [boxRef, W] = useMeasuredWidth();
  const PLOT_H = Math.round(Math.min(330, Math.max(210, W * 0.6)));
  const sx = (x: number) => PAD + ((x - view.xMin) / (view.xMax - view.xMin)) * (W - 2 * PAD);
  const sy = (y: number) => PAD + ((view.yMax - y) / (view.yMax - view.yMin)) * (PLOT_H - 2 * PAD);
  const span = view.yMax - view.yMin;
  const clampY = (y: number) => Math.max(view.yMin - 2 * span, Math.min(view.yMax + 2 * span, y));

  const pathFor = (from: number, to: number) => {
    const lo = Math.max(from, view.xMin);
    const hi = Math.min(to, view.xMax);
    if (!(hi > lo)) return '';
    const n = 240;
    let d = '';
    let pen = false;
    for (let i = 0; i <= n; i += 1) {
      const x = lo + ((hi - lo) * i) / n;
      const nearBreak = a.breaks.some((b) => Math.abs(x - b) < 1e-6 * (view.xMax - view.xMin));
      const y = nearBreak ? NaN : evaluate(a.fn, x);
      if (!Number.isFinite(y)) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${sx(x).toFixed(2)} ${sy(clampY(y)).toFixed(2)} `;
      pen = true;
    }
    return d;
  };

  const xAxisY = view.yMin < 0 && view.yMax > 0 ? sy(0) : null;
  const yAxisX = view.xMin < 0 && view.xMax > 0 ? sx(0) : null;
  const height = PLOT_H + (strip ? STRIP_H : 0);

  return (
    <div ref={boxRef} className="w-full">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width={W}
        height={height}
        className="block h-auto w-full touch-pan-y select-none font-sans"
        role="img"
        aria-label={label}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD} y={PAD} width={W - 2 * PAD} height={PLOT_H - 2 * PAD} rx="6" />
          </clipPath>
        </defs>
        <rect
          x={PAD}
          y={PAD}
          width={W - 2 * PAD}
          height={PLOT_H - 2 * PAD}
          rx="8"
          className="fill-[#F8FAFD]"
        />
        {a.pieces.map((piece, index) => {
          if (highlight !== index) return null;
          const x0 = sx(Math.max(piece.from, view.xMin));
          const x1 = sx(Math.min(piece.to, view.xMax));
          return (
            <rect
              key={index}
              x={x0}
              y={PAD}
              width={x1 - x0}
              height={PLOT_H - 2 * PAD}
              className="fill-blue-100/70"
            />
          );
        })}
        <g clipPath={`url(#${clipId})`}>
          {xAxisY !== null && (
            <line
              x1={PAD}
              x2={W - PAD}
              y1={xAxisY}
              y2={xAxisY}
              className="stroke-slate-300"
              strokeWidth="1.2"
            />
          )}
          {yAxisX !== null && (
            <line
              x1={yAxisX}
              x2={yAxisX}
              y1={PAD}
              y2={PLOT_H - PAD}
              className="stroke-slate-300"
              strokeWidth="1.2"
            />
          )}
          {[...a.criticalPoints, ...a.breaks].map((x) => (
            <line
              key={x}
              x1={sx(x)}
              x2={sx(x)}
              y1={PAD}
              y2={PLOT_H - PAD}
              className={a.breaks.includes(x) ? 'stroke-slate-400' : 'stroke-slate-300'}
              strokeDasharray="4 4"
            />
          ))}
          {colored
            ? a.pieces.map((piece, index) => (
                <path
                  key={index}
                  d={pathFor(piece.from, piece.to)}
                  fill="none"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  className={piece.direction === 'up' ? 'stroke-emerald-500' : 'stroke-rose-500'}
                />
              ))
            : a.pieces.map((piece, index) => (
                <path
                  key={index}
                  d={pathFor(piece.from, piece.to)}
                  fill="none"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  className="stroke-[#1E3A8A]"
                />
              ))}
          {children?.({ sx, sy, bottom: PLOT_H - PAD })}
        </g>
        {xAxisY !== null && (
          <text
            x={W - PAD - 4}
            y={xAxisY - 6}
            textAnchor="end"
            className="fill-slate-400 text-[13px] italic"
          >
            x
          </text>
        )}
        {a.criticalPoints.map((x) => {
          const y = evaluate(a.fn, x);
          if (y < view.yMin || y > view.yMax) return null;
          return (
            <circle
              key={x}
              cx={sx(x)}
              cy={sy(y)}
              r="4.5"
              className="fill-white stroke-slate-500"
              strokeWidth="2"
            />
          );
        })}
        {[...a.criticalPoints, ...a.breaks].map((x) => (
          <text
            key={x}
            x={sx(x)}
            y={PLOT_H - 4}
            textAnchor="middle"
            className="fill-slate-600 text-[14px] font-semibold"
          >
            {formatNumber(x)}
          </text>
        ))}
        {strip && <SignStrip analysis={a} sx={sx} view={view} width={W} plotHeight={PLOT_H} />}
      </svg>
    </div>
  );
}

/** The sign of f′ drawn directly under the graph, aligned with it. */
function SignStrip({
  analysis: a,
  sx,
  view,
  width: W,
  plotHeight,
}: {
  analysis: FunctionAnalysis;
  sx: (x: number) => number;
  view: View;
  width: number;
  plotHeight: number;
}) {
  const top = plotHeight + 6;
  const mid = top + 26;
  return (
    <g>
      <rect
        x={PAD}
        y={top}
        width={W - 2 * PAD}
        height={STRIP_H - 14}
        rx="8"
        className="fill-white stroke-slate-200"
      />
      <text x={PAD + 10} y={mid + 5} className="fill-slate-500 text-[14px] font-semibold">
        y′
      </text>
      {a.intervals.map((interval, index) => {
        const lo = Math.max(interval.from, view.xMin);
        const hi = Math.min(interval.to, view.xMax);
        if (!(hi > lo)) return null;
        const cx = (sx(lo) + sx(hi)) / 2;
        const up = interval.sign > 0;
        return (
          <text
            key={index}
            x={cx}
            y={mid + 7}
            textAnchor="middle"
            className={`text-[22px] font-bold ${up ? 'fill-emerald-600' : 'fill-rose-600'}`}
          >
            {up ? '+' : '−'}
          </text>
        );
      })}
      {a.criticalPoints.map((x) => (
        <text
          key={x}
          x={sx(x)}
          y={mid + 5}
          textAnchor="middle"
          className="fill-slate-700 text-[15px] font-semibold"
        >
          0
        </text>
      ))}
      {a.breaks.map((x) => (
        <g key={x} className="stroke-slate-500">
          <line x1={sx(x) - 2} x2={sx(x) - 2} y1={top + 6} y2={top + STRIP_H - 20} />
          <line x1={sx(x) + 2} x2={sx(x) + 2} y1={top + 6} y2={top + STRIP_H - 20} />
        </g>
      ))}
    </g>
  );
}

// ─── Predict ─────────────────────────────────────────────────────────────────

type Direction = 'up' | 'down';

function pieceExplanation(a: FunctionAnalysis, piece: MonotonePiece): string {
  const up = piece.direction === 'up';
  const fa = Number.isFinite(piece.from) ? evaluate(a.fn, piece.from) : NaN;
  const fb = Number.isFinite(piece.to) ? evaluate(a.fn, piece.to) : NaN;
  const hasA = Number.isFinite(fa);
  const hasB = Number.isFinite(fb);
  const change =
    hasA && hasB
      ? `y ${up ? 'tăng' : 'giảm'} từ ${formatNumber(fa)} ${up ? 'lên' : 'xuống'} ${formatNumber(fb)}`
      : hasB
        ? `y ${up ? 'tăng dần lên tới' : 'giảm dần xuống tới'} ${formatNumber(fb)} tại x = ${formatNumber(piece.to)}`
        : hasA
          ? `y ${up ? 'tăng' : 'giảm'} dần kể từ ${formatNumber(fa)} tại x = ${formatNumber(piece.from)}`
          : `x tăng thì y ${up ? 'tăng' : 'giảm'}`;
  return `Trên ${formatInterval(piece.from, piece.to)}, đồ thị đi ${up ? 'lên' : 'xuống'}: ${change}.`;
}

function PredictLayer({
  analysis: a,
  view,
  expression,
  onDone,
  done,
  split = false,
}: {
  analysis: FunctionAnalysis;
  view: View;
  expression: string;
  onDone?: () => void;
  done: boolean;
  split?: boolean;
}) {
  const [answers, setAnswers] = React.useState<Record<number, Direction>>({});
  const [answered, setChecked] = React.useState(false);
  // `done` can also arrive after mount, when saved progress is restored.
  const checked = answered || done;
  const [focus, setFocus] = React.useState<number | null>(null);
  const resultRef = React.useRef<HTMLDivElement>(null);
  const complete = a.pieces.every((_, index) => answers[index]);
  const right = a.pieces.filter((piece, index) => answers[index] === piece.direction).length;
  const reviewing = done && !Object.keys(answers).length;

  const check = () => {
    setChecked(true);
    onDone?.();
    window.requestAnimationFrame(() => resultRef.current?.focus());
  };

  return (
    <div
      className={
        split
          ? '@3xl:grid @3xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] @3xl:items-start @3xl:gap-8'
          : ''
      }
    >
      <div className={split ? '@3xl:order-2' : ''}>
        <Plot
          analysis={a}
          view={view}
          colored={checked}
          highlight={focus}
          label={`Đồ thị hàm số y = ${expression}.`}
        />
      </div>
      <div className={split ? '@3xl:order-1' : ''}>
        <fieldset className={split ? 'mt-4 @3xl:mt-0' : 'mt-4'} disabled={checked}>
          <legend className="text-[15px] font-semibold text-[#091224]">
            Đi từ trái sang phải, đồ thị đi lên hay đi xuống trên từng khoảng?
          </legend>
          <ul className="mt-3 space-y-2">
            {a.pieces.map((piece, index) => {
              const given = answers[index];
              const correct = checked && !reviewing ? given === piece.direction : null;
              return (
                <li
                  key={index}
                  onMouseEnter={() => setFocus(index)}
                  onMouseLeave={() => setFocus(null)}
                  onFocus={() => setFocus(index)}
                  onBlur={() => setFocus(null)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                    correct === true
                      ? 'border-emerald-200 bg-emerald-50/60'
                      : correct === false
                        ? 'border-rose-200 bg-rose-50/60'
                        : 'border-slate-200 bg-white'
                  }`}
                  data-testid={`predict-row-${index}`}
                >
                  <span className="min-w-0 text-[15px] font-semibold tabular-nums text-[#091224] sm:min-w-[8.5rem]">
                    {formatInterval(piece.from, piece.to)}
                  </span>
                  <span
                    className="ml-auto flex shrink-0 gap-1.5 sm:gap-2"
                    role="radiogroup"
                    aria-label={`Khoảng ${formatInterval(piece.from, piece.to)}`}
                  >
                    {(
                      [
                        ['up', 'Đi lên', 'Lên', ArrowUpRight],
                        ['down', 'Đi xuống', 'Xuống', ArrowDownRight],
                      ] as const
                    ).map(([value, text, short, Icon]) => {
                      const selected = reviewing ? piece.direction === value : given === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setAnswers((current) => ({ ...current, [index]: value }))}
                          className={`inline-flex h-10 items-center gap-1 rounded-lg border px-2.5 text-[14px] font-semibold sm:gap-1.5 sm:px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-default ${
                            selected
                              ? value === 'up'
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-rose-600 bg-rose-600 text-white'
                              : 'border-slate-200 bg-white text-slate-600 enabled:hover:border-slate-300'
                          }`}
                          data-testid={`predict-${index}-${value}`}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                          <span className="sm:hidden">{short}</span>
                          <span className="hidden sm:inline">{text}</span>
                        </button>
                      );
                    })}
                  </span>
                  {correct !== null && (
                    <span className="sr-only">{correct ? 'Đúng' : 'Chưa đúng'}</span>
                  )}
                  {correct === true && (
                    <Check className="size-4 text-emerald-600" aria-hidden="true" />
                  )}
                  {correct === false && <X className="size-4 text-rose-600" aria-hidden="true" />}
                </li>
              );
            })}
          </ul>
        </fieldset>
        {!checked ? (
          <button
            type="button"
            disabled={!complete}
            onClick={check}
            className="mt-4 inline-flex h-11 items-center rounded-xl bg-[#091224] px-5 text-[15px] font-bold text-white transition hover:bg-[#1c2740] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
            data-testid="predict-check"
          >
            Kiểm tra dự đoán
          </button>
        ) : (
          <div
            ref={resultRef}
            tabIndex={-1}
            role="status"
            className={`mt-4 rounded-xl p-4 text-[15px] leading-7 outline-none ${
              reviewing || right === a.pieces.length
                ? 'bg-emerald-50 text-emerald-950'
                : 'bg-amber-50 text-amber-950'
            }`}
            data-testid="predict-result"
          >
            {!reviewing && (
              <p className="font-bold">
                {right === a.pieces.length
                  ? 'Chính xác, em đọc đồ thị rất tốt.'
                  : `Em đúng ${right}/${a.pieces.length} khoảng. Nhìn lại phần tô màu nhé.`}
              </p>
            )}
            <ul className="mt-1 space-y-1">
              {a.pieces.map((piece, index) => (
                <li key={index} className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className={`mt-2.5 size-2 shrink-0 rounded-full ${piece.direction === 'up' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  />
                  {pieceExplanation(a, piece)}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[14px] text-slate-600">
              Xanh là đoạn đi lên, đỏ là đoạn đi xuống. Câu hỏi tiếp theo: làm sao biết điều này mà
              không cần vẽ đồ thị?
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Values (the definition) ─────────────────────────────────────────────────

function initialPair(a: FunctionAnalysis, view: View): [number, number] {
  const finite = a.pieces.find((piece) => Number.isFinite(piece.from) && Number.isFinite(piece.to));
  const piece = finite ?? a.pieces[0];
  const lo = Math.max(piece.from, view.xMin);
  const hi = Math.min(piece.to, view.xMax);
  return [lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.75];
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  testId: string;
}) {
  const id = React.useId();
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="w-10 shrink-0 text-[15px] font-semibold italic text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={(max - min) / 400}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={`${label} = ${decimal(value)}`}
        className="h-8 w-full accent-[#0052FF]"
        data-testid={testId}
      />
      <span className="w-16 shrink-0 text-right text-[14px] tabular-nums text-slate-600">
        {decimal(value)}
      </span>
    </div>
  );
}

function ValuesLayer({
  analysis: a,
  view,
  expression,
}: {
  analysis: FunctionAnalysis;
  view: View;
  expression: string;
}) {
  const [pair, setPair] = React.useState<[number, number]>(() => initialPair(a, view));
  const gap = (view.xMax - view.xMin) / 100;
  const [x1, x2] = pair;
  const y1 = evaluate(a.fn, x1);
  const y2 = evaluate(a.fn, x2);
  const p1 = pieceOf(a, x1);
  const p2 = pieceOf(a, x2);
  const same = p1 && p1 === p2;
  const comparison = y1 < y2 ? '<' : y1 > y2 ? '>' : '=';

  return (
    <div>
      <Plot
        analysis={a}
        view={view}
        colored
        label={`Đồ thị y = ${expression} với hai điểm x₁ và x₂.`}
      >
        {({ sx, sy, bottom }) => (
          <>
            {[
              [x1, y1, 'x₁'],
              [x2, y2, 'x₂'],
            ].map(([x, y, name]) =>
              Number.isFinite(y as number) ? (
                <g key={name as string}>
                  <line
                    x1={sx(x as number)}
                    x2={sx(x as number)}
                    y1={sy(y as number)}
                    y2={bottom}
                    className="stroke-[#0052FF]"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={sx(x as number)}
                    cy={sy(y as number)}
                    r="7"
                    className="fill-[#0052FF] stroke-white"
                    strokeWidth="2.5"
                  />
                  <text
                    x={sx(x as number)}
                    y={sy(y as number) - 12}
                    textAnchor="middle"
                    className="fill-[#0052FF] text-[14px] font-bold"
                  >
                    {name === 'x₁' ? 'A' : 'B'}
                  </text>
                </g>
              ) : null
            )}
          </>
        )}
      </Plot>
      <div className="mt-3 space-y-1">
        <Slider
          label="x₁"
          value={x1}
          min={view.xMin}
          max={view.xMax}
          onChange={(value) => setPair([Math.min(value, x2 - gap), x2])}
          testId="slider-x1"
        />
        <Slider
          label="x₂"
          value={x2}
          min={view.xMin}
          max={view.xMax}
          onChange={(value) => setPair([x1, Math.max(value, x1 + gap)])}
          testId="slider-x2"
        />
      </div>
      <div
        className="mt-3 rounded-xl bg-slate-50 p-4 text-[15px] leading-7 text-slate-800"
        aria-live="polite"
        data-testid="values-readout"
      >
        <p className="tabular-nums">
          x₁ = {decimal(x1)} &lt; x₂ = {decimal(x2)}, còn f(x₁) ={' '}
          {Number.isFinite(y1) ? decimal(y1) : 'không xác định'}{' '}
          {Number.isFinite(y1) && Number.isFinite(y2) ? comparison : ''} f(x₂) ={' '}
          {Number.isFinite(y2) ? decimal(y2) : 'không xác định'}.
        </p>
        <p className="mt-1 font-semibold">
          {same
            ? `Cả hai điểm cùng nằm trong ${formatInterval(p1.from, p1.to)}: x tăng thì y ${p1.direction === 'up' ? 'tăng, hàm số đồng biến ở đây' : 'giảm, hàm số nghịch biến ở đây'}.`
            : 'Hai điểm đang ở hai khoảng khác nhau. Kéo cả hai vào cùng một khoảng để so sánh.'}
        </p>
      </div>
    </div>
  );
}

// ─── Derivative ──────────────────────────────────────────────────────────────

function DerivativeLayer({
  analysis: a,
  view,
  expression,
}: {
  analysis: FunctionAnalysis;
  view: View;
  expression: string;
}) {
  const fPrime = React.useMemo(() => derivative(a.fn), [a]);
  const [x, setX] = React.useState(() => {
    const [first] = initialPair(a, view);
    return first;
  });
  const y = evaluate(a.fn, x);
  const slope = evaluate(fPrime, x);
  const defined = Number.isFinite(y) && Number.isFinite(slope);
  const zero = defined && Math.abs(slope) < 1e-3;
  const reach = (view.xMax - view.xMin) * 0.14;

  return (
    <div>
      <Plot
        analysis={a}
        view={view}
        colored
        strip
        label={`Đồ thị y = ${expression}, tiếp tuyến tại một điểm, và dấu của y′ bên dưới.`}
      >
        {({ sx, sy }) =>
          defined ? (
            <g>
              <line
                x1={sx(x - reach)}
                x2={sx(x + reach)}
                y1={sy(y - slope * reach)}
                y2={sy(y + slope * reach)}
                className={
                  zero ? 'stroke-slate-500' : slope > 0 ? 'stroke-emerald-700' : 'stroke-rose-700'
                }
                strokeWidth="2.5"
                strokeDasharray="7 5"
              />
              <circle
                cx={sx(x)}
                cy={sy(y)}
                r="7.5"
                className="fill-[#0052FF] stroke-white"
                strokeWidth="2.5"
              />
            </g>
          ) : null
        }
      </Plot>
      <div className="mt-3">
        <Slider
          label="x"
          value={x}
          min={view.xMin}
          max={view.xMax}
          onChange={setX}
          testId="slider-x"
        />
      </div>
      <p
        className={`mt-3 rounded-xl p-4 text-[15px] leading-7 tabular-nums ${
          !defined || zero
            ? 'bg-slate-50 text-slate-800'
            : slope > 0
              ? 'bg-emerald-50 text-emerald-950'
              : 'bg-rose-50 text-rose-950'
        }`}
        aria-live="polite"
        data-testid="derivative-readout"
      >
        {!defined ? (
          <>Tại x = {decimal(x)} hàm số không xác định.</>
        ) : zero ? (
          <>
            Tại x = {decimal(x)}: y′ = 0. Tiếp tuyến nằm ngang, đây là chỗ đồ thị có thể đổi chiều.
          </>
        ) : (
          <>
            Tại x = {decimal(x)}: y′ = {decimal(slope)} {slope > 0 ? '> 0' : '< 0'}.{' '}
            <strong>
              Tiếp tuyến đi {slope > 0 ? 'lên' : 'xuống'}, đồ thị đang đi{' '}
              {slope > 0 ? 'lên' : 'xuống'}.
            </strong>
          </>
        )}
      </p>
    </div>
  );
}

// ─── Public component ────────────────────────────────────────────────────────

export function FunctionGraph({
  source,
  layer,
  onPredicted,
  predicted = false,
  split = false,
}: {
  source: string;
  layer: GraphLayer;
  /** Called once the student has checked their prediction. */
  onPredicted?: () => void;
  /** The prediction was already made earlier (review): show the answer. */
  predicted?: boolean;
  /** Put the controls beside the plot on wide screens. */
  split?: boolean;
}) {
  const data = useAnalysis(source);
  if (!data) return null;
  const { analysis, view } = data;
  const expression = analysis.expression;
  return (
    <figure
      className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4"
      data-testid={`graph-${layer}`}
    >
      <figcaption className="mb-2 flex items-center justify-between gap-2 px-1 text-[15px] text-slate-600">
        <span>
          Đồ thị <InlineText text={`$y = ${expression}$`} />
        </span>
      </figcaption>
      {layer === 'predict' && (
        <PredictLayer
          analysis={analysis}
          view={view}
          expression={expression}
          onDone={onPredicted}
          done={predicted}
          split={split}
        />
      )}
      {layer === 'values' && (
        <ValuesLayer analysis={analysis} view={view} expression={expression} />
      )}
      {layer === 'derivative' && (
        <DerivativeLayer analysis={analysis} view={view} expression={expression} />
      )}
    </figure>
  );
}

// ─── Variation table ─────────────────────────────────────────────────────────

type Level = 'top' | 'mid' | 'bottom';

/** Bảng biến thiên computed from the function: x, the sign of y′, and the arrows of y. */
export function VariationTable({ source }: { source: string }) {
  const result = React.useMemo(() => analyzeFunction(source), [source]);
  const [boxRef, measured] = useMeasuredWidth();
  const arrowId = `vt-arrow-${React.useId().replace(/:/g, '')}`;
  if (!result.ok) return null;
  const a = result.analysis;
  const marks = [-Infinity, ...[...a.criticalPoints, ...a.breaks].sort((p, q) => p - q), Infinity];
  const width = Math.max(300, Math.min(measured, 640));
  const left = 64;
  const right = 28;
  const step = (width - left - right) / (marks.length - 1);
  const mx = (index: number) => left + step * index;
  const rowX = 34;
  const rowSign = 82;
  const yTop = 122;
  const yBottom = 196;
  const levelY = (level: Level) =>
    level === 'top' ? yTop : level === 'bottom' ? yBottom : (yTop + yBottom) / 2;
  const isBreak = (x: number) => a.breaks.includes(x);

  // Values and their heights at each mark.
  type Point = { index: number; value: number; level: Level };
  const ends: Array<{ before?: Point; after?: Point }> = marks.map((x, index) => {
    const leftSign = a.intervals[index - 1]?.sign;
    const rightSign = a.intervals[index]?.sign;
    if (x === -Infinity)
      return { after: { index, value: a.limits.left, level: rightSign > 0 ? 'bottom' : 'top' } };
    if (x === Infinity)
      return { before: { index, value: a.limits.right, level: leftSign > 0 ? 'top' : 'bottom' } };
    if (isBreak(x)) {
      const limits = a.limits.atBreak[String(x)];
      return {
        before: { index, value: limits.before, level: leftSign > 0 ? 'top' : 'bottom' },
        after: { index, value: limits.after, level: rightSign > 0 ? 'bottom' : 'top' },
      };
    }
    const level: Level = leftSign === rightSign ? 'mid' : leftSign > 0 ? 'top' : 'bottom';
    const point = { index, value: evaluate(a.fn, x), level };
    return { before: point, after: point };
  });

  const summary = a.pieces
    .map(
      (piece) =>
        `${piece.direction === 'up' ? 'đồng biến' : 'nghịch biến'} trên ${formatInterval(piece.from, piece.to)}`
    )
    .join('; ');

  return (
    <figure
      className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4"
      data-testid="variation-table"
    >
      <figcaption className="mb-2 px-1 text-[13px] font-bold uppercase tracking-wider text-slate-500">
        Bảng biến thiên
      </figcaption>
      <div ref={boxRef} className="overflow-x-auto">
        <svg
          width={width}
          height={214}
          viewBox={`0 0 ${width} 214`}
          className="max-w-none font-sans"
          role="img"
          aria-label={`Bảng biến thiên: hàm số ${summary}.`}
        >
          <defs>
            <marker
              id={arrowId}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 z" className="fill-slate-700" />
            </marker>
          </defs>
          <line x1="8" x2={width - 8} y1="50" y2="50" className="stroke-slate-300" />
          <line x1="8" x2={width - 8} y1="100" y2="100" className="stroke-slate-300" />
          <line x1="50" x2="50" y1="8" y2="206" className="stroke-slate-300" />
          <text
            x="22"
            y={rowX + 4}
            textAnchor="middle"
            className="fill-slate-600 text-[16px] italic"
          >
            x
          </text>
          <text
            x="22"
            y={rowSign + 4}
            textAnchor="middle"
            className="fill-slate-600 text-[16px] italic"
          >
            y′
          </text>
          <text x="22" y="164" textAnchor="middle" className="fill-slate-600 text-[16px] italic">
            y
          </text>
          {marks.map((x, index) => (
            <text
              key={index}
              x={mx(index)}
              y={rowX + 4}
              textAnchor="middle"
              className="fill-slate-900 text-[15px] font-semibold"
            >
              {formatNumber(x)}
            </text>
          ))}
          {marks.map((x, index) =>
            !Number.isFinite(x) ? null : isBreak(x) ? (
              <g key={index} className="stroke-slate-600">
                <line x1={mx(index) - 2} x2={mx(index) - 2} y1="58" y2="206" />
                <line x1={mx(index) + 2} x2={mx(index) + 2} y1="58" y2="206" />
              </g>
            ) : (
              <text
                key={index}
                x={mx(index)}
                y={rowSign + 5}
                textAnchor="middle"
                className="fill-slate-700 text-[15px] font-semibold"
              >
                0
              </text>
            )
          )}
          {a.intervals.map((interval, index) => (
            <text
              key={index}
              x={(mx(index) + mx(index + 1)) / 2}
              y={rowSign + 7}
              textAnchor="middle"
              className={`text-[22px] font-bold ${interval.sign > 0 ? 'fill-emerald-600' : 'fill-rose-600'}`}
            >
              {interval.sign > 0 ? '+' : '−'}
            </text>
          ))}
          {ends.map((end, index) => {
            const points = isBreak(marks[index])
              ? [
                  { point: end.before!, dx: -16, anchor: 'end' as const },
                  { point: end.after!, dx: 16, anchor: 'start' as const },
                ]
              : [{ point: (end.before ?? end.after)!, dx: 0, anchor: 'middle' as const }];
            return points.map(({ point, dx, anchor }) => (
              <text
                key={`${index}${dx}`}
                x={mx(index) + dx}
                y={levelY(point.level) + 5}
                textAnchor={anchor}
                className="fill-slate-900 text-[15px] font-semibold"
              >
                {formatNumber(point.value)}
              </text>
            ));
          })}
          {a.intervals.map((interval, index) => {
            const start = ends[index].after!;
            const end = ends[index + 1].before!;
            const x0 = mx(index) + (isBreak(marks[index]) ? 30 : 24);
            const x1 = mx(index + 1) - (isBreak(marks[index + 1]) ? 30 : 24);
            const y0 =
              levelY(start.level) +
              (start.level === 'top' ? 10 : start.level === 'bottom' ? -14 : 0);
            const y1 =
              levelY(end.level) + (end.level === 'top' ? 10 : end.level === 'bottom' ? -14 : 0);
            return (
              <line
                key={index}
                x1={x0}
                y1={y0}
                x2={x1}
                y2={y1}
                className={interval.sign > 0 ? 'stroke-emerald-600' : 'stroke-rose-600'}
                strokeWidth="2"
                markerEnd={`url(#${arrowId})`}
              />
            );
          })}
        </svg>
      </div>
      <p className="mt-2 px-1 text-[14px] leading-6 text-slate-600">
        Tú Tài tính bảng này trực tiếp từ hàm số <InlineText text={`$y = ${a.expression}$`} />: hàm
        số {summary}.
      </p>
    </figure>
  );
}
