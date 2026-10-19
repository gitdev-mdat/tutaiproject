/**
 * The LaTeX subset Tú Tài renders, shared by the learner renderer
 * (`components/shared/question-content-renderer.tsx`), the AI lesson-draft
 * normaliser and the authoring checks.
 *
 * Maths is written inside `$…$`, `\(…\)` or `\[…\]`. Inside those delimiters
 * the renderer understands the commands listed here; anything else stays as
 * its raw source, so the checks below can tell an author before a student
 * ever sees it.
 */

/** Delimited maths: `$…$`, `\(…\)`, `\[…\]`. Capturing, so `split` keeps the maths parts. */
export const MATH_TOKEN = /(\$[^$]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g;

/** Commands that stand for one character. */
export const MATH_SYMBOLS: Readonly<Record<string, string>> = {
  // Relations and operators
  le: '≤',
  leq: '≤',
  leqslant: '≤',
  ge: '≥',
  geq: '≥',
  geqslant: '≥',
  ne: '≠',
  neq: '≠',
  lt: '<',
  gt: '>',
  approx: '≈',
  equiv: '≡',
  sim: '∼',
  simeq: '≃',
  cong: '≅',
  propto: '∝',
  times: '×',
  div: '÷',
  pm: '±',
  mp: '∓',
  cdot: '·',
  circ: '∘',
  ast: '∗',
  infty: '∞',
  // Sets and logic
  in: '∈',
  notin: '∉',
  ni: '∋',
  cup: '∪',
  cap: '∩',
  subset: '⊂',
  subseteq: '⊆',
  supset: '⊃',
  supseteq: '⊇',
  setminus: '∖',
  emptyset: '∅',
  varnothing: '∅',
  forall: '∀',
  exists: '∃',
  neg: '¬',
  land: '∧',
  lor: '∨',
  wedge: '∧',
  vee: '∨',
  mid: '∣',
  parallel: '∥',
  perp: '⊥',
  angle: '∠',
  triangle: '△',
  // Arrows
  to: '→',
  rightarrow: '→',
  longrightarrow: '⟶',
  leftarrow: '←',
  longleftarrow: '⟵',
  gets: '←',
  leftrightarrow: '↔',
  Rightarrow: '⇒',
  Longrightarrow: '⟹',
  implies: '⟹',
  Leftarrow: '⇐',
  Longleftarrow: '⟸',
  impliedby: '⟸',
  Leftrightarrow: '⇔',
  Longleftrightarrow: '⟺',
  iff: '⟺',
  mapsto: '↦',
  uparrow: '↑',
  downarrow: '↓',
  nearrow: '↗',
  searrow: '↘',
  nwarrow: '↖',
  swarrow: '↙',
  // Greek
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  varepsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
  theta: 'θ',
  vartheta: 'ϑ',
  iota: 'ι',
  kappa: 'κ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ',
  tau: 'τ',
  upsilon: 'υ',
  phi: 'ϕ',
  varphi: 'φ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',
  Gamma: 'Γ',
  Delta: 'Δ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Xi: 'Ξ',
  Pi: 'Π',
  Sigma: 'Σ',
  Phi: 'Φ',
  Psi: 'Ψ',
  Omega: 'Ω',
  // Calculus and big operators
  int: '∫',
  iint: '∬',
  oint: '∮',
  sum: '∑',
  prod: '∏',
  partial: '∂',
  nabla: '∇',
  prime: '′',
  // Dots and misc
  cdots: '⋯',
  ldots: '…',
  dots: '…',
  vdots: '⋮',
  degree: '°',
  // Function names, typeset upright as words
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  cot: 'cot',
  sec: 'sec',
  csc: 'csc',
  arcsin: 'arcsin',
  arccos: 'arccos',
  arctan: 'arctan',
  sinh: 'sinh',
  cosh: 'cosh',
  tanh: 'tanh',
  log: 'log',
  lg: 'lg',
  ln: 'ln',
  exp: 'exp',
  lim: 'lim',
  max: 'max',
  min: 'min',
  sup: 'sup',
  inf: 'inf',
  det: 'det',
  gcd: 'gcd',
  // Spacing
  quad: ' ',
  qquad: '  ',
};

/** One-character escapes: `\{`, `\,`, `\%`, … */
export const MATH_ESCAPES: Readonly<Record<string, string>> = {
  '{': '{',
  '}': '}',
  '%': '%',
  $: '$',
  '&': '&',
  '#': '#',
  _: '_',
  '|': '‖',
  ',': ' ',
  ';': ' ',
  ':': ' ',
  ' ': ' ',
  '!': '',
  '\\': ' ',
};

/** Commands that only size or space delimiters; they render as nothing. */
export const MATH_LAYOUT_COMMANDS: ReadonlySet<string> = new Set([
  'left',
  'right',
  'big',
  'Big',
  'bigg',
  'Bigg',
  'bigl',
  'bigr',
  'Bigl',
  'Bigr',
  'displaystyle',
  'textstyle',
  'limits',
  'nolimits',
]);

/** Commands that take `{…}` arguments, with how many. */
export const MATH_GROUP_COMMANDS: Readonly<Record<string, number>> = {
  frac: 2,
  dfrac: 2,
  tfrac: 2,
  binom: 2,
  dbinom: 2,
  sqrt: 1,
  text: 1,
  textrm: 1,
  textit: 1,
  textbf: 1,
  mathrm: 1,
  mathit: 1,
  mathbf: 1,
  operatorname: 1,
  mathbb: 1,
  overline: 1,
  bar: 1,
  vec: 1,
  overrightarrow: 1,
  hat: 1,
  widehat: 1,
  boxed: 1,
};

export const MATHBB: Readonly<Record<string, string>> = {
  N: 'ℕ',
  Z: 'ℤ',
  Q: 'ℚ',
  R: 'ℝ',
  C: 'ℂ',
};

export function isSupportedMathCommand(name: string): boolean {
  return (
    name in MATH_SYMBOLS ||
    name in MATH_GROUP_COMMANDS ||
    MATH_LAYOUT_COMMANDS.has(name) ||
    (name.length === 1 && name in MATH_ESCAPES)
  );
}

export interface TextSegment {
  math: boolean;
  /** The segment as written, delimiters included for maths. */
  raw: string;
  /** For maths, the inside of the delimiters; otherwise the same as `raw`. */
  body: string;
}

/** Splits text into prose and delimited maths, in order. */
export function splitMathSegments(text: string): TextSegment[] {
  return text
    .split(MATH_TOKEN)
    .filter((part) => part !== '')
    .map((part) => {
      const dollar = part.length > 1 && part.startsWith('$') && part.endsWith('$');
      const paren = part.startsWith('\\(') && part.endsWith('\\)');
      const bracket = part.startsWith('\\[') && part.endsWith('\\]');
      if (dollar) return { math: true, raw: part, body: part.slice(1, -1) };
      if (paren || bracket) return { math: true, raw: part, body: part.slice(2, -2) };
      return { math: false, raw: part, body: part };
    });
}

const COMMAND = /\\([A-Za-z]+)/g;

export interface MathIssues {
  /** Commands inside maths the renderer does not know, e.g. `\begin`. */
  unsupported: string[];
  /** LaTeX commands written outside `$…$`, which students would see raw. */
  outsideMath: string[];
  /** An odd number of `$`: a formula is not closed. */
  unbalancedDollar: boolean;
  /** A formula whose `{` and `}` do not pair up. */
  unbalancedBraces: boolean;
}

/** What in a piece of lesson text would not render as maths for a student. */
export function findMathIssues(text: string): MathIssues {
  const unsupported = new Set<string>();
  const outsideMath = new Set<string>();
  let unbalancedBraces = false;
  for (const segment of splitMathSegments(text)) {
    if (segment.math) {
      for (const match of segment.body.matchAll(COMMAND)) {
        if (!isSupportedMathCommand(match[1])) unsupported.add(`\\${match[1]}`);
      }
      const body = segment.body.replace(/\\[{}]/g, '');
      let depth = 0;
      for (const char of body) {
        if (char === '{') depth += 1;
        if (char === '}') depth -= 1;
        if (depth < 0) break;
      }
      if (depth !== 0) unbalancedBraces = true;
    } else {
      for (const match of segment.body.matchAll(COMMAND)) outsideMath.add(`\\${match[1]}`);
    }
  }
  const dollars = (text.replace(/\\\$/g, '').match(/\$/g) ?? []).length;
  return {
    unsupported: [...unsupported],
    outsideMath: [...outsideMath],
    unbalancedDollar: dollars % 2 === 1,
    unbalancedBraces,
  };
}

export function hasMathIssues(issues: MathIssues): boolean {
  return (
    issues.unsupported.length > 0 ||
    issues.outsideMath.length > 0 ||
    issues.unbalancedDollar ||
    issues.unbalancedBraces
  );
}

/** Reads one `{…}` group starting at `start` (which must be `{`); returns its inside and the index after it. */
export function readGroup(source: string, start: number): { body: string; end: number } | null {
  if (source[start] !== '{') return null;
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (char === '\\') {
      i += 1;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return { body: source.slice(start + 1, i), end: i + 1 };
    }
  }
  return null;
}

