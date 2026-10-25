'use client';

import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronDown, Keyboard } from 'lucide-react';
import { formatInterval, formatNumber, type MonotonePiece } from '@/lib/learning/function-model';
import type { InteractivePlan } from '@/lib/learning/interactive-lesson';
import { useAnalysis, type PieceTone } from '../function-graph';
import { RichText } from '../rich-text';
import { Beat, Feedback, Hints, Outcome, Prompt, RuntimeContext, useAttempt } from './beats';
import { ExploreGraph } from './explore-graph';
import { StageLayout } from './stage-layout';

/**
 * Part 1, "Đồ thị này đi đâu?": the curve draws itself, a dot runs along it,
 * and the student finds where it turns by tapping the graph, then says which
 * pieces go up and which go down. Nothing is labelled before they try.
 */
export function ShapeStage({
  plan,
  height,
  onReady,
}: {
  plan: InteractivePlan;
  height: number;
  onReady: () => void;
}) {
  const data = useAnalysis(plan.main);
  const { review } = React.useContext(RuntimeContext);
  const turning = React.useMemo(
    () =>
      data ? data.analysis.criticalPoints.filter((x) => isTurning(data.analysis.pieces, x)) : [],
    [data]
  );
  const [tapped, setFound] = React.useState<number[]>(() => (review ? turning : []));
  const [miss, setMiss] = React.useState<number | null>(null);
  const [keyboard, setKeyboard] = React.useState(false);
  const [probe, setProbe] = React.useState(0);
  const find = useAttempt('bat-dau/doi-chieu');
  const label = useAttempt('bat-dau/len-xuong');
  const [labels, setLabels] = React.useState<Record<number, 'up' | 'down'>>({});
  const [wrongPiece, setWrongPiece] = React.useState<number | null>(null);

  const found = find.state.status === 'revealed' ? turning : tapped;
  const allFound = found.length >= turning.length;
  const labelsDone = label.done;
  React.useEffect(() => {
    if (!turning.length && !find.done) find.complete();
  }, [turning.length, find]);
  React.useEffect(() => {
    if (labelsDone) onReady();
  }, [labelsDone, onReady]);

  if (!data) return null;
  const { analysis: a, view } = data;
  const width = view.xMax - view.xMin;

  const tap = (x: number) => {
    if (allFound || find.done) return;
    const near = turning.find(
      (point) => !found.includes(point) && Math.abs(point - x) <= width * 0.06
    );
    if (near !== undefined) {
      const next = [...found, near].sort((p, q) => p - q);
      setFound(next);
      setMiss(null);
      if (next.length === turning.length) find.submit(true);
      return;
    }
    if (turning.some((point) => found.includes(point) && Math.abs(point - x) <= width * 0.06))
      return;
    setMiss(x);
    find.submit(false);
  };

  const pick = (index: number, value: 'up' | 'down') => {
    if (label.done || labels[index] === a.pieces[index].direction) return;
    if (value === a.pieces[index].direction) {
      const next = { ...labels, [index]: value };
      setLabels(next);
      setWrongPiece(null);
      if (a.pieces.every((piece, i) => next[i] === piece.direction)) label.submit(true);
    } else {
      setWrongPiece(index);
      label.submit(false);
    }
  };

  const shownLabels =
    label.state.status !== 'open' && !review
      ? labelAll(a.pieces)
      : review
        ? labelAll(a.pieces)
        : labels;
  const paint: PieceTone[] = a.pieces.map((piece, index) =>
    shownLabels[index] === piece.direction ? piece.direction : null
  );
  const focusBands =
    !allFound && find.state.hints >= 2
      ? turning
          .filter((point) => !found.includes(point))
          .map((point) => ({
            from: point - width * 0.08,
            to: point + width * 0.08,
            tone: 'focus' as const,
          }))
      : allFound && !labelsDone && wrongPiece !== null
        ? [{ from: a.pieces[wrongPiece].from, to: a.pieces[wrongPiece].to, tone: 'focus' as const }]
        : [];

  const graph = (
    <ExploreGraph
      source={plan.main}
      height={height}
      drawIn={!review}
      tracer={!allFound && !review}
      marks={allFound ? turning : found}
      paint={paint}
      bands={focusBands}
      pulse={miss === null && found.length ? [found[found.length - 1]] : undefined}
      onTap={!allFound ? tap : undefined}
      point={keyboard && !allFound ? { x: probe, onChange: setProbe } : null}
      slider={keyboard}
      testId="graph-shape"
      badge={
        !allFound ? (
          <span
            key={`${found.length}-${find.state.misses}`}
            className="tt-pop shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[13px] font-bold text-amber-700"
            role="status"
          >
            {/* Said on the graph too: on a phone the feedback below may be out of view. */}
            {miss !== null ? 'Chưa phải, thử chỗ khác · ' : ''}Đã tìm {found.length}/
            {turning.length}
          </span>
        ) : null
      }
    />
  );

  return (
    <StageLayout graph={graph}>
      {turning.length > 0 && (
        <Beat
          number={1}
          title="Quan sát"
          status={allFound ? 'done' : 'active'}
          summary={
            <>
              Đồ thị đổi chiều tại{' '}
              <strong className="font-bold text-[#091224]">
                x = {turning.map(formatNumber).join(' và x = ')}
              </strong>
            </>
          }
          testId="beat-turning"
        >
          <Prompt>
            Chấm vàng đang chạy dọc đồ thị từ trái sang phải. <br className="hidden sm:block" />
            <span className="text-blue-700">Chạm vào những chỗ nó đổi chiều</span> (đang lên chuyển
            sang xuống, hoặc ngược lại).
          </Prompt>
          {!allFound && (
            <>
              {miss !== null && (
                <Feedback tone="wrong" testId="tap-miss">
                  Ở x ≈ {formatNumber(Math.round(miss * 10) / 10)} đồ thị vẫn đi tiếp một chiều. Tìm
                  chỗ nó quay đầu nhé.
                </Feedback>
              )}
              <Hints
                attempt={find}
                hints={[
                  'Chỗ đổi chiều là đỉnh của một "ngọn đồi" hoặc đáy của một "thung lũng" trên đồ thị.',
                  'Nhìn vào vùng được tô vàng trên đồ thị.',
                ]}
              />
              <button
                type="button"
                onClick={() => setKeyboard((value) => !value)}
                className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-pressed={keyboard}
                data-testid="keyboard-mode"
              >
                <Keyboard className="size-4" aria-hidden="true" />
                {keyboard ? 'Ẩn thanh trượt' : 'Không chạm được? Dùng thanh trượt'}
              </button>
              {keyboard && (
                <button
                  type="button"
                  onClick={() => tap(probe)}
                  className="mt-1 inline-flex min-h-10 items-center rounded-xl bg-[#091224] px-4 text-[14px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  data-testid="mark-here"
                >
                  Đánh dấu chỗ đổi chiều tại M
                </button>
              )}
            </>
          )}
        </Beat>
      )}

      {allFound && (
        <Beat
          number={turning.length ? 2 : 1}
          title="Dự đoán"
          status={labelsDone ? 'done' : 'active'}
          summary={a.pieces
            .map(
              (piece) =>
                `${formatInterval(piece.from, piece.to)} ${piece.direction === 'up' ? 'đi lên' : 'đi xuống'}`
            )
            .join(' · ')}
          testId="beat-direction"
        >
          {find.state.status === 'revealed' && !review && (
            <Feedback tone="shown" title="Đây là những chỗ đổi chiều.">
              {turning
                .map(
                  (x) =>
                    `${a.pieces.find((piece) => piece.to === x)?.direction === 'up' ? 'Đỉnh' : 'Đáy'} tại x = ${formatNumber(x)}`
                )
                .join(', ')}
              .
            </Feedback>
          )}
          {find.state.status === 'correct' && !review && !labelsDone && (
            <Feedback tone="right" title={find.state.misses ? 'Tìm được rồi!' : 'Mắt tinh lắm!'}>
              Đồ thị được chia thành {a.pieces.length} đoạn.
            </Feedback>
          )}
          <Prompt>Đi từ trái sang phải, mỗi đoạn đi lên hay đi xuống?</Prompt>
          <ul className="mt-3 space-y-2">
            {a.pieces.map((piece, index) => {
              const right = shownLabels[index] === piece.direction;
              return (
                <li
                  key={index}
                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 transition-colors ${
                    right
                      ? piece.direction === 'up'
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-rose-300 bg-rose-50'
                      : wrongPiece === index
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-slate-200 bg-white'
                  }`}
                  data-testid={`piece-${index}`}
                >
                  <span className="min-w-0 flex-1 text-[15px] font-bold tabular-nums text-[#091224]">
                    {formatInterval(piece.from, piece.to)}
                  </span>
                  {(['up', 'down'] as const).map((value) => {
                    const Icon = value === 'up' ? ArrowUpRight : ArrowDownRight;
                    const chosen = right && piece.direction === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={labelsDone || right}
                        onClick={() => pick(index, value)}
                        className={`inline-flex h-10 items-center gap-1 rounded-lg px-3 text-[14px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          chosen
                            ? value === 'up'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-rose-600 text-white'
                            : 'border border-slate-200 bg-white text-slate-600 enabled:hover:border-blue-400 disabled:opacity-40'
                        }`}
                        data-testid={`piece-${index}-${value}`}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                        {value === 'up' ? 'Lên' : 'Xuống'}
                      </button>
                    );
                  })}
                </li>
              );
            })}
          </ul>
          {!labelsDone && (
            <Hints
              attempt={label}
              extra={
                wrongPiece !== null
                  ? 'Đoạn tô vàng: nhìn chấm chạy từ trái sang phải trên đoạn đó.'
                  : undefined
              }
              hints={[
                'Đi từ trái sang phải: chấm leo lên là đồ thị đi lên, chấm tụt xuống là đồ thị đi xuống.',
                'So sánh độ cao ở đầu và ở cuối đoạn.',
              ]}
            />
          )}
          {labelsDone && !review && (
            <Outcome
              attempt={label}
              right="Xanh là đoạn đi lên, đỏ là đoạn đi xuống."
              shown="Xanh là đoạn đi lên, đỏ là đoạn đi xuống."
            />
          )}
        </Beat>
      )}

      {labelsDone && (
        <div
          className="tt-rise rounded-2xl bg-[#091224] p-5 text-white shadow-[0_18px_40px_rgba(9,18,36,0.25)]"
          data-testid="big-question"
        >
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-blue-200">
            Câu hỏi lớn của bài
          </p>
          <p className="mt-1.5 text-[19px] font-extrabold leading-snug text-white">
            Làm sao biết đồ thị đi lên hay đi xuống{' '}
            <span className="text-amber-300">mà không cần vẽ</span>?
          </p>
          {plan.intro && (
            <details className="group mt-3 text-[14px] leading-6 text-slate-300">
              <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 font-semibold text-blue-200 hover:text-white [&::-webkit-details-marker]:hidden">
                <ChevronDown
                  className="size-4 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
                Vì sao bài này quan trọng?
              </summary>
              <RichText
                content={plan.intro}
                className="mt-1 text-slate-300 [&_*]:!text-slate-300"
              />
            </details>
          )}
          <p className="mt-3 text-[14px] text-slate-300">
            Gợi ý: câu trả lời nằm ở <strong className="font-bold text-white">độ dốc</strong> của đồ
            thị. Bấm Tiếp tục để khám phá.
          </p>
        </div>
      )}
    </StageLayout>
  );
}

function isTurning(pieces: MonotonePiece[], x: number) {
  return pieces.some((piece) => piece.to === x);
}

function labelAll(pieces: MonotonePiece[]) {
  return Object.fromEntries(pieces.map((piece, index) => [index, piece.direction]));
}
