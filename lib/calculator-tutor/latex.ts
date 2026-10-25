import type { KeyId, Token } from './fx570vn-plus';

/**
 * A small reader for the formulas of imported questions (the LaTeX subset the
 * textbook import produces), to turn a function such as `\frac{x}{\ln x}` into
 * what is typed on the calculator, and to compute its values independently of
 * the simulation. Anything outside the subset is reported, never guessed.
 */

export type Expr =
  | { t: 'num'; v: number; text: string }
  | { t: 'x' }
  | { t: 'const'; name: 'e' | 'π' }
  | { t: 'param'; name: string }
  | { t: 'neg'; a: Expr }
  | { t: 'bin'; op: '+' | '-' | '*' | '/'; a: Expr; b: Expr; implied?: boolean }
  | { t: 'pow'; a: Expr; b: Expr }
  | { t: 'fn'; name: FunctionName; a: Expr };

export type FunctionName = 'ln' | 'log' | 'sqrt' | 'sin' | 'cos' | 'tan' | 'abs';

type Lexeme =
  | { k: 'num'; text: string }
  | { k: 'letter'; text: string }
  | { k: 'cmd'; text: string }
  | { k: 'sym'; text: string };

const IGNORED_COMMANDS = new Set([
  'left',
  'right',
  'displaystyle',
  ',',
  ';',
  '!',
  ' ',
  'big',
  'Big',
]);
const FUNCTIONS: Record<string, FunctionName> = {
  ln: 'ln',
  log: 'log',
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  sqrt: 'sqrt',
};

function lex(source: string): Lexeme[] | null {
  const out: Lexeme[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (/\s/.test(c)) {
      i += 1;
    } else if (/\d/.test(c) || (c === '.' && /\d/.test(source[i + 1] ?? ''))) {
      let text = '';
      while (i < source.length && /[\d.]/.test(source[i])) text += source[i++];
      out.push({ k: 'num', text });
    } else if (/[a-zA-Z]/.test(c)) {
      out.push({ k: 'letter', text: c });
      i += 1;
    } else if (c === '\\') {
      let name = '';
      i += 1;
      if (/[a-zA-Z]/.test(source[i] ?? '')) {
        while (i < source.length && /[a-zA-Z]/.test(source[i])) name += source[i++];
      } else {
        name = source[i++] ?? '';
      }
      if (name === 'lbrace' || name === '{') out.push({ k: 'sym', text: '(' });
      else if (name === 'rbrace' || name === '}') out.push({ k: 'sym', text: ')' });
      else if (name === '|') out.push({ k: 'sym', text: '|' });
      else if (!IGNORED_COMMANDS.has(name)) out.push({ k: 'cmd', text: name });
    } else if ('+-*/^(){}[]|'.includes(c)) {
      out.push({ k: 'sym', text: c });
      i += 1;
    } else if (c === '−') {
      out.push({ k: 'sym', text: '-' });
      i += 1;
    } else if (c === '×' || c === '·') {
      out.push({ k: 'sym', text: '*' });
      i += 1;
    } else {
      return null;
    }
  }
  return out;
}

