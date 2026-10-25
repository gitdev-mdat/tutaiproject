import { definedFunction, derivative, polynomialOf, type Polynomial } from './solution-matching';
import type { ExerciseChoice } from './types';

/**
 * Deterministic checks of a proposed answer, where the mathematics allows one.
 * Today: "the polynomial y = P(x) is increasing / decreasing on interval I",
 * the commonest question of "Tính đơn điệu". The answer of a question outside
 * what the check understands is left to the Admin: NOT_APPLICABLE is not a pass.
 */

export type AnswerCheck =
  | { status: 'CONFIRMED'; note: string }
  | { status: 'CONFLICT'; note: string }
  | { status: 'AMBIGUOUS'; note: string }
  | { status: 'NOT_APPLICABLE' };

type Direction = 'INCREASING' | 'DECREASING';
type Interval = { start: number; end: number; label: string };

const strip = (text: string) =>
  text
    .replace(/\$/g, '')
    .replace(/\\(?:left|right|displaystyle)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function directionOf(text: string): Direction | null {
  const plain = strip(text).toLocaleLowerCase('vi');
  if (/không\s+(?:đồng|nghịch)\s+biến/u.test(plain)) return null;
  const up = /đồng\s+biến/u.test(plain);
  const down = /nghịch\s+biến/u.test(plain);
  if (up === down) return null;
  return up ? 'INCREASING' : 'DECREASING';
}

function numberOf(raw: string): number | null {
  const text = raw.replace(/\s+/g, '');
  if (/^\+?\\infty$/.test(text)) return Infinity;
  if (/^-\\infty$/.test(text)) return -Infinity;
  const fraction = /^(-?)\\[dt]?frac\{(-?\d+(?:\.\d+)?)\}\{(\d+(?:\.\d+)?)\}$/.exec(text);
  if (fraction) return (fraction[1] ? -1 : 1) * (Number(fraction[2]) / Number(fraction[3]));
  const slash = /^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(text);
  if (slash) return Number(slash[1]) / Number(slash[2]);
  return /^-?\d+(?:[.,]\d+)?$/.test(text) ? Number(text.replace(',', '.')) : null;
}

const INTERVAL = /[([]\s*([^;,()[\]$]+?)\s*[;,]\s*([^;,()[\]$]+?)\s*[)\]]|\\mathbb\{R\}|ℝ/g;
const FILLER =
  /^(?:hàm|số|đã|cho|luôn|trên|khoảng|các|mỗi|từng|và|tập|xác|định|của|nó|\(|\)|[;,.:])*$/u;

/** "(a; b)", "(-\infty; 0) và (2; +\infty)", "\mathbb{R}" → open intervals; null if anything else. */
export function intervalsOf(text: string): Interval[] | null {
  const plain = strip(text);
  const intervals: Interval[] = [];
  for (const match of plain.matchAll(INTERVAL)) {
    if (!match[1]) {
      intervals.push({ start: -Infinity, end: Infinity, label: 'ℝ' });
      continue;
    }
    const start = numberOf(match[1]);
    const end = numberOf(match[2]);
    if (start === null || end === null || !(start < end)) return null;
    intervals.push({ start, end, label: match[0] });
  }
  const rest = plain.replace(INTERVAL, ' ').toLocaleLowerCase('vi').replace(/\s+/g, '');
  if (!intervals.length || !FILLER.test(rest)) return null;
  return intervals;
}

/**
 * The claims of one answer choice: "nghịch biến trên (0; 1) và đồng biến trên
 * (1; +∞)" is two claims. A choice without a direction takes the stem's. Null
 * when the choice says anything the check does not understand.
 */
function claimsOf(text: string, stemDirection: Direction | null) {
  const plain = strip(text);
  const keywords = [...plain.matchAll(/(đồng|nghịch)\s+biến/giu)];
  if (/không\s+(?:đồng|nghịch)\s+biến/iu.test(plain)) return null;
  if (!keywords.length) {
    const intervals = stemDirection ? intervalsOf(plain) : null;
    return intervals ? [{ direction: stemDirection!, intervals }] : null;
  }
  if (!FILLER.test(plain.slice(0, keywords[0].index).toLocaleLowerCase('vi').replace(/\s+/g, '')))
    return null;
  const claims: Array<{ direction: Direction; intervals: Interval[] }> = [];
  keywords.forEach((keyword, index) => {
    const from = (keyword.index ?? 0) + keyword[0].length;
    const to = keywords[index + 1]?.index ?? plain.length;
    claims.push({
      direction: /đồng/iu.test(keyword[1]) ? 'INCREASING' : 'DECREASING',
      intervals: intervalsOf(plain.slice(from, to)) ?? [],
    });
  });
  return claims.every((claim) => claim.intervals.length) ? claims : null;
}

const evaluate = (polynomial: Polynomial, x: number) =>
  [...polynomial].reduce((sum, [power, coefficient]) => sum + coefficient * x ** power, 0);

/** True when the polynomial keeps the sign the direction needs on the whole open interval. */
function monotoneOn(fn: Polynomial, direction: Direction, interval: Interval): boolean {
  const d = derivative(fn);
  const degree = Math.max(0, ...d.keys());
  const lead = Math.abs(d.get(degree) ?? 0);
  if (lead === 0) return false; // constant function: neither strictly
  // Every real root of d lies within the Cauchy bound.
  const bound =
    1 + Math.max(0, ...[...d].filter(([p]) => p !== degree).map(([, c]) => Math.abs(c) / lead));
  const start = Math.max(interval.start, -bound - 1);
  const end = Math.min(interval.end, bound + 1);
  if (!(start < end)) {
    const x = interval.start === -Infinity ? interval.end - 1 : interval.start + 1;
    const value = evaluate(d, x);
    return direction === 'INCREASING' ? value > 0 : value < 0;
  }
  const steps = 4000;
  for (let i = 1; i < steps; i += 1) {
    const x = start + ((end - start) * i) / steps;
    const value = evaluate(d, x);
    // A zero of d' inside the interval is allowed only as an isolated point.
    if (direction === 'INCREASING' ? value < -1e-9 : value > 1e-9) return false;
  }
  return true;
}

/** Checks the proposed answer of a monotonicity question about a polynomial. */
export function checkMonotonicityAnswer(
  stem: string,
  choices: ExerciseChoice[] | undefined,
  answer: string | null | undefined
): AnswerCheck {
  if (!answer || !choices?.length) return { status: 'NOT_APPLICABLE' };
  const fnSource = definedFunction(stem);
  const fn = fnSource ? polynomialOf(fnSource) : null;
  const radicalMatch = fnSource ? /^\\sqrt\{([^{}]+)\}$/.exec(fnSource) : null;
  const radical = radicalMatch ? polynomialOf(radicalMatch[1]) : null;
  if (!fn && !radical) return { status: 'NOT_APPLICABLE' };
  const stemDirection = directionOf(stem.split('\n')[0] ?? stem) ?? directionOf(stem);
  const verdicts = choices.map((choice) => {
    const claims = claimsOf(choice.text, stemDirection);
    return {
      label: choice.label,
      holds: claims
        ? claims.every((claim) =>
            claim.intervals.every((interval) =>
              fn
                ? monotoneOn(fn, claim.direction, interval)
                : monotoneOnRadical(radical!, claim.direction, interval)
            )
          )
        : (null as boolean | null),
    };
  });
  const chosen = verdicts.find((verdict) => verdict.label === answer);
  if (!chosen || chosen.holds === null) return { status: 'NOT_APPLICABLE' };
  if (!chosen.holds)
    return {
      status: 'CONFLICT',
      note: `Tính đạo hàm của y = ${fnSource}: phương án ${answer} không đúng.`,
    };
  const alsoTrue = verdicts
    .filter((v) => v.label !== answer && v.holds === true)
    .map((v) => v.label);
  if (alsoTrue.length)
    return {
      status: 'AMBIGUOUS',
      note: `Phương án ${answer} đúng theo đạo hàm, nhưng ${alsoTrue.join(', ')} cũng đúng.`,
    };
  const unknown = verdicts.some((v) => v.label !== answer && v.holds === null);
  if (unknown)
    return {
      status: 'AMBIGUOUS',
      note: `Phương án ${answer} đúng theo đạo hàm, nhưng chưa kiểm chứng được các phương án còn lại.`,
    };
  return {
    status: 'CONFIRMED',
    note: `Đã tính đạo hàm của y = ${fnSource}: phương án ${answer} đúng, các phương án còn lại sai.`,
  };
}

/** Sign-checks sqrt of a concave quadratic on the interior of its real domain. */
function monotoneOnRadical(
  radicand: Polynomial,
  direction: Direction,
  interval: Interval
): boolean {
  const a = radicand.get(2) ?? 0;
  const b = radicand.get(1) ?? 0;
  const c = radicand.get(0) ?? 0;
  if (!(a < 0)) return false;
  const discriminant = b * b - 4 * a * c;
  if (!(discriminant > 0)) return false;
  const root = Math.sqrt(discriminant);
  const roots = [(-b - root) / (2 * a), (-b + root) / (2 * a)].sort((x, y) => x - y);
  const [domainStart, domainEnd] = roots;
  if (interval.start < domainStart || interval.end > domainEnd) return false;
  const vertex = -b / (2 * a);
  return direction === 'INCREASING'
    ? interval.end <= vertex + 1e-10
    : interval.start >= vertex - 1e-10;
}

/** Infer a choice only from a single explicit derivative-sign interval in the solution. */
export function inferMonotonicityChoice(
  stem: string,
  choices: ExerciseChoice[] | undefined,
  solution: string
): string | null {
  if (!choices?.length) return null;
  const facts: Array<{ direction: Direction; interval: string }> = [];
  for (const [, sign, interval] of solution.matchAll(
    /y\s*'\s*([<>])\s*0\s*\$?\s*(?:trên|tren)\s*\$?\s*(\([^)]*\))/giu
  ))
    facts.push({ direction: sign === '>' ? 'INCREASING' : 'DECREASING', interval });
  for (const [, sign, interval] of solution.matchAll(
    /y\s*'\s*([<>])\s*0[\s$]*(?:\\forall|∀)\s*x\s*\\in\s*\$?(\([^)]*\))/giu
  ))
    facts.push({ direction: sign === '>' ? 'INCREASING' : 'DECREASING', interval });
  for (const [, word, interval] of solution.matchAll(
    /(đồng|nghịch)\s+biến\s+(?:trên|tren)\s*\$?(\([^)]*\))/giu
  ))
    facts.push({ direction: word === 'đồng' ? 'INCREASING' : 'DECREASING', interval });
  const normalizedFacts = [
    ...new Set(
      facts
        .map((fact) => {
          const parsed = intervalsOf(fact.interval);
          return parsed?.length === 1
            ? `${fact.direction}:${parsed[0].start}:${parsed[0].end}`
            : '';
        })
        .filter(Boolean)
    ),
  ];
  if (normalizedFacts.length !== 1) return null;
  const [, direction, start, end] =
    /^(INCREASING|DECREASING):([^:]+):([^:]+)$/.exec(normalizedFacts[0]) ?? [];
  const expectedDirection = direction as Direction;
  const requestedDirection = directionOf(stem);
  if (expectedDirection !== requestedDirection) return null;
  const normalized = `${start}:${end}`;
  const eligible = choices.filter((choice) => {
    const candidate = intervalsOf(choice.text);
    return candidate?.length === 1 && `${candidate[0].start}:${candidate[0].end}` === normalized;
  });
  if (eligible.length !== 1) return null;
  const check = checkMonotonicityAnswer(stem, choices, eligible[0].label);
  return check.status === 'CONFIRMED' ? eligible[0].label : null;
}
