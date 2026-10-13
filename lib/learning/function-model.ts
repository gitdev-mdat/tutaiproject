/**
 * A small, exact-enough model of the function an admin types for a lesson's
 * interactive graph ("y = x^3 - 3x", "y = \dfrac{x - 1}{x + 2}").
 *
 * Only polynomials and quotients of polynomials are accepted. Everything the
 * student sees (critical points, signs of the derivative, monotone pieces,
 * the variation table) is computed from the parsed function, never read out
 * of the lesson text. Anything we cannot parse is rejected with a message so
 * the admin can fix it, and the lesson falls back to text.
 */

/** Polynomial coefficients, lowest degree first: [c0, c1, c2, ...]. */
export type Poly = number[];

export interface RationalFunction {
  num: Poly;
  den: Poly;
}

export type ParseResult =
  { ok: true; fn: RationalFunction; expression: string } | { ok: false; error: string };

const MAX_EXPONENT = 8;
const MAX_NUM_DEGREE = 8;
const MAX_DEN_DEGREE = 6;

// ─── Polynomial arithmetic ───────────────────────────────────────────────────

function trim(p: Poly): Poly {
  const out = [...p];
  while (out.length > 1 && Math.abs(out[out.length - 1]) < 1e-12) out.pop();
  return out.length ? out : [0];
}

export function degree(p: Poly): number {
  const t = trim(p);
  return t.length === 1 && t[0] === 0 ? -1 : t.length - 1;
}

function add(a: Poly, b: Poly): Poly {
  const out = new Array(Math.max(a.length, b.length)).fill(0);
  a.forEach((c, i) => (out[i] += c));
  b.forEach((c, i) => (out[i] += c));
  return trim(out);
}

function scale(a: Poly, k: number): Poly {
  return trim(a.map((c) => c * k));
}

function mul(a: Poly, b: Poly): Poly {
  const out = new Array(a.length + b.length - 1).fill(0);
  a.forEach((ca, i) => b.forEach((cb, j) => (out[i + j] += ca * cb)));
  return trim(out);
}

export function derive(p: Poly): Poly {
  return trim(p.slice(1).map((c, i) => c * (i + 1)));
}

export function evalPoly(p: Poly, x: number): number {
  let value = 0;
  for (let i = p.length - 1; i >= 0; i -= 1) value = value * x + p[i];
  return value;
}

// ─── Real roots ──────────────────────────────────────────────────────────────

/** Snaps a value to a nearby simple fraction (denominator up to 12) or integer. */
export function snap(value: number, tolerance = 1e-7): number {
  if (!Number.isFinite(value)) return value;
  for (let q = 1; q <= 12; q += 1) {
    const n = Math.round(value * q);
    if (Math.abs(value - n / q) < tolerance * Math.max(1, Math.abs(value))) return n / q || 0;
  }
  return value;
}

/** Real roots of a polynomial, ascending, each listed once (double roots included). */
export function realRoots(p: Poly): number[] {
  const poly = trim(p);
  const deg = degree(poly);
  if (deg <= 0) return [];
  if (deg === 1) return [snap(-poly[0] / poly[1])];
  const lead = poly[deg];
  const bound = 1 + Math.max(...poly.slice(0, deg).map((c) => Math.abs(c / lead)));
  const critical = realRoots(derive(poly)).filter((c) => c > -bound && c < bound);
  const magnitude = (x: number) =>
    poly.reduce((sum, c, i) => sum + Math.abs(c) * Math.abs(x) ** i, 0);
  const roots: number[] = [];
  // A critical point where the polynomial vanishes is a repeated root.
  for (const c of critical) {
    if (Math.abs(evalPoly(poly, c)) <= 1e-9 * Math.max(1, magnitude(c))) roots.push(c);
  }
  const marks = [-bound, ...critical, bound];
  for (let i = 0; i < marks.length - 1; i += 1) {
    let a = marks[i];
    let b = marks[i + 1];
    let fa = evalPoly(poly, a);
    const fb = evalPoly(poly, b);
    if (fa === 0 || fb === 0 || Math.sign(fa) === Math.sign(fb)) continue;
    for (let k = 0; k < 200 && b - a > 1e-14 * Math.max(1, Math.abs(a)); k += 1) {
      const m = (a + b) / 2;
      const fm = evalPoly(poly, m);
      if (fm === 0) {
        a = b = m;
        break;
      }
      if (Math.sign(fm) === Math.sign(fa)) {
        a = m;
        fa = fm;
      } else b = m;
    }
    roots.push((a + b) / 2);
  }
  const sorted = roots.map((r) => snap(r)).sort((x, y) => x - y);
  return sorted.filter((r, i) => i === 0 || Math.abs(r - sorted[i - 1]) > 1e-7);
}

