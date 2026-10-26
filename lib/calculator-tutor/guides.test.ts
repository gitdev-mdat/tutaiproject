import { describe, expect, it } from 'vitest';
import type { Question } from '@/lib/question-bank/qb-types';
import { replay, screenText, type CalcState } from './fx570vn-plus';
import corpus from './fixtures/math-book-3.json';
import { REFERENCE_GUIDES, solutionGuideFor } from './registry';
import { X_OVER_LN_X } from './guides/x-over-ln-x';

describe.each(REFERENCE_GUIDES.map((guide) => [guide.id, guide] as const))('%s', (_id, guide) => {
  it('every step leaves the screen it promises, replayed key by key', () => {
    let state: CalcState | undefined;
    for (const step of guide.calculator.steps) {
      state = replay(step.keys, state);
      expect(state.screen, step.id).toBe(step.expect.screen);
      expect(screenText(state), step.id).toBe(step.expect.text);
    }
  });

  it('never presents a value outside the domain as a function value', () => {
    let state: CalcState | undefined;
    for (const step of guide.calculator.steps) {
      state = replay(step.keys, state);
      if (state.screen !== 'TABLE') continue;
      for (const row of state.rows) {
        const defined = row.x > 0 && row.x !== 1;
        expect(row.f === null, `x = ${row.x}`).toBe(!defined);
        if (defined) expect(row.f).toBeCloseTo(row.x / Math.log(row.x), 9);
      }
    }
  });
});

describe('x / ln x', () => {
  const steps = Object.fromEntries(X_OVER_LN_X.calculator.steps.map((step) => [step.id, step]));
  const after = (id: string) => {
    let state: CalcState | undefined;
    for (const step of X_OVER_LN_X.calculator.steps) {
      state = replay(step.keys, state);
      if (step.id === id) return state;
    }
    throw new Error(id);
  };

  it('samples (0; 1) inside the domain: strictly decreasing values', () => {
    const values = after('range-0-1').rows.map((row) => row.f!);
    expect(after('range-0-1').rows[0].x).toBeGreaterThan(0);
    expect(values.every((v, i) => i === 0 || v < values[i - 1])).toBe(true);
  });

  it('samples (1; 4): decreasing, then increasing after the smallest value near x = e', () => {
    const rows = after('range-1-4').rows;
    expect(rows[0].x).toBeGreaterThan(1);
    const min = rows.reduce((best, row) => (row.f! < best.f! ? row : best));
    expect(min.x).toBe(2.8);
    expect(Math.abs(min.x - Math.E)).toBeLessThan(0.2);
    expect(rows.length).toBeLessThanOrEqual(30);
    expect(steps['read-1-4'].checkpoint?.body).toMatch(/đạo hàm/);
  });

  it('the derivative method concludes D and the sign table matches ln x - 1', () => {
    expect(X_OVER_LN_X.derivative.lines.find((line) => line.emphasis)?.text).toMatch(/Chọn D/);
    const derivative = (x: number) => (Math.log(x) - 1) / Math.log(x) ** 2;
    expect([0.5, 2, 4].map((x) => (derivative(x) > 0 ? '+' : '−'))).toEqual(
      X_OVER_LN_X.derivative.signTable!.signs
    );
  });
});

describe('matching the reference lesson, by content only', () => {
  const real = corpus.questions[0];
  const base = {
    id: 'qa-other-id',
    stem: real.stem,
    options: real.options,
    explanation: real.explanation,
  } as unknown as Question;

  it('the same question content gets the reference lesson, whatever its id', () => {
    expect(solutionGuideFor(base)?.id).toBe(X_OVER_LN_X.id);
    expect(solutionGuideFor({ ...base, id: 'anything-else' })?.origin).toBe('reference');
  });

  it('another question on x / ln x (other choices) gets a generated guide, not the reference', () => {
    const other = {
      ...base,
      options: [
        { key: 'A', content: 'Hàm số đồng biến trên $(e; +\\infty)$' },
        { key: 'B', content: 'Hàm số đồng biến trên $(0; 1)$' },
      ],
    } as Question;
    const guide = solutionGuideFor(other)!;
    expect(guide.origin).toBe('generated');
    expect(guide.level).toBe('A');
  });

  it('a question without a calculator method gets nothing', () => {
    expect(
      solutionGuideFor({ ...base, explanation: 'Tập xác định: $D = \\mathbb{R}$.' })
    ).toBeNull();
  });

  it('keeps only the source notes that apply to the imported text, and no matching rule in the payload', () => {
    const guide = solutionGuideFor(base)!;
    expect('match' in guide).toBe(false);
    expect(guide.source.notes.some((note) => /ký tự điều khiển/.test(note.text))).toBe(true);
    const clean = solutionGuideFor({
      ...base,
      explanation: real.explanation.replace(
        /\$D = \(0; \+[^$]*\$/,
        '$D = (0; +\\infty) \\setminus \\{1\\}$'
      ),
    })!;
    expect(clean.source.notes.some((note) => /ký tự điều khiển/.test(note.text))).toBe(false);
  });
});
