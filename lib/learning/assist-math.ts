/**
 * Checks the mathematical claims in an AI explanation against the function
 * engine (`function-model.ts`), and writes the verified walk-through used
 * when the AI is wrong or unavailable.
 *
 * The AI only ever proposes: which function it is talking about, its
 * derivative, the critical points and the monotone intervals. Every one of
 * those is recomputed here. Visuals are drawn from the engine's own analysis,
 * never from AI output.
 */

import {
  analyzeFunction,
  derivative,
  parseFunction,
  sameFunction,
  type FunctionAnalysis,
  type Poly,
} from './function-model';

/** Interval ends as JSON allows them: null stands for −∞ (start) or +∞ (end). */
export type ClaimedInterval = [number | null, number | null];

export interface MathClaims {
  /** The function the explanation is about, e.g. "x^3 - 3x". */
  function?: string | null;
  derivative?: string | null;
  criticalPoints?: number[] | null;
  increasing?: ClaimedInterval[] | null;
  decreasing?: ClaimedInterval[] | null;
}

export type MathCheck =
  /** No function is involved (a definition, a parametric question …). */
  | { status: 'none' }
  /** A function is involved but the engine cannot analyse it; no visual, no verified claims. */
  | { status: 'unsupported'; expression: string }
  | {
      status: 'verified';
      /** The function the visuals are drawn from, as "y = …" source for the graph components. */
      source: string;
      /** Which AI claims were recomputed and agreed, in student words. */
      checked: string[];
    }
  | { status: 'mismatch'; source: string; problems: string[] };

const EPS = 1e-6;
const close = (a: number, b: number) =>
  (a === b && !Number.isFinite(a)) || Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a));

function sameSet(a: number[], b: number[]): boolean {
  const x = [...a].sort((p, q) => p - q);
  const y = [...b].sort((p, q) => p - q);
  return x.length === y.length && x.every((value, i) => close(value, y[i]));
}

type Span = { from: number; to: number };

/** Joins intervals that touch at a point of the domain (f′ = 0 there does not break monotonicity). */
function joinSpans(spans: Span[], breaks: number[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.from - b.from);
  const out: Span[] = [];
  for (const span of sorted) {
    const last = out[out.length - 1];
    if (last && close(last.to, span.from) && !breaks.some((b) => close(b, span.from))) {
      last.to = span.to;
    } else out.push({ ...span });
  }
  return out;
}

function sameSpans(a: Span[], b: Span[]): boolean {
  return (
    a.length === b.length && a.every((s, i) => close(s.from, b[i].from) && close(s.to, b[i].to))
  );
}

function toSpans(claimed: ClaimedInterval[]): Span[] | null {
  const spans: Span[] = [];
  for (const [from, to] of claimed) {
    const span = { from: from ?? -Infinity, to: to ?? Infinity };
    if (!(span.from < span.to)) return null;
    spans.push(span);
  }
  return spans;
}

function engineSpans(analysis: FunctionAnalysis, direction: 'up' | 'down'): Span[] {
  return joinSpans(
    analysis.pieces.filter((p) => p.direction === direction).map(({ from, to }) => ({ from, to })),
    analysis.breaks
  );
}

/**
 * Compares the AI's claims with the engine.
 * - `contextSource`: the function the lesson or question itself is about, read
 *   deterministically from published content. When present it wins: an AI
 *   claim about another function is a mismatch.
 * - Without it, the AI may propose an illustration; it is analysed by the
 *   engine and shown only if its claims agree.
 */
export function checkMathClaims(
  contextSource: string | null,
  claims: MathClaims | null
): MathCheck {
  const proposed = claims?.function?.trim() || null;
  const source = contextSource ?? proposed;
  if (!source) return { status: 'none' };
  const result = analyzeFunction(source);
  if (!result.ok) return { status: 'unsupported', expression: source };
  const analysis = result.analysis;
  const graphSource = `y = ${analysis.expression}`;

  const problems: string[] = [];
  const checked: string[] = [];
  if (contextSource && proposed) {
    const parsed = parseFunction(proposed);
    if (!parsed.ok || !sameFunction(parsed.fn, analysis.fn)) {
      problems.push('Lời giải thích đang nói về một hàm số khác với đề bài.');
    }
  }
  if (claims?.derivative) {
    const parsed = parseFunction(claims.derivative);
    if (!parsed.ok || !sameFunction(parsed.fn, derivative(analysis.fn))) {
      problems.push('Đạo hàm trong lời giải thích không đúng.');
    } else checked.push('đạo hàm');
  }
  if (claims?.criticalPoints) {
    if (!sameSet(claims.criticalPoints, analysis.criticalPoints)) {
      problems.push('Các điểm làm đạo hàm bằng 0 không đúng.');
    } else checked.push('điểm làm y′ = 0');
  }
  let intervalsChecked = false;
  for (const [direction, claimed] of [
    ['up', claims?.increasing],
    ['down', claims?.decreasing],
  ] as const) {
    if (!claimed) continue;
    const spans = toSpans(claimed);
    if (!spans || !sameSpans(joinSpans(spans, analysis.breaks), engineSpans(analysis, direction))) {
      problems.push(
        direction === 'up'
          ? 'Các khoảng đồng biến trong lời giải thích không đúng.'
          : 'Các khoảng nghịch biến trong lời giải thích không đúng.'
      );
    } else intervalsChecked = true;
  }
  if (intervalsChecked) checked.push('khoảng đồng biến, nghịch biến');

  if (problems.length) return { status: 'mismatch', source: graphSource, problems };
  return { status: 'verified', source: graphSource, checked };
}

