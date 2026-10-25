import type { KeyId } from './fx570vn-plus';

/**
 * Finds the calculator method in an imported explanation and reads it into
 * segments and events, deterministically: no AI, no network. It only reports
 * what the text says; `generate.ts` decides what can be shown and how.
 *
 * Matching is done on a folded copy of the text (lower case, no Vietnamese
 * diacritics, same length), so "Ấn", "ấn", "AN" and OCR variants such as
 * "M0DE 7" or "SHlFT" are read alike, and positions found in the copy are
 * positions in the original.
 */

export const DETECTOR_VERSION = 1;

export type Operation =
  'TABLE' | 'SOLVE' | 'CALC' | 'DERIVATIVE' | 'INTEGRAL' | 'STAT' | 'EQUATION' | 'GENERIC';

export const OPERATION_LABEL: Record<Operation, string> = {
  TABLE: 'Bảng giá trị (TABLE)',
  SOLVE: 'Giải phương trình (SOLVE)',
  CALC: 'Tính giá trị biểu thức (CALC)',
  DERIVATIVE: 'Đạo hàm tại một điểm (d/dx)',
  INTEGRAL: 'Tích phân (∫)',
  STAT: 'Thống kê (STAT)',
  EQUATION: 'Giải phương trình/hệ (EQN)',
  GENERIC: 'Dùng máy tính',
};

export type RangeField = 'start' | 'end' | 'step';

/** A value read after Start?/End?/Step?, as written. */
export type RangeValue = {
  /** The value as written: "-3", "0,2", "\frac{\pi}{2}". */
  text: string;
  /** Keys the source names for it ("SHIFT x10^x"). */
  claimedKeys?: KeyId[];
  /** What the source says the keys mean ("chính là chọn end là e"). */
  claimedMeaning?: 'e' | 'π';
};

export type SourceEvent =
  | { kind: 'open-table' }
  | { kind: 'function'; latex: string }
  | { kind: 'confirm-fg' }
  | { kind: 'range'; field: RangeField; value: RangeValue | null }
  | { kind: 'parameter'; name: string; value: number }
  | { kind: 'reference'; target: string }
  | { kind: 'read' }
  | { kind: 'conclusion' }
  | { kind: 'keys'; keys: KeyId[] }
  | { kind: 'evaluate'; at: string; result?: string };

export type Segment = {
  index: number;
  /** The line of the source, verbatim. */
  text: string;
  events: SourceEvent[];
  /** The line announces a picture ("Máy hiện:", "Nhập như sau:") that is not in the imported text. */
  figureMissing: boolean;
};

export type Signal = { kind: string; text: string; at: number; negated?: boolean };

export type CalculatorDetection = {
  version: number;
  present: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  operation: Operation | null;
  operations: Operation[];
  model: { id: string | null; name: string | null; brand: string | null };
  signals: Signal[];
  /** The calculator method, as character offsets in the explanation. */
  section: { start: number; end: number } | null;
  /** The text before the calculator method (another method, Cách 1), verbatim. */
  mathText: string | null;
  segments: Segment[];
  /** Fragments that look like OCR or import errors. */
  ocr: string[];
};

/** One character in, one character out, so offsets stay valid. */
function foldChar(c: string): string {
  if (c === 'đ' || c === 'Đ') return 'd';
  const base = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return (base[0] ?? c).toLowerCase()[0] ?? c;
}

export function fold(text: string): string {
  return text.split('').map(foldChar).join('');
}

