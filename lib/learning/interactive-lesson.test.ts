import { describe, expect, it } from 'vitest';
import { interactiveLessonConfig } from '@/config/interactive-lessons';
import { buildLessonJourney } from '@/lib/knowledge-tree/lesson-journey';
import {
  DON_DIEU_P1_CURRENT,
  DON_DIEU_P1_LESSON_ID,
} from '@/lib/knowledge-tree/__fixtures__/don-dieu-p1-2026-10-19';
import type { KnowledgeArticleBlock } from '@/lib/knowledge-tree/knowledge-tree-types';
import {
  analyzeFunction,
  derivativeChoices,
  domainLatex,
  evaluate,
  derivative,
  formatPolynomial,
  nonTurningPoints,
  parseFunction,
  testValue,
  type FunctionAnalysis,
} from './function-model';
import {
  FRESH_ATTEMPT,
  answer,
  askHint,
  buildInteractivePlan,
  outcomeOf,
  practiceRole,
  restoreInteractiveStage,
} from './interactive-lesson';

const analysis = (source: string): FunctionAnalysis => {
  const result = analyzeFunction(source);
  if (!result.ok) throw new Error(result.error);
  return result.analysis;
};
const fPrime = (source: string, x: number) => evaluate(derivative(analysis(source).fn), x);
const pieces = (a: FunctionAnalysis) => a.pieces.map((p) => [p.from, p.to, p.direction]);

describe('the three functions of the P1 pilot', () => {
  it('y = x³ − 3x² + 2: y′ = 3x² − 6x, zeros 0 and 2, up / down / up', () => {
    const a = analysis('y = x^3 - 3x^2 + 2');
    expect(a.criticalPoints).toEqual([0, 2]);
    expect(evaluate(a.fn, 0)).toBe(2);
    expect(evaluate(a.fn, 2)).toBe(-2);
    expect(a.intervals.map((i) => i.sign)).toEqual([1, -1, 1]);
    expect(pieces(a)).toEqual([
      [-Infinity, 0, 'up'],
      [0, 2, 'down'],
      [2, Infinity, 'up'],
    ]);
    expect(fPrime('y = x^3 - 3x^2 + 2', -1)).toBe(9);
    expect(fPrime('y = x^3 - 3x^2 + 2', 1)).toBe(-3);
    expect(fPrime('y = x^3 - 3x^2 + 2', 3)).toBe(9);
    expect(fPrime('y = x^3 - 3x^2 + 2', 0.5)).toBeCloseTo(-2.25, 12);
    expect(nonTurningPoints(a)).toEqual([]);
  });

  it('y = −x³ + 3x: y′ = −3x² + 3, zeros ±1, down / up / down', () => {
    const a = analysis('y = -x^3 + 3x');
    expect(a.criticalPoints).toEqual([-1, 1]);
    expect(evaluate(a.fn, -1)).toBe(-2);
    expect(evaluate(a.fn, 1)).toBe(2);
    expect(pieces(a)).toEqual([
      [-Infinity, -1, 'down'],
      [-1, 1, 'up'],
      [1, Infinity, 'down'],
    ]);
    expect(nonTurningPoints(a)).toEqual([]);
  });

  it('y = x³: y′(0) = 0 but y′ keeps its sign, so the function increases on ℝ', () => {
    const a = analysis('y = x^3');
    expect(a.criticalPoints).toEqual([0]);
    expect(a.intervals.map((i) => i.sign)).toEqual([1, 1]);
    expect(pieces(a)).toEqual([[-Infinity, Infinity, 'up']]);
    expect(nonTurningPoints(a)).toEqual([0]);
  });

  it('a rational function still analyses, and is kept out of the step-by-step exercises', () => {
    const a = analysis('y = \\dfrac{x - 1}{x + 2}');
    expect(a.breaks).toEqual([-2]);
    expect(a.criticalPoints).toEqual([]);
    expect(pieces(a)).toEqual([
      [-Infinity, -2, 'up'],
      [-2, Infinity, 'up'],
    ]);
    expect(domainLatex(a)).toBe('\\mathbb{R} \\setminus \\{-2\\}');
    expect(derivativeChoices(a.fn)).toBeNull();
    expect(practiceRole('y = \\dfrac{x - 1}{x + 2}', null)).toMatchObject({ ok: false });
  });
});

