import * as React from 'react';
import type { SignChart as SignChartModel } from '@/lib/knowledge-tree/lesson-structure';

/**
 * Sign chart and variation sketch for a derivative, drawn from the intervals
 * the lesson's own worked example states. Plain SVG: no chart library.
 */

const formatPoint = (value: number) =>
  value === -Infinity ? '−∞' : value === Infinity ? '+∞' : String(value).replace('-', '−');

export function SignChart({ chart }: { chart: SignChartModel }) {
  const arrowId = `sign-arrow-${React.useId().replace(/:/g, '')}`;
  const fn = chart.derivative.replace(/'.*$/, '') || 'y';
  const marks = [-Infinity, ...chart.points, Infinity];
  const width = 360;
  const left = 48;
  const right = 18;
  const step = (width - left - right) / (marks.length - 1);
  const x = (index: number) => left + step * index;

  // Schematic curve: rises on "+" intervals, falls on "-" intervals.
  let level = 0;
  const levels = [0];
  for (const interval of chart.intervals) {
    level += interval.sign === '+' ? 1 : -1;
    levels.push(level);
  }
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  const curveTop = 132;
  const curveHeight = 54;
  const y = (value: number) =>
    curveTop + curveHeight - ((value - min) / Math.max(1, max - min)) * curveHeight;
  const curveSmooth = levels
    .slice(1)
    .map((value, index) => {
      const x0 = x(index);
      const x1 = x(index + 1);
      const y0 = y(levels[index]);
      const y1 = y(value);
      return `C ${x0 + step / 2} ${y0}, ${x1 - step / 2} ${y1}, ${x1} ${y1}`;
    })
    .join(' ');

  const summary = chart.intervals
    .map(
      (interval) =>
        `trên (${formatPoint(interval.from)}; ${formatPoint(interval.to)}) ${chart.derivative} ${
          interval.sign === '+' ? 'dương, hàm số đồng biến' : 'âm, hàm số nghịch biến'
        }`
    )
    .join('; ');

  return (
    <figure className="rounded-2xl border border-indigo-100 bg-white p-4 sm:p-5">
      <figcaption className="mb-3 text-[13px] font-bold uppercase tracking-wider text-indigo-600">
        Bảng xét dấu và chiều biến thiên
      </figcaption>
      <svg
        viewBox={`0 0 ${width} 212`}
        className="h-auto w-full max-w-[520px] font-sans"
        role="img"
        aria-label={`Bảng xét dấu: ${summary}.`}
      >
        <defs>
          <marker
            id={arrowId}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {/* Row labels */}
        <text x="8" y="24" className="fill-slate-500 text-[13px] font-semibold">
          x
        </text>
        <text x="8" y="60" className="fill-slate-500 text-[13px] font-semibold">
          {chart.derivative}
        </text>
        <text x="8" y="100" className="fill-slate-500 text-[13px] font-semibold">
          {fn}
        </text>
        <line x1={left - 10} x2={width - 4} y1="36" y2="36" className="stroke-slate-200" />
        <line x1={left - 10} x2={width - 4} y1="74" y2="74" className="stroke-slate-200" />
        <line x1={left - 10} x2={left - 10} y1="6" y2="118" className="stroke-slate-200" />

        {marks.map((mark, index) => (
          <g key={index}>
            <text
              x={x(index)}
              y="24"
              textAnchor="middle"
              className="fill-slate-800 text-[13px] font-semibold"
            >
              {formatPoint(mark)}
            </text>
            {Number.isFinite(mark) && (
              <>
                <line
                  x1={x(index)}
                  x2={x(index)}
                  y1="42"
                  y2="70"
                  className="stroke-slate-300"
                  strokeDasharray="3 3"
                />
                <text
                  x={x(index)}
                  y="60"
                  textAnchor="middle"
                  className="fill-slate-500 text-[13px]"
                >
                  0
                </text>
              </>
            )}
          </g>
        ))}

        {chart.intervals.map((interval, index) => {
          const mid = (x(index) + x(index + 1)) / 2;
          const up = interval.sign === '+';
          return (
            <g key={index} className={up ? 'text-emerald-600' : 'text-rose-600'}>
              <text
                x={mid}
                y="61"
                textAnchor="middle"
                className="fill-current text-[17px] font-bold"
              >
                {up ? '+' : '−'}
              </text>
              <line
                x1={mid - step * 0.28}
                x2={mid + step * 0.28}
                y1={up ? 106 : 84}
                y2={up ? 84 : 106}
                stroke="currentColor"
                strokeWidth="2"
                markerEnd={`url(#${arrowId})`}
              />
            </g>
          );
        })}

        {/* Sketch of the graph's shape */}
        <path
          d={`M ${x(0)} ${y(levels[0])} ${curveSmooth}`}
          fill="none"
          className="stroke-indigo-500"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {chart.points.map((point, index) => (
          <g key={point}>
            <circle
              cx={x(index + 1)}
              cy={y(levels[index + 1])}
              r="4"
              className="fill-white stroke-indigo-600"
              strokeWidth="2"
            />
            <text
              x={x(index + 1)}
              y={levels[index + 1] === max ? y(levels[index + 1]) - 9 : y(levels[index + 1]) + 18}
              textAnchor="middle"
              className="fill-slate-500 text-[11px]"
            >
              x = {formatPoint(point)}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-2 text-[13px] leading-5 text-slate-500">
        Vẽ từ lời giải ở trên: nơi {chart.derivative} mang dấu{' '}
        <span className="font-semibold text-emerald-700">+</span> thì đồ thị đi lên, nơi mang dấu{' '}
        <span className="font-semibold text-rose-700">−</span> thì đồ thị đi xuống. Hình chỉ minh
        hoạ chiều biến thiên, không đúng tỉ lệ.
      </p>
    </figure>
  );
}