// ─── Parser ──────────────────────────────────────────────────────────────────

type Token = { kind: 'num'; value: number } | { kind: 'x' } | { kind: 'frac' } | { kind: string };

function normalize(input: string): string {
  return input
    .replace(/\$/g, '')
    .replace(/[−–—]/g, '-')
    .replace(/[·×]/g, '*')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\\(?:cdot|times)/g, '*')
    .replace(/\\left|\\right/g, '')
    .replace(/\\[dt]?frac/g, '§')
    .replace(/[{[]/g, '(')
    .replace(/[}\]]/g, ')')
    .replace(/\s+/g, '')
    .replace(/^(?:y|f\(x\)|g\(x\))=/i, '');
}

function tokenize(text: string): Token[] | string {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\d|\./.test(ch)) {
      const match = /^\d+(?:\.\d+)?|^\.\d+/.exec(text.slice(i));
      if (!match) return `Số không hợp lệ ở "${text.slice(i, i + 6)}".`;
      tokens.push({ kind: 'num', value: Number(match[0]) });
      i += match[0].length;
    } else if (ch === 'x' || ch === 'X') {
      tokens.push({ kind: 'x' });
      i += 1;
    } else if (ch === '§') {
      tokens.push({ kind: 'frac' });
      i += 1;
    } else if ('+-*/^()'.includes(ch)) {
      tokens.push({ kind: ch });
      i += 1;
    } else {
      const word = /^[a-zA-Z]+/.exec(text.slice(i))?.[0];
      if (word && word.length > 1)
        return `"${word}" chưa được hỗ trợ: chỉ vẽ đa thức và phân thức của x.`;
      return `Không hiểu ký hiệu "${ch}". Chỉ dùng x, số, + − × /, ^ và ngoặc.`;
    }
  }
  return tokens;
}

class ParseError extends Error {}

const constant = (c: number): RationalFunction => ({ num: [c], den: [1] });
const rf = {
  add: (a: RationalFunction, b: RationalFunction): RationalFunction => ({
    num: add(mul(a.num, b.den), mul(b.num, a.den)),
    den: mul(a.den, b.den),
  }),
  neg: (a: RationalFunction): RationalFunction => ({ num: scale(a.num, -1), den: a.den }),
  mul: (a: RationalFunction, b: RationalFunction): RationalFunction => ({
    num: mul(a.num, b.num),
    den: mul(a.den, b.den),
  }),
  div: (a: RationalFunction, b: RationalFunction): RationalFunction => {
    if (degree(b.num) < 0) throw new ParseError('Có phép chia cho 0.');
    return { num: mul(a.num, b.den), den: mul(a.den, b.num) };
  },
};

