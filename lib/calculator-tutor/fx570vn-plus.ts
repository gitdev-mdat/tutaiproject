/**
 * A teaching simulation of the TABLE mode of the CASIO fx-570VN PLUS, limited
 * to what the calculator tutorials need. It is not an emulator: no CASIO
 * firmware, ROM or artwork is used, and every key outside the supported set
 * says so instead of pretending to work.
 *
 * Supported, as documented in the fx-570VN PLUS / fx-570ES PLUS user's guide:
 * MODE → 7 (TABLE); f(X) and g(X) input (the reset setting is "f(x),g(x)", so
 * the calculator asks for g(X) after f(X)); Start?/End?/Step? prompts with
 * defaults 1, 5, 1; at most 30 rows with the f(x),g(x) setting; AC on the table
 * returns to the function input. Function values are computed here, in double
 * precision, from the expression the student typed: a value that is undefined
 * (ln of a non-positive number, division by zero) is shown as ERROR, as the
 * calculator does.
 */

export const MODEL = {
  id: 'fx-570VN-PLUS',
  name: 'CASIO fx-570VN PLUS',
  kind: 'teaching-simulation',
} as const;

export type KeyId =
  | 'SHIFT'
  | 'ALPHA'
  | 'MODE'
  | 'ON'
  | 'UP'
  | 'DOWN'
  | 'LEFT'
  | 'RIGHT'
  | 'FRAC'
  | 'SQRT'
  | 'SQUARE'
  | 'LOG'
  | 'LN'
  | 'NEG'
  | 'RCL'
  | 'ENG'
  | 'LPAREN'
  | 'RPAREN'
  | 'SD'
  | 'MPLUS'
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'DOT'
  | 'EXP'
  | 'ANS'
  | 'EQ'
  | 'DEL'
  | 'AC'
  | 'TIMES'
  | 'DIVIDE'
  | 'PLUS'
  | 'MINUS';

/** What is printed on and above a key. `shift`/`alpha` are the secondary labels. */
export type KeyFace = { id: KeyId; label: string; shift?: string; alpha?: string; aria: string };

export const KEYS: Record<KeyId, KeyFace> = {
  SHIFT: { id: 'SHIFT', label: 'SHIFT', aria: 'SHIFT' },
  ALPHA: { id: 'ALPHA', label: 'ALPHA', aria: 'ALPHA' },
  MODE: { id: 'MODE', label: 'MODE', shift: 'SETUP', aria: 'MODE' },
  ON: { id: 'ON', label: 'ON', aria: 'ON' },
  UP: { id: 'UP', label: '▲', aria: 'Mũi tên lên' },
  DOWN: { id: 'DOWN', label: '▼', aria: 'Mũi tên xuống' },
  LEFT: { id: 'LEFT', label: '◀', aria: 'Mũi tên trái' },
  RIGHT: { id: 'RIGHT', label: '▶', aria: 'Mũi tên phải' },
  FRAC: { id: 'FRAC', label: '▭/▭', aria: 'Phân số' },
  SQRT: { id: 'SQRT', label: '√▭', aria: 'Căn bậc hai' },
  SQUARE: { id: 'SQUARE', label: 'x²', aria: 'Bình phương' },
  LOG: { id: 'LOG', label: 'log', aria: 'log' },
  LN: { id: 'LN', label: 'ln', shift: 'eˣ', aria: 'ln' },
  NEG: { id: 'NEG', label: '(−)', aria: 'Dấu âm' },
  RCL: { id: 'RCL', label: 'RCL', aria: 'RCL' },
  ENG: { id: 'ENG', label: 'ENG', aria: 'ENG' },
  LPAREN: { id: 'LPAREN', label: '(', aria: 'Mở ngoặc' },
  RPAREN: { id: 'RPAREN', label: ')', alpha: 'X', aria: 'Đóng ngoặc' },
  SD: { id: 'SD', label: 'S⇔D', aria: 'S⇔D' },
  MPLUS: { id: 'MPLUS', label: 'M+', aria: 'M+' },
  '0': { id: '0', label: '0', aria: '0' },
  '1': { id: '1', label: '1', aria: '1' },
  '2': { id: '2', label: '2', aria: '2' },
  '3': { id: '3', label: '3', aria: '3' },
  '4': { id: '4', label: '4', aria: '4' },
  '5': { id: '5', label: '5', aria: '5' },
  '6': { id: '6', label: '6', aria: '6' },
  '7': { id: '7', label: '7', aria: '7' },
  '8': { id: '8', label: '8', aria: '8' },
  '9': { id: '9', label: '9', aria: '9' },
  DOT: { id: 'DOT', label: '.', aria: 'Dấu chấm thập phân' },
  EXP: { id: 'EXP', label: '×10ˣ', shift: 'π', alpha: 'e', aria: '×10ˣ' },
  ANS: { id: 'ANS', label: 'Ans', aria: 'Ans' },
  EQ: { id: 'EQ', label: '=', aria: 'Bằng' },
  DEL: { id: 'DEL', label: 'DEL', aria: 'DEL' },
  AC: { id: 'AC', label: 'AC', aria: 'AC' },
  TIMES: { id: 'TIMES', label: '×', aria: 'Nhân' },
  DIVIDE: { id: 'DIVIDE', label: '÷', aria: 'Chia' },
  PLUS: { id: 'PLUS', label: '+', aria: 'Cộng' },
  MINUS: { id: 'MINUS', label: '−', aria: 'Trừ' },
};

