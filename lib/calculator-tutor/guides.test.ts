import { describe, expect, it } from 'vitest';
import type { Question } from '@/lib/question-bank/qb-types';
import { replay, screenText, type CalcState } from './fx570vn-plus';
import { SOLUTION_GUIDES, solutionGuideFor } from './registry';
import { X_OVER_LN_X } from './guides/x-over-ln-x';

describe.each(SOLUTION_GUIDES.map((guide) => [guide.id, guide] as const))('%s', (_id, guide) => {
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

describe('matching a question', () => {
  const base = {
    id: 'qa-other',
    stem: 'Cho hàm số $y = \\frac{x}{\\ln x}$. Trong các khẳng định dưới đây, khẳng định nào đúng?',
    explanation: 'Tập xác định: $D = (0; +\frac{\\infty}{\\infty}) \\setminus \\{1\\}$.\nCách 2: …',
    textbookSource: { documentTitle: 'math_book_3', questionNumber: '1' },
  } as unknown as Question;

  it('by id, or by the same textbook question with the same formula', () => {
    expect(
      solutionGuideFor({
        ...base,
        id: 'q-b48ea52f-2c80-41f8-9740-852bbad40ed5',
        textbookSource: undefined,
      })?.id
    ).toBe(X_OVER_LN_X.id);
    expect(solutionGuideFor(base)?.id).toBe(X_OVER_LN_X.id);
  });

  it('not another question of the book, nor the same number in another book', () => {
    expect(solutionGuideFor({ ...base, stem: 'Cho hàm số $y = x - \\ln(x + 1)$.' })).toBeNull();
    expect(
      solutionGuideFor({
        ...base,
        textbookSource: { documentTitle: 'other', questionNumber: '1' },
      } as Question)
    ).toBeNull();
    expect(solutionGuideFor({ ...base, textbookSource: undefined })).toBeNull();
  });

  it('keeps only the source notes that apply to the imported text, and no matching rule in the payload', () => {
    const guide = solutionGuideFor(base)!;
    expect('match' in guide).toBe(false);
    expect(guide.source.notes.some((note) => /ký tự điều khiển/.test(note.text))).toBe(true);
    const clean = solutionGuideFor({
      ...base,
      explanation: 'Tập xác định: $D = (0; +\\infty) \\setminus \\{1\\}$.',
    })!;
    expect(clean.source.notes.some((note) => /ký tự điều khiển/.test(note.text))).toBe(false);
    expect(clean.source.notes.some((note) => /Cách 1/.test(note.text))).toBe(false);
  });
});
