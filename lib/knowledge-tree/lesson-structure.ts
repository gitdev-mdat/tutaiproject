/**
 * Turns the admin-authored article text into a teaching structure for the
 * student reader: short chunks, worked-example steps, mistake/fix pairs and,
 * for derivative-sign statements, a sign chart. Everything here is derived
 * from the saved blocks; when the text does not follow a pattern the reader
 * falls back to showing it as written.
 */

import type { KnowledgeArticleBlock } from './knowledge-tree-types';

const LIST_MARKER = /^\s*(?:[-*•+]|\d+[.)])\s+/;

export function blockText(blocks: KnowledgeArticleBlock[], type: KnowledgeArticleBlock['type']) {
  return blocks
    .filter((block) => block.type === type)
    .map((block) => block.content.trim())
    .filter(Boolean)
    .join('\n\n');
}

/** Non-empty lines with any list marker removed. */
export function listItems(content: string): string[] {
  return content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(LIST_MARKER, '').trim())
    .filter(Boolean);
}

/** About 130 words a minute for maths text, plus a minute per worked-example step group. */
export function estimateReadingMinutes(blocks: KnowledgeArticleBlock[]): number {
  const words = blocks
    .filter((block) => block.type !== 'TITLE' && block.type !== 'REFERENCES')
    .map(
      (block) =>
        block.content
          .replace(/\$[^$]*\$/g, ' công_thức ')
          .split(/\s+/)
          .filter(Boolean).length
    )
    .reduce((sum, count) => sum + count, 0);
  const example = parseWorkedExample(blockText(blocks, 'EXAMPLE'));
  const minutes = Math.round(words / 130) + (example ? Math.ceil(example.steps.length / 2) : 0);
  return Math.max(2, minutes);
}

/** The first objective, as a one-line promise of what the student will be able to do. */
export function learningPromise(blocks: KnowledgeArticleBlock[]): string | null {
  const first = listItems(blockText(blocks, 'OBJECTIVE'))[0];
  if (first) return first.replace(/[.;]\s*$/, '');
  const intro = blockText(blocks, 'INTRO');
  const sentence = intro.split(/(?<=[.!?])\s+/)[0]?.trim();
  return sentence || null;
}

export interface ContentChunk {
  title: string | null;
  body: string;
}

/**
 * Splits the main content at its own numbered headings ("1. Khái niệm:") so a
 * long section reads as a few short ideas. A heading is a numbered line that
 * ends with a colon, or a numbered line followed by more text in the same
 * paragraph. Content without such headings stays one chunk.
 */
export function splitIntoChunks(content: string): ContentChunk[] {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const heading = /^\s*(\d+)[.)]\s+(.+?)\s*:?\s*$/;
  const chunks: ContentChunk[] = [];
  let current: ContentChunk = { title: null, body: '' };
  const headingAt = (index: number) => {
    const match = heading.exec(lines[index]);
    if (!match) return null;
    const endsWithColon = /:\s*$/.test(lines[index]);
    const next = lines[index + 1]?.trim() ?? '';
    const nextIsSibling = heading.test(lines[index + 1] ?? '');
    return endsWithColon || (next && !nextIsSibling) ? match[2].replace(/:$/, '').trim() : null;
  };
  lines.forEach((line, index) => {
    const title = headingAt(index);
    if (title) {
      if (current.title || current.body.trim()) chunks.push(current);
      current = { title, body: '' };
    } else {
      current.body += (current.body ? '\n' : '') + line;
    }
  });
  if (current.title || current.body.trim()) chunks.push(current);
  const cleaned = chunks.map((chunk) => ({ ...chunk, body: chunk.body.trim() }));
  return cleaned.some((chunk) => chunk.title) ? cleaned : [{ title: null, body: content.trim() }];
}

export interface ExampleStep {
  label: string;
  body: string;
}

export interface WorkedExample {
  problem: string;
  intro: string;
  steps: ExampleStep[];
}

const STEP = /^\s*(?:[-*•]\s*)?(Bước\s*\d+)\s*[:.)]\s*(.*)$/i;

/**
 * Reads "Đề bài: … Lời giải: … Bước 1: …" examples. Returns null when the
 * example has no steps, so free-form examples keep their original layout.
 */
export function parseWorkedExample(content: string): WorkedExample | null {
  const text = content.replace(/\r\n?/g, '\n').trim();
  if (!text) return null;
  const lines = text.split('\n');
  const firstStep = lines.findIndex((line) => STEP.test(line));
  if (firstStep < 0) return null;

  const before = lines.slice(0, firstStep).join('\n');
  const solutionAt = before.search(/\bLời giải\s*:?/i);
  const problemText = (solutionAt >= 0 ? before.slice(0, solutionAt) : before)
    .replace(/^\s*(?:Đề bài|Ví dụ\s*\d*)\s*[:.]\s*/i, '')
    .trim();
  const intro =
    solutionAt >= 0
      ? before
          .slice(solutionAt)
          .replace(/^\s*Lời giải\s*:?\s*/i, '')
          .trim()
      : '';

  const steps: ExampleStep[] = [];
  for (const line of lines.slice(firstStep)) {
    const match = STEP.exec(line);
    if (match) {
      steps.push({ label: match[1].replace(/\s+/, ' '), body: match[2].trim() });
    } else if (steps.length) {
      const last = steps[steps.length - 1];
      last.body = last.body ? `${last.body}\n${line}` : line;
    }
  }
  for (const step of steps) step.body = step.body.trim();
  if (!problemText && steps.length < 2) return null;
  return { problem: problemText, intro, steps };
}