/** One symbol of an expression as it appears on the screen. */
export type Token =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '.'
  | 'X'
  | 'e'
  | 'π'
  | 'ln('
  | '('
  | ')'
  | '+'
  | '−'
  | '×'
  | '÷'
  | '⁻';

export type Screen =
  'COMP' | 'MODE_MENU' | 'F' | 'G' | 'START' | 'END' | 'STEP' | 'TABLE' | 'ERROR';
export type ErrorKind = 'Syntax ERROR' | 'Math ERROR' | 'Range ERROR';
export type Row = { x: number; f: number | null; g: number | null };

export type CalcState = {
  screen: Screen;
  shift: boolean;
  alpha: boolean;
  f: Token[];
  g: Token[];
  /** Cursor position in the expression or prompt being edited. */
  cursor: number;
  start: number;
  end: number;
  step: number;
  /** What was typed at the current Start?/End?/Step? prompt; empty keeps the shown value. */
  entry: Token[];
  rows: Row[];
  hasG: boolean;
  row: number;
  col: 0 | 1 | 2;
  /** First row shown: the table screen shows three rows. */
  top: number;
  error: ErrorKind | null;
};

export const TABLE_MAX_ROWS = 30;
export const VISIBLE_ROWS = 3;

export function initialState(): CalcState {
  return {
    screen: 'COMP',
    shift: false,
    alpha: false,
    f: [],
    g: [],
    cursor: 0,
    start: 1,
    end: 5,
    step: 1,
    entry: [],
    rows: [],
    hasG: false,
    row: 0,
    col: 0,
    top: 0,
    error: null,
  };
}

/**
 * What a key press did. `ok: false` means the key is outside what this
 * simulation supports (or does nothing here); the state is then unchanged
 * apart from clearing SHIFT/ALPHA, and `message` says why.
 */
export type PressResult = { state: CalcState; ok: boolean; message: string };

const DIGIT_TOKENS: Partial<Record<KeyId, Token>> = {
  '0': '0',
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  DOT: '.',
  LPAREN: '(',
  RPAREN: ')',
  PLUS: '+',
  MINUS: '−',
  TIMES: '×',
  DIVIDE: '÷',
  NEG: '⁻',
  LN: 'ln(',
};

const UNSUPPORTED = 'Phím này nằm ngoài phạm vi bản mô phỏng (chỉ mô phỏng chức năng TABLE).';

/** The token a key types, after SHIFT/ALPHA, or null when it types nothing. */
function tokenFor(key: KeyId, state: CalcState): Token | null {
  if (state.alpha) {
    if (key === 'RPAREN') return 'X';
    if (key === 'EXP') return 'e';
    return null;
  }
  if (state.shift) return key === 'EXP' ? 'π' : null;
  return DIGIT_TOKENS[key] ?? null;
}

const TOKEN_MESSAGE: Partial<Record<Token, string>> = {
  X: 'Nhập biến X (ALPHA + phím ")").',
  e: 'Nhập hằng số e ≈ 2,718 (ALPHA + ×10ˣ).',
  π: 'Nhập hằng số π ≈ 3,142 (SHIFT + ×10ˣ).',
  'ln(': 'Phím ln nhập "ln(" và tự mở ngoặc.',
  '÷': 'Nhập phép chia.',
  ')': 'Đóng ngoặc.',
  '(': 'Mở ngoặc.',
  '⁻': 'Nhập dấu âm.',
};