/** Reads a formula; null when it is outside the subset or malformed. */
export function parseLatex(source: string): Expr | null {
  const lexed = lex(source);
  if (!lexed || !lexed.length) return null;
  const lexemes: Lexeme[] = lexed;
  let i = 0;
  const peek = () => lexemes[i];
  const isSym = (text: string) => peek()?.k === 'sym' && peek()!.text === text;
  const isCmd = (...names: string[]) => peek()?.k === 'cmd' && names.includes(peek()!.text);

  function startsAtom(): boolean {
    const next = peek();
    if (!next) return false;
    if (next.k === 'num' || next.k === 'letter') return true;
    if (next.k === 'cmd')
      return ['frac', 'dfrac', 'tfrac', 'pi', ...Object.keys(FUNCTIONS)].includes(next.text);
    return next.text === '(' || next.text === '[' || next.text === '{' || next.text === '|';
  }

  function group(): Expr | null {
    if (isSym('{')) {
      i += 1;
      const a = sum();
      if (!a || !isSym('}')) return null;
      i += 1;
      return a;
    }
    // A single symbol: \frac12, x^2.
    const next = peek();
    if (next?.k === 'num') {
      i += 1;
      const digit = next.text[0];
      if (next.text.length > 1) lexemes.splice(i, 0, { k: 'num', text: next.text.slice(1) });
      return { t: 'num', v: Number(digit), text: digit };
    }
    return atom();
  }

  function closingFor(open: string): string {
    return open === '(' ? ')' : open === '[' ? ']' : open === '{' ? '}' : '|';
  }

  /** The argument of \ln, \sin…: brackets, a group, or the product right after (\ln 2x). */
  function argument(): Expr | null {
    if (isSym('(') || isSym('[') || isSym('{')) return atom();
    let a = power();
    while (a && startsAtom() && !isSym('(') && !isSym('|') && !(peek()?.k === 'cmd')) {
      const b = power();
      if (!b) return null;
      a = { t: 'bin', op: '*', a, b, implied: true };
    }
    return a;
  }

  function atom(): Expr | null {
    const next = peek();
    if (!next) return null;
    i += 1;
    if (next.k === 'num') {
      if ((next.text.match(/\./g)?.length ?? 0) > 1) return null;
      return { t: 'num', v: Number(next.text), text: next.text };
    }
    if (next.k === 'letter') {
      if (next.text === 'x' || next.text === 'X') return { t: 'x' };
      if (next.text === 'e') return { t: 'const', name: 'e' };
      return { t: 'param', name: next.text };
    }
    if (next.k === 'cmd') {
      if (next.text === 'pi') return { t: 'const', name: 'π' };
      if (next.text === 'frac' || next.text === 'dfrac' || next.text === 'tfrac') {
        const a = group();
        const b = a && group();
        return a && b ? { t: 'bin', op: '/', a, b } : null;
      }
      const fn = FUNCTIONS[next.text];
      if (fn) {
        if (fn === 'sqrt' && isSym('[')) return null; // n-th roots are outside the subset
        const a = fn === 'sqrt' ? group() : argument();
        return a && { t: 'fn', name: fn, a };
      }
      return null;
    }
    if (next.text === '(' || next.text === '[' || next.text === '{' || next.text === '|') {
      const a = sum();
      const close = closingFor(next.text);
      if (!a || !isSym(close)) return null;
      i += 1;
      return next.text === '|' ? { t: 'fn', name: 'abs', a } : a;
    }
    return null;
  }

  function power(): Expr | null {
    const base = atom();
    if (!base) return null;
    if (isSym('^')) {
      i += 1;
      const negative = isSym('-');
      if (negative) i += 1;
      const exponent = group();
      if (!exponent) return null;
      return { t: 'pow', a: base, b: negative ? { t: 'neg', a: exponent } : exponent };
    }
    return base;
  }

  function unary(): Expr | null {
    if (isSym('-')) {
      i += 1;
      const a = unary();
      return a && { t: 'neg', a };
    }
    if (isSym('+')) {
      i += 1;
      return unary();
    }
    return power();
  }

  function product(): Expr | null {
    let a = unary();
    while (a) {
      if (isSym('*') || isCmd('cdot', 'times')) {
        i += 1;
        const b = unary();
        if (!b) return null;
        a = { t: 'bin', op: '*', a, b };
      } else if (isSym('/')) {
        i += 1;
        const b = unary();
        if (!b) return null;
        a = { t: 'bin', op: '/', a, b };
      } else if (startsAtom() && !isSym('|')) {
        const b = power();
        if (!b) return null;
        a = { t: 'bin', op: '*', a, b, implied: true };
      } else break;
    }
    return a;
  }

  function sum(): Expr | null {
    let a = product();
    while (a && (isSym('+') || isSym('-'))) {
      const op = peek()!.text as '+' | '-';
      i += 1;
      const b = product();
      if (!b) return null;
      a = { t: 'bin', op, a, b };
    }
    return a;
  }

  const tree = sum();
  return tree && i === lexemes.length ? tree : null;
}

// ------------------------------------------------------------------ evaluation

