import { describe, expect, it } from 'vitest';
import {
  analyzeFunction,
  evaluate,
  formatInterval,
  formatNumber,
  parseFunction,
  realRoots,
  sameFunction,
} from './function-model';

function analysis(input: string) {
  const result = analyzeFunction(input);
  if (!result.ok) throw new Error(result.error);
  return result.analysis;
}

describe('parseFunction', () => {
  it('reads plain and LaTeX-style input', () => {
    for (const input of ['y = x^3 - 3x', '$y = x^3 - 3x$', 'f(x)=x³−3x', 'x(x-1)(x+1) - 2x']) {
      const parsed = parseFunction(input);
      expect(parsed.ok, input).toBe(true);
      if (parsed.ok) expect(evaluate(parsed.fn, 2)).toBeCloseTo(2, 12);
    }
    const fraction = parseFunction('y = \\dfrac{x - 1}{x + 2}');
    expect(fraction.ok).toBe(true);
    if (fraction.ok) expect(evaluate(fraction.fn, 1)).toBe(0);
  });

  it('respects precedence: -x^2 is −(x²)', () => {
    const parsed = parseFunction('-x^2 + 1');
    expect(parsed.ok && evaluate(parsed.fn, 3)).toBe(-8);
  });

  it('rejects what it cannot draw correctly instead of guessing', () => {
    for (const input of [
      '',
      'y = sin(x)',
      'y = 2^x',
      'y = x^(1.5)',
      'y = 5',
      'y = (x+1',
      'y = \\sqrt{x}',
    ]) {
      expect(parseFunction(input).ok, input).toBe(false);
    }
  });
});

describe('realRoots', () => {
  it('finds simple, repeated and irrational roots', () => {
    expect(realRoots([-3, 0, 3])).toEqual([-1, 1]);
    expect(realRoots([0, 0, 3])).toEqual([0]);
    expect(realRoots([0, -4, 0, 4])).toEqual([-1, 0, 1]);
    const [a, b] = realRoots([-1, 0, 1, 0].slice(0, 3).map((c, i) => (i === 0 ? -2 : c)));
    expect(a).toBeCloseTo(-Math.SQRT2, 10);
    expect(b).toBeCloseTo(Math.SQRT2, 10);
    expect(realRoots([1, 0, 1])).toEqual([]);
  });
});

describe('analyzeFunction', () => {
  it('y = x³ − 3x: increasing, decreasing, increasing around ±1', () => {
    const a = analysis('y = x^3 - 3x');
    expect(a.criticalPoints).toEqual([-1, 1]);
    expect(a.intervals.map((i) => i.sign)).toEqual([1, -1, 1]);
    expect(a.pieces.map((p) => [formatInterval(p.from, p.to), p.direction])).toEqual([
      ['(−∞; −1)', 'up'],
      ['(−1; 1)', 'down'],
      ['(1; +∞)', 'up'],
    ]);
    expect(evaluate(a.fn, -1)).toBe(2);
    expect(evaluate(a.fn, 1)).toBe(-2);
    expect(a.limits).toMatchObject({ left: -Infinity, right: Infinity });
  });

  it('y = x³ keeps one increasing piece through the zero of f′', () => {
    const a = analysis('y = x^3');
    expect(a.criticalPoints).toEqual([0]);
    expect(a.intervals.map((i) => i.sign)).toEqual([1, 1]);
    expect(a.pieces).toEqual([{ from: -Infinity, to: Infinity, direction: 'up' }]);
  });

  it('y = (x − 1)/(x + 2) increases on each side of the break, never across it', () => {
    const a = analysis('y = \\dfrac{x - 1}{x + 2}');
    expect(a.breaks).toEqual([-2]);
    expect(a.criticalPoints).toEqual([]);
    expect(a.pieces.map((p) => [formatInterval(p.from, p.to), p.direction])).toEqual([
      ['(−∞; −2)', 'up'],
      ['(−2; +∞)', 'up'],
    ]);
    expect(a.limits.left).toBe(1);
    expect(a.limits.right).toBe(1);
    expect(a.limits.atBreak['-2']).toEqual({ before: Infinity, after: -Infinity });
  });

  it('matches the practice question y = x⁴ − 2x²', () => {
    const a = analysis('y = x^4 - 2x^2');
    expect(a.pieces.map((p) => p.direction)).toEqual(['down', 'up', 'down', 'up']);
    expect(a.criticalPoints).toEqual([-1, 0, 1]);
  });

  it('rejects constant functions', () => {
    expect(analyzeFunction('y = \\dfrac{2x + 2}{x + 1}').ok).toBe(false);
  });
});

describe('formatting and matching', () => {
  it('formats numbers the Vietnamese way', () => {
    expect(formatNumber(-1)).toBe('−1');
    expect(formatNumber(1 / 3)).toBe('1/3');
    expect(formatNumber(Math.SQRT2)).toBe('≈ 1,41');
    expect(formatNumber(-Infinity)).toBe('−∞');
  });

  it('recognises the same function written differently', () => {
    const a = parseFunction('x^3 - 3x');
    const b = parseFunction('x(x - 1)(x + 1) - 2x');
    const c = parseFunction('x^3 - 3x + 1');
    expect(a.ok && b.ok && sameFunction(a.fn, b.fn)).toBe(true);
    expect(a.ok && c.ok && sameFunction(a.fn, c.fn)).toBe(false);
  });
});