function parseTokens(tokens: Token[]): RationalFunction {
  let pos = 0;
  const peek = () => tokens[pos]?.kind;
  const expect = (kind: string) => {
    if (peek() !== kind)
      throw new ParseError(kind === ')' ? 'Thiếu dấu ngoặc đóng.' : 'Biểu thức chưa đủ.');
    pos += 1;
  };

  function expression(): RationalFunction {
    let value = term();
    while (peek() === '+' || peek() === '-') {
      const op = tokens[pos++].kind;
      const right = term();
      value = rf.add(value, op === '+' ? right : rf.neg(right));
    }
    return value;
  }

  function term(): RationalFunction {
    let value = unary();
    for (;;) {
      const kind = peek();
      if (kind === '*' || kind === '/') {
        pos += 1;
        const right = unary();
        value = kind === '*' ? rf.mul(value, right) : rf.div(value, right);
      } else if (kind === 'x' || kind === '(' || kind === 'frac' || kind === 'num') {
        // Implicit multiplication: 3x, x(x + 1), (x - 1)(x + 1). A number may
        // only follow a closing bracket or x when written as (x)2, which we reject.
        if (kind === 'num') throw new ParseError('Viết số trước biến, ví dụ 3x thay vì x3.');
        value = rf.mul(value, power());
      } else return value;
    }
  }

  function unary(): RationalFunction {
    if (peek() === '-') {
      pos += 1;
      return rf.neg(unary());
    }
    if (peek() === '+') {
      pos += 1;
      return unary();
    }
    return power();
  }

  function power(): RationalFunction {
    const base = primary();
    if (peek() !== '^') return base;
    pos += 1;
    let exponentToken = tokens[pos];
    let wrapped = false;
    if (exponentToken?.kind === '(') {
      wrapped = true;
      pos += 1;
      exponentToken = tokens[pos];
    }
    if (exponentToken?.kind !== 'num') throw new ParseError('Số mũ phải là số tự nhiên.');
    const exponent = (exponentToken as { value: number }).value;
    pos += 1;
    if (wrapped) expect(')');
    if (!Number.isInteger(exponent) || exponent < 0 || exponent > MAX_EXPONENT) {
      throw new ParseError(`Số mũ phải là số tự nhiên từ 0 đến ${MAX_EXPONENT}.`);
    }
    let value = constant(1);
    for (let k = 0; k < exponent; k += 1) value = rf.mul(value, base);
    return value;
  }

  function primary(): RationalFunction {
    const token = tokens[pos];
    if (!token) throw new ParseError('Biểu thức chưa đủ.');
    pos += 1;
    if (token.kind === 'num') return constant((token as { value: number }).value);
    if (token.kind === 'x') return { num: [0, 1], den: [1] };
    if (token.kind === '(') {
      const value = expression();
      expect(')');
      return value;
    }
    if (token.kind === 'frac') {
      expect('(');
      const top = expression();
      expect(')');
      expect('(');
      const bottom = expression();
      expect(')');
      return rf.div(top, bottom);
    }
    throw new ParseError(`Không hiểu "${token.kind}" ở vị trí này.`);
  }

  const result = expression();
  if (pos !== tokens.length) throw new ParseError('Có ký hiệu thừa ở cuối biểu thức.');
  return result;
}

/** Parses "y = …" into a quotient of polynomials, or explains why it cannot. */
export function parseFunction(input: string): ParseResult {
  const text = normalize(input.trim());
  if (!text) return { ok: false, error: 'Chưa nhập hàm số.' };
  const tokens = tokenize(text);
  if (typeof tokens === 'string') return { ok: false, error: tokens };
  if (!tokens.some((token) => token.kind === 'x')) {
    return { ok: false, error: 'Hàm số cần có biến x.' };
  }
  try {
    let { num, den } = parseTokens(tokens);
    if (degree(den) === 0) {
      num = scale(num, 1 / den[0]);
      den = [1];
    }
    if (degree(num) > MAX_NUM_DEGREE || degree(den) > MAX_DEN_DEGREE) {
      return { ok: false, error: 'Bậc của hàm số quá cao để vẽ minh hoạ.' };
    }
    if (![...num, ...den].every(Number.isFinite)) {
      return { ok: false, error: 'Hệ số không hợp lệ.' };
    }
    const expression = input
      .trim()
      .replace(/^\$|\$$/g, '')
      .replace(/^(?:y|f\(x\))\s*=\s*/i, '');
    return { ok: true, fn: { num, den }, expression };
  } catch (error) {
    if (error instanceof ParseError) return { ok: false, error: error.message };
    throw error;
  }
}

export function evaluate(fn: RationalFunction, x: number): number {
  const d = evalPoly(fn.den, x);
  return d === 0 ? NaN : evalPoly(fn.num, x) / d;
}

/** f′ as a quotient: (p′q − pq′) / q². Its sign is the sign of the numerator. */
export function derivative(fn: RationalFunction): RationalFunction {
  return {
    num: add(mul(derive(fn.num), fn.den), scale(mul(fn.num, derive(fn.den)), -1)),
    den: mul(fn.den, fn.den),
  };
}

/** True when two functions agree at a spread of test points (used to match an example to the graph). */
export function sameFunction(a: RationalFunction, b: RationalFunction): boolean {
  const xs = [-3.7, -1.3, -0.45, 0.31, 0.77, 1.9, 2.6, 4.3];
  let compared = 0;
  for (const x of xs) {
    const va = evaluate(a, x);
    const vb = evaluate(b, x);
    if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
    compared += 1;
    if (Math.abs(va - vb) > 1e-9 * Math.max(1, Math.abs(va))) return false;
  }
  return compared >= 5;
}

// ─── Analysis ────────────────────────────────────────────────────────────────

export interface SignInterval {
  from: number;
  to: number;
  /** Sign of f′ on the open interval. */
  sign: 1 | -1;
}