describe('derivative options', () => {
  it('offers the right derivative and three distinct, wrong slips for x³ − 3x² + 2', () => {
    const fn = (parseFunction('y = x^3 - 3x^2 + 2') as { ok: true; fn: never }).fn;
    const options = derivativeChoices(fn)!;
    expect(options.map((o) => o.latex)).toEqual([
      '3x^{2} - 6x',
      'x^{2} - 3x',
      '3x^{2} - 6x + 2',
      '3x^{3} - 6x^{2}',
    ]);
    expect(options.filter((o) => o.correct)).toHaveLength(1);
    expect(options.slice(1).every((o) => o.mistake)).toBe(true);
  });

  it('drops a slip that would equal the right answer (no constant term in −x³ + 3x)', () => {
    const fn = (parseFunction('y = -x^3 + 3x') as { ok: true; fn: never }).fn;
    const options = derivativeChoices(fn)!;
    expect(options.map((o) => o.latex)).toEqual(['-3x^{2} + 3', '-x^{2} + 3', '-3x^{3} + 3x']);
    expect(new Set(options.map((o) => o.latex)).size).toBe(options.length);
  });

  it('formats polynomials the way the lesson writes them', () => {
    expect(formatPolynomial([0, 0, 3])).toBe('3x^{2}');
    expect(formatPolynomial([-1, 1])).toBe('x - 1');
    expect(formatPolynomial([0, 0, 0, -1])).toBe('-x^{3}');
    expect(formatPolynomial([0])).toBe('0');
  });
});

describe('test values for the sign table', () => {
  it('picks an easy integer inside each interval, never on its ends', () => {
    expect(testValue(-Infinity, 0)).toBe(-1);
    expect(testValue(0, 2)).toBe(1);
    expect(testValue(2, Infinity)).toBe(3);
    expect(testValue(-1, 1)).toBe(0);
    expect(testValue(-Infinity, Infinity)).toBe(0);
    const inside = testValue(0.5, 0.9);
    expect(inside).toBeGreaterThan(0.5);
    expect(inside).toBeLessThan(0.9);
  });

  it('the sign at each test value is the sign of the interval', () => {
    for (const source of ['y = x^3 - 3x^2 + 2', 'y = -x^3 + 3x', 'y = x^3']) {
      const a = analysis(source);
      for (const interval of a.intervals) {
        const value = fPrime(source, testValue(interval.from, interval.to));
        expect(Math.sign(value)).toBe(interval.sign);
      }
    }
  });
});