/**
 * Cleans model-written text so its maths renders, without touching valid source:
 * - `\\rightarrow` (a backslash escaped twice on the way through JSON) becomes `\rightarrow`;
 * - outside `$…$`, a one-character command in ordinary prose becomes its Unicode
 *   character (`Tính f'(x) \rightarrow Xét dấu` → `Tính f'(x) → Xét dấu`);
 * - outside `$…$`, a command with arguments (`\frac{1}{2}`) is wrapped in `$…$`.
 * Unknown commands are left as they are so the authoring checks can report them.
 * Each line is handled on its own, the way lessons render.
 */
export function normalizeGeneratedMath(text: string): string {
  const collapsed = text.replace(/\\\\(?=[A-Za-z]{2,})/g, '\\');
  // Line by line, as lessons render: an unclosed $ on one line must not pair with the next.
  return collapsed
    .split('\n')
    .map(closeTrailingFormula)
    .map((line) =>
      splitMathSegments(line)
        .map((segment) => (segment.math ? segment.raw : normalizeProse(segment.body)))
        .join('')
    )
    .join('\n');
}

/**
 * A line whose last formula was never closed, when what follows the `$` is a single
 * token such as `\mathbb{R}.`: close it before the final punctuation. Anything longer
 * is left for the authoring checks, since guessing where a formula ends could change it.
 */