function insert(list: Token[], at: number, token: Token): Token[] {
  return [...list.slice(0, at), token, ...list.slice(at)];
}

function editing(state: CalcState): Token[] {
  if (state.screen === 'F') return state.f;
  if (state.screen === 'G') return state.g;
  return state.entry;
}

function withEdited(state: CalcState, tokens: Token[], cursor: number): CalcState {
  if (state.screen === 'F') return { ...state, f: tokens, cursor };
  if (state.screen === 'G') return { ...state, g: tokens, cursor };
  return { ...state, entry: tokens, cursor };
}

const PROMPT_NEXT: Record<'START' | 'END', 'END' | 'STEP'> = { START: 'END', END: 'STEP' };
const PROMPT_LABEL = { START: 'Start', END: 'End', STEP: 'Step' } as const;

export function press(previous: CalcState, key: KeyId): PressResult {
  const state = { ...previous, shift: false, alpha: false };
  const fail = (message: string): PressResult => ({ state, ok: false, message });
  const done = (next: CalcState, message: string): PressResult => ({
    state: next,
    ok: true,
    message,
  });

  if (key === 'SHIFT') {
    return done(
      { ...state, shift: !previous.shift },
      previous.shift ? 'Tắt SHIFT.' : 'Bật SHIFT: phím tiếp theo dùng chức năng chữ vàng.'
    );
  }
  if (key === 'ALPHA') {
    return done(
      { ...state, alpha: !previous.alpha },
      previous.alpha ? 'Tắt ALPHA.' : 'Bật ALPHA: phím tiếp theo dùng chức năng chữ đỏ.'
    );
  }
  if (key === 'MODE' && previous.shift)
    return fail('SETUP (SHIFT + MODE) không được mô phỏng. Bài này dùng cài đặt mặc định của máy.');
  if (key === 'MODE')
    return done({ ...state, screen: 'MODE_MENU', error: null }, 'Mở menu chọn chế độ (MODE).');

  switch (previous.screen) {
    case 'COMP':
      return fail('Bản mô phỏng chỉ có chế độ TABLE. Hãy bấm MODE để chọn chế độ.');

    case 'MODE_MENU':
      if (key === '7' && !previous.shift && !previous.alpha) {
        return done(
          { ...state, screen: 'F', f: [], g: [], cursor: 0 },
          'Chọn 7: TABLE. Máy hiện f(X)= để nhập hàm số.'
        );
      }
      if (key === '1')
        return done({ ...state, screen: 'COMP' }, 'Chọn 1: COMP (tính toán thông thường).');
      if (key === 'AC') return done({ ...state, screen: 'COMP' }, 'Thoát menu.');
      if (/^\d$/.test(key))
        return fail(`Chế độ số ${key} không nằm trong bản mô phỏng. TABLE là số 7.`);
      return fail('Trong menu MODE, hãy bấm số của chế độ cần chọn.');

    case 'F':
    case 'G':
    case 'START':
    case 'END':
    case 'STEP': {
      const tokens = editing(previous);
      const token = tokenFor(key, previous);
      if (token) {
        if (previous.screen !== 'F' && previous.screen !== 'G' && token === 'X') {
          return fail('Start, End và Step là các số, không chứa X.');
        }
        return done(
          withEdited(state, insert(tokens, previous.cursor, token), previous.cursor + 1),
          TOKEN_MESSAGE[token] ?? `Nhập "${token}".`
        );
      }
      if (previous.shift || previous.alpha) return fail(UNSUPPORTED);
      if (key === 'DEL') {
        if (previous.cursor === 0) return fail('Không còn gì để xoá ở bên trái con trỏ.');
        return done(
          withEdited(
            state,
            [...tokens.slice(0, previous.cursor - 1), ...tokens.slice(previous.cursor)],
            previous.cursor - 1
          ),
          'Xoá ký tự bên trái con trỏ.'
        );
      }
      if (key === 'LEFT')
        return done(
          { ...state, cursor: Math.max(0, previous.cursor - 1) },
          'Dời con trỏ sang trái.'
        );
      if (key === 'RIGHT')
        return done(
          { ...state, cursor: Math.min(tokens.length, previous.cursor + 1) },
          'Dời con trỏ sang phải.'
        );
      if (key === 'AC') {
        if (previous.screen === 'F' || previous.screen === 'G')
          return done(withEdited(state, [], 0), 'Xoá biểu thức đang nhập.');
        return done(
          { ...state, screen: 'F', entry: [], cursor: previous.f.length },
          'Huỷ, quay lại màn hình nhập f(X).'
        );
      }
      if (key === 'EQ') return confirm(previous, state);
      if (key === 'UP' || key === 'DOWN') return fail('Phím này không dùng ở màn hình nhập.');
      return fail(UNSUPPORTED);
    }

    case 'TABLE': {
      if (previous.shift || previous.alpha) return fail(UNSUPPORTED);
      const columns = previous.hasG ? 3 : 2;
      if (key === 'DOWN' || key === 'UP') {
        const row = Math.min(
          previous.rows.length - 1,
          Math.max(0, previous.row + (key === 'DOWN' ? 1 : -1))
        );
        if (row === previous.row)
          return fail(key === 'DOWN' ? 'Đã ở dòng cuối của bảng.' : 'Đã ở dòng đầu của bảng.');
        const top =
          row < previous.top
            ? row
            : row >= previous.top + VISIBLE_ROWS
              ? row - VISIBLE_ROWS + 1
              : previous.top;
        return done(
          { ...state, row, top },
          `Chuyển đến dòng X = ${formatFull(previous.rows[row].x)}.`
        );
      }
      if (key === 'LEFT' || key === 'RIGHT') {
        const col = Math.min(
          columns - 1,
          Math.max(0, previous.col + (key === 'RIGHT' ? 1 : -1))
        ) as 0 | 1 | 2;
        if (col === previous.col) return fail('Không còn cột nào theo hướng này.');
        return done({ ...state, col }, `Chọn cột ${['X', 'F(X)', 'G(X)'][col]}.`);
      }
      if (key === 'AC')
        return done(
          { ...state, screen: 'F', cursor: previous.f.length },
          'Quay lại màn hình nhập f(X) (hàm số vẫn được giữ).'
        );
      if (key === 'EQ') return fail('Bảng đã hiện. Dùng ▲ ▼ để xem các dòng, AC để quay lại.');
      return fail('Ở màn hình bảng, bản mô phỏng chỉ hỗ trợ ▲ ▼ ◀ ▶ và AC.');
    }

    case 'ERROR':
      if (key === 'AC' || key === 'LEFT' || key === 'RIGHT') {
        return done(
          { ...state, screen: 'F', error: null, cursor: previous.f.length },
          'Đóng thông báo lỗi, quay lại nhập f(X).'
        );
      }
      return fail('Máy đang báo lỗi. Bấm AC để quay lại.');
  }
}

