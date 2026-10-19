/**
 * Lightweight checks on an AI lesson draft, shown to the admin in the review
 * panel. They catch structural and checkable problems (raw LaTeX, a formal
 * statement before any intuition, an introductory lesson with one example,
 * advanced edge cases among the "common mistakes", a derivative or a
 * monotonicity conclusion that does not match the example's function). They
 * cannot judge whether a lesson teaches well; the admin's review stays the
 * gate before anything reaches students.
 */

import { findMathIssues, splitMathSegments } from '@/lib/content/math-notation';
import {
  analyzeFunction,
  derivative,
  parseFunction,
  sameFunction,
  type MonotonePiece,
} from '@/lib/learning/function-model';
import type { AiDraftBlockType, AiLessonDraft, LessonStage } from './ai-lesson-draft';
import { listItems, paragraphLabel, parseExamples, splitConcepts } from './lesson-journey';

export interface DraftCheck {
  id: string;
  block: AiDraftBlockType | null;
  severity: 'warning' | 'info';
  message: string;
}

const BLOCK_NAMES: Record<AiDraftBlockType, string> = {
  INTRO: 'Mở đầu',
  OBJECTIVE: 'Mục tiêu',
  MAIN_CONTENT: 'Nội dung chính',
  EXAMPLE: 'Ví dụ',
  RECAP: 'Ghi nhớ',
  COMMON_MISTAKE: 'Lỗi hay gặp',
  GRAPH: 'Hàm số minh hoạ',
};

const words = (text: string) =>
  text
    .replace(/\$[^$]*\$/g, ' x ')
    .split(/\s+/)
    .filter(Boolean).length;

const short = (text: string, max = 70) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