export interface MistakeItem {
  trap: string;
  fix: string | null;
}

/** "Lỗi … Cách tránh: …" lines become a trap and its fix. */
export function parseMistakes(content: string): MistakeItem[] {
  return listItems(content).map((item) => {
    const match = /^(.*?)(?:\.\s*|\s+)?(?:Cách tránh|Cách khắc phục|Khắc phục)\s*:\s*(.+)$/i.exec(
      item
    );
    return match ? { trap: match[1].trim(), fix: match[2].trim() } : { trap: item, fix: null };
  });
}

// ─── Sign chart ──────────────────────────────────────────────────────────────

export interface SignInterval {
  from: number;
  to: number;
  sign: '+' | '-';
}

export interface SignChart {
  /** The derivative as written, e.g. "y'" or "f'(x)". */
  derivative: string;
  /** Finite critical points in increasing order. */
  points: number[];
  intervals: SignInterval[];
}

const ENDPOINT = String.raw`([+-]?\s*\\infty|[+-]?\d+(?:[.,]\d+)?)`;
const INTERVAL = new RegExp(String.raw`[(\[]\s*${ENDPOINT}\s*[;,]\s*${ENDPOINT}\s*[)\]]`, 'g');
const SIGN_STATEMENT = /\$?\s*([a-zA-Z]'(?:\([a-z]\))?)\s*([<>])\s*0\s*\$?/;

function endpointValue(raw: string): number {
  const value = raw.replace(/\s+/g, '');
  if (value.endsWith('\\infty')) return value.startsWith('-') ? -Infinity : Infinity;
  return Number(value.replace(',', '.'));
}

/**
 * Finds lines such as "$y' > 0$ trên các khoảng $(-\infty; 0)$ và $(2; +\infty)$"
 * and, when the intervals cover the real line without gaps, returns the sign
 * of the derivative on each interval. Anything ambiguous returns null.
 */
export function extractSignChart(content: string): SignChart | null {
  const intervals: SignInterval[] = [];
  let derivative = '';
  for (const line of content.split('\n')) {
    const sign = SIGN_STATEMENT.exec(line);
    if (!sign) continue;
    const after = line.slice(sign.index + sign[0].length);
    if (!/trên|khi|với/i.test(after.slice(0, 40))) continue;
    INTERVAL.lastIndex = 0;
    for (const match of after.matchAll(INTERVAL)) {
      const from = endpointValue(match[1]);
      const to = endpointValue(match[2]);
      if (!(from < to) || Number.isNaN(from) || Number.isNaN(to)) return null;
      intervals.push({ from, to, sign: sign[2] === '>' ? '+' : '-' });
    }
    derivative ||= sign[1];
  }
  if (intervals.length < 2) return null;
  intervals.sort((a, b) => a.from - b.from);
  if (intervals[0].from !== -Infinity || intervals[intervals.length - 1].to !== Infinity) {
    return null;
  }
  for (let index = 1; index < intervals.length; index += 1) {
    if (intervals[index].from !== intervals[index - 1].to) return null;
  }
  return {
    derivative,
    points: intervals.slice(1).map((interval) => interval.from),
    intervals,
  };
}

// ─── Teaching flow ───────────────────────────────────────────────────────────

export type LessonFlowId =
  | 'khoi-dong'
  | 'muc-tieu'
  | 'kien-thuc'
  | 'vi-du'
  | 'tu-kiem-tra'
  | 'loi-hay-gap'
  | 'ghi-nho'
  | 'luyen-tap';

export interface LessonFlowStep {
  id: LessonFlowId;
  label: string;
}

/**
 * The lesson's rhythm, Hook → Explain → Show → Check → Practice → Recap,
 * limited to the steps this article actually has content for.
 */
export function lessonFlow(
  blocks: KnowledgeArticleBlock[],
  options: { practice: boolean }
): LessonFlowStep[] {
  const has = (type: KnowledgeArticleBlock['type']) => blockText(blocks, type).length > 0;
  const steps: Array<[LessonFlowId, string, boolean]> = [
    ['khoi-dong', 'Khởi động', has('INTRO')],
    ['muc-tieu', 'Mục tiêu', has('OBJECTIVE')],
    ['kien-thuc', 'Kiến thức chính', has('MAIN_CONTENT')],
    ['vi-du', 'Ví dụ mẫu', has('EXAMPLE')],
    ['tu-kiem-tra', 'Tự kiểm tra', has('OBJECTIVE')],
    ['loi-hay-gap', 'Lỗi hay gặp', has('COMMON_MISTAKE')],
    ['ghi-nho', 'Ghi nhớ', has('RECAP')],
    ['luyen-tap', 'Luyện tập', options.practice],
  ];
  return steps.filter(([, , present]) => present).map(([id, label]) => ({ id, label }));
}
