'use client';

import * as React from 'react';
import {
  derivative,
  evaluate,
  formatNumber,
  type FunctionAnalysis,
} from '@/lib/learning/function-model';
import type { InteractivePlan } from '@/lib/learning/interactive-lesson';
import { decimal, useAnalysis, type PieceTone, type View } from '../function-graph';
import { InlineText } from '../rich-text';
import {
  Beat,
  Choices,
  DiscoveryCard,
  Feedback,
  Hints,
  Outcome,
  Prompt,
  RuntimeContext,
  useAttempt,
  type Choice,
} from './beats';
import { ExploreGraph, TRAIL_BINS, binCenter, reachableRange, trailBin } from './explore-graph';
import { StageLayout } from './stage-layout';

/** Where the student has dragged M: bins of the sign trail and the zeros of f′ landed on. */
export function useScan(
  analysis: FunctionAnalysis | null,
  view: View | null,
  review: boolean,
  initial: number | null = null
) {
  const start = React.useMemo(() => {
    if (!analysis || !view) return 0;
    if (initial !== null) return initial;
    // Start at the left end of the visible curve, away from any special point.
    const [lo, hi] = reachableRange(analysis, view);
    return lo + (hi - lo) * 0.04;
  }, [analysis, view, initial]);
  const [x, setX] = React.useState(start);
  const [visited, setVisited] = React.useState<boolean[]>(() =>
    Array.from({ length: TRAIL_BINS }, () => review)
  );
  const [zeros, setZeros] = React.useState<number[]>(() =>
    review && analysis ? analysis.criticalPoints : []
  );
  const last = React.useRef<number | null>(null);

  const move = React.useCallback(
    (next: number) => {
      if (!analysis || !view) return;
      setX(next);
      // Paint every bin between the previous position and this one, so a fast drag leaves no gaps.
      const from = trailBin(last.current ?? next, view);
      const to = trailBin(next, view);
      last.current = next;
      setVisited((current) => {
        const lo = Math.min(from, to);
        const hi = Math.max(from, to);
        if (current.slice(lo, hi + 1).every(Boolean)) return current;
        const copy = current.slice();
        for (let bin = lo; bin <= hi; bin += 1) copy[bin] = true;
        return copy;
      });
      const zero = analysis.criticalPoints.find((point) => Math.abs(point - next) < 1e-9);
      if (zero !== undefined) {
        setZeros((current) => (current.includes(zero) ? current : [...current, zero]));
      }
    },
    [analysis, view]
  );

  const coverage = React.useMemo(() => {
    if (!analysis || !view) return [];
    const [lo, hi] = reachableRange(analysis, view);
    return analysis.intervals.map((interval) => {
      let seen = 0;
      let total = 0;
      for (let bin = 0; bin < TRAIL_BINS; bin += 1) {
        const center = binCenter(bin, view);
        if (center <= interval.from || center >= interval.to) continue;
        if (center < lo || center > hi) continue;
        total += 1;
        if (visited[bin]) seen += 1;
      }
      return total ? seen / total : 1;
    });
  }, [analysis, view, visited]);

  const intervalsSeen = coverage.filter((value) => value >= 0.25).length;
  const complete =
    !!analysis &&
    intervalsSeen === analysis.intervals.length &&
    analysis.criticalPoints.every((point) => zeros.includes(point));
  return { x, move, visited, zeros, coverage, intervalsSeen, complete };
}

/** Tangent direction choices, phrased for the student. */
const TANGENT_CHOICES: Choice[] = [
  { id: 'len', label: 'Nghiêng lên (đi lên từ trái sang phải)', correct: true },
  {
    id: 'xuong',
    label: 'Nghiêng xuống',
    correct: false,
    why: 'Tiếp tuyến "ôm" sát đồ thị tại điểm đó, nên nó nghiêng theo đúng chiều của đồ thị.',
  },
  {
    id: 'ngang',
    label: 'Nằm ngang',
    correct: false,
    why: 'Tiếp tuyến chỉ nằm ngang ở đỉnh hoặc đáy, nơi đồ thị dừng lại để đổi chiều.',
  },
];

/**
 * Part 2, "Bí mật nằm ở độ dốc": the student predicts the tangent on a rising
 * piece, then drags M along the whole graph, painting the sign of f′ under it,
 * and states the rule before it is shown in the admin's words.
 */
