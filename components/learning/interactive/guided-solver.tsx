'use client';

import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, Check, ListOrdered } from 'lucide-react';
import {
  analyzeFunction,
  derivative,
  derivativeChoices,
  domainLatex,
  evalPoly,
  formatInterval,
  formatNumber,
  formatPolynomial,
  testValue,
  type FunctionAnalysis,
} from '@/lib/learning/function-model';
import type { WorkedExample } from '@/lib/knowledge-tree/lesson-journey';
import { decimal } from '../function-graph';
import { InlineText } from '../rich-text';
import {
  Beat,
  Feedback,
  Hints,
  ModelStep,
  Outcome,
  Prompt,
  RuntimeContext,
  useAttempt,
  type Choice,
} from './beats';
import { Question } from './stage-slope';

/**
 * "Tự giải": the lesson's procedure done by the student on one function, one
 * step at a time (domain → derivative → f′ = 0 → sign of f′ → conclusion).
 * Every option, hint and check comes from the analysed function; after each
 * step the admin's own worked solution for that step is shown, when there is
 * one. `onProgress` reports how far the student is, so the graph can follow.
 */

export type SolverStep = 'domain' | 'derivative' | 'roots' | 'signs' | 'conclusion' | 'solved';
const ORDER: SolverStep[] = ['domain', 'derivative', 'roots', 'signs', 'conclusion', 'solved'];