/** = on an input screen. */
function confirm(previous: CalcState, state: CalcState): PressResult {
  const done = (next: CalcState, message: string): PressResult => ({
    state: next,
    ok: true,
    message,
  });
  if (previous.screen === 'F') {
    return done(
      { ...state, screen: 'G', cursor: previous.g.length },
      'Xác nhận f(X). Máy hỏi tiếp g(X)= (cài đặt mặc định "f(x),g(x)").'
    );
  }
  if (previous.screen === 'G') {
    return done(
      { ...state, screen: 'START', entry: [], cursor: 0 },
      previous.g.length
        ? 'Xác nhận g(X). Máy hỏi Start?'
        : 'Bỏ trống g(X). Máy hỏi Start? (giá trị X đầu tiên).'
    );
  }
  const screen = previous.screen as 'START' | 'END' | 'STEP';
  const field = ({ START: 'start', END: 'end', STEP: 'step' } as const)[screen];
  let value = previous[field];
  if (previous.entry.length) {
    const parsed = evaluate(previous.entry, 0);
    if (parsed.kind === 'syntax')
      return done(
        { ...state, screen: 'ERROR', error: 'Syntax ERROR' },
        'Máy báo Syntax ERROR: biểu thức nhập chưa đúng cú pháp.'
      );
    if (parsed.kind === 'math')
      return done(
        { ...state, screen: 'ERROR', error: 'Math ERROR' },
        'Máy báo Math ERROR: giá trị nhập không tính được.'
      );
    value = round10(parsed.value);
  }
  const next = { ...state, [field]: value, entry: [] as Token[], cursor: 0 };
  const label = PROMPT_LABEL[screen];
  if (screen !== 'STEP') {
    return done(
      { ...next, screen: PROMPT_NEXT[screen] },
      `${label} = ${formatFull(value)}. Máy hỏi tiếp ${PROMPT_LABEL[PROMPT_NEXT[screen]]}?`
    );
  }
  return generate(next, label);
}