// Operation signals, on folded text. OCR-tolerant where it matters: 0/o, 1/l/i.
const OPERATION_PATTERNS: { op: Operation; kind: string; re: RegExp }[] = [
  { op: 'TABLE', kind: 'mode-7', re: /\bm[o0]de\s*:?\s*7\b/g },
  { op: 'TABLE', kind: 'table', re: /\btable\b/g },
  { op: 'TABLE', kind: 'prompt', re: /\b(?:start|end|step)\s*\?/g },
  { op: 'TABLE', kind: 'range-words', re: /\bstart\b[^\n.]{0,60}\bend\b[^\n.]{0,60}\bstep\b/g },
  { op: 'SOLVE', kind: 'solve', re: /\b(?:sh[i1l]ft\s*)?s[o0]lve\b/g },
  { op: 'CALC', kind: 'calc', re: /\bcalc\b/g },
  { op: 'DERIVATIVE', kind: 'd/dx', re: /d\s*\/\s*dx/g },
  { op: 'INTEGRAL', kind: 'integral-key', re: /∫|\bphim tich phan\b/g },
  { op: 'STAT', kind: 'stat', re: /\bm[o0]de\s*:?\s*[23]\b|\bstat\b/g },
  { op: 'EQUATION', kind: 'eqn', re: /\bm[o0]de\s*:?\s*5\b|\beqn\b/g },
];
const CALCULATOR =
  /\b(?:may tinh(?: cam tay| bo tui| casio)?|bam may|casio|vinacal|fx\s*-?\s*\d{3}\s*[a-z]*)\b/g;
const ACTION = /\b(?:bam|an|nhan|nhap|su dung|dung|kiem tra|thu)\b/;
/** "…nhanh hơn rất nhiều so với việc bấm máy thử": the calculator is mentioned, not used. */
const NEGATION =
  /(?:khong can|chua can|khong nen|thay vi|so voi viec|so voi|khoi phai|khong dung)[^.\n]*$/;

const MODELS: { re: RegExp; id: string; name: string }[] = [
  { re: /fx\s*-?\s*570\s*vn\s*plus/, id: 'fx-570VN-PLUS', name: 'CASIO fx-570VN PLUS' },
  { re: /fx\s*-?\s*570\s*es\s*plus/, id: 'fx-570ES-PLUS', name: 'CASIO fx-570ES PLUS' },
  { re: /fx\s*-?\s*580\s*vn\s*x/, id: 'fx-580VNX', name: 'CASIO fx-580VNX' },
  { re: /fx\s*-?\s*570\s*ms/, id: 'fx-570MS', name: 'CASIO fx-570MS' },
  { re: /fx\s*-?\s*880\s*btg/, id: 'fx-880BTG', name: 'CASIO fx-880BTG' },
  { re: /vinacal/, id: 'VINACAL', name: 'VINACAL' },
];

function negated(folded: string, at: number): boolean {
  const before = folded.slice(Math.max(0, at - 80), at);
  return NEGATION.test(before);
}

// ------------------------------------------------------------------- reading values

const EXP_KEY = /(?:x\s*10\s*\^?\s*x|×\s*10\s*[ˣx]|x10x|10\^x)/;

/** "0,2" → "0.2" (Vietnamese decimal comma), "−3" → "-3". */
function normalizeNumber(text: string): string {
  return text.replace(/\s+/g, '').replace('−', '-').replace(',', '.');
}

/** The value written after Start?/End?/Step?, from the original text of that part. */
function readRangeValue(original: string): RangeValue | null {
  const folded = fold(original);
  const value: RangeValue = { text: '' };
  const shift = new RegExp(`sh[i1l]ft\\s*${EXP_KEY.source}`).exec(folded);
  const alpha = new RegExp(`alpha\\s*${EXP_KEY.source}`).exec(folded);
  if (shift) value.claimedKeys = ['SHIFT', 'EXP'];
  else if (alpha) value.claimedKeys = ['ALPHA', 'EXP'];
  const meaning = /\bla\s*\$?\s*(e|\\pi|π)\s*\$?(?![a-z])/.exec(folded);
  if (meaning) value.claimedMeaning = meaning[1] === 'e' ? 'e' : 'π';

  // Formulas: the last one wins ("Ta chọn $x = 0$, ấn $0 =$" → 0).
  const formulas = [...original.matchAll(/\$([^$]+)\$/g)].map((match) =>
    match[1].replace(/=\s*$/, '').replace(/^.*=/, '').trim()
  );
  const formula = formulas.filter(Boolean).pop();
  if (formula) {
    value.text = /^-?\s*\d+(?:[.,]\d+)?$/.test(formula) ? normalizeNumber(formula) : formula;
    return value;
  }
  const outside = original.replace(/\$[^$]*\$/g, ' ');
  const number = /(^|[^\d.,])([-−]?\s*\d+(?:[.,]\d+)?)(?![\d])/.exec(
    // Not the 10 of "x10^x".
    outside.replace(new RegExp(EXP_KEY.source, 'gi'), ' ')
  );
  if (number) {
    value.text = normalizeNumber(number[2]);
    return value;
  }
  if (value.claimedKeys) {
    value.text = value.claimedKeys[0] === 'SHIFT' ? '\\pi' : 'e';
    return value;
  }
  return null;
}