export interface MonotonePiece {
  from: number;
  to: number;
  direction: 'up' | 'down';
}

export interface FunctionAnalysis {
  fn: RationalFunction;
  /** As the admin wrote it, without "y =". */
  expression: string;
  /** x values outside the domain (zeros of the denominator). */
  breaks: number[];
  /** Points of the domain where f′ = 0. */
  criticalPoints: number[];
  /** The domain cut at critical points and breaks, with the sign of f′ on each part. */
  intervals: SignInterval[];
  /** Maximal intervals of monotonicity (joined across zeros of f′ that keep the sign). */
  pieces: MonotonePiece[];
  /** Limits shown in the variation table: at −∞, at each break (left, right), at +∞. */
  limits: {
    left: number;
    right: number;
    atBreak: Record<string, { before: number; after: number }>;
  };
}

export type AnalysisResult =
  { ok: true; analysis: FunctionAnalysis } | { ok: false; error: string };

function limitAt(fn: RationalFunction, x: number): number {
  const value = evaluate(fn, x);
  if (!Number.isFinite(value) || Math.abs(value) > 1e5) return value > 0 ? Infinity : -Infinity;
  return snap(Math.round(value * 1e4) / 1e4, 1e-4);
}

export function analyzeFunction(input: string): AnalysisResult {
  const parsed = parseFunction(input);
  if (!parsed.ok) return parsed;
  const { fn } = parsed;
  const breaks = realRoots(fn.den);
  const fPrime = derivative(fn);
  if (degree(fPrime.num) < 0) {
    return {
      ok: false,
      error: 'Hàm số này là hàm hằng nên không có khoảng đồng biến, nghịch biến.',
    };
  }
  const isBreak = (x: number) => breaks.some((b) => Math.abs(b - x) < 1e-9);
  const criticalPoints = realRoots(fPrime.num).filter((x) => !isBreak(x));
  const cuts = [...new Set([...criticalPoints, ...breaks])].sort((a, b) => a - b);
  const bounds = [-Infinity, ...cuts, Infinity];
  const intervals: SignInterval[] = [];
  for (let i = 0; i < bounds.length - 1; i += 1) {
    const from = bounds[i];
    const to = bounds[i + 1];
    const probe =
      from === -Infinity && to === Infinity
        ? 0
        : from === -Infinity
          ? to - 1
          : to === Infinity
            ? from + 1
            : (from + to) / 2;
    const value = evalPoly(fPrime.num, probe);
    intervals.push({ from, to, sign: value > 0 ? 1 : -1 });
  }
  const pieces: MonotonePiece[] = [];
  for (const interval of intervals) {
    const last = pieces[pieces.length - 1];
    const direction = interval.sign > 0 ? 'up' : 'down';
    if (last && last.direction === direction && !isBreak(interval.from)) last.to = interval.to;
    else pieces.push({ from: interval.from, to: interval.to, direction });
  }
  const span = cuts.length ? cuts[cuts.length - 1] - cuts[0] + 1 : 1;
  const far = 1e7 * span;
  const atBreak: FunctionAnalysis['limits']['atBreak'] = {};
  for (const b of breaks) {
    const h = 1e-7 * Math.max(1, Math.abs(b));
    atBreak[String(b)] = { before: limitAt(fn, b - h), after: limitAt(fn, b + h) };
  }
  return {
    ok: true,
    analysis: {
      fn,
      expression: parsed.expression,
      breaks,
      criticalPoints,
      intervals,
      pieces,
      limits: { left: limitAt(fn, -far), right: limitAt(fn, far), atBreak },
    },
  };
}

// ─── Display helpers ─────────────────────────────────────────────────────────

const MINUS = '−';

/** −1, 1/3, ≈ 0,18, −∞: how a number reads in a Vietnamese maths lesson. */
export function formatNumber(value: number): string {
  if (value === Infinity) return '+∞';
  if (value === -Infinity) return `${MINUS}∞`;
  const sign = value < 0 ? MINUS : '';
  const abs = Math.abs(value);
  if (Number.isInteger(abs)) return `${sign}${abs}`;
  for (let q = 2; q <= 12; q += 1) {
    const n = Math.round(abs * q);
    if (Math.abs(abs - n / q) < 1e-9) return `${sign}${n}/${q}`;
  }
  return `≈ ${sign}${abs.toFixed(2).replace('.', ',')}`;
}

export function formatInterval(from: number, to: number): string {
  return `(${formatNumber(from)}; ${formatNumber(to)})`;
}
