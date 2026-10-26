import { describe, expect, it } from 'vitest';
import {
  evaluate,
  formatCell,
  initialState,
  press,
  replay,
  screenText,
  selectedValue,
  type KeyId,
  type Token,
} from './fx570vn-plus';

const OPEN: KeyId[] = ['MODE', '7'];
const X_OVER_LN_X: KeyId[] = ['ALPHA', 'RPAREN', 'DIVIDE', 'LN', 'ALPHA', 'RPAREN', 'RPAREN'];
const number = (text: string): KeyId[] => [...text].map((c) => (c === '.' ? 'DOT' : (c as KeyId)));
const range = (start: string, end: string, step: string): KeyId[] => [
  ...number(start),
  'EQ',
  ...number(end),
  'EQ',
  ...number(step),
  'EQ',
];
const table = (start: string, end: string, step: string) =>
  replay([...OPEN, ...X_OVER_LN_X, 'EQ', 'EQ', ...range(start, end, step)]);

describe('expression entry', () => {
  it('enters X ÷ ln(X) with ALPHA ) for X and ln opening its bracket', () => {
    expect(screenText(replay([...OPEN, ...X_OVER_LN_X]))).toBe('f(X)=X÷ln(X)');
  });

  it('evaluates with the calculator precedence and implied multiplication', () => {
    const t = (s: string) => [...s] as Token[];
    expect(evaluate(t('1+2×3'), 0)).toEqual({ kind: 'value', value: 7 });
    expect(evaluate(['2', 'X'], 4)).toEqual({ kind: 'value', value: 8 });
    expect(evaluate(['X', '÷', 'ln(', 'X'], Math.E)).toEqual({ kind: 'value', value: Math.E });
    expect(evaluate(['X', '÷', 'ln(', 'X', ')'], 2).kind).toBe('value');
  });

  it('reports undefined values and syntax errors instead of inventing numbers', () => {
    expect(evaluate(['X', '÷', 'ln(', 'X', ')'], 0)).toEqual({ kind: 'math' });
    expect(evaluate(['X', '÷', 'ln(', 'X', ')'], 1)).toEqual({ kind: 'math' });
    expect(evaluate(['X', '÷', 'ln(', 'X', ')'], -2)).toEqual({ kind: 'math' });
    expect(evaluate(['X', '÷'], 2)).toEqual({ kind: 'syntax' });
    expect(evaluate(['1', '.', '2', '.', '3'], 0)).toEqual({ kind: 'syntax' });
  });

  it('SHIFT ×10ˣ is π and ALPHA ×10ˣ is e', () => {
    const start = replay([...OPEN, 'ALPHA', 'EXP', 'EQ', 'EQ', 'SHIFT', 'EXP']);
    expect(screenText(start)).toBe('Start? π');
    const e = replay([...OPEN, 'ALPHA', 'EXP']);
    expect(screenText(e)).toBe('f(X)=e');
  });

  it('DEL and the cursor keys edit the expression', () => {
    let state = replay([...OPEN, ...X_OVER_LN_X, 'DEL', 'DEL']);
    expect(screenText(state)).toBe('f(X)=X÷ln(');
    state = replay(['LEFT', 'DEL', 'TIMES'], state);
    expect(screenText(state)).toBe('f(X)=X×ln(');
  });
});

describe('TABLE', () => {
  it('asks g(X) after f(X) (reset setting f(x),g(x)) and starts from the defaults 1, 5, 1', () => {
    const state = replay([...OPEN, ...X_OVER_LN_X, 'EQ']);
    expect(state.screen).toBe('G');
    const start = replay(['EQ'], state);
    expect(screenText(start)).toBe('Start? 1');
    const defaults = replay(['EQ', 'EQ', 'EQ'], start);
    expect(defaults.rows.map((row) => row.x)).toEqual([1, 2, 3, 4, 5]);
    expect(defaults.rows[0].f).toBeNull();
  });

  it('values on (0; 1) are x / ln x at each sampled x', () => {
    const state = table('0.1', '0.9', '0.1');
    expect(state.rows).toHaveLength(9);
    state.rows.forEach((row, i) => {
      const x = Number(((i + 1) / 10).toFixed(1));
      expect(row.x).toBe(x);
      expect(row.f).toBeCloseTo(x / Math.log(x), 9);
    });
  });

  it('marks x = 0 and x = 1 as ERROR (outside the domain), never as values', () => {
    const state = table('0', '2', '0.5');
    expect(state.rows.map((row) => [row.x, row.f === null ? 'ERROR' : 'value'])).toEqual([
      [0, 'ERROR'],
      [0.5, 'value'],
      [1, 'ERROR'],
      [1.5, 'value'],
      [2, 'value'],
    ]);
    expect(formatCell(state.rows[0].f)).toBe('ERROR');
    const atOne = replay(['DOWN', 'DOWN'], state);
    expect(selectedValue({ ...atOne, col: 1 })).toBe('ERROR');
  });

  it('cuts table cells to six characters like the printed screens in the source (p. 29)', () => {
    const left = table('0.2', '0.8', '0.2');
    expect(left.rows.map((row) => formatCell(row.f))).toEqual([
      '-0.124',
      '-0.436',
      '-1.174',
      '-3.585',
    ]);
    const right = table('1.2', '2.2', '0.2');
    expect(right.rows.map((row) => formatCell(row.f))).toEqual([
      '6.5817',
      '4.1608',
      '3.4042',
      '3.0623',
      '2.8853',
      '2.7902',
    ]);
  });

  it('refuses more than 30 rows and an End below Start with Range ERROR', () => {
    expect(table('0.1', '4', '0.1').error).toBe('Range ERROR');
    expect(table('3', '1', '0.5').error).toBe('Range ERROR');
    expect(table('1', '30', '1').rows).toHaveLength(30);
  });

  it('a syntax error in f(X) is reported when the table is generated', () => {
    const state = replay([
      ...OPEN,
      'ALPHA',
      'RPAREN',
      'DIVIDE',
      'EQ',
      'EQ',
      ...range('1', '2', '1'),
    ]);
    expect(state.error).toBe('Syntax ERROR');
    expect(replay(['AC'], state).screen).toBe('F');
  });

  it('scrolls three visible rows with ▼ ▲ and returns to f(X) with AC, keeping the function', () => {
    let state = table('1.2', '4', '0.2');
    state = replay(['DOWN', 'DOWN', 'DOWN'], state);
    expect([state.row, state.top]).toEqual([3, 1]);
    state = replay(['UP', 'UP', 'UP'], state);
    expect([state.row, state.top]).toEqual([0, 0]);
    expect(press(state, 'UP').ok).toBe(false);
    expect(screenText(replay(['AC'], state))).toBe('f(X)=X÷ln(X)');
  });
});

