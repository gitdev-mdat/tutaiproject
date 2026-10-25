import {
  formatFull,
  MODEL,
  replay,
  screenText,
  TABLE_MAX_ROWS,
  tokenText,
  type CalcState,
  type KeyId,
  type Token,
} from './fx570vn-plus';
import {
  detectCalculatorMethod,
  OPERATION_LABEL,
  type CalculatorDetection,
  type Operation,
  type RangeField,
  type RangeValue,
  type Segment,
} from './detect';
import {
  evaluateExpr,
  functionsOf,
  parametersOf,
  parseLatex,
  sameFunction,
  substitute,
  typeExpression,
  type Expr,
} from './latex';
import type {
  CalculatorTutorial,
  GuideLevel,
  GuideStep,
  GuideWarning,
  SourceNote,
  StepOrigin,
  TutorialStep,
} from './types';

/**
 * Builds a calculator guide from a question and its imported explanation, with
 * no per-question configuration:
 *
 *   detect (detect.ts) → read the function and the values the source gives →
 *   decide the level → build the steps → replay every key on the simulation →
 *   compare every table value with the formula computed independently.
 *
 * Level A: the operation is TABLE on a function the simulation can type, the
 * declared calculator is the fx-570VN PLUS family or unnamed: the student
 * presses every key, the screens are the simulation's.
 * Level B: the operation and some keys are clear, but the function or the
 * calculator is outside the simulation: keys are highlighted, values (if any)
 * are computed from the formula and labelled as such, no screen is drawn.
 * Level C: only text: the source lines as steps, with what is missing marked.
 *
 * Deterministic and cheap: the same question always gives the same guide, so
 * nothing needs storing; Admin's decision is stored with the hash of the
 * content it was made on (`registry.ts`).
 */

export type GuideInput = {
  stem: string;
  explanation?: string | null;
  options?: { key: string; content: string }[];
};

export type GeneratedGuide = {
  sourceHash: string;
  detection: CalculatorDetection;
  level: GuideLevel | null;
  operation: Operation | null;
  functionLatex: string | null;
  model: { name: string; named: boolean; note: string };
  mathText: string | null;
  calculator?: CalculatorTutorial;
  steps: GuideStep[];
  notes: SourceNote[];
  warnings: GuideWarning[];
  checks: string[];
};