export function SlopeStage({
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
  const a = data?.analysis ?? null;
  const view = data?.view ?? null;
  // M starts on the first rising piece for the prediction, so the tangent can be seen there.
  const rising = React.useMemo(() => {
    if (!a || !view) return null;
    const piece = a.pieces.find((item) => item.direction === 'up');
    if (!piece) return null;
    const [left, right] = reachableRange(a, view);
    const lo = Math.max(piece.from, left);
    const hi = Math.min(piece.to, right);
    return lo + (hi - lo) * 0.5;
  }, [a, view]);
  const scan = useScan(a, view, review, rising);
  const predict = useAttempt('kham-pha/tiep-tuyen');
  const positive = useAttempt('kham-pha/dao-ham-duong');
  const negative = useAttempt('kham-pha/dao-ham-am');
  const explored = useAttempt('kham-pha/keo-tiep-tuyen');
  const [hovered, setHovered] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (scan.complete && !explored.done) explored.complete();
  }, [scan.complete, explored]);
  const ruleDone = positive.done && negative.done;
  React.useEffect(() => {
    if (ruleDone) onReady();
  }, [ruleDone, onReady]);

  if (!a || !view) return null;
  const fPrime = derivative(a.fn);
  const stage: 'predict' | 'scan' | 'rule' | 'done' = !predict.done
    ? 'predict'
    : !explored.done
      ? 'scan'
      : !ruleDone
        ? 'rule'
        : 'done';

  const pointX = stage === 'predict' ? (rising ?? scan.x) : scan.x;
  const slopeHere = evaluate(fPrime, pointX);

  // Bands follow the questions: where f′ > 0 once that is asked, where f′ < 0 next.
  const upBands = a.intervals
    .filter((interval) => interval.sign > 0)
    .map((interval) => ({ from: interval.from, to: interval.to, tone: 'up' as const }));
  const downBands = a.intervals
    .filter((interval) => interval.sign < 0)
    .map((interval) => ({ from: interval.from, to: interval.to, tone: 'down' as const }));
  const bands =
    stage === 'rule'
      ? !positive.done
        ? upBands
        : downBands
      : stage === 'done' && hovered !== null
        ? hovered === 0
          ? upBands
          : downBands
        : [];
  const paint: PieceTone[] | undefined =
    stage === 'rule' || stage === 'done'
      ? a.pieces.map((piece) =>
          stage === 'done'
            ? hovered === null || (hovered === 0) === (piece.direction === 'up')
              ? piece.direction
              : null
            : !positive.done
              ? piece.direction === 'up'
                ? 'up'
                : null
              : piece.direction
        )
      : undefined;

  const graph = (
    <ExploreGraph
      source={plan.main}
      height={height}
      marks={scan.zeros}
      paint={paint}
      bands={bands}
      point={{
        x: pointX,
        onChange: stage === 'predict' ? () => undefined : scan.move,
        tangent: stage !== 'predict' || predict.done,
        slope: stage !== 'predict',
      }}
      snapTo={a.criticalPoints}
      trail={stage === 'predict' ? null : { visited: scan.visited, zeros: scan.zeros }}
      slider={stage !== 'predict'}
      testId="graph-slope"
      badge={
        stage === 'scan' ? (
          <span
            className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[13px] font-bold tabular-nums text-blue-700"
            data-testid="scan-progress"
          >
            {scan.intervalsSeen + scan.zeros.length}/{a.intervals.length + a.criticalPoints.length}
          </span>
        ) : null
      }
    />
  );

  return (
    <StageLayout graph={graph}>
      <Beat
        number={1}
        title="Dự đoán"
        status={predict.done ? 'done' : 'active'}
        summary="Trên đoạn đi lên, tiếp tuyến nghiêng lên."
        testId="beat-predict"
      >
        <Prompt>
          Điểm M nằm trên một đoạn đồ thị <span className="text-emerald-700">đi lên</span>. Theo em,
          tiếp tuyến tại M sẽ thế nào?
        </Prompt>
        <Question
          choices={TANGENT_CHOICES}
          attempt={predict}
          testId="predict-tangent"
          hints={[
            'Tiếp tuyến là đường thẳng chạm đồ thị tại M và đi cùng hướng với đồ thị ở đó.',
            'Đồ thị đi lên thì đường thẳng "ôm" theo nó cũng đi lên.',
          ]}
        />
        {predict.done && (
          <Outcome
            attempt={predict}
            right={
              <>
                Tiếp tuyến đã hiện trên đồ thị. Độ dốc của nó chính là{' '}
                <strong>f′(x) = {decimal(slopeHere)}</strong>, một số dương.
              </>
            }
          />
        )}
      </Beat>

      {predict.done && (
        <Beat
          number={2}
          title="Khám phá"
          status={explored.done ? 'done' : 'active'}
          summary={
            <>
              Đã kéo M khắp đồ thị: f′ đổi dấu tại{' '}
              <strong className="font-bold text-[#091224]">
                x = {a.criticalPoints.map(formatNumber).join(' và x = ')}
              </strong>
            </>
          }
          testId="beat-scan"
        >
          <Prompt>
            <span className="text-blue-700">Kéo điểm M</span> dọc đồ thị từ trái sang phải. Để ý màu
            của tiếp tuyến và giá trị f′.
          </Prompt>
          <ScanChecklist analysis={a} view={view} scan={scan} />
          {stage === 'scan' &&
            scan.intervalsSeen === a.intervals.length &&
            scan.zeros.length < a.criticalPoints.length && (
              <Feedback tone="info" title="Gần xong rồi!">
                Còn chỗ tiếp tuyến <strong>nằm ngang</strong>: kéo M chậm lại ở đỉnh và đáy, M sẽ tự
                hút vào đúng điểm có f′ = 0.
              </Feedback>
            )}
          {explored.done && !review && (
            <Feedback tone="right" title="Em đã tự dựng được dải dấu của f′!">
              Dải màu dưới đồ thị chính là <strong>bảng xét dấu</strong> em sẽ dùng trong bài.
            </Feedback>
          )}
        </Beat>
      )}

      {explored.done && (
        <Beat
          number={3}
          title="Rút ra quy tắc"
          status={ruleDone ? 'done' : 'active'}
          summary="f′ > 0 thì đồ thị đi lên, f′ < 0 thì đồ thị đi xuống."
          testId="beat-rule"
        >
          {!positive.done ? (
            <>
              <Prompt>
                Ở những khoảng tô <span className="text-emerald-700">xanh</span>, f′(x) &gt; 0. Ở đó
                đồ thị…
              </Prompt>
              <Question
                choices={RULE_CHOICES.positive}
                attempt={positive}
                columns={3}
                testId="rule-positive"
                hints={[
                  'Nhìn dải dấu: dấu + nằm dưới những đoạn nào của đồ thị?',
                  'Đi từ trái sang phải trên vùng xanh, đồ thị cao lên hay thấp xuống?',
                ]}
              />
            </>
          ) : (
            <>
              <Feedback tone={positive.state.status === 'revealed' ? 'shown' : 'right'}>
                f′(x) &gt; 0 thì đồ thị <strong>đi lên</strong>.
              </Feedback>
              <div className="mt-3">
                <Prompt>
                  Còn những khoảng tô <span className="text-rose-700">đỏ</span>, f′(x) &lt; 0. Ở đó
                  đồ thị…
                </Prompt>
              </div>
              <Question
                choices={RULE_CHOICES.negative}
                attempt={negative}
                columns={3}
                testId="rule-negative"
                hints={['Ngược lại với vùng xanh.', 'Trên vùng đỏ, tiếp tuyến nghiêng xuống.']}
              />
            </>
          )}
        </Beat>
      )}

      {ruleDone && (
        <DiscoveryCard
          title={plan.theorem?.title.replace(/[:：]\s*$/, '') ?? 'Quy tắc'}
          lead={plan.hypothesis}
        >
          {plan.theorem?.items.length ? (
            <ul className="space-y-2" data-testid="theorem-items">
              {plan.theorem.items.map((item, index) => {
                const sign = /f'\(x\)\s*>\s*0|>\s*0/.test(item) ? 0 : /<\s*0/.test(item) ? 1 : null;
                return (
                  <li
                    key={index}
                    onMouseEnter={() => setHovered(sign)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(sign)}
                    onBlur={() => setHovered(null)}
                    tabIndex={sign === null ? undefined : 0}
                    className={`flex gap-2.5 rounded-xl px-3 py-2 outline-none transition-colors ${
                      sign === 0
                        ? 'bg-emerald-50 hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-400'
                        : sign === 1
                          ? 'bg-rose-50 hover:bg-rose-100 focus-visible:ring-2 focus-visible:ring-rose-400'
                          : 'bg-slate-50'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-2.5 size-2 shrink-0 rounded-full ${
                        sign === 0 ? 'bg-emerald-500' : sign === 1 ? 'bg-rose-500' : 'bg-slate-400'
                      }`}
                    />
                    <span>
                      <InlineText text={item} />
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>f′(x) &gt; 0 thì hàm số đồng biến, f′(x) &lt; 0 thì hàm số nghịch biến.</p>
          )}
          <p className="mt-3 text-[14px] leading-6 text-slate-500">
            Đồ thị đi lên nghĩa là hàm số <strong className="text-emerald-700">đồng biến</strong>,
            đi xuống nghĩa là <strong className="text-rose-700">nghịch biến</strong>. Rê chuột hoặc
            chạm vào từng dòng để thấy vùng tương ứng trên đồ thị.
          </p>
        </DiscoveryCard>
      )}
    </StageLayout>
  );
}

const RULE_CHOICES: Record<'positive' | 'negative', Choice[]> = {
  positive: [
    { id: 'len', label: 'Đi lên', correct: true },
    {
      id: 'xuong',
      label: 'Đi xuống',
      correct: false,
      why: 'Trên vùng xanh, tiếp tuyến nghiêng lên.',
    },
    {
      id: 'ngang',
      label: 'Nằm ngang',
      correct: false,
      why: 'Đồ thị chỉ "phẳng" tại đúng chỗ f′ = 0, không phải cả một khoảng.',
    },
  ],
  negative: [
    { id: 'len', label: 'Đi lên', correct: false, why: 'Trên vùng đỏ, tiếp tuyến nghiêng xuống.' },
    { id: 'xuong', label: 'Đi xuống', correct: true },
    {
      id: 'ngang',
      label: 'Nằm ngang',
      correct: false,
      why: 'Đồ thị chỉ "phẳng" tại đúng chỗ f′ = 0, không phải cả một khoảng.',
    },
  ],
};

/** A choice question with its hints; a wrong pick first says why that option is wrong. */
export function Question({
  choices,
  attempt,
  hints,
  columns,
  testId,
  onAnswer,
}: {
  choices: Choice[];
  attempt: ReturnType<typeof useAttempt>;
  hints: React.ReactNode[];
  columns?: 1 | 2 | 3;
  testId?: string;
  onAnswer?: (choice: Choice) => void;
}) {
  const [lastWrong, setLastWrong] = React.useState<string | null>(null);
  return (
    <>
      <Choices
        choices={choices}
        attempt={attempt}
        columns={columns}
        testId={testId}
        onAnswer={(choice) => {
          setLastWrong(choice.correct ? null : (choice.why ?? 'Thử lại với gợi ý bên dưới nhé.'));
          onAnswer?.(choice);
        }}
      />
      <Hints attempt={attempt} hints={hints} extra={lastWrong} />
    </>
  );
}

function ScanChecklist({
  analysis: a,
  view,
  scan,
}: {
  analysis: FunctionAnalysis;
  view: View;
  scan: ReturnType<typeof useScan>;
}) {
  const ups = a.intervals
    .map((interval, index) => ({ interval, index }))
    .filter((item) => item.interval.sign > 0);
  const downs = a.intervals
    .map((interval, index) => ({ interval, index }))
    .filter((item) => item.interval.sign < 0);
  const seen = (items: typeof ups) => items.some(({ index }) => scan.coverage[index] >= 0.25);
  const all = (items: typeof ups) => items.every(({ index }) => scan.coverage[index] >= 0.25);
  const rows = [
    {
      id: 'up',
      done: all(ups),
      started: seen(ups),
      text: 'Chỗ tiếp tuyến nghiêng lên',
    },
    {
      id: 'down',
      done: all(downs),
      started: seen(downs),
      text: 'Chỗ tiếp tuyến nghiêng xuống',
    },
    {
      id: 'zero',
      done: a.criticalPoints.every((point) => scan.zeros.includes(point)),
      started: scan.zeros.length > 0,
      text: `Chỗ tiếp tuyến nằm ngang (${scan.zeros.length}/${a.criticalPoints.length})`,
    },
  ].filter((row) => row.id !== 'zero' || a.criticalPoints.length > 0);
  void view;
  return (
    <ul className="mt-3 space-y-1.5" data-testid="scan-checklist">
      {rows.map((row) => (
        <li
          key={row.id}
          className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[15px] transition-colors ${
            row.done ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-50 text-slate-600'
          }`}
          data-done={row.done ? 'true' : 'false'}
        >
          <span
            aria-hidden="true"
            className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
              row.done
                ? 'tt-pop bg-emerald-500 text-white'
                : row.started
                  ? 'bg-blue-100 text-blue-700'
                  : 'border border-slate-300 bg-white'
            }`}
          >
            {row.done ? '✓' : ''}
          </span>
          <span className="min-w-0 flex-1">{row.text}</span>
          {row.id === 'up' && (
            <span className="text-[13px] font-bold text-emerald-700">f′ &gt; 0</span>
          )}
          {row.id === 'down' && (
            <span className="text-[13px] font-bold text-rose-700">f′ &lt; 0</span>
          )}
          {row.id === 'zero' && (
            <span className="text-[13px] font-bold text-amber-700">f′ = 0</span>
          )}
        </li>
      ))}
    </ul>
  );
}