// ─── Verified walk-through ───────────────────────────────────────────────────

/** A number as LaTeX: −1 → -1, 1/3 → \frac{1}{3}, 0.18… → 0{,}18, ∞ → \infty. */
export function latexNumber(value: number): string {
  if (value === Infinity) return '+\\infty';
  if (value === -Infinity) return '-\\infty';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (Number.isInteger(abs)) return `${sign}${abs}`;
  for (let q = 2; q <= 12; q += 1) {
    const n = Math.round(abs * q);
    if (Math.abs(abs - n / q) < 1e-9) return `${sign}\\frac{${n}}{${q}}`;
  }
  return `${sign}${abs.toFixed(2).replace('.', '{,}')}`;
}

/** A polynomial as LaTeX, highest degree first: [−3, 0, 3] → 3x^2 - 3. */
export function latexPoly(p: Poly): string {
  const terms: string[] = [];
  for (let i = p.length - 1; i >= 0; i -= 1) {
    const c = Math.abs(p[i]) < 1e-12 ? 0 : p[i];
    if (c === 0) continue;
    const abs = Math.abs(c);
    const coefficient = i > 0 && Math.abs(abs - 1) < 1e-12 ? '' : latexNumber(abs);
    const variable = i === 0 ? '' : i === 1 ? 'x' : `x^${i}`;
    const sign = c < 0 ? '-' : '+';
    terms.push(
      terms.length
        ? ` ${sign} ${coefficient}${variable}`
        : `${c < 0 ? '-' : ''}${coefficient}${variable}`
    );
  }
  return terms.join('') || '0';
}

const interval = (from: number, to: number) => `(${latexNumber(from)}; ${latexNumber(to)})`;
const list = (items: string[]) =>
  items.length <= 1
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} và ${items[items.length - 1]}`;

export interface AssistStep {
  title: string;
  detail: string;
}

/**
 * The textbook procedure for monotonicity, computed by the engine:
 * domain, derivative, zeros, sign of y′, conclusion. Every value here is
 * calculated, so it can be shown as verified.
 */
export function verifiedMonotonicitySteps(source: string): AssistStep[] | null {
  const result = analyzeFunction(source);
  if (!result.ok) return null;
  const a = result.analysis;
  const d = derivative(a.fn);
  const constantDen = d.den.length === 1;
  const fPrime = constantDen
    ? latexPoly(d.num.map((c) => c / d.den[0]))
    : `\\dfrac{${latexPoly(d.num)}}{${latexPoly(d.den)}}`;
  const domain = a.breaks.length
    ? `$D = \\mathbb{R} \\setminus \\{${a.breaks.map(latexNumber).join('; ')}\\}$`
    : '$D = \\mathbb{R}$';
  const zeros = a.criticalPoints.length
    ? `$y' = 0$ tại ${list(a.criticalPoints.map((x) => `$x = ${latexNumber(x)}$`))}.`
    : "$y'$ không bằng 0 tại điểm nào.";
  const undefinedAt = a.breaks.length
    ? ` $y'$ không xác định tại ${list(a.breaks.map((x) => `$x = ${latexNumber(x)}$`))}.`
    : '';
  const positive = a.intervals.filter((i) => i.sign > 0).map((i) => `$${interval(i.from, i.to)}$`);
  const negative = a.intervals.filter((i) => i.sign < 0).map((i) => `$${interval(i.from, i.to)}$`);
  const signs = [
    positive.length ? `$y' > 0$ trên ${list(positive)}` : '',
    negative.length ? `$y' < 0$ trên ${list(negative)}` : '',
  ]
    .filter(Boolean)
    .join('; ');
  const up = engineSpans(a, 'up').map((s) => `$${interval(s.from, s.to)}$`);
  const down = engineSpans(a, 'down').map((s) => `$${interval(s.from, s.to)}$`);
  const conclusion = [
    up.length ? `đồng biến trên ${list(up)}` : '',
    down.length ? `nghịch biến trên ${list(down)}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  return [
    { title: 'Tìm tập xác định', detail: `${domain}.` },
    { title: 'Tính đạo hàm', detail: `$y' = ${fPrime}$.` },
    { title: "Tìm chỗ y' bằng 0 hoặc không xác định", detail: `${zeros}${undefinedAt}` },
    { title: "Xét dấu y'", detail: `${signs}.` },
    { title: 'Kết luận', detail: `Hàm số ${conclusion}.` },
  ];
}