/** f(x) in real numbers, angles in radians; null where it is undefined. */
export function evaluateExpr(
  expr: Expr,
  x: number,
  params: Record<string, number> = {}
): number | null {
  function run(node: Expr): number {
    switch (node.t) {
      case 'num':
        return node.v;
      case 'x':
        return x;
      case 'const':
        return node.name === 'e' ? Math.E : Math.PI;
      case 'param':
        if (!(node.name in params)) throw new Undefined();
        return params[node.name];
      case 'neg':
        return -run(node.a);
      case 'pow': {
        const value = run(node.a) ** run(node.b);
        if (!Number.isFinite(value)) throw new Undefined();
        return value;
      }
      case 'fn': {
        const a = run(node.a);
        switch (node.name) {
          case 'ln':
          case 'log':
            if (!(a > 0)) throw new Undefined();
            return node.name === 'ln' ? Math.log(a) : Math.log10(a);
          case 'sqrt':
            if (a < 0) throw new Undefined();
            return Math.sqrt(a);
          case 'sin':
            return Math.sin(a);
          case 'cos':
            return Math.cos(a);
          case 'tan':
            if (Math.abs(Math.cos(a)) < 1e-12) throw new Undefined();
            return Math.tan(a);
          case 'abs':
            return Math.abs(a);
        }
        throw new Undefined();
      }
      case 'bin': {
        const a = run(node.a);
        const b = run(node.b);
        if (node.op === '/' && Math.abs(b) < 1e-12) throw new Undefined();
        const value =
          node.op === '+' ? a + b : node.op === '-' ? a - b : node.op === '*' ? a * b : a / b;
        if (!Number.isFinite(value)) throw new Undefined();
        return value;
      }
    }
  }
  try {
    return run(expr);
  } catch (error) {
    if (error instanceof Undefined) return null;
    throw error;
  }
}

class Undefined extends Error {}

/** Free letters other than x (parameters such as m). */
export function parametersOf(expr: Expr): string[] {
  const found = new Set<string>();
  const visit = (node: Expr) => {
    if (node.t === 'param') found.add(node.name);
    if ('a' in node) visit(node.a);
    if ('b' in node) visit(node.b);
  };
  visit(expr);
  return [...found];
}

export function functionsOf(expr: Expr): FunctionName[] {
  const found = new Set<FunctionName>();
  const visit = (node: Expr) => {
    if (node.t === 'fn') found.add(node.name);
    if ('a' in node) visit(node.a);
    if ('b' in node) visit(node.b);
  };
  visit(expr);
  return [...found];
}

/** Replaces parameters by numbers (m = 1 in "thử m = 1"). */
export function substitute(expr: Expr, params: Record<string, number>): Expr {
  switch (expr.t) {
    case 'param':
      return expr.name in params
        ? { t: 'num', v: params[expr.name], text: String(params[expr.name]) }
        : expr;
    case 'neg':
    case 'fn':
      return { ...expr, a: substitute(expr.a, params) };
    case 'bin':
    case 'pow':
      return { ...expr, a: substitute(expr.a, params), b: substitute(expr.b, params) };
    default:
      return expr;
  }
}

/** Whether two formulas give the same values at a spread of points (OCR/consistency check). */
export function sameFunction(a: Expr, b: Expr, params: Record<string, number> = {}): boolean {
  let compared = 0;
  for (const x of [-3.7, -2.2, -1.3, -0.6, 0.35, 0.8, 1.45, 2.3, 3.1, 4.6, 7.9]) {
    const p = evaluateExpr(a, x, params);
    const q = evaluateExpr(b, x, params);
    if ((p === null) !== (q === null)) return false;
    if (p !== null && q !== null) {
      if (Math.abs(p - q) > 1e-9 * Math.max(1, Math.abs(p))) return false;
      compared += 1;
    }
  }
  return compared >= 3;
}

// ------------------------------------------------------------- calculator input

export type Typing =
  | { ok: true; tokens: Token[]; keys: KeyId[] }
  | { ok: false; reason: string; unsupported: string[] };

const FUNCTION_LABEL: Record<FunctionName, string> = {
  ln: 'ln',
  log: 'log',
  sqrt: '√',
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  abs: 'giá trị tuyệt đối',
};

/** Supported by the TABLE simulation: ln and √ (sin, cos, tan depend on the angle unit). */
const SIMULATED_FUNCTIONS: FunctionName[] = ['ln', 'sqrt'];

/**
 * What to type on the fx-570VN PLUS (MathI/O) for a formula, with brackets
 * where the calculator's order of operations needs them. A fraction is typed
 * with ÷ and brackets: the result is the same, and every key is one the
 * simulation checks.
 */