function closeTrailingFormula(line: string): string {
  const dollars = (line.replace(/\\\$/g, '').match(/\$/g) ?? []).length;
  if (dollars % 2 === 0) return line;
  const match = /\$([^\s$]+?)([.,;:!?]?)\s*$/.exec(line);
  if (!match || !/[\\\w]/.test(match[1])) return line;
  return `${line.slice(0, match.index)}$${match[1]}$${match[2]}`;
}

function normalizeProse(prose: string): string {
  let out = '';
  let cursor = 0;
  for (const match of prose.matchAll(COMMAND)) {
    const index = match.index ?? 0;
    if (index < cursor) continue;
    const name = match[1];
    out += prose.slice(cursor, index);
    cursor = index + match[0].length;
    if (name in MATH_SYMBOLS && !/^[a-z]+$/.test(MATH_SYMBOLS[name])) {
      out += MATH_SYMBOLS[name];
      continue;
    }
    const groups = MATH_GROUP_COMMANDS[name];
    if (groups && name !== 'text') {
      let end = cursor;
      let read = 0;
      while (read < groups) {
        const group = readGroup(prose, end);
        if (!group) break;
        end = group.end;
        read += 1;
      }
      if (read === groups) {
        out += `$${prose.slice(index, end)}$`;
        cursor = end;
        continue;
      }
    }
    out += match[0];
  }
  return out + prose.slice(cursor);
}