describe('the interactive plan from the published P1 lesson', () => {
  const classic = buildLessonJourney(DON_DIEU_P1_CURRENT, { checks: 0 });
  const config = interactiveLessonConfig(DON_DIEU_P1_LESSON_ID, undefined)!;
  const plan = buildInteractivePlan(DON_DIEU_P1_CURRENT, {
    classic,
    defaultPractice: config.practice,
  })!;

  it('is built from the admin content, not written for this lesson', () => {
    expect(plan.main).toBe('y = x^3 - 3x^2 + 2');
    expect(plan.hypothesis).toBe('Giả sử hàm số $y = f(x)$ có đạo hàm trên khoảng $K$.');
    expect(plan.theorem?.title).toBe('Điều kiện đủ để hàm số đơn điệu');
    expect(plan.theorem?.items).toHaveLength(3);
    expect(plan.extension?.title).toBe('Mở rộng điều kiện đơn điệu');
    expect(plan.method?.steps).toHaveLength(4);
    expect(plan.example?.steps.map((s) => s.label)).toEqual([
      'Bước 1',
      'Bước 2',
      'Bước 3',
      'Bước 4',
    ]);
    expect(plan.recap).toHaveLength(4);
  });

  it('uses the pilot fallbacks while the lesson has no practice field', () => {
    expect(plan.practice).toBe('y = -x^3 + 3x');
    expect(plan.flat).toBe('y = x^3');
    expect(plan.stages.map((s) => s.id)).toEqual([
      'bat-dau',
      'kham-pha',
      'mo-rong',
      'vi-du',
      'thu-suc',
      'tong-ket',
    ]);
  });

  it("prefers the admin's own practice functions", () => {
    const blocks: KnowledgeArticleBlock[] = [
      ...DON_DIEU_P1_CURRENT,
      { id: 'p', type: 'GRAPH_PRACTICE', content: 'y = x^3 - 3x\ny = x^3 - 3x^2 + 2' },
    ];
    const own = buildInteractivePlan(blocks, { classic, defaultPractice: config.practice })!;
    expect(own.practice).toBe('y = x^3 - 3x');
    // No f′ = 0 example among the admin's functions: the part keeps only the text.
    expect(own.flat).toBeNull();
    expect(own.stages.map((s) => s.id)).toContain('mo-rong');
  });

  it('rejects practice functions that would not teach anything new', () => {
    expect(practiceRole('y = x^3 - 3x^2 + 2', plan.main)).toMatchObject({ ok: false });
    expect(practiceRole('y = 2x + 1', plan.main)).toMatchObject({ ok: false });
    expect(practiceRole('y = sin x', plan.main)).toMatchObject({ ok: false });
    expect(practiceRole('y = x^3', plan.main)).toMatchObject({ ok: true, role: 'flat' });
  });

  it('is null for a lesson without a drawable polynomial', () => {
    const noGraph = DON_DIEU_P1_CURRENT.map((b) =>
      b.type === 'GRAPH' ? { ...b, content: '' } : b
    );
    expect(buildInteractivePlan(noGraph, { classic })).toBeNull();
    const rational = DON_DIEU_P1_CURRENT.map((b) =>
      b.type === 'GRAPH' ? { ...b, content: 'y = \\dfrac{x - 1}{x + 2}' } : b
    );
    expect(buildInteractivePlan(rational, { classic })).toBeNull();
  });

  it('maps every stage of the text lesson to an interactive part', () => {
    expect(classic.stages.map((s) => s.id)).toEqual([
      'bat-dau',
      'y-1',
      'y-2',
      'y-3',
      'y-4',
      'vi-du',
      'tong-ket',
    ]);
    expect(plan.aliases).toEqual({
      'bat-dau': 'bat-dau',
      'y-1': 'kham-pha',
      'y-2': 'kham-pha',
      'y-3': 'mo-rong',
      'y-4': 'vi-du',
      'vi-du': 'vi-du',
      'tong-ket': 'tong-ket',
    });
  });
});

describe('progress saved by the text lesson', () => {
  const classic = buildLessonJourney(DON_DIEU_P1_CURRENT, { checks: 0 });
  const plan = buildInteractivePlan(DON_DIEU_P1_CURRENT, {
    classic,
    defaultPractice: ['y = -x^3 + 3x', 'y = x^3'],
  })!;
  const restore = (saved: Parameters<typeof restoreInteractiveStage>[0]) =>
    plan.stages[restoreInteractiveStage(saved, plan, classic)]?.id;

  it('a finished lesson stays finished', () => {
    expect(
      restore({ reached: 6, total: 7, stageId: 'tong-ket', completedAt: '2026-10-20T00:00:00Z' })
    ).toBe('tong-ket');
    expect(restore({ reached: 2, total: 7, completedAt: '2026-10-20T00:00:00Z' })).toBe('tong-ket');
  });

  it('a lesson in progress resumes at the part teaching the same idea', () => {
    expect(restore({ reached: 2, total: 7, stageId: 'y-2', completedAt: null })).toBe('kham-pha');
    expect(restore({ reached: 3, total: 7, stageId: 'y-3', completedAt: null })).toBe('mo-rong');
    expect(restore({ reached: 4, total: 7, stageId: 'y-4', completedAt: null })).toBe('vi-du');
    expect(restore({ reached: 5, total: 7, completedAt: null })).toBe('vi-du');
    expect(restore({ reached: 3, total: 6, stageId: 'vi-du', completedAt: null })).toBe('vi-du');
    expect(restore(undefined)).toBe('bat-dau');
  });
});