export function GuidedSolver({
  source,
  example,
  activity,
  onProgress,
}: {
  source: string;
  /** The admin's worked example about this function, compared with after each step. */
  example: WorkedExample | null;
  /** Prefix of the saved activity ids ("vi-du", "thu-suc"). */
  activity: string;
  onProgress: (step: SolverStep) => void;
}) {
  const analysis = React.useMemo(() => {
    const result = analyzeFunction(source);
    return result.ok ? result.analysis : null;
  }, [source]);
  const domain = useAttempt(`${activity}/tap-xac-dinh`);
  const deriv = useAttempt(`${activity}/dao-ham`);
  const roots = useAttempt(`${activity}/nghiem`);
  const signs = useAttempt(`${activity}/xet-dau`);
  const conclusion = useAttempt(`${activity}/ket-luan`);

  const step: SolverStep = !domain.done
    ? 'domain'
    : !deriv.done
      ? 'derivative'
      : !roots.done
        ? 'roots'
        : !signs.done
          ? 'signs'
          : !conclusion.done
            ? 'conclusion'
            : 'solved';
  React.useEffect(() => onProgress(step), [step, onProgress]);
  if (!analysis) return null;

  const a = analysis;
  const fPrime = derivative(a.fn).num;
  const yPrime = formatPolynomial(fPrime);
  const expression = source.replace(/^\s*y\s*=\s*/, '');
  const model = (n: number) =>
    example?.steps.find((item) => item.label?.replace(/\s+/g, ' ') === `Bước ${n}`) ?? null;
  const reached = (target: SolverStep) => ORDER.indexOf(step) >= ORDER.indexOf(target);
  const domainText = domainLatex(a);

  const domainChoices: Choice[] = [
    { id: 'r', label: <InlineText text={`$D = ${domainText}$`} />, correct: true },
    {
      id: 'r-0',
      label: <InlineText text="$D = \mathbb{R} \setminus \{0\}$" />,
      correct: false,
      why: 'Hàm đa thức không có mẫu số, nên không phải bỏ điểm nào.',
    },
    {
      id: 'duong',
      label: <InlineText text="$D = [0; +\infty)$" />,
      correct: false,
      why: 'Không có căn bậc chẵn: x âm vẫn thay được vào hàm số.',
    },
  ];
  const derivativeOptions: Choice[] = (derivativeChoices(a.fn) ?? []).map((option, index) => ({
    id: `d${index}`,
    label: <InlineText text={`$y' = ${option.latex}$`} />,
    correct: option.correct,
    why: option.mistake ?? undefined,
  }));
  // A fixed order that does not always put the right answer first.
  const shuffled = rotate(
    derivativeOptions,
    expression.length % Math.max(derivativeOptions.length, 1)
  );

  return (
    <div className="space-y-3" data-testid={`solver-${activity}`} data-step={step}>
      <Beat
        number={1}
        title="Bước 1 · Tập xác định"
        status={domain.done ? 'done' : 'active'}
        summary={<InlineText text={`Bước 1: $D = ${domainText}$`} />}
        testId="step-domain"
      >
        <Prompt>
          <InlineText text={`Tập xác định của hàm số $y = ${expression}$ là gì?`} />
        </Prompt>
        <Question
          choices={domainChoices}
          attempt={domain}
          testId="choices-domain"
          hints={[
            'Tập xác định gồm mọi x thay được vào hàm số.',
            'Hàm đa thức (không có mẫu, không có căn) xác định với mọi số thực.',
          ]}
        />
        {domain.done && (
          <StepReview
            attempt={domain}
            model={model(1)}
            fallback={`Hàm đa thức nên $D = ${domainText}$.`}
          />
        )}
      </Beat>

      {reached('derivative') && (
        <Beat
          number={2}
          title="Bước 2 · Tính đạo hàm"
          status={deriv.done ? 'done' : 'active'}
          summary={<InlineText text={`Bước 2: $y' = ${yPrime}$`} />}
          testId="step-derivative"
        >
          <Prompt>
            <InlineText text={`Đạo hàm của $y = ${expression}$ là:`} />
          </Prompt>
          <Question
            choices={shuffled}
            attempt={deriv}
            testId="choices-derivative"
            hints={[
              <InlineText
                key="1"
                text="Đạo hàm từng số hạng: $(x^n)' = n \cdot x^{n-1}$, $(c)' = 0$."
              />,
              <InlineText key="2" text={`Số hạng bậc cao nhất cho ra ${firstTermHint(fPrime)}.`} />,
            ]}
          />
          {deriv.done && (
            <Outcome attempt={deriv} right={<InlineText text={`$y' = ${yPrime}$`} />} />
          )}
        </Beat>
      )}

      {reached('roots') && (
        <Beat
          number={3}
          title="Bước 2 · Giải y′ = 0"
          status={roots.done ? 'done' : 'active'}
          summary={
            <InlineText
              text={
                a.criticalPoints.length
                  ? `$y' = 0 \\Leftrightarrow x = ${a.criticalPoints.map(latexNumber).join('$ hoặc $x = ')}$`
                  : "$y' = 0$ vô nghiệm"
              }
            />
          }
          testId="step-roots"
        >
          <RootPicker analysis={a} yPrime={yPrime} attempt={roots} />
          {roots.done && (
            <StepReview attempt={roots} model={model(2)} fallback={rootsFallback(a, yPrime)} />
          )}
        </Beat>
      )}

      {reached('signs') && (
        <Beat
          number={4}
          title="Bước 3 · Xét dấu y′"
          status={signs.done ? 'done' : 'active'}
          summary={
            <>
              Bước 3:{' '}
              {a.intervals
                .map(
                  (interval) =>
                    `${interval.sign > 0 ? '+' : '−'} trên ${formatInterval(interval.from, interval.to)}`
                )
                .join(', ')}
            </>
          }
          testId="step-signs"
        >
          <SignTable analysis={a} attempt={signs} />
          {signs.done && <StepReview attempt={signs} model={model(3)} fallback={null} />}
        </Beat>
      )}

      {reached('conclusion') && (
        <Beat
          number={5}
          title="Bước 4 · Kết luận"
          status={conclusion.done ? 'done' : 'active'}
          summary={
            <>
              Bước 4:{' '}
              {a.pieces
                .map(
                  (piece) =>
                    `${piece.direction === 'up' ? 'đồng biến' : 'nghịch biến'} trên ${formatInterval(piece.from, piece.to)}`
                )
                .join('; ')}
            </>
          }
          testId="step-conclusion"
        >
          <ConclusionPicker analysis={a} attempt={conclusion} />
          {conclusion.done && <StepReview attempt={conclusion} model={model(4)} fallback={null} />}
        </Beat>
      )}
    </div>
  );
}

function rotate<T>(items: T[], by: number): T[] {
  return items.length ? [...items.slice(by), ...items.slice(0, by)] : items;
}

function latexNumber(value: number) {
  return formatNumber(value).replace('−', '-');
}