function generate(state: CalcState, label: string): PressResult {
  const fail = (error: ErrorKind, message: string): PressResult => ({
    state: { ...state, screen: 'ERROR', error },
    ok: true,
    message,
  });
  if (
    !state.f.length ||
    parse(state.f) === null ||
    (state.g.length > 0 && parse(state.g) === null)
  ) {
    return fail('Syntax ERROR', 'Máy báo Syntax ERROR: hàm số nhập chưa đúng cú pháp.');
  }
  const count =
    state.step > 0 && state.end >= state.start
      ? Math.floor((state.end - state.start) / state.step + 1e-9) + 1
      : Infinity;
  if (count > TABLE_MAX_ROWS) {
    return fail(
      'Range ERROR',
      `Máy báo Range ERROR: Start, End, Step này cho quá ${TABLE_MAX_ROWS} dòng (hoặc End nhỏ hơn Start, Step không dương).`
    );
  }
  const rows: Row[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = round10(state.start + i * state.step);
    const value = (tokens: Token[]) => {
      const result = evaluate(tokens, x);
      return result.kind === 'value' ? result.value : null;
    };
    rows.push({ x, f: value(state.f), g: state.g.length ? value(state.g) : null });
  }
  const undefinedRows = rows.filter((row) => row.f === null).length;
  return {
    state: {
      ...state,
      screen: 'TABLE',
      rows,
      hasG: state.g.length > 0,
      row: 0,
      col: 0,
      top: 0,
      error: null,
    },
    ok: true,
    message: `${label} = ${formatFull(state.step)}. Máy lập bảng ${rows.length} dòng${undefinedRows ? `, có ${undefinedRows} dòng ERROR (X ngoài tập xác định)` : ''}.`,
  };
}

// ---------------------------------------------------------------- expressions

type Node =
  | { t: 'num'; v: number }
  | { t: 'x' }
  | { t: 'neg'; a: Node }
  | { t: 'ln'; a: Node }
  | { t: 'bin'; op: '+' | '−' | '×' | '÷'; a: Node; b: Node };

/**
 * Reads tokens with the calculator's precedence: × and ÷ (including implied
 * multiplication such as 2X) before + and −. Closing brackets at the end of the
 * expression may be omitted, as on the calculator. Returns null on a syntax error.
 */
export function parse(tokens: Token[]): Node | null {
  let i = 0;
  const peek = () => tokens[i];
  const startsFactor = (token: Token | undefined) =>
    token !== undefined &&
    (/^[\d.]$/.test(token) || ['X', 'e', 'π', 'ln(', '(', '⁻'].includes(token));

  function number(): Node | null {
    let text = '';
    while (peek() !== undefined && /^[\d.]$/.test(peek()!)) text += tokens[i++];
    if ((text.match(/\./g)?.length ?? 0) > 1 || text === '.') return null;
    return { t: 'num', v: Number(text) };
  }
  function closing(): boolean {
    if (peek() === ')') {
      i += 1;
      return true;
    }
    return peek() === undefined;
  }
  function factor(): Node | null {
    const token = peek();
    if (token === undefined) return null;
    if (/^[\d.]$/.test(token)) return number();
    i += 1;
    if (token === 'X') return { t: 'x' };
    if (token === 'e') return { t: 'num', v: Math.E };
    if (token === 'π') return { t: 'num', v: Math.PI };
    if (token === '⁻') {
      const a = factor();
      return a && { t: 'neg', a };
    }
    if (token === '(' || token === 'ln(') {
      const a = sum();
      if (!a || !closing()) return null;
      return token === '(' ? a : { t: 'ln', a };
    }
    return null;
  }
  function product(): Node | null {
    let a = factor();
    while (a) {
      const token = peek();
      if (token === '×' || token === '÷') {
        i += 1;
        const b = factor();
        if (!b) return null;
        a = { t: 'bin', op: token, a, b };
      } else if (startsFactor(token)) {
        const b = factor();
        if (!b) return null;
        a = { t: 'bin', op: '×', a, b };
      } else break;
    }
    return a;
  }
  function sum(): Node | null {
    let a = product();
    while (a && (peek() === '+' || peek() === '−')) {
      const op = tokens[i++] as '+' | '−';
      const b = product();
      if (!b) return null;
      a = { t: 'bin', op, a, b };
    }
    return a;
  }
  const tree = sum();
  return tree && i === tokens.length ? tree : null;
}