function sentences(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/(?<=[.!?:])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

// ─── Notation ────────────────────────────────────────────────────────────────

/** Notation a student must be told the meaning of, with the words that name it. */
const NOTATION: Array<{ name: string; symbol: RegExp; names: RegExp }> = [
  { name: "đạo hàm ($f'(x)$, $y'$)", symbol: /\b[a-zA-Z]'(?:\s*\(|\s*[=<>]|$)/, names: /đạo hàm/i },
  { name: 'tích phân, nguyên hàm (∫)', symbol: /\\int\b/, names: /tích phân|nguyên hàm/i },
  { name: 'giới hạn (lim)', symbol: /\\lim\b/, names: /giới hạn/i },
  { name: 'vectơ', symbol: /\\vec\b|\\overrightarrow\b/, names: /vectơ|véc-tơ|vector/i },
  { name: 'logarit', symbol: /\\log\b|\\ln\b/, names: /logarit|lôgarit/i },
  { name: 'tổng (∑)', symbol: /\\sum\b/, names: /tổng/i },
  { name: 'xác suất có điều kiện', symbol: /P\s*\(\s*[A-Z]\s*\|/, names: /điều kiện/i },
];
const EXPLAINS =
  /(?:^|\s)là(?=\s|$)|nghĩa là|cho biết|kí hiệu|ký hiệu|gọi là|chính là|đo |biểu thị|thể hiện/i;

function mathOf(sentence: string): string {
  return splitMathSegments(sentence)
    .filter((segment) => segment.math)
    .map((segment) => segment.body)
    .join(' ');
}

function notationChecks(draft: AiLessonDraft): DraftCheck[] {
  const checks: DraftCheck[] = [];
  const list = sentences(`${draft.INTRO}\n\n${draft.MAIN_CONTENT}`);
  for (const item of NOTATION) {
    const first = list.findIndex((sentence) => item.symbol.test(mathOf(sentence)));
    if (first < 0) continue;
    // Lower-cased first: the `i` flag does not fold Vietnamese letters such as Đ.
    const near = list
      .slice(Math.max(0, first - 1), first + 2)
      .join(' ')
      .toLocaleLowerCase('vi');
    if (item.names.test(near) && EXPLAINS.test(near)) continue;
    checks.push({
      id: `notation-${item.name}`,
      block: draft.INTRO.includes(list[first]) ? 'INTRO' : 'MAIN_CONTENT',
      severity: 'warning',
      message: `Ký hiệu ${item.name} xuất hiện lần đầu ở câu “${short(list[first])}” mà chưa nói nó là gì.`,
    });
  }
  return checks;
}

// ─── Maths in worked examples ────────────────────────────────────────────────

/** "-\infty", "+\infty", "2", "-1,5", "\frac{1}{3}", "-\dfrac{1}{3}" → number. */
function readNumber(raw: string): number | null {
  const text = raw.replace(/\s+/g, '').replace(/\\left|\\right/g, '');
  if (/^-\\infty$/.test(text)) return -Infinity;
  if (/^\+?\\infty$/.test(text)) return Infinity;
  const fraction = /^([-+]?)\\[dt]?frac\{(-?\d+(?:[.,]\d+)?)\}\{(\d+(?:[.,]\d+)?)\}$/.exec(text);
  if (fraction) {
    const value = Number(fraction[2].replace(',', '.')) / Number(fraction[3].replace(',', '.'));
    return fraction[1] === '-' ? -value : value;
  }
  if (/^[-+]?\d+(?:[.,]\d+)?$/.test(text)) return Number(text.replace(',', '.'));
  return null;
}

/** Intervals "(a; b)" written in a piece of maths. */
function readIntervals(math: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const match of math.matchAll(/\(\s*([^;()]+?)\s*;\s*([^;()]+?)\s*\)/g)) {
    const from = readNumber(match[1]);
    const to = readNumber(match[2]);
    if (from !== null && to !== null && from < to) out.push([from, to]);
  }
  return out;
}

const inside = ([from, to]: [number, number], piece: MonotonePiece) =>
  from >= piece.from - 1e-6 && to <= piece.to + 1e-6;

const formatInterval = ([from, to]: [number, number]) =>
  `(${Number.isFinite(from) ? from : '−∞'}; ${Number.isFinite(to) ? to : '+∞'})`;

function exampleMathChecks(draft: AiLessonDraft): DraftCheck[] {
  const checks: DraftCheck[] = [];
  parseExamples(draft.EXAMPLE).forEach((example, index) => {
    if (!example.fn) return;
    const label = example.title || `Ví dụ ${index + 1}`;
    const solution = example.steps.map((step) => step.body).join('\n');

    // The derivative the solution writes, compared with the one computed from the problem.
    for (const segment of splitMathSegments(solution)) {
      if (!segment.math) continue;
      const claim =
        /^\s*(?:y'|f'\s*\(\s*x\s*\))\s*=\s*([^=]+?)\s*(?:=|\\Leftrightarrow|\\Rightarrow|$)/.exec(
          segment.body
        );
      if (!claim) continue;
      const parsed = parseFunction(`y = ${claim[1]}`);
      if (!parsed.ok) break;
      if (!sameFunction(parsed.fn, derivative(example.fn))) {
        checks.push({
          id: `example-${index}-derivative`,
          block: 'EXAMPLE',
          severity: 'warning',
          message: `${label}: đạo hàm viết là $${segment.body.trim()}$ nhưng tính lại từ đề bài thì không khớp. Kiểm tra lại phép tính.`,
        });
      }
      break;
    }

    // Monotonicity conclusions compared with the sign of the derivative.
    const source = `y = ${example.problem.match(/\$\s*(?:y|f\s*\(\s*x\s*\))\s*=\s*([^$]+)\$/)?.[1] ?? ''}`;
    const analysis = analyzeFunction(source);
    if (!analysis.ok) return;
    const { pieces } = analysis.analysis;
    for (const line of solution.split('\n')) {
      for (const part of line.split(/(?=đồng biến|nghịch biến)/)) {
        const direction = part.startsWith('đồng biến')
          ? 'up'
          : part.startsWith('nghịch biến')
            ? 'down'
            : null;
        if (!direction) continue;
        for (const interval of readIntervals(mathOf(part))) {
          if (pieces.some((piece) => piece.direction === direction && inside(interval, piece))) {
            continue;
          }
          checks.push({
            id: `example-${index}-${direction}-${interval.join('_')}`,
            block: 'EXAMPLE',
            severity: 'warning',
            message: `${label}: kết luận hàm số ${direction === 'up' ? 'đồng biến' : 'nghịch biến'} trên ${formatInterval(interval)} không khớp với dấu của đạo hàm tính lại từ đề bài.`,
          });
        }
      }
    }
  });
  return checks;
}

// ─── Teaching structure ──────────────────────────────────────────────────────

const FORMAL_OPENING = /^(?:giả sử|cho hàm số|cho |định lí|định lý|định nghĩa|nếu |với mọi)/i;
/** Edge cases and formal subtleties that do not belong among a first lesson's mistakes. */
const ADVANCED_MISTAKE =
  /vô số|hữu hạn điểm|tham số\s*\$?\s*m\b|\\cup|∪|trường hợp đặc biệt|ngoại lệ|giới hạn một bên|không liên tục/i;
/** Solving f(x) = 0 where the method needs f'(x) = 0. */
const WRONG_EQUATION = /\$\s*(?:f\s*\(\s*x\s*\)|y)\s*=\s*0\s*\$/;

function structureChecks(draft: AiLessonDraft, stage: LessonStage, math: boolean): DraftCheck[] {
  const checks: DraftCheck[] = [];
  const concepts = splitConcepts(draft.MAIN_CONTENT);
  const firstParagraph = draft.MAIN_CONTENT.split(/\n{2,}/)[0] ?? '';
  const opening = (paragraphLabel(firstParagraph)?.rest ?? firstParagraph).trim();

  if (stage === 'INTRODUCTORY' && FORMAL_OPENING.test(opening.toLocaleLowerCase('vi'))) {
    checks.push({
      id: 'formal-opening',
      block: 'MAIN_CONTENT',
      severity: 'warning',
      message: `Bài mở đầu nhưng Nội dung chính bắt đầu ngay bằng phát biểu hình thức (“${short(opening, 60)}”). Học sinh mới cần thấy trực giác hoặc ví dụ trước.`,
    });
  }
  if (concepts.length && concepts.every((concept) => !concept.title)) {
    checks.push({
      id: 'unlabelled-ideas',
      block: 'MAIN_CONTENT',
      severity: 'info',
      message:
        'Nội dung chính chưa chia thành các ý có nhãn in đậm (“**Tên ý.** …”), nên học sinh sẽ đọc thành khối dài.',
    });
  }
  if (concepts.length > 5) {
    checks.push({
      id: 'too-many-ideas',
      block: 'MAIN_CONTENT',
      severity: 'warning',
      message: `Nội dung chính có ${concepts.length} ý; một bài nên dạy 2–4 ý.`,
    });
  }
  for (const concept of concepts) {
    const count = words(concept.body);
    if (count > 220) {
      checks.push({
        id: `long-idea-${concept.title ?? concept.body.slice(0, 20)}`,
        block: 'MAIN_CONTENT',
        severity: 'warning',
        message: `Ý “${short(concept.title ?? concept.body, 40)}” dài khoảng ${count} từ; nên tách hoặc rút gọn.`,
      });
    }
  }

  const examples = parseExamples(draft.EXAMPLE);
  if (stage === 'INTRODUCTORY' && examples.length < 2) {
    checks.push({
      id: 'one-example',
      block: 'EXAMPLE',
      severity: 'warning',
      message:
        'Bài mở đầu chỉ có một ví dụ. Nên có một ví dụ thật đơn giản minh hoạ khái niệm trước ví dụ làm đủ các bước.',
    });
  }
  examples.forEach((example, index) => {
    if (!example.steps.length) {
      checks.push({
        id: `example-${index}-no-steps`,
        block: 'EXAMPLE',
        severity: 'warning',
        message: `${example.title || `Ví dụ ${index + 1}`} chưa có lời giải từng bước.`,
      });
    }
  });

  const mistakes = listItems(draft.COMMON_MISTAKE);
  if (mistakes.length > 3) {
    checks.push({
      id: 'many-mistakes',
      block: 'COMMON_MISTAKE',
      severity: 'info',
      message: `Có ${mistakes.length} lỗi hay gặp; giữ 1–3 lỗi học sinh dễ mắc nhất trong bài này.`,
    });
  }
  if (math && (stage === 'INTRODUCTORY' || stage === 'APPLICATION')) {
    for (const mistake of mistakes) {
      if (!ADVANCED_MISTAKE.test(mistake.toLocaleLowerCase('vi'))) continue;
      checks.push({
        id: `advanced-mistake-${mistake.slice(0, 20)}`,
        block: 'COMMON_MISTAKE',
        severity: 'warning',
        message: `Lỗi “${short(mistake)}” là trường hợp đặc biệt hoặc cách viết hình thức; với giai đoạn này nên ưu tiên lỗi học sinh gặp ngay khi làm bài.`,
      });
    }
  }
  if (math) {
    const procedureText = `${draft.MAIN_CONTENT}\n${draft.EXAMPLE}`;
    for (const sentence of sentences(procedureText)) {
      if (
        WRONG_EQUATION.test(sentence) &&
        /đạo hàm|xét dấu|tới hạn/.test(sentence.toLocaleLowerCase('vi'))
      ) {
        checks.push({
          id: `wrong-equation-${sentence.slice(0, 20)}`,
          block: draft.EXAMPLE.includes(sentence) ? 'EXAMPLE' : 'MAIN_CONTENT',
          severity: 'warning',
          message: `Câu “${short(sentence)}” giải phương trình hàm số bằng 0; để xét dấu đạo hàm cần giải $f'(x) = 0$.`,
        });
      }
    }
  }

  const total = (Object.values(draft) as string[]).reduce((sum, text) => sum + words(text), 0);
  if (total > 1400) {
    checks.push({
      id: 'too-long',
      block: null,
      severity: 'warning',
      message: `Bản nháp dài khoảng ${total} từ; bài học nên gọn để học sinh đọc hết.`,
    });
  }
  if (words(draft.MAIN_CONTENT) < 80) {
    checks.push({
      id: 'thin-content',
      block: 'MAIN_CONTENT',
      severity: 'warning',
      message: 'Nội dung chính rất ngắn; có thể chưa đủ giải thích cho học sinh tự học.',
    });
  }

  // The same long sentence written in two parts.
  const seen = new Map<string, AiDraftBlockType>();
  for (const block of ['INTRO', 'MAIN_CONTENT', 'EXAMPLE', 'COMMON_MISTAKE'] as const) {
    for (const sentence of sentences(draft[block])) {
      const key = sentence.toLocaleLowerCase('vi').replace(/\s+/g, ' ');
      if (words(key) < 8) continue;
      const earlier = seen.get(key);
      if (earlier && earlier !== block) {
        checks.push({
          id: `repeat-${key.slice(0, 20)}`,
          block,
          severity: 'info',
          message: `Câu “${short(sentence)}” lặp lại ở ${BLOCK_NAMES[earlier]} và ${BLOCK_NAMES[block]}.`,
        });
      }
      seen.set(key, block);
    }
  }
  return checks;
}

function mathFormatChecks(draft: AiLessonDraft): DraftCheck[] {
  const checks: DraftCheck[] = [];
  for (const block of Object.keys(BLOCK_NAMES) as AiDraftBlockType[]) {
    if (block === 'GRAPH') continue;
    const issues = findMathIssues(draft[block] ?? '');
    const problems = [
      issues.outsideMath.length && `lệnh ngoài $…$: ${issues.outsideMath.join(', ')}`,
      issues.unsupported.length && `lệnh chưa hiển thị được: ${issues.unsupported.join(', ')}`,
      issues.unbalancedDollar && 'thiếu dấu $ đóng công thức',
      issues.unbalancedBraces && 'dấu { } không khớp',
    ].filter(Boolean);
    if (problems.length) {
      checks.push({
        id: `math-format-${block}`,
        block,
        severity: 'warning',
        message: `${BLOCK_NAMES[block]}: ${problems.join('; ')}. Học sinh sẽ thấy ký hiệu thô.`,
      });
    }
  }
  return checks;
}

/** All checks for one draft, warnings first. */
export function reviewLessonDraft(
  draft: AiLessonDraft,
  options: { stage: LessonStage; subject: string }
): DraftCheck[] {
  const math = /toán/.test(options.subject.toLocaleLowerCase('vi'));
  const checks = [
    ...mathFormatChecks(draft),
    ...structureChecks(draft, options.stage, math),
    ...(math ? [...notationChecks(draft), ...exampleMathChecks(draft)] : []),
  ];
  return checks.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'warning' ? -1 : 1));
}