function firstTermHint(fPrime: number[]) {
  const k = fPrime.length - 1;
  const lead = formatPolynomial([...Array(k).fill(0), fPrime[k]]);
  return `$${lead}$`;
}

function rootsFallback(a: FunctionAnalysis, yPrime: string) {
  return a.criticalPoints.length
    ? `$y' = 0 \\Leftrightarrow ${yPrime} = 0 \\Leftrightarrow x = ${a.criticalPoints.map(latexNumber).join('$ hoặc $x = ')}$.`
    : `$y' = ${yPrime}$ không bằng 0 tại điểm nào.`;
}

/** After a step: "Lời giải mẫu" in the admin's words, or a short computed one. */
function StepReview({
  attempt,
  model,
  fallback,
}: {
  attempt: ReturnType<typeof useAttempt>;
  model: { label: string | null; body: string } | null;
  fallback: string | null;
}) {
  const { review } = React.useContext(RuntimeContext);
  return (
    <>
      {!review && attempt.state.status === 'revealed' && (
        <Feedback tone="shown" title="Không sao, mình cùng xem lời giải nhé." />
      )}
      {model ? (
        <ModelStep label={model.label} body={model.body} />
      ) : fallback ? (
        <ModelStep label={null} body={fallback} />
      ) : null}
    </>
  );
}

// ─── Roots ───────────────────────────────────────────────────────────────────

/** Candidate roots: the right ones and numbers students get by sign or factoring slips. */
export function rootCandidates(roots: number[]): number[] {
  const set = new Set<number>(roots);
  const extras = roots.length ? roots.flatMap((r) => [-r, r + 1, r - 1]) : [0, 1, -1];
  for (const value of extras) {
    if (set.size >= Math.max(4, roots.length + 2)) break;
    if (Number.isFinite(value)) set.add(value === 0 ? 0 : value);
  }
  return [...set].sort((p, q) => p - q);
}