describe('MathI/O boxes: √▭, x^▭ and x²', () => {
  const X: KeyId[] = ['ALPHA', 'RPAREN'];
  it('√ opens a box that ▶ leaves; the box closes itself at the end', () => {
    // (2X − 3) ÷ √(X² − 1)
    const state = replay([
      ...OPEN,
      'LPAREN',
      '2',
      ...X,
      'MINUS',
      '3',
      'RPAREN',
      'DIVIDE',
      'SQRT',
      ...X,
      'SQUARE',
      'MINUS',
      '1',
    ]);
    expect(screenText(state)).toBe('f(X)=(2X−3)÷√(X²−1)');
    expect(evaluate(state.f, 2)).toEqual({ kind: 'value', value: 1 / Math.sqrt(3) });
    expect(evaluate(state.f, 0.5)).toEqual({ kind: 'math' });
    expect(evaluate(state.f, 1)).toEqual({ kind: 'math' });
  });

  it('x^▭ takes the exponent in a box; ▶ goes on after it', () => {
    const state = replay([...OPEN, ...X, 'POWER', '3', 'RIGHT', 'PLUS', '1']);
    expect(screenText(state)).toBe('f(X)=X^(3)+1');
    expect(evaluate(state.f, 2)).toEqual({ kind: 'value', value: 9 });
  });

  it('(−)X² is −(X²), and 1÷2X is 1÷(2X) (multiplication without a sign first)', () => {
    const square = replay([...OPEN, 'NEG', ...X, 'SQUARE']);
    expect(evaluate(square.f, 3)).toEqual({ kind: 'value', value: -9 });
    const quotient = replay([...OPEN, '1', 'DIVIDE', '2', ...X]);
    expect(evaluate(quotient.f, 4)).toEqual({ kind: 'value', value: 1 / 8 });
  });

  it('DEL steps back into a box and removes a box with its end, keeping what is inside', () => {
    let state = replay([...OPEN, 'SQRT', '4', 'RIGHT']);
    state = replay(['DEL'], state);
    expect(state.cursor).toBe(2);
    state = replay(['LEFT', 'DEL'], state);
    expect(screenText(state)).toBe('f(X)=4');
  });

  it('boxes are not accepted at Start?/End?/Step?', () => {
    const state = replay([...OPEN, ...X, 'EQ', 'EQ']);
    expect(press(state, 'SQRT').ok).toBe(false);
  });
});

describe('unsupported keys say so', () => {
  it.each<KeyId>(['LOG', 'FRAC', 'RCL', 'ENG', 'SD', 'MPLUS', 'ANS', 'ON'])('%s', (key) => {
    const state = replay([...OPEN]);
    const result = press(state, key);
    expect(result.ok).toBe(false);
    expect(result.state.f).toEqual(state.f);
    expect(result.message).toMatch(/ngoài phạm vi/);
  });

  it.each<KeyId>(['SIN', 'COS', 'TAN', 'CALC', 'INTEG'])(
    '%s says why it is not simulated',
    (key) => {
      const state = replay([...OPEN]);
      const result = press(state, key);
      expect(result.ok).toBe(false);
      expect(result.state.f).toEqual(state.f);
      expect(result.message).toMatch(/không được mô phỏng/);
    }
  );

  it('other modes are not simulated', () => {
    const result = press(replay(['MODE']), '5');
    expect(result.ok).toBe(false);
    expect(result.state.screen).toBe('MODE_MENU');
  });

  it('COMP only points to MODE', () => {
    expect(press(initialState(), '7').ok).toBe(false);
  });
});