/** FNV-1a, 32 bits, hex: identifies the content a guide (and Admin's decision) was made on. */
export function contentHash(input: GuideInput): string {
  const text = JSON.stringify([input.stem, input.explanation ?? '', input.options ?? []]);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const SIMULATED_MODELS = ['fx-570VN-PLUS', 'fx-570ES-PLUS'];

export const CASIO_REFERENCES = [
  {
    label: 'CASIO fx-570VN PLUS: Hướng dẫn sử dụng (TABLE, cài đặt f(x),g(x))',
    url: 'https://support.casio.com/storage/vi/manual/pdf/VI/004/fx-570VNPLUS_VI.pdf',
  },
  {
    label: 'CASIO fx-570ES PLUS: Calculation modes, Creating a number table',
    url: 'https://support.casio.com/global/en/calc/manual/fx-570ESPLUS_991ESPLUS_en/using_calculation_modes/creating_number.html',
  },
];

/** A number the Vietnamese way, for prose: 0,2 and −3. */
function vn(value: number): string {
  return formatFull(value).replace('.', ',').replace(/^-/, '−');
}

function typed(tokens: Token[]): string {
  return tokens.map((token) => (token === '⁻' ? '−' : tokenText(token))).join('');
}

/** The function in the stem: "$y = …$" or "$f(x) = …$". */
export function functionFromStem(stem: string): string | null {
  for (const match of stem.matchAll(/\$([^$]+)\$/g)) {
    const assignment = /(?:^|[^a-zA-Z'])(?:y|f\s*\(\s*x\s*\))\s*=\s*(.+)$/.exec(match[1]);
    if (assignment && !/'/.test(match[1].slice(0, assignment.index + 3)))
      return assignment[1].trim();
  }
  return null;
}

/** Interval endpoints written in the answer choices, as numbers (∞ left out). */
function optionEndpoints(options: GuideInput['options']): number[] {
  const values: number[] = [];
  for (const option of options ?? []) {
    for (const formula of option.content.matchAll(/\$([^$]+)\$/g)) {
      const text = formula[1].replace(/\\left|\\right/g, '');
      for (const interval of text.matchAll(/[([]\s*([^;()[\]]+?)\s*;\s*([^;()[\]]+?)\s*[)\]]/g)) {
        for (const end of [interval[1], interval[2]]) {
          if (/infty/.test(end)) continue;
          const expr = parseLatex(end);
          const value = expr && evaluateExpr(expr, 0);
          if (value !== null && value !== undefined && Number.isFinite(value)) values.push(value);
        }
      }
    }
  }
  return values;
}

type Range = { start: number; end: number; step: number };
type RangeEntry = { value: number; tokens: Token[]; keys: KeyId[]; origin: StepOrigin };

function rowsOf(range: Range): number[] {
  if (!(range.step > 0) || range.end < range.start) return [];
  const count = Math.floor((range.end - range.start) / range.step + 1e-9) + 1;
  if (count > TABLE_MAX_ROWS) return [];
  return Array.from({ length: count }, (_, index) =>
    Number((range.start + index * range.step).toPrecision(10))
  );
}

/** A range around the answer choices' intervals, trimmed to where f is defined. */
function proposeRange(expr: Expr, options: GuideInput['options']): Range | null {
  const ends = optionEndpoints(options);
  const lo = Math.floor(Math.min(...(ends.length ? ends : [-2]))) - 1;
  const hi = Math.ceil(Math.max(...(ends.length ? ends : [2]))) + 1;
  for (const step of [0.1, 0.2, 0.25, 0.5, 1, 2, 5]) {
    const rows = rowsOf({ start: lo, end: hi, step });
    if (!rows.length || rows.length > 25) continue;
    const defined = rows.map((x) => evaluateExpr(expr, x) !== null);
    const first = defined.indexOf(true);
    const last = defined.lastIndexOf(true);
    if (first < 0) return null;
    return { start: rows[first], end: rows[last], step };
  }
  return null;
}

function numberEntry(value: number, origin: StepOrigin): RangeEntry | null {
  const expr = parseLatex(String(Number(value.toPrecision(10))));
  const typing = expr && typeExpression(expr);
  return typing && typing.ok ? { value, tokens: typing.tokens, keys: typing.keys, origin } : null;
}

const KEY_MEANING: Record<'SHIFT' | 'ALPHA', 'π' | 'e'> = { SHIFT: 'π', ALPHA: 'e' };

/** A value of Start/End/Step as the source gives it, corrected when its keys contradict it. */
function rangeEntry(
  field: RangeField,
  written: RangeValue,
  notes: SourceNote[],
  warnings: GuideWarning[]
): RangeEntry | null {
  const label = { start: 'Start', end: 'End', step: 'Step' }[field];
  const claimed = written.claimedKeys?.[0] as 'SHIFT' | 'ALPHA' | undefined;
  if (claimed && written.claimedMeaning && KEY_MEANING[claimed] !== written.claimedMeaning) {
    const meaning = written.claimedMeaning;
    const right = meaning === 'e' ? 'ALPHA ×10ˣ' : 'SHIFT ×10ˣ';
    notes.push({
      tone: 'error',
      text: `Sách ghi ${label}: "${claimed} ×10ˣ" để nhập ${meaning}. Trên fx-570VN PLUS, SHIFT ×10ˣ là π ≈ 3,14 và ALPHA ×10ˣ là e ≈ 2,72, nên muốn ${label} = ${meaning} phải bấm ${right}.`,
    });
    warnings.push({
      code: 'KEY_CORRECTED',
      severity: 'info',
      text: `${label}: sách ghi ${claimed} ×10ˣ cho ${meaning}; hướng dẫn dùng ${right} (theo hướng dẫn sử dụng của CASIO).`,
    });
    const tokens: Token[] = [meaning];
    return {
      value: meaning === 'e' ? Math.E : Math.PI,
      tokens,
      keys: meaning === 'e' ? ['ALPHA', 'EXP'] : ['SHIFT', 'EXP'],
      origin: 'CORRECTED',
    };
  }
  const expr = parseLatex(written.text);
  if (!expr || parametersOf(expr).length || /x/i.test(written.text.replace(/\\[a-z]+/g, '')))
    return null;
  const value = evaluateExpr(expr, 0);
  const typing = typeExpression(expr);
  if (value === null || !typing.ok) return null;
  return { value, tokens: typing.tokens, keys: typing.keys, origin: 'SOURCE' };
}

/** x as a multiple of π with a small denominator (3π/5), or the decimal. */
function piLabel(x: number): string {
  const ratio = x / Math.PI;
  for (let denominator = 1; denominator <= 12; denominator += 1) {
    const numerator = Math.round(ratio * denominator);
    if (Math.abs(ratio * denominator - numerator) < 1e-9) {
      if (numerator === 0) return '0';
      const top = `${numerator < 0 ? '−' : ''}${Math.abs(numerator) === 1 ? '' : Math.abs(numerator)}π`;
      return denominator === 1 ? top : `${top}/${denominator}`;
    }
  }
  return vn(x);
}

/** "giảm khi X đi từ −3 đến −1,5", from consecutive table values. */
function describeTrend(
  points: { x: number; y: number }[],
  label: (x: number) => string = vn
): { text: string; pieces: string[] } {
  const pieces: { sign: number; from: number; to: number }[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const difference = points[index].y - points[index - 1].y;
    const sign = Math.abs(difference) < 1e-12 ? 0 : Math.sign(difference);
    const last = pieces[pieces.length - 1];
    if (last && last.sign === sign) last.to = points[index].x;
    else pieces.push({ sign, from: points[index - 1].x, to: points[index].x });
  }
  const words = pieces.map(
    (piece) =>
      `${piece.sign < 0 ? 'giảm' : piece.sign > 0 ? 'tăng' : 'không đổi'} khi X đi từ ${label(piece.from)} đến ${label(piece.to)}`
  );
  return { text: `F(X) ${words.join(', rồi ')}`, pieces: words };
}

function lastEvent<K extends Segment['events'][number]['kind']>(
  segments: Segment[],
  kind: K
): { event: Extract<Segment['events'][number], { kind: K }>; segment: Segment } | null {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const events = segments[index].events.filter((event) => event.kind === kind);
    if (events.length)
      return {
        event: events[events.length - 1] as Extract<Segment['events'][number], { kind: K }>,
        segment: segments[index],
      };
  }
  return null;
}

function modelOf(detection: CalculatorDetection, operation: Operation | null) {
  const { id, name } = detection.model;
  if (id && SIMULATED_MODELS.includes(id)) {
    return {
      simulate: true,
      info: {
        name: MODEL.name,
        named: true,
        note:
          id === 'fx-570VN-PLUS'
            ? 'Lời giải dùng CASIO fx-570VN PLUS.'
            : `Lời giải dùng ${name}; thao tác TABLE giống fx-570VN PLUS nên Tú Tài mô phỏng trên fx-570VN PLUS.`,
      },
    };
  }
  if (id) {
    return {
      simulate: false,
      info: {
        name: name!,
        named: true,
        note: `Lời giải dùng ${name}. Tú Tài chỉ mô phỏng fx-570VN PLUS, nên ở đây chỉ minh hoạ các bước, không mô phỏng phím và màn hình của ${name}.`,
      },
    };
  }
  return {
    simulate: operation === 'TABLE',
    info: {
      name: MODEL.name,
      named: false,
      note:
        operation === 'TABLE'
          ? 'Lời giải không ghi đời máy. Thao tác MODE 7 → TABLE đúng với CASIO fx-570VN PLUS (và fx-570ES PLUS), nên Tú Tài mô phỏng trên fx-570VN PLUS. Máy đời khác có thể vào bảng bằng phím khác.'
          : 'Lời giải không ghi đời máy. Các phím được tô sáng theo bàn phím fx-570VN PLUS để minh hoạ; máy đời khác có thể khác.',
    },
  };
}

// ----------------------------------------------------------------------- TABLE

type TableContext = {
  input: GuideInput;
  detection: CalculatorDetection;
  notes: SourceNote[];
  warnings: GuideWarning[];
  checks: string[];
  simulate: boolean;
};

type TableResult = {
  level: GuideLevel;
  functionLatex: string;
  steps: GuideStep[];
  calculator?: CalculatorTutorial;
};

function tableGuide(context: TableContext): TableResult | null {
  const { input, detection, notes, warnings, checks } = context;
  const segments = detection.segments;

  const sourceFunction = lastEvent(segments, 'function');
  const stemLatex = functionFromStem(input.stem);
  const sourceExpr = sourceFunction ? parseLatex(sourceFunction.event.latex) : null;
  const stemExpr = stemLatex ? parseLatex(stemLatex) : null;

  // Parameters substituted by the source ("thử m = 1"): the one next to the range, else the last.
  const rangeSegment = segments.find((segment) =>
    segment.events.some((event) => event.kind === 'range')
  );
  const parameterEvents = (rangeSegment?.events ?? [])
    .concat(lastEvent(segments, 'parameter')?.segment.events ?? [])
    .filter((event) => event.kind === 'parameter');
  const params: Record<string, number> = {};
  const firstParameter = parameterEvents[0];
  if (firstParameter?.kind === 'parameter') params[firstParameter.name] = firstParameter.value;

  let expr: Expr | null = sourceExpr ?? stemExpr;
  let latex = sourceExpr ? sourceFunction!.event.latex : stemLatex;
  let functionOrigin: StepOrigin = sourceExpr ? 'SOURCE' : 'FROM_QUESTION';
  if (sourceExpr && stemExpr && !sameFunction(sourceExpr, stemExpr, params)) {
    warnings.push({
      code: 'FUNCTION_MISMATCH',
      severity: 'review',
      text: `Hàm số trong lời giải ($${sourceFunction!.event.latex}$) khác hàm số trong đề ($${stemLatex}$): có thể là lỗi nhập. Hướng dẫn dùng hàm số trong đề.`,
    });
    expr = stemExpr;
    latex = stemLatex;
    functionOrigin = 'FROM_QUESTION';
  }
  if (!expr || !latex) return null;

  const figure = segments.find(
    (segment) =>
      segment.figureMissing && /nhap/i.test(segment.text.normalize('NFD').replace(/[̀-ͯ]/g, ''))
  );
  if (functionOrigin === 'FROM_QUESTION') {
    notes.push({
      tone: 'missing',
      text: figure
        ? `Lời giải in phần nhập hàm số bằng hình ("${figure.text}") nhưng bản nhập không có hình; hàm số được lấy từ đề bài.`
        : 'Lời giải không ghi hàm số cần nhập; hàm số được lấy từ đề bài.',
    });
  }

  const free = parametersOf(expr).filter((name) => !(name in params));
  const used = substitute(expr, params);
  const paramText = Object.entries(params)
    .filter(([name]) => parametersOf(expr!).includes(name))
    .map(([name, value]) => `${name} = ${vn(value)}`)
    .join(', ');
  const trig = functionsOf(used).some((name) => ['sin', 'cos', 'tan'].includes(name));
  const typing = typeExpression(used);
  const functionLatex = `$f(x) = ${latex}$${paramText ? ` (với ${paramText})` : ''}`;

  // Start / End / Step: the source's, corrected if needed, else proposed.
  const fields: RangeField[] = ['start', 'end', 'step'];
  const written = Object.fromEntries(
    fields.map((field) => {
      let found: { value: RangeValue | null; segment: Segment } | null = null;
      for (const segment of segments)
        for (const event of segment.events)
          if (event.kind === 'range' && event.field === field && event.value)
            found = { value: event.value, segment };
      return [field, found];
    })
  ) as Record<RangeField, { value: RangeValue; segment: Segment } | null>;
  let entries = fields.map((field) =>
    written[field] ? rangeEntry(field, written[field]!.value, notes, warnings) : null
  );
  let rangeOrigin: StepOrigin = entries.some((entry) => entry?.origin === 'CORRECTED')
    ? 'CORRECTED'
    : 'SOURCE';
  let range: Range | null = entries.every(Boolean)
    ? { start: entries[0]!.value, end: entries[1]!.value, step: entries[2]!.value }
    : null;
  if (range && !rowsOf(range).length) {
    warnings.push({
      code: 'RANGE_INVALID',
      severity: 'review',
      text: `Start/End/Step của sách (${entries.map((entry) => vn(entry!.value)).join(' / ')}) cho quá ${TABLE_MAX_ROWS} dòng hoặc không hợp lệ (máy báo Range ERROR). Hướng dẫn đề xuất khoảng khác.`,
    });
    range = null;
  }
  if (!range && !free.length) {
    const proposed = proposeRange(used, input.options);
    if (proposed) {
      range = proposed;
      rangeOrigin = 'PROPOSED';
      entries = [proposed.start, proposed.end, proposed.step].map((value) =>
        numberEntry(value, 'PROPOSED')
      );
      const reference = lastEvent(segments, 'reference');
      warnings.push({
        code: 'RANGE_PROPOSED',
        severity: 'review',
        text: `Lời giải không cho Start/End/Step${reference ? ` (chỉ ghi "tương tự ${reference.event.target}")` : ''}. Tú Tài đề xuất Start = ${vn(proposed.start)}, End = ${vn(proposed.end)}, Step = ${vn(proposed.step)} từ các khoảng trong phương án và tập xác định: cần Admin chấp nhận.`,
      });
      if (reference)
        notes.push({
          tone: 'missing',
          text: `Lời giải chỉ ghi "tương tự ${reference.event.target}", không có thao tác cụ thể. Khoảng giá trị trong hướng dẫn do Tú Tài đề xuất.`,
        });
    }
  }
  const rows = range ? rowsOf(range) : [];
  const rangeSource = fields
    .map((field) => written[field]?.segment.text)
    .filter((text, index, all): text is string => !!text && all.indexOf(text) === index)
    .join(' / ');

  const openEvent = segments.find((segment) =>
    segment.events.some((event) => event.kind === 'open-table')
  );
  const confirmEvent = segments.find((segment) =>
    segment.events.some((event) => event.kind === 'confirm-fg')
  );
  const conclusions = segments.filter(
    (segment) =>
      segment.events.some((event) => event.kind === 'conclusion') &&
      !segment.events.some((event) => event.kind === 'range')
  );
  const readsInSource = segments.some((segment) =>
    segment.events.some((event) => event.kind === 'read')
  );

  const values = rows.map((x) => ({ x, y: evaluateExpr(used, x) }));
  const undefinedRows = values.filter((row) => row.y === null).map((row) => row.x);
  if (undefinedRows.length && rangeOrigin !== 'PROPOSED' && range) {
    notes.push({
      tone: 'caution',
      text: `Khoảng của lời giải đi qua X = ${undefinedRows.map(vn).join('; ')}, nơi hàm số không xác định: máy hiện ERROR ở ${undefinedRows.length > 1 ? 'các dòng' : 'dòng'} này, không phải giá trị của hàm số.`,
    });
  }

  const intervalText = (entry: RangeEntry | null) => (entry ? typed(entry.tokens) : '?');
  const rangeInstruction = `Start? nhập ${intervalText(entries[0])} rồi bấm =; End? nhập ${intervalText(entries[1])} rồi bấm =; Step? nhập ${intervalText(entries[2])} rồi bấm =.`;
  const rangeKeys = entries.every(Boolean)
    ? entries.flatMap((entry) => [...entry!.keys, 'EQ' as KeyId])
    : undefined;

  // Runs of rows where f is defined, in order: each is read with ▼.
  const runs: { from: number; to: number }[] = [];
  values.forEach((row, index) => {
    if (row.y === null) return;
    const last = runs[runs.length - 1];
    if (last && last.to === index - 1) last.to = index;
    else runs.push({ from: index, to: index });
  });
  const readable = runs.filter((run) => run.to > run.from).slice(0, 4);
  // In π (π/2, 3π/5…) when the source's range is.
  const inPi = entries.some((entry) => entry?.tokens.includes('π'));
  const trends = readable.map((run) =>
    describeTrend(
      values.slice(run.from, run.to + 1).map((row) => ({ x: row.x, y: row.y! })),
      inPi ? piLabel : vn
    )
  );
  const conclusion = [
    ...trends.map((trend) => `${trend.text}.`),
    ...conclusions.map((segment) => `Lời giải kết luận: "${segment.text}"`),
    "Bảng chỉ tính tại một số điểm nên không phải là chứng minh: dùng để dự đoán và kiểm tra; kết luận chặt chẽ dựa vào dấu của $y'$.",
    ...(undefinedRows.length
      ? ['Dòng ERROR không phải giá trị của hàm số: xét riêng từng khoảng của tập xác định.']
      : []),
  ];

  const level: GuideLevel =
    context.simulate && typing.ok && !trig && range && rangeKeys && rows.length ? 'A' : 'B';

  if (level === 'A') {
    const steps: GuideStep[] = [];
    const pressed: KeyId[] = [];
    let state: CalcState | null = null;
    const add = (step: GuideStep) => {
      pressed.push(...step.keys!);
      state = replay(pressed);
      steps.push({ ...step, expect: { screen: state.screen, text: screenText(state) } });
    };
    try {
      add({
        id: 'open-table',
        title: 'Mở chế độ TABLE',
        instruction: 'Bấm MODE, rồi bấm 7 để chọn TABLE.',
        keys: ['MODE', '7'],
        explanation: 'Trên fx-570VN PLUS, TABLE là mục số 7 trong menu MODE.',
        origin: openEvent ? 'SOURCE' : 'MODEL',
        source: openEvent?.text,
      });
      const tokens = typing.ok ? typing.tokens : [];
      const tips = [
        'Biến X là chữ đỏ trên phím ")": bấm ALPHA rồi ")".',
        tokens.includes('÷') && latex.includes('\\frac')
          ? 'Phân số được nhập bằng phím ÷ và dấu ngoặc: (tử)÷(mẫu) cho cùng giá trị.'
          : '',
        tokens.includes('√(')
          ? 'Phím √ mở ô căn: nhập biểu thức trong ô, bấm ▶ để ra khỏi ô nếu còn nhập tiếp.'
          : '',
        tokens.includes('^(') ? 'Phím x▭ mở ô số mũ: nhập số mũ rồi bấm ▶ để ra khỏi ô.' : '',
        tokens.includes('²') ? 'x² là phím bình phương.' : '',
        tokens.includes('ln(') ? 'Phím ln tự mở ngoặc "ln(", nhớ đóng ngoặc.' : '',
        tokens[0] === '⁻' || tokens.includes('⁻')
          ? 'Dấu âm đứng đầu dùng phím (−), không dùng phím trừ.'
          : '',
        tokens.includes('e') ? 'Hằng số e là chữ đỏ trên phím ×10ˣ: ALPHA rồi ×10ˣ.' : '',
        paramText ? `Thay ${paramText} như lời giải.` : '',
      ].filter(Boolean);
      add({
        id: 'enter-function',
        title: 'Nhập hàm số',
        instruction: `Nhập f(X) = ${typed(tokens)}`,
        math: functionLatex,
        keys: typing.ok ? typing.keys : [],
        explanation: tips.join(' '),
        origin: functionOrigin,
        source: functionOrigin === 'SOURCE' ? sourceFunction!.segment.text : figure?.text,
      });
      add({
        id: 'skip-g',
        title: 'Bỏ qua g(X)',
        instruction: 'Bấm = để xác nhận f(X). Máy hỏi g(X): bấm = lần nữa để bỏ trống.',
        keys: ['EQ', 'EQ'],
        explanation:
          'Cài đặt mặc định của fx-570VN PLUS là "f(x),g(x)", nên sau f(X) máy hỏi thêm g(X). Bài này chỉ cần f.',
        origin: confirmEvent ? 'SOURCE' : 'MODEL',
        source: confirmEvent?.text,
      });
      add({
        id: 'range',
        title: 'Chọn khoảng giá trị của X',
        instruction: rangeInstruction,
        keys: rangeKeys!,
        explanation: `Máy lập bảng X = ${vn(rows[0])}; ${vn(rows[1] ?? rows[0])}; …; ${vn(rows[rows.length - 1])}: ${rows.length} dòng (tối đa ${TABLE_MAX_ROWS} dòng khi có cả f và g).`,
        checkpoint: undefinedRows.length
          ? {
              tone: 'warning',
              title: `Có ${undefinedRows.length} dòng ERROR`,
              body: `Tại X = ${undefinedRows.map(vn).join('; ')} máy báo ERROR vì hàm số không xác định ở đó (ngoài tập xác định). Đây không phải giá trị của hàm số: chỉ đọc các dòng có số.`,
            }
          : undefined,
        origin: rangeOrigin,
        source: rangeSource || undefined,
      });
      let row = 0;
      readable.forEach((run, index) => {
        const presses = run.to - row;
        if (presses <= 0) return;
        const from = values[run.from].x;
        const to = values[run.to].x;
        add({
          id: `read-${index + 1}`,
          title: `Đọc bảng: X từ ${vn(from)} đến ${vn(to)}`,
          instruction: `Bấm ▼ ${presses} lần để đi qua các dòng đến X = ${vn(to)}, vừa bấm vừa nhìn cột F(X).`,
          keys: Array.from({ length: presses }, () => 'DOWN' as KeyId),
          explanation: `Các giá trị: ${values
            .slice(run.from, run.to + 1)
            .map((point) => `${vn(point.x)} → ${vn(point.y!)}`)
            .join('; ')}.`,
          checkpoint: {
            tone: 'observe',
            title: `Quan sát: ${trends[index].text}`,
            body: 'Đây là giá trị tại các điểm mẫu: đủ để dự đoán chiều biến thiên trên khoảng này, chưa phải chứng minh.',
          },
          origin: readsInSource ? 'SOURCE' : 'MODEL',
        });
        row = run.to;
      });
    } catch (error) {
      // A key the simulation refuses: never show a sequence that does not run.
      warnings.push({
        code: 'SIMULATION_FAILED',
        severity: 'review',
        text: `Thứ tự phím không chạy được trên bản mô phỏng (${error instanceof Error ? error.message : 'lỗi'}); chuyển sang minh hoạ.`,
      });
      return { level: 'B', functionLatex, steps: illustrationSteps() };
    }

    // Every value on the simulated table against the formula computed independently.
    const final = state as CalcState | null;
    const mismatch = final?.rows.find((entry, index) => {
      const expected = values[index]?.y ?? null;
      return (
        (entry.f === null) !== (expected === null) ||
        (entry.f !== null &&
          expected !== null &&
          Math.abs(entry.f - expected) > 1e-9 * Math.max(1, Math.abs(expected)))
      );
    });
    if (!final || mismatch) {
      warnings.push({
        code: 'VALUES_MISMATCH',
        severity: 'review',
        text: 'Giá trị trên bảng mô phỏng không khớp công thức tính độc lập; chuyển sang minh hoạ.',
      });
      return { level: 'B', functionLatex, steps: illustrationSteps() };
    }
    checks.push(
      `Phát lại ${steps.length} bước (${pressed.length} lần bấm phím) trên bản mô phỏng; màn hình sau mỗi bước được ghi lại.`,
      `${rows.length} giá trị của bảng khớp công thức tính độc lập (${undefinedRows.length} dòng ERROR đúng chỗ hàm số không xác định).`
    );

    const tutorialSteps: TutorialStep[] = steps.map((step) => ({
      id: step.id,
      title: step.title,
      instruction: step.instruction,
      keys: step.keys!,
      explanation: step.explanation ?? '',
      hint:
        step.id === 'enter-function' ? 'X là chữ đỏ trên phím ")": bấm ALPHA rồi ")".' : undefined,
      checkpoint: step.checkpoint,
      expect: step.expect!,
      origin: step.origin,
    }));
    return {
      level,
      functionLatex,
      steps,
      calculator: {
        id: `generated-table-${contentHash(input)}`,
        model: MODEL,
        functionLatex,
        intro: undefinedRows.length
          ? `Trên khoảng này hàm số không xác định tại X = ${undefinedRows.map(vn).join('; ')}: máy sẽ hiện ERROR ở đó.`
          : undefined,
        freeHint:
          'Máy mô phỏng nhận mọi phím của chức năng TABLE. Bấm AC để quay lại f(X) (hàm số được giữ), rồi thử một khoảng khác.',
        objective: `Lập bảng giá trị của ${functionLatex} để xem F(X) tăng hay giảm khi X tăng.`,
        steps: tutorialSteps,
        conclusion,
        references: CASIO_REFERENCES,
      },
    };
  }

  function illustrationSteps(): GuideStep[] {
    const steps: GuideStep[] = [];
    const highlight = (keys: KeyId[]) =>
      context.simulate || !detection.model.id ? keys : undefined;
    if (trig) {
      warnings.push({
        code: 'ANGLE_UNIT',
        severity: 'review',
        text: 'Hàm lượng giác: máy phải ở đơn vị Radian (khoảng X tính theo π). Lời giải không nêu bước này; nếu máy để Deg (mặc định), bảng sẽ sai.',
      });
      steps.push({
        id: 'angle-unit',
        title: 'Chọn đơn vị góc Radian',
        instruction:
          'Trước khi lập bảng, chuyển máy sang Radian: SHIFT, MODE (SETUP), rồi chọn Rad.',
        keys: highlight(['SHIFT', 'MODE', '4']),
        explanation:
          'X ở đây là số đo góc tính bằng radian (π/2, π…). Ở đơn vị Deg, máy hiểu π/2 là 1,57 độ và cho bảng khác hẳn. Lời giải không ghi bước này.',
        origin: 'MODEL',
      });
    }
    steps.push({
      id: 'open-table',
      title: 'Mở chế độ TABLE',
      instruction: openEvent ? openEvent.text : 'Mở chức năng bảng giá trị (TABLE) của máy.',
      keys: highlight(['MODE', '7']),
      origin: openEvent ? 'SOURCE' : 'MODEL',
      source: openEvent?.text,
    });
    steps.push({
      id: 'enter-function',
      title: 'Nhập hàm số',
      instruction: `Nhập hàm số ${functionLatex}.`,
      math: functionLatex,
      explanation: typing.ok
        ? undefined
        : `${typing.reason} Các phím của bước này không được tô sáng.`,
      origin: functionOrigin,
      source: functionOrigin === 'SOURCE' ? sourceFunction!.segment.text : figure?.text,
    });
    steps.push({
      id: 'skip-g',
      title: 'Bỏ qua g(X)',
      instruction: 'Bấm = để xác nhận f(X); nếu máy hỏi g(X), bấm = lần nữa để bỏ trống.',
      keys: highlight(['EQ', 'EQ']),
      origin: confirmEvent ? 'SOURCE' : 'MODEL',
      source: confirmEvent?.text,
    });
    if (entries.some(Boolean) || rangeSource) {
      steps.push({
        id: 'range',
        title: 'Chọn khoảng giá trị của X',
        instruction: rangeInstruction,
        keys: rangeKeys ? highlight(rangeKeys) : undefined,
        origin: rangeOrigin,
        source: rangeSource || undefined,
      });
    }
    if (rows.length && !free.length) {
      // f at the exact value, not the rounded one (sin π is 0, not −4·10⁻¹⁰).
      const shown = rows.map((_, index) => {
        const x = range!.start + index * range!.step;
        const y = evaluateExpr(used, x);
        return { x: inPi ? piLabel(x) : vn(values[index].x), y: y === null ? 'ERROR' : vn(y) };
      });
      steps.push({
        id: 'values',
        title: 'Giá trị Tú Tài tính được',
        instruction: `Giá trị của f tại các X của bảng, tính từ công thức${trig ? ' (X theo radian)' : ''}. Đây không phải ảnh màn hình máy: dùng để đối chiếu với máy của em.`,
        values: shown,
        checkpoint: trends.length
          ? {
              tone: 'observe',
              title: `Quan sát: ${trends.map((trend) => trend.text).join('; ')}`,
              body: 'Giá trị tại các điểm mẫu chỉ giúp dự đoán, chưa phải chứng minh.',
            }
          : undefined,
        origin: 'COMPUTED',
      });
      checks.push(`${rows.length} giá trị tính từ công thức (không mô phỏng phím).`);
    }
    for (const segment of conclusions) {
      steps.push({
        id: `conclusion-${segment.index}`,
        title: 'Kết luận của lời giải',
        instruction: segment.text,
        origin: 'SOURCE',
        source: segment.text,
      });
    }
    return steps;
  }

  return { level: 'B', functionLatex, steps: illustrationSteps() };
}

// --------------------------------------------------------------- other methods

function segmentSteps(
  input: GuideInput,
  detection: CalculatorDetection,
  warnings: GuideWarning[],
  notes: SourceNote[],
  checks: string[],
  showKeys: boolean
): GuideStep[] {
  const stemLatex = functionFromStem(input.stem);
  const steps: GuideStep[] = [];
  for (const segment of detection.segments) {
    const keys = segment.events.flatMap((event) => (event.kind === 'keys' ? event.keys : []));
    const reference = segment.events.find((event) => event.kind === 'reference');
    const evaluation = segment.events.find((event) => event.kind === 'evaluate');
    const conclusion = segment.events.some((event) => event.kind === 'conclusion');
    let checkpoint: GuideStep['checkpoint'];
    if (evaluation?.kind === 'evaluate' && evaluation.result !== undefined) {
      const functionEvent = segment.events.find((event) => event.kind === 'function');
      const latex = functionEvent?.kind === 'function' ? functionEvent.latex : stemLatex;
      const expr = latex ? parseLatex(latex) : null;
      const value = expr ? evaluateExpr(expr, Number(evaluation.at)) : null;
      const claimed = Number(evaluation.result);
      if (value !== null && expr) {
        const decimals = (evaluation.result.split('.')[1] ?? '').length;
        const ok = Math.abs(value - claimed) <= 0.5 * 10 ** -decimals + 1e-9;
        checkpoint = ok
          ? {
              tone: 'observe',
              title: `Đã kiểm tra: f(${vn(Number(evaluation.at))}) = ${vn(value)}`,
              body: 'Tú Tài tính lại từ công thức: khớp kết quả trong lời giải.',
            }
          : {
              tone: 'warning',
              title: `Kết quả trong lời giải (${vn(claimed)}) khác giá trị tính được`,
              body: `Tính lại từ công thức: f(${vn(Number(evaluation.at))}) = ${vn(value)}.`,
            };
        if (ok) checks.push(`Kết quả CALC tại X = ${vn(Number(evaluation.at))} khớp công thức.`);
        else
          warnings.push({
            code: 'CALC_MISMATCH',
            severity: 'review',
            text: `Lời giải ghi f(${vn(Number(evaluation.at))}) = ${vn(claimed)}, tính lại được ${vn(value)}.`,
          });
      }
    }
    if (reference?.kind === 'reference') {
      notes.push({
        tone: 'missing',
        text: `Lời giải chỉ ghi "tương tự ${reference.target}", không có thao tác cụ thể cho câu này.`,
      });
    }
    steps.push({
      id: `source-${segment.index}`,
      title: segment.figureMissing
        ? 'Màn hình máy (hình bị thiếu)'
        : reference
          ? 'Tham chiếu bài khác'
          : conclusion
            ? 'Kết luận'
            : evaluation
              ? 'Tính giá trị'
              : keys.length
                ? 'Thao tác trên máy'
                : `Bước ${steps.length + 1}`,
      instruction: segment.text,
      keys: showKeys && keys.length ? keys : undefined,
      explanation: segment.figureMissing
        ? 'Lời giải có hình màn hình ở đây nhưng bản nhập không có hình. Tú Tài không vẽ lại màn hình không có trong nguồn.'
        : reference
          ? 'Không có thao tác cụ thể trong lời giải của câu này.'
          : undefined,
      checkpoint,
      origin: segment.figureMissing ? 'MISSING' : reference ? 'UNCERTAIN' : 'SOURCE',
      source: segment.text,
    });
  }
  return steps;
}

// ----------------------------------------------------------------------- entry

export function generateGuide(input: GuideInput): GeneratedGuide {
  const detection = detectCalculatorMethod(input.explanation);
  const sourceHash = contentHash(input);
  const notes: SourceNote[] = [];
  const warnings: GuideWarning[] = [];
  const checks: string[] = [];
  const { simulate, info: model } = modelOf(detection, detection.operation);
  const empty: GeneratedGuide = {
    sourceHash,
    detection,
    level: null,
    operation: detection.operation,
    functionLatex: null,
    model,
    mathText: detection.mathText,
    steps: [],
    notes,
    warnings,
    checks,
  };
  if (!detection.present) return empty;

  for (const fragment of detection.ocr) {
    warnings.push({ code: 'OCR', severity: 'info', text: `Nghi lỗi nhập/OCR: ${fragment}` });
    notes.push({ tone: 'error', text: `Bản nhập có chỗ nghi lỗi: ${fragment}` });
  }
  const figures = detection.segments.filter((segment) => segment.figureMissing).length;
  if (figures) {
    warnings.push({
      code: 'FIGURE_MISSING',
      severity: 'info',
      text: `${figures} hình màn hình máy trong lời giải không có trong bản nhập.`,
    });
    notes.push({
      tone: 'missing',
      text: `${figures} hình màn hình máy trong lời giải không được nhập, nên các câu "máy hiện…", "nhập như sau:" không có hình đi kèm. Tú Tài không vẽ lại các hình này.`,
    });
  }
  if (!model.named) warnings.push({ code: 'MODEL_ASSUMED', severity: 'info', text: model.note });
  if (detection.confidence === 'low')
    warnings.push({
      code: 'LOW_CONFIDENCE',
      severity: 'review',
      text: 'Chỉ thấy lời giải nhắc tới máy tính, không có lệnh cụ thể: cần Admin xác nhận đây là cách giải bằng máy.',
    });

  if (detection.operation === 'TABLE') {
    const table = tableGuide({ input, detection, notes, warnings, checks, simulate });
    if (table) {
      return {
        ...empty,
        level: table.level,
        functionLatex: table.functionLatex,
        calculator: table.calculator,
        steps: table.steps,
      };
    }
    warnings.push({
      code: 'NO_FUNCTION',
      severity: 'info',
      text: 'Không đọc được hàm số (trong lời giải hay trong đề) để lập bảng: chỉ hiện các bước của lời giải.',
    });
  }

  const steps = segmentSteps(input, detection, warnings, notes, checks, true);
  const level: GuideLevel = steps.some((step) => step.keys?.length) ? 'B' : 'C';
  if (level === 'C' || detection.operation !== 'TABLE')
    warnings.push({
      code:
        detection.operation === 'TABLE' || detection.operation === 'GENERIC'
          ? 'TEXT_ONLY'
          : 'OPERATION_NOT_SIMULATED',
      severity: 'info',
      text:
        level === 'C'
          ? 'Lời giải không có đủ phím hay giá trị để minh hoạ trên máy: hiện từng bước bằng chữ.'
          : `${OPERATION_LABEL[detection.operation ?? 'GENERIC']} không được mô phỏng: tô sáng các phím lời giải nêu, không vẽ màn hình.`,
    });
  return { ...empty, level, steps };
}