export type Evaluation = { kind: 'value'; value: number } | { kind: 'math' } | { kind: 'syntax' };

class MathError extends Error {}

function run(node: Node, x: number): number {
  switch (node.t) {
    case 'num':
      return node.v;
    case 'x':
      return x;
    case 'neg':
      return -run(node.a, x);
    case 'ln': {
      const a = run(node.a, x);
      if (!(a > 0)) throw new MathError();
      return Math.log(a);
    }
    case 'bin': {
      const a = run(node.a, x);
      const b = run(node.b, x);
      if (node.op === '÷' && b === 0) throw new MathError();
      const value =
        node.op === '+' ? a + b : node.op === '−' ? a - b : node.op === '×' ? a * b : a / b;
      if (!Number.isFinite(value)) throw new MathError();
      return value;
    }
  }
}

export function evaluate(tokens: Token[], x: number): Evaluation {
  const tree = parse(tokens);
  if (!tree) return { kind: 'syntax' };
  try {
    return { kind: 'value', value: run(tree, x) };
  } catch (error) {
    if (error instanceof MathError) return { kind: 'math' };
    throw error;
  }
}

// ---------------------------------------------------------------- formatting

/** The calculator keeps 10 significant digits on screen. */
export function round10(value: number): number {
  return Number(value.toPrecision(10));
}

/** A value the way the bottom line of the table screen shows it: up to 10 significant digits. */
export function formatFull(value: number): string {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e10 || abs < 1e-9)
    return value
      .toExponential(9)
      .replace(/\.?0+e/, 'e')
      .replace('e+', '×10^')
      .replace('e', '×10^');
  return String(round10(value));
}

/**
 * A value squeezed into a table cell (six characters), cut rather than rounded:
 * the cells printed in the source (page 29) show 6.5817 for 6.58178 and -1.174
 * for -1.17457. The full value is on the bottom line when the cell is selected.
 */
export function formatCell(value: number | null): string {
  if (value === null) return 'ERROR';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(round10(value));
  for (let decimals = 9; decimals >= 0; decimals -= 1) {
    const cut = Math.trunc(round10(abs * 10 ** decimals)) / 10 ** decimals;
    const text = sign + String(Number(cut.toFixed(decimals)));
    if (text.length <= 6) return cut === 0 && sign ? '-0' : text;
  }
  return value.toExponential(0);
}

/** An expression as typed, for the input line. */
export function expressionText(tokens: Token[]): string {
  return tokens.map((token) => (token === '⁻' ? '-' : token)).join('');
}

/** Plain-text summary of the screen, for tests and screen readers. */
export function screenText(state: CalcState): string {
  switch (state.screen) {
    case 'COMP':
      return 'COMP';
    case 'MODE_MENU':
      return '1:COMP 2:CMPLX 3:STAT 4:BASE-N 5:EQN 6:MATRIX 7:TABLE 8:VECTOR';
    case 'F':
      return `f(X)=${expressionText(state.f)}`;
    case 'G':
      return `g(X)=${expressionText(state.g)}`;
    case 'START':
    case 'END':
    case 'STEP': {
      const field = ({ START: 'start', END: 'end', STEP: 'step' } as const)[state.screen];
      return `${PROMPT_LABEL[state.screen]}? ${state.entry.length ? expressionText(state.entry) : formatFull(state[field])}`;
    }
    case 'TABLE': {
      const row = state.rows[state.row];
      return `TABLE ${state.rows.length} dòng; X=${formatFull(row.x)} F(X)=${row.f === null ? 'ERROR' : formatFull(row.f)}`;
    }
    case 'ERROR':
      return state.error ?? 'ERROR';
  }
}

/** The value of the selected cell, shown at the bottom right of the table screen. */
export function selectedValue(state: CalcState): string {
  const row = state.rows[state.row];
  if (!row) return '';
  const value = state.col === 0 ? row.x : state.col === 1 ? row.f : row.g;
  return value === null ? 'ERROR' : formatFull(value);
}

/** Applies keys in order and fails loudly if one is not accepted: used to replay a tutorial. */
export function replay(keys: KeyId[], from: CalcState = initialState()): CalcState {
  return keys.reduce((state, key, index) => {
    const result = press(state, key);
    if (!result.ok)
      throw new Error(`Key ${index} (${key}) not accepted on ${state.screen}: ${result.message}`);
    return result.state;
  }, from);
}