describe('attempts and hints', () => {
  it('a right first answer is a first try', () => {
    const state = answer(FRESH_ATTEMPT, true);
    expect(state.status).toBe('correct');
    expect(outcomeOf(state)).toBe('first-try');
  });

  it('each miss opens the next hint; the third reveals the answer', () => {
    let state = answer(FRESH_ATTEMPT, false);
    expect(state).toEqual({ misses: 1, hints: 1, status: 'open' });
    state = answer(state, false);
    expect(state).toEqual({ misses: 2, hints: 2, status: 'open' });
    state = answer(state, false);
    expect(state.status).toBe('revealed');
    expect(outcomeOf(state)).toBe('revealed');
    // Nothing changes once closed.
    expect(answer(state, true)).toBe(state);
  });

  it('asking for a hint counts as help, and hints stop at the last one', () => {
    let state = askHint(FRESH_ATTEMPT);
    state = askHint(state);
    state = askHint(state);
    expect(state.hints).toBe(2);
    expect(outcomeOf(answer(state, true))).toBe('with-help');
    expect(outcomeOf(answer(answer(FRESH_ATTEMPT, false), true))).toBe('with-help');
  });
});

describe('turning the pilot on and off', () => {
  it('is on for P1 only, unless the setting turns it off', () => {
    expect(interactiveLessonConfig(DON_DIEU_P1_LESSON_ID, undefined)).not.toBeNull();
    expect(interactiveLessonConfig(DON_DIEU_P1_LESSON_ID, '')).not.toBeNull();
    expect(interactiveLessonConfig('knowledge-other', undefined)).toBeNull();
    expect(interactiveLessonConfig(DON_DIEU_P1_LESSON_ID, 'off')).toBeNull();
    expect(interactiveLessonConfig(DON_DIEU_P1_LESSON_ID, 'knowledge-other')).toBeNull();
    expect(interactiveLessonConfig(DON_DIEU_P1_LESSON_ID, DON_DIEU_P1_LESSON_ID)).not.toBeNull();
  });
});

describe('graph exploration and guided steps', () => {
  it('snaps M onto f′ = 0 only when it is close, so the zero can be landed on exactly', async () => {
    const { snapX, trailBin, TRAIL_BINS } =
      await import('@/components/learning/interactive/explore-graph');
    const view = { xMin: -2, xMax: 4, yMin: -3, yMax: 3 };
    expect(snapX(1.95, view, [0, 2])).toBe(2);
    expect(snapX(0.1, view, [0, 2])).toBe(0);
    expect(snapX(1.5, view, [0, 2])).toBe(1.5);
    expect(snapX(9, view, [])).toBe(4);
    expect(trailBin(-2, view)).toBe(0);
    expect(trailBin(4, view)).toBe(TRAIL_BINS - 1);
  });

  it('offers the right roots of f′ = 0 among plausible slips, never duplicates', async () => {
    const { rootCandidates } = await import('@/components/learning/interactive/guided-solver');
    // y = x³ − 3x² + 2: y′ = 3x² − 6x = 0 ⇔ x = 0 or x = 2.
    const main = rootCandidates([0, 2]);
    expect(main).toEqual(expect.arrayContaining([0, 2]));
    expect(new Set(main).size).toBe(main.length);
    expect(main.length).toBeGreaterThanOrEqual(4);
    // y = −x³ + 3x: y′ = −3x² + 3 = 0 ⇔ x = ±1.
    expect(rootCandidates([-1, 1])).toEqual(expect.arrayContaining([-1, 1]));
    // No roots: "Vô nghiệm" is the answer, the chips are only distractors.
    expect(rootCandidates([]).length).toBeGreaterThan(0);
  });
});