/** Keys named in a line, for highlighting (level B). Only unambiguous names. */
function namedKeys(folded: string): KeyId[] {
  const keys: KeyId[] = [];
  const re =
    /\bsh[i1l]ft\s*s[o0]lve\b|\bs[o0]lve\b|\bsh[i1l]ft\b|\balpha\b|\bm[o0]de\s*:?\s*(\d)\b|\bcalc\b|d\s*\/\s*dx|\bac\b|\bdel\b|(?:^|\s)=(?=\s|$|\.)/g;
  for (const match of folded.matchAll(re)) {
    const text = match[0].trim();
    if (/^sh[i1l]ft\s*s[o0]lve$/.test(text) || /^s[o0]lve$/.test(text)) keys.push('SHIFT', 'CALC');
    else if (/^sh[i1l]ft$/.test(text)) keys.push('SHIFT');
    else if (text === 'alpha') keys.push('ALPHA');
    else if (match[1]) keys.push('MODE', match[1] as KeyId);
    else if (text === 'calc') keys.push('CALC');
    else if (/d\s*\/\s*dx/.test(text)) keys.push('SHIFT', 'INTEG');
    else if (text === 'ac') keys.push('AC');
    else if (text === 'del') keys.push('DEL');
    else if (text === '=') keys.push('EQ');
  }
  return keys;
}

function readEvents(line: string): SourceEvent[] {
  const folded = fold(line);
  const events: SourceEvent[] = [];
  if (/\bm[o0]de\s*:?\s*7\b/.test(folded) || /\btable\b/.test(folded))
    events.push({ kind: 'open-table' });

  // "Nhập vào máy $Fx = \frac{x}{\ln x}$", "nhập $f(x) = …$".
  if (/\bnhap\b/.test(folded)) {
    for (const match of line.matchAll(/\$([^$]+)\$/g)) {
      const assignment = /^\s*(?:f\s*\(\s*x\s*\)|f\s*x|y)\s*=\s*(.+)$/i.exec(match[1]);
      if (assignment) events.push({ kind: 'function', latex: assignment[1].trim() });
    }
  }
  if (/\b(?:an|bam|nhan)\s*(?:2|hai)\s*lan\s*(?:dau\s*)?(?:=|bang)/.test(folded))
    events.push({ kind: 'confirm-fg' });

  // "End? Ta nhập … (chính là chọn end là e)": a repeated word belongs to the same field.
  const fields = [...folded.matchAll(/\b(start|end|step)\b\s*\??/g)].filter(
    (match, index, all) => index === 0 || all[index - 1][1] !== match[1]
  );
  fields.forEach((match, index) => {
    const from = match.index! + match[0].length;
    const to = fields[index + 1]?.index ?? line.length;
    events.push({
      kind: 'range',
      field: match[1] as RangeField,
      value: readRangeValue(line.slice(from, to)),
    });
  });

  for (const match of folded.matchAll(
    /\b(?:thu|voi|chon|cho)\s*\$?\s*([a-wyz])\s*=\s*([-−]?\d+(?:[.,]\d+)?)\s*\$?/g
  )) {
    events.push({ kind: 'parameter', name: match[1], value: Number(normalizeNumber(match[2])) });
  }
  const reference = /\btuong tu\s*(?:nhu\s*)?((?:bai|cau|vi du)\s*\d+)/.exec(folded);
  if (reference)
    events.push({
      kind: 'reference',
      target: line.slice(
        reference.index + reference[0].length - reference[1].length,
        reference.index + reference[0].length
      ),
    });
  if (/\bkeo xuong\b|\b(?:may|man hinh) hien(?: nhu sau)?\s*:/.test(folded))
    events.push({ kind: 'read' });
  if (
    /\b(?:vay|do vay|tu day ta (?:thay|nhan thay)|chon (?:dap an |phuong an )?[a-d]\b|loai (?:duoc )?[a-d]\b)/.test(
      folded
    )
  )
    events.push({ kind: 'conclusion' });

  const calc = /\bcalc\b[^.\n]*?\bx\s*=\s*\$?\s*([-−]?\d+(?:[.,]\d+)?)/.exec(folded);
  if (calc) {
    const result = /\b(?:duoc|ket qua|may hien|bang)\s*:?\s*\$?\s*([-−]?\d+(?:[.,]\d+)?)/.exec(
      folded.slice(calc.index + calc[0].length)
    );
    events.push({
      kind: 'evaluate',
      at: normalizeNumber(calc[1]),
      result: result ? normalizeNumber(result[1]) : undefined,
    });
  }

  const keys = namedKeys(folded.replace(/\$[^$]*\$/g, (formula) => ' '.repeat(formula.length)));
  if (keys.length) events.push({ kind: 'keys', keys });
  return events;
}

