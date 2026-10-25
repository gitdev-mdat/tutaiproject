'use client';

import * as React from 'react';
import { Lock } from 'lucide-react';
import { derivative, evaluate, type FunctionAnalysis } from '@/lib/learning/function-model';
import {
  PAD,
  Plot,
  decimal,
  useAnalysis,
  type PieceTone,
  type PlotScale,
  type View,
} from '../function-graph';
import { InlineText } from '../rich-text';

/**
 * The lesson's graph as a place to explore: a point the student drags along
 * the curve (pointer, touch or keyboard), its tangent and the value of f′
 * there, the sign of f′ painted under the axis wherever the student has been,
 * and taps on the curve. Every number comes from the analysed function.
 */

/** Bins across the view used to remember where the student has dragged. */
export const TRAIL_BINS = 72;

export function trailBin(x: number, view: View): number {
  const t = (x - view.xMin) / (view.xMax - view.xMin);
  return Math.max(0, Math.min(TRAIL_BINS - 1, Math.floor(t * TRAIL_BINS)));
}

export function binCenter(bin: number, view: View): number {
  return view.xMin + ((bin + 0.5) / TRAIL_BINS) * (view.xMax - view.xMin);
}

/** Snaps x to a nearby special point (within 2.5 % of the view), so f′ = 0 can be landed on exactly. */
export function snapX(x: number, view: View, points: number[]): number {
  const tolerance = (view.xMax - view.xMin) * 0.025;
  let best = x;
  let distance = tolerance;
  for (const point of points) {
    const d = Math.abs(point - x);
    if (d <= distance) {
      best = point;
      distance = d;
    }
  }
  return Math.max(view.xMin, Math.min(view.xMax, best));
}

/**
 * The x values where the curve is inside the view, so M can never be dragged
 * off the picture (y = x³ − 3x² + 2 leaves the view well before x reaches its edges).
 */
export function reachableRange(a: FunctionAnalysis, view: View): [number, number] {
  const n = 400;
  let lo = view.xMax;
  let hi = view.xMin;
  for (let i = 0; i <= n; i += 1) {
    const x = view.xMin + ((view.xMax - view.xMin) * i) / n;
    const y = evaluate(a.fn, x);
    if (!Number.isFinite(y) || y < view.yMin || y > view.yMax) continue;
    lo = Math.min(lo, x);
    hi = Math.max(hi, x);
  }
  return lo < hi ? [lo, hi] : [view.xMin, view.xMax];
}

export interface ExploreGraphProps {
  source: string;
  height: number;
  caption?: React.ReactNode;
  /** Shown at the right of the caption: a live value, a status. */
  badge?: React.ReactNode;
  drawIn?: boolean;
  marks?: number[];
  paint?: PieceTone[];
  bands?: Array<{ from: number; to: number; tone: 'up' | 'down' | 'focus' }>;
  /** A dot running along the curve, left to right, to show "đi từ trái sang phải". */
  tracer?: boolean;
  /** Two points A, B with their values, for the definition (x₁ < x₂). */
  pair?: [number, number] | null;
  /** The draggable point M. */
  point?: {
    x: number;
    onChange: (x: number) => void;
    tangent?: boolean;
    /** Show "f′(x) = …" beside M. */
    slope?: boolean;
  } | null;
  /** Points M snaps to. */
  snapTo?: number[];
  /** A tap on the plot area, at x. */
  onTap?: (x: number) => void;
  /** Bins of the sign trail the student has uncovered, and the zeros found. */
  trail?: { visited: boolean[]; zeros: number[] } | null;
  /** Points to draw attention to once (a soft ping). */
  pulse?: number[];
  /** Replace the curve by a placeholder (the challenge, before it is solved). */
  hidden?: React.ReactNode;
  /** Show the slider under the graph as another way to move M. */
  slider?: boolean;
  testId?: string;
}

export function ExploreGraph(props: ExploreGraphProps) {
  const data = useAnalysis(props.source);
  if (!data) return null;
  return <ExploreGraphInner {...props} analysis={data.analysis} view={data.view} />;
}