function RootPicker({
  analysis: a,
  yPrime,
  attempt,
}: {
  analysis: FunctionAnalysis;
  yPrime: string;
  attempt: ReturnType<typeof useAttempt>;
}) {
  const fPrime = derivative(a.fn).num;
  const candidates = React.useMemo(() => rootCandidates(a.criticalPoints), [a]);
  const [chosen, setChosen] = React.useState<number[]>([]);
  const [none, setNone] = React.useState(false);
  const [wrong, setWrong] = React.useState<string | null>(null);
  const shown = attempt.done ? a.criticalPoints : chosen;
  const toggle = (value: number) => {
    setNone(false);
    setWrong(null);
    setChosen((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };
  const check = () => {
    const right =
      (none && a.criticalPoints.length === 0) ||
      (!none &&
        chosen.length === a.criticalPoints.length &&
        chosen.every((value) => a.criticalPoints.includes(value)));
    if (right) {
      attempt.submit(true);
      return;
    }
    const extra = chosen.find((value) => !a.criticalPoints.includes(value));
    const missing = a.criticalPoints.find((value) => !chosen.includes(value));
    setWrong(
      extra !== undefined
        ? `Thử lại: thay x = ${formatNumber(extra)} vào y′ được ${decimal(evalPoly(fPrime, extra))}, khác 0.`
        : none
          ? 'Phương trình này có nghiệm đấy. Thử phân tích y′ thành nhân tử.'
          : missing !== undefined
            ? `Còn thiếu nghiệm. Em đã tìm được ${chosen.length}/${a.criticalPoints.length}.`
            : 'Chưa đúng, thử lại nhé.'
    );
    attempt.submit(false);
  };
  return (
    <>
      <Prompt>
        <InlineText text={`Giải $y' = 0$, tức là $${yPrime} = 0$. Chọn **tất cả** các nghiệm:`} />
      </Prompt>
      <div
        className="mt-3 flex flex-wrap gap-2"
        role="group"
        aria-label="Các nghiệm"
        data-testid="root-chips"
      >
        {candidates.map((value) => {
          const on = shown.includes(value);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              disabled={attempt.done}
              onClick={() => toggle(value)}
              className={`inline-flex h-11 min-w-16 items-center justify-center gap-1 rounded-xl border-2 px-3 text-[16px] font-bold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                on
                  ? attempt.done
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                    : 'border-[#0052FF] bg-[#0052FF] text-white'
                  : 'border-slate-200 bg-white text-[#091224] enabled:hover:border-blue-400 disabled:opacity-40'
              }`}
              data-testid={`root-${formatNumber(value)}`}
            >
              {on && <Check className="size-4" aria-hidden="true" />}x = {formatNumber(value)}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={none}
          disabled={attempt.done}
          onClick={() => {
            setChosen([]);
            setWrong(null);
            setNone((value) => !value);
          }}
          className={`inline-flex h-11 items-center rounded-xl border-2 px-3 text-[15px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            none
              ? 'border-[#0052FF] bg-[#0052FF] text-white'
              : 'border-slate-200 bg-white text-slate-600 enabled:hover:border-blue-400 disabled:opacity-40'
          }`}
          data-testid="root-none"
        >
          Vô nghiệm
        </button>
      </div>
      {!attempt.done && (
        <>
          <button
            type="button"
            onClick={check}
            disabled={!chosen.length && !none}
            className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[#0052FF] px-5 text-[15px] font-bold text-white transition hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:bg-slate-200 disabled:text-slate-400"
            data-testid="check-roots"
          >
            Kiểm tra
          </button>
          <Hints
            attempt={attempt}
            extra={wrong}
            hints={[
              'Đặt nhân tử chung, hoặc đưa về dạng tích bằng 0.',
              <InlineText key="2" text={rootHint(a, yPrime)} />,
            ]}
          />
        </>
      )}
      {attempt.done && (
        <Outcome attempt={attempt} right={<InlineText text={rootsFallback(a, yPrime)} />} />
      )}
    </>
  );
}

function rootHint(a: FunctionAnalysis, yPrime: string) {
  const roots = a.criticalPoints;
  if (roots.length === 2 && roots[0] === -roots[1]) {
    return `$${yPrime} = 0 \\Leftrightarrow x^{2} = ${latexNumber(roots[1] ** 2)}$.`;
  }
  if (roots.length === 2 && roots.includes(0)) {
    return `Đặt $x$ làm nhân tử chung: $y' = x \\cdot (\\ldots)$. Một nghiệm là $x = 0$, nghiệm kia làm phần trong ngoặc bằng 0.`;
  }
  return `Thử thay từng số vào $y' = ${yPrime}$: số nào làm $y'$ bằng 0?`;
}

// ─── Sign table ──────────────────────────────────────────────────────────────

function SignTable({
  analysis: a,
  attempt,
}: {
  analysis: FunctionAnalysis;
  attempt: ReturnType<typeof useAttempt>;
}) {
  const fPrime = derivative(a.fn).num;
  const [signs, setSigns] = React.useState<Array<1 | -1 | null>>(() => a.intervals.map(() => null));
  const [wrongCells, setWrongCells] = React.useState<number[]>([]);
  const final = attempt.done ? a.intervals.map((interval) => interval.sign) : signs;
  const cut = a.criticalPoints;
  const flip = (index: number) => {
    setWrongCells((current) => current.filter((item) => item !== index));
    setSigns((current) =>
      current.map((value, i) => (i === index ? (value === 1 ? -1 : 1) : value))
    );
  };
  const check = () => {
    const wrong = a.intervals
      .map((interval, index) => (signs[index] === interval.sign ? -1 : index))
      .filter((index) => index >= 0);
    setWrongCells(wrong);
    attempt.submit(wrong.length === 0);
  };
  const probe = (index: number) => {
    const interval = a.intervals[index];
    const t = testValue(interval.from, interval.to);
    const value = evalPoly(fPrime, t);
    return `Trên ${formatInterval(interval.from, interval.to)}, thử x = ${formatNumber(t)}: y′(${formatNumber(t)}) = ${formatNumber(value)}${value > 0 ? ' > 0' : ' < 0'}.`;
  };

  return (
    <>
      <Prompt>Chạm vào từng ô để chọn dấu của y′ trên mỗi khoảng.</Prompt>
      <div className="mt-3 overflow-x-auto" data-testid="sign-table">
        <table className="w-full min-w-[300px] border-separate border-spacing-0 overflow-hidden rounded-xl border border-slate-200 text-center text-[15px]">
          <tbody>
            <tr className="bg-slate-50">
              <th
                scope="row"
                className="w-12 border-b border-r border-slate-200 px-2 py-2 font-semibold italic text-slate-600"
              >
                x
              </th>
              <td className="border-b border-slate-200 p-1.5" colSpan={a.intervals.length * 2 + 1}>
                {/* Same columns as the row of signs below, so each value of x sits over its 0. */}
                <div className="flex items-center gap-1.5 font-semibold tabular-nums text-slate-700">
                  {a.intervals.map((_, index) => (
                    <React.Fragment key={index}>
                      {index > 0 && (
                        <span className="w-7 shrink-0 font-bold text-[#091224]">
                          {formatNumber(cut[index - 1])}
                        </span>
                      )}
                      <span
                        className={`flex min-w-0 flex-1 px-1 text-[14px] text-slate-500 ${
                          index === 0 ? 'justify-start' : 'justify-end'
                        }`}
                      >
                        {index === 0 ? '−∞' : index === a.intervals.length - 1 ? '+∞' : ''}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </td>
            </tr>
            <tr>
              <th
                scope="row"
                className="border-r border-slate-200 px-2 py-2 font-semibold italic text-slate-600"
              >
                y′
              </th>
              <td colSpan={a.intervals.length * 2 + 1} className="p-1.5">
                <div className="flex items-center gap-1.5">
                  {a.intervals.map((interval, index) => {
                    const value = final[index];
                    const bad = wrongCells.includes(index);
                    return (
                      <React.Fragment key={index}>
                        {index > 0 && (
                          <span
                            className="w-7 shrink-0 text-[15px] font-extrabold text-amber-600"
                            aria-label="y′ bằng 0"
                          >
                            0
                          </span>
                        )}
                        <button
                          type="button"
                          disabled={attempt.done}
                          onClick={() => flip(index)}
                          aria-label={`Dấu y′ trên ${formatInterval(interval.from, interval.to)}: ${value === 1 ? 'dương' : value === -1 ? 'âm' : 'chưa chọn'}`}
                          className={`h-11 min-w-0 flex-1 rounded-lg border-2 text-[20px] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            value === 1
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : value === -1
                                ? 'border-rose-300 bg-rose-50 text-rose-700'
                                : 'border-dashed border-slate-300 bg-white text-slate-300 hover:border-blue-400'
                          } ${bad ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
                          data-testid={`sign-${index}`}
                          data-value={value ?? ''}
                        >
                          {value === 1 ? '+' : value === -1 ? '−' : '?'}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {!attempt.done && (
        <>
          <button
            type="button"
            onClick={check}
            disabled={signs.some((value) => value === null)}
            className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[#0052FF] px-5 text-[15px] font-bold text-white transition hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:bg-slate-200 disabled:text-slate-400"
            data-testid="check-signs"
          >
            Kiểm tra
          </button>
          <Hints
            attempt={attempt}
            extra={wrongCells.length ? `Ô viền vàng chưa đúng. ${probe(wrongCells[0])}` : undefined}
            hints={[
              'Chọn một số dễ tính nằm trong khoảng, thay vào y′ rồi xem kết quả dương hay âm.',
              probe(0),
            ]}
          />
        </>
      )}
      {attempt.done && (
        <Outcome
          attempt={attempt}
          right="Dải dấu này giống hệt dải màu em đã kéo trên đồ thị."
          shown={a.intervals.map((_, index) => probe(index)).join(' ')}
        />
      )}
    </>
  );
}

// ─── Conclusion ──────────────────────────────────────────────────────────────

function ConclusionPicker({
  analysis: a,
  attempt,
}: {
  analysis: FunctionAnalysis;
  attempt: ReturnType<typeof useAttempt>;
}) {
  const [answers, setAnswers] = React.useState<Record<number, 'up' | 'down'>>({});
  const [wrong, setWrong] = React.useState<number[]>([]);
  const final = attempt.done
    ? Object.fromEntries(a.pieces.map((piece, index) => [index, piece.direction]))
    : answers;
  const check = () => {
    const bad = a.pieces
      .map((piece, index) => (answers[index] === piece.direction ? -1 : index))
      .filter((i) => i >= 0);
    setWrong(bad);
    attempt.submit(bad.length === 0);
  };
  return (
    <>
      <Prompt>Trên mỗi khoảng, hàm số đồng biến hay nghịch biến?</Prompt>
      <ul className="mt-3 space-y-2" data-testid="conclusion-rows">
        {a.pieces.map((piece, index) => (
          <li
            key={index}
            className={`grid grid-cols-2 items-center gap-2 rounded-xl border-2 px-3 py-2.5 ${
              wrong.includes(index) ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
            }`}
          >
            <span className="col-span-2 text-[15px] font-bold tabular-nums text-[#091224]">
              Trên {formatInterval(piece.from, piece.to)}
            </span>
            {(['up', 'down'] as const).map((value) => {
              const Icon = value === 'up' ? ArrowUpRight : ArrowDownRight;
              const on = final[index] === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  disabled={attempt.done}
                  onClick={() => {
                    setWrong((current) => current.filter((item) => item !== index));
                    setAnswers((current) => ({ ...current, [index]: value }));
                  }}
                  className={`inline-flex h-10 items-center justify-center gap-1 rounded-lg px-3 text-[14px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    on
                      ? value === 'up'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 enabled:hover:border-blue-400 disabled:opacity-40'
                  }`}
                  data-testid={`conclude-${index}-${value}`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {value === 'up' ? 'Đồng biến' : 'Nghịch biến'}
                </button>
              );
            })}
          </li>
        ))}
      </ul>
      {!attempt.done && (
        <>
          <button
            type="button"
            onClick={check}
            disabled={a.pieces.some((_, index) => !answers[index])}
            className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[#0052FF] px-5 text-[15px] font-bold text-white transition hover:bg-[#0044CC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:bg-slate-200 disabled:text-slate-400"
            data-testid="check-conclusion"
          >
            Kiểm tra
          </button>
          <Hints
            attempt={attempt}
            extra={wrong.length ? 'Nhìn lại dấu y′ trên khoảng viền vàng.' : undefined}
            hints={[
              'y′ > 0 thì đồng biến, y′ < 0 thì nghịch biến.',
              'Dấu + ứng với mũi tên đi lên, dấu − ứng với mũi tên đi xuống.',
            ]}
          />
        </>
      )}
      {attempt.done && <Outcome attempt={attempt} right="Em đã tự giải xong cả bài." />}
    </>
  );
}

/** The method beside the solver: where the student is in the four steps. */
export function MethodSteps({
  method,
  step,
}: {
  method: { title: string; steps: string[] } | null;
  step: SolverStep;
}) {
  if (!method) return null;
  const active = { domain: 0, derivative: 1, roots: 1, signs: 2, conclusion: 3, solved: 4 }[step];
  return (
    <details
      className="group rounded-2xl border border-slate-200 bg-white"
      data-testid="method-card"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 px-4 py-2.5 text-[14px] font-bold text-[#091224] [&::-webkit-details-marker]:hidden">
        <ListOrdered className="size-4 text-blue-600" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <InlineText text={method.title.replace(/^\d+\.\s*/, '').replace(/[:：]\s*$/, '')} />
        </span>
        <span className="text-[13px] font-semibold tabular-nums text-slate-500">
          {Math.min(active + 1, method.steps.length)}/{method.steps.length}
        </span>
      </summary>
      <ol className="space-y-1.5 px-4 pb-4">
        {method.steps.map((text, index) => (
          <li
            key={index}
            className={`flex gap-2.5 rounded-lg px-2 py-1.5 text-[14px] leading-6 ${
              index === active
                ? 'bg-blue-50 font-semibold text-[#091224]'
                : index < active
                  ? 'text-slate-400'
                  : 'text-slate-600'
            }`}
          >
            <span
              className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                index < active
                  ? 'bg-emerald-500 text-white'
                  : index === active
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {index < active ? '✓' : index + 1}
            </span>
            <span>
              <InlineText
                text={text.replace(/^\s*(?:\*\*)?Bước\s*\d+\s*[:.)]\s*(?:\*\*)?\s*/i, '')}
              />
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