// --------------------------------------------------------------------- OCR checks

function ocrSuspects(text: string): string[] {
  const found: string[] = [];
  const snippet = (at: number) =>
    text
      .slice(Math.max(0, at - 12), at + 18)
      .replace(/[\x00-\x1f]/g, '�')
      .trim();
  const control = /[\x00-\x08\x0b\x0c\x0e-\x1f]/.exec(text);
  if (control)
    found.push(
      `Ký tự điều khiển trong công thức (thường là "\\f" của \\frac bị mất): …${snippet(control.index)}…`
    );
  const lostFrac = /(^|[^\\a-z])rac\{/.exec(text);
  if (lostFrac && !control) found.push(`"rac{" thiếu "\\f": …${snippet(lostFrac.index)}…`);
  const infinity = /\\frac\{\\infty\}\{\\infty\}|rac\{\\infty\}\{\\infty\}/.exec(text);
  if (infinity)
    found.push(`"∞/∞" trong khoảng: có thể là "+∞" nhập sai: …${snippet(infinity.index)}…`);
  if ((text.match(/\$/g)?.length ?? 0) % 2 === 1)
    found.push('Số dấu $ lẻ: một công thức chưa đóng.');
  return found;
}

// ------------------------------------------------------------------------- detect

const HEADING = /^\s*cach\s*(\d+)\s*[:.)-]/;