export function typeExpression(expr: Expr): Typing {
  const unsupported = new Set<string>();
  const atomic = (node: Expr) =>
    node.t === 'num' || node.t === 'x' || node.t === 'const' || node.t === 'fn' || node.t === 'pow';
  const wrap = (node: Expr): Token[] => ['(', ...emit(node), ')'];

  function number(text: string): Token[] {
    return [...text] as Token[];
  }

  function emit(node: Expr): Token[] {
    switch (node.t) {
      case 'num':
        return number(node.text);
      case 'x':
        return ['X'];
      case 'const':
        return [node.name];
      case 'param':
        unsupported.add(`tham số ${node.name}`);
        return [];
      case 'neg': {
        const inner = node.a.t === 'bin' && (node.a.op === '+' || node.a.op === '-');
        return ['⁻', ...(inner ? wrap(node.a) : emit(node.a))];
      }
      case 'pow': {
        const base = atomic(node.a) && node.a.t !== 'pow' ? emit(node.a) : wrap(node.a);
        if (node.b.t === 'num' && node.b.v === 2) return [...base, '²'];
        return [...base, '^(', ...emit(node.b), '⟩'];
      }
      case 'fn':
        if (!SIMULATED_FUNCTIONS.includes(node.name)) {
          unsupported.add(FUNCTION_LABEL[node.name]);
          return [];
        }
        return node.name === 'ln' ? ['ln(', ...emit(node.a), ')'] : ['√(', ...emit(node.a), '⟩'];
      case 'bin': {
        if (node.op === '+' || node.op === '-') {
          const right =
            node.op === '-' && node.b.t === 'bin' && (node.b.op === '+' || node.b.op === '-')
              ? wrap(node.b)
              : emit(node.b);
          return [...emit(node.a), node.op === '+' ? '+' : '−', ...right];
        }
        if (node.op === '/') {
          return [
            ...(atomic(node.a) ? emit(node.a) : wrap(node.a)),
            '÷',
            ...(atomic(node.b) ? emit(node.b) : wrap(node.b)),
          ];
        }
        // ×: brackets around sums, quotients and signed terms. Multiplication without a sign
        // comes before ÷ on the calculator, so 1÷4X would be 1÷(4X).
        const side = (child: Expr) =>
          (child.t === 'bin' && child.op !== '*') || child.t === 'neg' ? wrap(child) : emit(child);
        const left = side(node.a);
        const right = side(node.b);
        // Implied multiplication (2X, 3ln(X)) unless the right side starts with a digit.
        const sign: Token[] = /^[\d.]$/.test(right[0] ?? '') ? ['×'] : [];
        return [...left, ...sign, ...right];
      }
    }
  }

  const tokens = emit(expr);
  if (unsupported.size) {
    return {
      ok: false,
      reason: `Bản mô phỏng TABLE chưa hỗ trợ: ${[...unsupported].join(', ')}.`,
      unsupported: [...unsupported],
    };
  }
  return { ok: true, tokens, keys: keysFor(tokens) };
}

const TOKEN_KEYS: Record<Token, KeyId[]> = {
  '0': ['0'],
  '1': ['1'],
  '2': ['2'],
  '3': ['3'],
  '4': ['4'],
  '5': ['5'],
  '6': ['6'],
  '7': ['7'],
  '8': ['8'],
  '9': ['9'],
  '.': ['DOT'],
  X: ['ALPHA', 'RPAREN'],
  e: ['ALPHA', 'EXP'],
  π: ['SHIFT', 'EXP'],
  'ln(': ['LN'],
  '√(': ['SQRT'],
  '^(': ['POWER'],
  '⟩': ['RIGHT'],
  '²': ['SQUARE'],
  '(': ['LPAREN'],
  ')': ['RPAREN'],
  '+': ['PLUS'],
  '−': ['MINUS'],
  '×': ['TIMES'],
  '÷': ['DIVIDE'],
  '⁻': ['NEG'],
};

/**
 * The keys that type `tokens`. A box (√, x^) gets its end with the key that
 * opens it, so the end is passed with ▶, or not at all at the end of the input.
 */
export function keysFor(tokens: Token[]): KeyId[] {
  let last = tokens.length;
  while (last > 0 && tokens[last - 1] === '⟩') last -= 1;
  return tokens.slice(0, last).flatMap((token) => TOKEN_KEYS[token]);
}

/** A formula as plain text, for messages (x/ln(x)). */
export function exprText(expr: Expr): string {
  switch (expr.t) {
    case 'num':
      return expr.text;
    case 'x':
      return 'x';
    case 'const':
      return expr.name;
    case 'param':
      return expr.name;
    case 'neg':
      return `-${exprText(expr.a)}`;
    case 'pow':
      return `${exprText(expr.a)}^${exprText(expr.b)}`;
    case 'fn':
      return `${expr.name}(${exprText(expr.a)})`;
    case 'bin':
      return `(${exprText(expr.a)}${expr.op}${exprText(expr.b)})`;
  }
}