function ExploreGraphInner({
  analysis: a,
  view,
  height,
  caption,
  badge,
  drawIn,
  marks,
  paint,
  bands,
  tracer,
  pair,
  point,
  snapTo = [],
  onTap,
  trail,
  pulse,
  hidden,
  slider,
  testId,
}: ExploreGraphProps & { analysis: FunctionAnalysis; view: View }) {
  const fPrime = React.useMemo(() => derivative(a.fn), [a]);
  const sliderId = React.useId();
  const [lo, hi] = React.useMemo(() => reachableRange(a, view), [a, view]);
  // M snaps onto a special point, and lets go of it as soon as the student moves on
  // (arrow keys move by less than the snapping distance): the point it just left is
  // ignored until M has moved clear of it.
  const released = React.useRef<number | null>(null);
  const current = point?.x;
  const moveTo = React.useCallback(
    (x: number) => {
      if (!point) return;
      const tolerance = (view.xMax - view.xMin) * 0.025;
      const leaving = snapTo.find((p) => current !== undefined && Math.abs(current - p) < 1e-9);
      if (leaving !== undefined && Math.abs(x - leaving) > tolerance * 0.2)
        released.current = leaving;
      if (released.current !== null && Math.abs(x - released.current) > tolerance)
        released.current = null;
      const targets = snapTo.filter((p) => p !== released.current);
      point.onChange(Math.max(lo, Math.min(hi, snapX(x, view, targets))));
    },
    [point, current, view, snapTo, lo, hi]
  );

  const head = (
    <figcaption className="flex min-h-11 items-center justify-between gap-3 py-1.5 pl-12 pr-1 text-[14px] text-slate-600 md:pl-1">
      <span className="min-w-0 truncate">
        {caption ?? <InlineText text={`$y = ${a.expression}$`} />}
      </span>
      {badge}
    </figcaption>
  );

  if (hidden) {
    return (
      <figure
        className="rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_12px_40px_rgba(9,18,36,0.06)] sm:p-3"
        data-testid={testId}
      >
        {head}
        <div
          className="relative grid place-items-center overflow-hidden rounded-xl bg-[#F8FAFD] bg-precision-grid-faint"
          style={{ height }}
          data-testid="graph-hidden"
        >
          <div className="mx-6 flex max-w-[300px] flex-col items-center gap-2 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-white text-slate-500 shadow-sm">
              <Lock className="size-5" aria-hidden="true" />
            </span>
            <div className="text-[14px] leading-6 text-slate-600">{hidden}</div>
          </div>
        </div>
      </figure>
    );
  }

  const below = trail
    ? {
        height: 44,
        render: (scale: PlotScale) => (
          <SignTrail analysis={a} view={view} scale={scale} trail={trail} />
        ),
      }
    : undefined;

  return (
    <figure
      className="select-none rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_12px_40px_rgba(9,18,36,0.06)] sm:p-3"
      data-testid={testId}
    >
      {head}
      <Plot
        analysis={a}
        view={view}
        colored={false}
        paint={paint}
        bands={bands}
        marks={marks}
        drawIn={drawIn}
        height={height}
        below={below}
        label={`Đồ thị y = ${a.expression}.`}
      >
        {(scale) => (
          <>
            {pair && <PairLayer analysis={a} scale={scale} pair={pair} />}
            {(onTap || point) && (
              <PointerSurface scale={scale} onTap={onTap} onScrub={point ? moveTo : undefined} />
            )}
            {pulse?.map((x) => {
              const y = evaluate(a.fn, x);
              return Number.isFinite(y) ? (
                <circle
                  key={`pulse-${x}`}
                  cx={scale.sx(x)}
                  cy={scale.sy(y)}
                  r="14"
                  className="tt-ping pointer-events-none fill-amber-400/50"
                />
              ) : null;
            })}
            {tracer && <Tracer analysis={a} view={view} scale={scale} />}
            {point && (
              <DragPoint
                analysis={a}
                fPrime={fPrime}
                view={view}
                scale={scale}
                x={point.x}
                tangent={point.tangent ?? false}
                slope={point.slope ?? false}
                onMove={moveTo}
              />
            )}
          </>
        )}
      </Plot>
      {point && slider && (
        <div className="mt-1 flex items-center gap-3 px-1">
          <label
            htmlFor={sliderId}
            className="shrink-0 text-[13px] font-semibold italic text-slate-500"
          >
            x<sub>M</sub>
          </label>
          <input
            id={sliderId}
            type="range"
            min={lo}
            max={hi}
            step={(hi - lo) / 400}
            value={point.x}
            onChange={(event) => moveTo(Number(event.target.value))}
            aria-valuetext={`x = ${decimal(point.x)}`}
            className="h-7 w-full accent-[#0052FF]"
            data-testid="explore-slider"
          />
          <span className="w-12 shrink-0 text-right text-[13px] tabular-nums text-slate-500">
            {decimal(point.x)}
          </span>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {point ? slopeSentence(a, fPrime, point.x) : ''}
      </span>
    </figure>
  );
}

function slopeSentence(a: FunctionAnalysis, fPrime: ReturnType<typeof derivative>, x: number) {
  const slope = evaluate(fPrime, x);
  if (!Number.isFinite(slope) || !Number.isFinite(evaluate(a.fn, x))) {
    return `Tại x = ${decimal(x)} hàm số không xác định.`;
  }
  if (Math.abs(slope) < 1e-9) return `Tại x = ${decimal(x)}, f′ bằng 0, tiếp tuyến nằm ngang.`;
  return `Tại x = ${decimal(x)}, f′ = ${decimal(slope)}, ${slope > 0 ? 'dương' : 'âm'}.`;
}

/**
 * Taps and scrubs on the plot. A mouse or pen drags from anywhere; a finger
 * scrubs only when it moves sideways, so swiping up or down still scrolls the
 * page (the plot keeps touch-action: pan-y).
 */
function PointerSurface({
  scale,
  onTap,
  onScrub,
}: {
  scale: PlotScale;
  onTap?: (x: number) => void;
  onScrub?: (x: number) => void;
}) {
  const start = React.useRef<{ x: number; y: number; id: number; dragging: boolean } | null>(null);
  const toX = (event: React.PointerEvent<SVGRectElement>) => {
    const svg = event.currentTarget.ownerSVGElement!;
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) * scale.width) / rect.width;
    return scale.invX(px);
  };
  return (
    <rect
      x={0}
      y={0}
      width={scale.width}
      height={scale.plotHeight}
      fill="transparent"
      className={onScrub ? 'cursor-crosshair' : 'cursor-pointer'}
      data-testid="graph-surface"
      data-plot-width={scale.width}
      data-x-min={scale.invX(PAD)}
      data-x-max={scale.invX(scale.width - PAD)}
      onPointerDown={(event) => {
        start.current = {
          x: event.clientX,
          y: event.clientY,
          id: event.pointerId,
          dragging: false,
        };
        if (event.pointerType !== 'touch' && onScrub) {
          // No text selection while dragging with a mouse.
          event.preventDefault();
          start.current.dragging = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          onScrub(toX(event));
        }
      }}
      onPointerMove={(event) => {
        const s = start.current;
        if (!s || s.id !== event.pointerId || !onScrub) return;
        if (!s.dragging) {
          const dx = Math.abs(event.clientX - s.x);
          const dy = Math.abs(event.clientY - s.y);
          if (dx > 6 && dx > dy) {
            s.dragging = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          } else return;
        }
        onScrub(toX(event));
      }}
      onPointerUp={(event) => {
        const s = start.current;
        start.current = null;
        if (!s || s.id !== event.pointerId) return;
        const moved = Math.hypot(event.clientX - s.x, event.clientY - s.y);
        if (!s.dragging && moved < 10) {
          const x = toX(event);
          if (onTap) onTap(x);
          else onScrub?.(x);
        }
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
    />
  );
}

function DragPoint({
  analysis: a,
  fPrime,
  view,
  scale,
  x,
  tangent,
  slope: showSlope,
  onMove,
}: {
  analysis: FunctionAnalysis;
  fPrime: ReturnType<typeof derivative>;
  view: View;
  scale: PlotScale;
  x: number;
  tangent: boolean;
  slope: boolean;
  onMove: (x: number) => void;
}) {
  const dragging = React.useRef(false);
  const y = evaluate(a.fn, x);
  const slope = evaluate(fPrime, x);
  const defined = Number.isFinite(y) && Number.isFinite(slope);
  const flat = defined && Math.abs(slope) < 1e-9;
  const reach = (view.xMax - view.xMin) * 0.16;
  const step = (view.xMax - view.xMin) / 80;
  const px = scale.sx(x);
  const py = defined ? scale.sy(y) : scale.bottom;
  const tone = !defined || flat ? 'slate' : slope > 0 ? 'up' : 'down';
  const label = defined ? (flat ? 'f′ = 0' : `f′ = ${decimal(slope)}`) : 'không xác định';
  const labelW = label.length * 8.4 + 18;
  const labelX = px + 14 + labelW > scale.width - 8 ? px - 14 - labelW : px + 14;
  // Above M, or below it when M is near the top of the plot.
  const labelY = py - 40 < 24 ? py + 52 : py - 40;

  const toX = (event: React.PointerEvent<SVGGElement>) => {
    const svg = (event.currentTarget as SVGGElement).ownerSVGElement!;
    const rect = svg.getBoundingClientRect();
    return scale.invX(((event.clientX - rect.left) * scale.width) / rect.width);
  };

  return (
    <g>
      {tangent && defined && (
        <line
          x1={scale.sx(x - reach)}
          x2={scale.sx(x + reach)}
          y1={scale.sy(y - slope * reach)}
          y2={scale.sy(y + slope * reach)}
          strokeWidth="3"
          strokeLinecap="round"
          className={`pointer-events-none ${
            tone === 'up'
              ? 'stroke-emerald-600'
              : tone === 'down'
                ? 'stroke-rose-600'
                : 'stroke-amber-500'
          }`}
          data-testid="tangent"
        />
      )}
      {flat && tangent && (
        <circle cx={px} cy={py} r="16" className="tt-ping pointer-events-none fill-amber-400/50" />
      )}
      {showSlope && (
        <g className="pointer-events-none" data-testid="slope-label">
          <rect
            x={labelX}
            y={labelY - 17}
            width={labelW}
            height={26}
            rx={13}
            className={
              tone === 'up'
                ? 'fill-emerald-600'
                : tone === 'down'
                  ? 'fill-rose-600'
                  : 'fill-amber-500'
            }
          />
          <text
            x={labelX + labelW / 2}
            y={labelY + 1}
            textAnchor="middle"
            className="fill-white text-[14px] font-bold tabular-nums"
          >
            {label}
          </text>
        </g>
      )}
      <g
        role="slider"
        tabIndex={0}
        aria-label="Điểm M trên đồ thị. Dùng phím mũi tên trái phải để di chuyển."
        aria-valuemin={Number(view.xMin.toFixed(2))}
        aria-valuemax={Number(view.xMax.toFixed(2))}
        aria-valuenow={Number(x.toFixed(2))}
        aria-valuetext={`x = ${decimal(x)}, ${label}`}
        className="cursor-grab outline-none active:cursor-grabbing [&:focus-visible>circle:nth-child(2)]:stroke-blue-500"
        style={{ touchAction: 'none' }}
        data-testid="drag-point"
        onKeyDown={(event) => {
          const big = event.shiftKey || event.key === 'PageUp' || event.key === 'PageDown';
          const delta = big ? step * 5 : step;
          let next: number | null = null;
          if (event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'PageUp')
            next = x + delta;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowDown' || event.key === 'PageDown')
            next = x - delta;
          if (event.key === 'Home') next = view.xMin;
          if (event.key === 'End') next = view.xMax;
          if (next === null) return;
          event.preventDefault();
          onMove(next);
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          event.stopPropagation();
        }}
        onPointerMove={(event) => {
          if (dragging.current) onMove(toX(event));
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        <circle cx={px} cy={py} r="24" fill="transparent" />
        <circle
          cx={px}
          cy={py}
          r="10"
          className="fill-[#0052FF] stroke-white drop-shadow-[0_2px_6px_rgba(0,82,255,0.45)]"
          strokeWidth="3"
        />
        <text
          x={px}
          y={py + 30}
          textAnchor="middle"
          className="pointer-events-none fill-[#0052FF] text-[14px] font-extrabold"
        >
          M
        </text>
      </g>
    </g>
  );
}

/** A dot running along the curve from left to right, moved without re-rendering React. */
function Tracer({
  analysis: a,
  view,
  scale,
}: {
  analysis: FunctionAnalysis;
  view: View;
  scale: PlotScale;
}) {
  const dot = React.useRef<SVGCircleElement>(null);
  const halo = React.useRef<SVGCircleElement>(null);
  React.useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const started = performance.now();
    const duration = 4200;
    const tick = (now: number) => {
      const t = ((now - started) % duration) / duration;
      const x = view.xMin + (view.xMax - view.xMin) * t;
      const y = evaluate(a.fn, x);
      const visible = Number.isFinite(y) && y > view.yMin && y < view.yMax;
      for (const element of [dot.current, halo.current]) {
        if (!element) continue;
        element.setAttribute('cx', String(scale.sx(x)));
        element.setAttribute('cy', String(scale.sy(Number.isFinite(y) ? y : view.yMin)));
        element.style.opacity = visible ? '1' : '0';
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [a, view, scale]);
  return (
    <g className="pointer-events-none" aria-hidden="true">
      <circle ref={halo} r="13" cx={-20} cy={-20} className="fill-amber-300/40" />
      <circle
        ref={dot}
        r="6.5"
        cx={-20}
        cy={-20}
        className="fill-amber-500 stroke-white"
        strokeWidth="2"
      />
    </g>
  );
}

function PairLayer({
  analysis: a,
  scale,
  pair,
}: {
  analysis: FunctionAnalysis;
  scale: PlotScale;
  pair: [number, number];
}) {
  return (
    <g className="pointer-events-none" data-testid="pair">
      {pair.map((x, index) => {
        const y = evaluate(a.fn, x);
        if (!Number.isFinite(y)) return null;
        const name = index === 0 ? 'A' : 'B';
        return (
          <g key={name} className="tt-fade-in">
            <line
              x1={scale.sx(x)}
              x2={scale.sx(x)}
              y1={scale.sy(y)}
              y2={scale.bottom}
              className="stroke-[#0052FF]"
              strokeDasharray="3 3"
            />
            <line
              x1={20}
              x2={scale.sx(x)}
              y1={scale.sy(y)}
              y2={scale.sy(y)}
              className="stroke-violet-500"
              strokeDasharray="3 3"
            />
            <text
              x={24}
              y={scale.sy(y) - 6}
              className="fill-violet-700 text-[13px] font-bold italic"
            >
              f(x{index === 0 ? '₁' : '₂'})
            </text>
            <circle
              cx={scale.sx(x)}
              cy={scale.sy(y)}
              r="7"
              className="fill-[#0052FF] stroke-white"
              strokeWidth="2.5"
            />
            <text
              x={scale.sx(x) + 10}
              y={scale.sy(y) - 10}
              className="fill-[#0052FF] text-[14px] font-extrabold"
            >
              {name}
            </text>
            <text
              x={scale.sx(x)}
              y={scale.bottom - 6}
              textAnchor="middle"
              className="fill-[#0052FF] text-[13px] font-bold italic"
            >
              x{index === 0 ? '₁' : '₂'}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/**
 * The sign of f′ under the graph, painted only where the student has dragged
 * M: the sign table of the lesson, built by hand.
 */
function SignTrail({
  analysis: a,
  view,
  scale,
  trail,
}: {
  analysis: FunctionAnalysis;
  view: View;
  scale: PlotScale;
  trail: { visited: boolean[]; zeros: number[] };
}) {
  const fPrime = React.useMemo(() => derivative(a.fn), [a]);
  const top = 6;
  const h = 32;
  const binW = (scale.width - 36) / TRAIL_BINS;
  const [lo, hi] = reachableRange(a, view);
  const covered = (from: number, to: number) => {
    let count = 0;
    let total = 0;
    for (let bin = 0; bin < TRAIL_BINS; bin += 1) {
      const x = binCenter(bin, view);
      if (x <= from || x >= to || x < lo || x > hi) continue;
      total += 1;
      if (trail.visited[bin]) count += 1;
    }
    return total ? count / total : 0;
  };
  return (
    <g data-testid="sign-trail">
      <rect
        x={18}
        y={top}
        width={scale.width - 36}
        height={h}
        rx={8}
        className="fill-slate-50 stroke-slate-200"
      />
      {trail.visited.map((seen, bin) => {
        if (!seen) return null;
        const value = evaluate(fPrime, binCenter(bin, view));
        if (!Number.isFinite(value)) return null;
        return (
          <rect
            key={bin}
            x={18 + bin * binW}
            y={top + 4}
            width={binW + 0.5}
            height={h - 8}
            className={`tt-fade-in ${value > 0 ? 'fill-emerald-200' : value < 0 ? 'fill-rose-200' : 'fill-amber-200'}`}
          />
        );
      })}
      <text x={26} y={top + 21} className="fill-slate-500 text-[13px] font-semibold italic">
        f′
      </text>
      {a.intervals.map((interval, index) => {
        const lo = Math.max(interval.from, view.xMin);
        const hi = Math.min(interval.to, view.xMax);
        if (!(hi > lo) || covered(interval.from, interval.to) < 0.25) return null;
        return (
          <text
            key={index}
            x={(scale.sx(lo) + scale.sx(hi)) / 2}
            y={top + 23}
            textAnchor="middle"
            className={`tt-pop text-[20px] font-extrabold ${interval.sign > 0 ? 'fill-emerald-700' : 'fill-rose-700'}`}
          >
            {interval.sign > 0 ? '+' : '−'}
          </text>
        );
      })}
      {trail.zeros.map((x) => (
        <g key={`zero-${x}`} className="tt-pop">
          <circle cx={scale.sx(x)} cy={top + h / 2} r="10" className="fill-amber-400" />
          <text
            x={scale.sx(x)}
            y={top + h / 2 + 5}
            textAnchor="middle"
            className="fill-white text-[13px] font-extrabold"
          >
            0
          </text>
        </g>
      ))}
    </g>
  );
}