export function detectCalculatorMethod(
  explanation: string | undefined | null
): CalculatorDetection {
  const text = explanation ?? '';
  const folded = fold(text);
  const signals: Signal[] = [];
  const operationCount = new Map<Operation, number>();

  for (const { op, kind, re } of OPERATION_PATTERNS) {
    for (const match of folded.matchAll(re)) {
      const isNegated = negated(folded, match.index!);
      signals.push({
        kind: `${op}:${kind}`,
        text: text.substr(match.index!, match[0].length),
        at: match.index!,
        negated: isNegated || undefined,
      });
      if (!isNegated) operationCount.set(op, (operationCount.get(op) ?? 0) + 1);
    }
  }
  let contextAt = -1;
  for (const match of folded.matchAll(CALCULATOR)) {
    const isNegated = negated(folded, match.index!);
    // The calculator is used when a verb of use is in the same sentence.
    const sentenceStart =
      Math.max(folded.lastIndexOf('.', match.index!), folded.lastIndexOf('\n', match.index!)) + 1;
    const sentenceEnd = folded.slice(match.index!).search(/[.\n]/);
    const sentence = folded.slice(
      sentenceStart,
      sentenceEnd < 0 ? undefined : match.index! + sentenceEnd
    );
    const used = ACTION.test(sentence);
    signals.push({
      kind: used ? 'calculator:used' : 'calculator:mentioned',
      text: text.substr(match.index!, match[0].length),
      at: match.index!,
      negated: isNegated || undefined,
    });
    if (used && !isNegated && contextAt < 0) contextAt = match.index!;
  }

  const operations = [...operationCount.keys()];
  const strong = operations.length > 0;
  const present = strong || contextAt >= 0;
  const operation: Operation | null = !present
    ? null
    : operations.includes('TABLE')
      ? 'TABLE'
      : (operations.sort((a, b) => operationCount.get(b)! - operationCount.get(a)!)[0] ??
        'GENERIC');
  const opSignals = [...operationCount.values()].reduce((sum, n) => sum + n, 0);
  const confidence = !present
    ? 'none'
    : (strong && contextAt >= 0) || opSignals >= 2
      ? 'high'
      : strong
        ? 'medium'
        : 'low';

  const modelMatch = MODELS.find((model) => model.re.test(folded));
  const model = {
    id: modelMatch?.id ?? null,
    name: modelMatch?.name ?? null,
    brand: modelMatch ? modelMatch.name.split(' ')[0] : /casio/.test(folded) ? 'CASIO' : null,
  };

  if (!present) {
    return {
      version: DETECTOR_VERSION,
      present,
      confidence,
      operation,
      operations,
      model,
      signals,
      section: null,
      mathText: null,
      segments: [],
      ocr: ocrSuspects(text),
    };
  }

  // The method starts at the first line with a signal, or at its "Cách n:" heading.
  const firstAt = Math.min(
    ...signals
      .filter((signal) => !signal.negated && signal.kind !== 'calculator:mentioned')
      .map((signal) => signal.at)
  );
  const lines: { start: number; text: string }[] = [];
  let offset = 0;
  for (const line of text.split('\n')) {
    lines.push({ start: offset, text: line });
    offset += line.length + 1;
  }
  let first = lines.findIndex(
    (line, index) => firstAt < (lines[index + 1]?.start ?? Infinity) && firstAt >= line.start
  );
  if (first < 0) first = 0;
  for (let index = first - 1; index >= 0 && index >= first - 2; index -= 1) {
    if (!lines[index].text.trim()) continue;
    if (HEADING.test(fold(lines[index].text))) first = index;
    break;
  }
  const heading = HEADING.exec(fold(lines[first].text));
  let last = lines.length - 1;
  for (let index = first + 1; index < lines.length; index += 1) {
    const other = HEADING.exec(fold(lines[index].text));
    if (other && other[1] !== heading?.[1]) {
      last = index - 1;
      break;
    }
  }
  const section = { start: lines[first].start, end: lines[last].start + lines[last].text.length };
  const before = text.slice(0, section.start).trim();
  const after = text.slice(section.end).trim();
  const mathText = [before, after].filter(Boolean).join('\n\n') || null;

  const segments: Segment[] = [];
  for (let index = first; index <= last; index += 1) {
    const line = lines[index].text;
    if (!line.trim()) continue;
    const followedByBlank = index === last || lines[index + 1].text.trim() === '';
    const announces =
      /:\s*$/.test(line.trim()) && /\b(?:nhu sau|may hien|man hinh|hien|nhap)\b/.test(fold(line));
    segments.push({
      index: segments.length,
      text: line.trim(),
      events: readEvents(line),
      figureMissing: announces && followedByBlank,
    });
  }

  return {
    version: DETECTOR_VERSION,
    present,
    confidence,
    operation,
    operations,
    model,
    signals,
    section,
    mathText,
    segments,
    ocr: ocrSuspects(text),
  };
}
