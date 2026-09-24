import 'server-only';

import { randomUUID } from 'crypto';
import type { QuestionCandidate } from './types';
import { recomputeMediaReadiness, hasRequiredVisualCue, normalizedRegion } from './media-readiness';
import type { ValidatedVisualDetection } from './visual-region-detection';

export interface ExtractedTextLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedDocumentPage {
  pageNumber: number;
  text: string;
  width?: number;
  height?: number;
  /** Server-only raster used to persist PDF pages as source evidence. */
  rasterPng?: Buffer;
  /** Reliable visual crops associated with questions on this page. */
  visualCrops?: Array<{
    id: string;
    bytes: Buffer;
    width: number;
    height: number;
    sourceRegion: { x: number; y: number; width: number; height: number };
  }>;
  textBounds?: { x: number; y: number; width: number; height: number };
  layoutLines?: ExtractedTextLine[];
  lowText: boolean;
}

export interface DocumentExtractionResult {
  pages: ExtractedDocumentPage[];
  candidates: QuestionCandidate[];
  warnings: string[];
}

export type DocumentPageTriage =
  'CONFIDENT' | 'LOW_TEXT' | 'NO_BOUNDARY' | 'NUMBERING_GAP' | 'SUSPECT_MATH';

export interface DocumentRecoveryPlan {
  pageNumbers: number[];
  triage: Map<number, DocumentPageTriage[]>;
}

interface QuestionBlock {
  number: number;
  text: string;
  pages: number[];
  sourceBounds?: { x: number; y: number; width: number; height: number };
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function normalizeAnswer(value: string): string {
  const answer = value.trim().toUpperCase();
  if (/^(TRUE|ĐÚNG|DUNG)$/.test(answer)) return 'TRUE';
  if (/^(FALSE|SAI)$/.test(answer)) return 'FALSE';
  return answer
    .split(/[,;\s]+/)
    .filter(Boolean)
    .join(',');
}

function mergeBounds(
  current: QuestionBlock['sourceBounds'],
  line: ExtractedTextLine
): NonNullable<QuestionBlock['sourceBounds']> {
  if (!current) return { x: line.x, y: line.y, width: line.width, height: line.height };
  const left = Math.min(current.x, line.x);
  const top = Math.min(current.y, line.y);
  const right = Math.max(current.x + current.width, line.x + line.width);
  const bottom = Math.max(current.y + current.height, line.y + line.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function lineFromItems(items: PositionedTextItem[], pageHeight: number): ExtractedTextLine {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let right = sorted[0]?.x ?? 0;
  let text = '';
  for (const item of sorted) {
    const gap = item.x - right;
    if (text && gap > Math.max(1, item.height * 0.18) && !text.endsWith(' ')) text += ' ';
    text += item.str;
    right = Math.max(right, item.x + item.width);
  }
  const left = Math.min(...sorted.map((item) => item.x));
  const pdfBottom = Math.min(...sorted.map((item) => item.y));
  const pdfTop = Math.max(...sorted.map((item) => item.y + item.height));
  return {
    text: normalizeWhitespace(text),
    x: left,
    y: Math.max(0, pageHeight - pdfTop),
    width: Math.max(0, right - left),
    height: Math.max(0, pdfTop - pdfBottom),
  };
}

function splitHorizontalSegments(
  items: PositionedTextItem[],
  pageWidth: number
): PositionedTextItem[][] {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const segments: PositionedTextItem[][] = [];
  let segment: PositionedTextItem[] = [];
  let right = 0;
  for (const item of sorted) {
    const gap = segment.length > 0 ? item.x - right : 0;
    if (segment.length > 0 && gap > Math.max(48, pageWidth * 0.12)) {
      segments.push(segment);
      segment = [];
    }
    segment.push(item);
    right = Math.max(item.x + item.width, segment.length === 1 ? item.x + item.width : right);
  }
  if (segment.length > 0) segments.push(segment);
  return segments;
}

function orderLinesByColumns(lines: ExtractedTextLine[], pageWidth: number): ExtractedTextLine[] {
  const vertical = (a: ExtractedTextLine, b: ExtractedTextLine) => a.y - b.y || a.x - b.x;
  if (lines.length < 4 || pageWidth <= 0) return [...lines].sort(vertical);

  const candidates = lines
    .filter((line) => line.width < pageWidth * 0.72)
    .map((line) => line.x)
    .sort((a, b) => a - b);
  let split = 0;
  let largestGap = 0;
  for (let index = 1; index < candidates.length; index += 1) {
    if (index < 2 || candidates.length - index < 2) continue;
    const gap = candidates[index] - candidates[index - 1];
    if (gap > largestGap) {
      largestGap = gap;
      split = (candidates[index] + candidates[index - 1]) / 2;
    }
  }
  if (largestGap < Math.max(48, pageWidth * 0.14)) return [...lines].sort(vertical);

  const spanning = lines.filter((line) => line.width >= pageWidth * 0.72);
  const columnLines = lines.filter((line) => line.width < pageWidth * 0.72);
  const left = columnLines.filter((line) => line.x <= split).sort(vertical);
  const right = columnLines.filter((line) => line.x > split).sort(vertical);
  if (left.length < 2 || right.length < 2) return [...lines].sort(vertical);

  const firstColumnY = Math.min(left[0].y, right[0].y);
  const before = spanning.filter((line) => line.y <= firstColumnY).sort(vertical);
  const after = spanning.filter((line) => line.y > firstColumnY).sort(vertical);
  return [...before, ...left, ...right, ...after];
}

/** Reconstructs horizontal lines and reads stable two-column layouts left-to-right. */
export function reconstructPositionedText(
  items: PositionedTextItem[],
  pageWidth: number,
  pageHeight: number
): { text: string; lines: ExtractedTextLine[] } {
  const usable = items.filter((item) => item.str.trim() && Number.isFinite(item.x + item.y));
  if (usable.length === 0) return { text: '', lines: [] };
  const medianHeight = [...usable].sort((a, b) => a.height - b.height)[
    Math.floor(usable.length / 2)
  ].height;
  const tolerance = Math.max(2, Math.min(6, medianHeight * 0.5));
  const rows: Array<{ baseline: number; items: PositionedTextItem[] }> = [];
  for (const item of [...usable].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((candidate) => Math.abs(candidate.baseline - item.y) <= tolerance);
    if (row) {
      row.items.push(item);
      row.baseline = row.items.reduce((sum, entry) => sum + entry.y, 0) / row.items.length;
    } else {
      rows.push({ baseline: item.y, items: [item] });
    }
  }
  const lines = orderLinesByColumns(
    rows
      .flatMap((row) => splitHorizontalSegments(row.items, pageWidth))
      .map((segment) => lineFromItems(segment, pageHeight))
      .filter((line) => line.text),
    pageWidth
  );
  return { text: lines.map((line) => line.text).join('\n'), lines };
}

function pageLines(page: ExtractedDocumentPage): ExtractedTextLine[] {
  if (page.layoutLines?.length) return page.layoutLines;
  return page.text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(normalizeWhitespace)
    .filter(Boolean)
    .map((text) => ({ text, x: 0, y: 0, width: 0, height: 0 }));
}

function questionBoundary(line: string): { number: number; remainder: string } | null {
  const match = line.match(/^\s*(?:câu|bài|question)\s+(\d+)\s*[.:)]\s*(.*)$/iu);
  if (!match) return null;
  return { number: Number(match[1]), remainder: normalizeWhitespace(match[2]) };
}

function answerKeyHeading(line: string): string | null {
  const table = line.match(/^\s*(?:bảng\s+đáp\s+án|answer\s+key)\s*[:\-]?\s*(.*)$/iu);
  if (table) return table[1] ?? '';
  const generic = line.match(/^\s*đáp\s+án\s*[:\-]?\s*(.*)$/iu);
  if (!generic) return null;
  const remainder = generic[1]?.trim() ?? '';
  return !remainder || /\b\d{1,3}\s*[.\-:)]\s*[A-E]\b/i.test(remainder) ? remainder : null;
}

function parseBoundedAnswerKey(lines: string[]): Map<number, string> {
  const bounded = lines.join('\n').slice(0, 12_000);
  const answers = new Map<number, string>();
  const tokenPattern = /(?:^|[\s,;|])([1-9]\d{0,2})\s*[.\-:)]\s*([A-E])\b/giu;
  for (const match of bounded.matchAll(tokenPattern)) {
    const number = Number(match[1]);
    if (!answers.has(number) && answers.size < 500) answers.set(number, match[2].toUpperCase());
  }
  return answers;
}

function blocksFromPages(pages: ExtractedDocumentPage[]): {
  blocks: QuestionBlock[];
  answerKey: Map<number, string>;
} {
  const blocks: QuestionBlock[] = [];
  const answerKeyLines: string[] = [];
  let current: QuestionBlock | null = null;
  let inAnswerKey = false;

  const finishCurrent = () => {
    if (!current) return;
    current.text = current.text.trim();
    blocks.push(current);
    current = null;
  };

  for (const page of [...pages].sort((a, b) => a.pageNumber - b.pageNumber)) {
    for (const line of pageLines(page)) {
      const boundary = questionBoundary(line.text);
      const answerHeading = answerKeyHeading(line.text);
      if (!inAnswerKey && answerHeading !== null && (current !== null || blocks.length > 0)) {
        finishCurrent();
        inAnswerKey = true;
        if (answerHeading) answerKeyLines.push(answerHeading);
        continue;
      }
      if (inAnswerKey) {
        answerKeyLines.push(line.text);
        continue;
      }
      if (boundary) {
        finishCurrent();
        current = {
          number: boundary.number,
          text: boundary.remainder,
          pages: [page.pageNumber],
          sourceBounds:
            line.width > 0 || line.height > 0 ? mergeBounds(undefined, line) : undefined,
        };
        continue;
      }
      // Cover pages, instructions and headers before the first explicit question are excluded.
      if (!current) continue;
      current.text += `${current.text ? '\n' : ''}${line.text}`;
      if (!current.pages.includes(page.pageNumber)) current.pages.push(page.pageNumber);
      if (current.pages[0] === page.pageNumber && (line.width > 0 || line.height > 0)) {
        current.sourceBounds = mergeBounds(current.sourceBounds, line);
      }
    }
  }
  finishCurrent();
  return { blocks, answerKey: parseBoundedAnswerKey(answerKeyLines) };
}

function inlineAnswer(text: string): string {
  const declaration = text.match(
    /(?:^|\n)\s*(?:đáp\s*án|answer|correct\s*answer)\s*[:\-]\s*(?:chọn\s+)?([A-E]|TRUE|FALSE|ĐÚNG|SAI)\b/iu
  );
  if (declaration) return normalizeAnswer(declaration[1]);
  const solutionChoice = text.match(/(?:^|\n)\s*lời\s*giải\b[\s\S]{0,600}?\bchọn\s+([A-E])\b/iu);
  return normalizeAnswer(solutionChoice?.[1] ?? '');
}

function extractOptions(text: string): {
  options: Array<{ key: string; content: string }>;
  firstOptionIndex: number;
} {
  const markers = [...text.matchAll(/(^|\n|[ \t])([A-E])\s*[.)]\s+/gm)];
  const options: Array<{ key: string; content: string }> = [];
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    const start = (marker.index ?? 0) + marker[0].length;
    const end = markers[index + 1]?.index ?? text.length;
    const content = text
      .slice(start, end)
      .split(/(?:^|\n)\s*(?:đáp\s*án|answer|correct\s*answer|lời\s*giải)\b/iu)[0]
      .trim();
    const key = marker[2].toUpperCase();
    if (content && !options.some((option) => option.key === key)) options.push({ key, content });
  }
  return { options, firstOptionIndex: markers[0]?.index ?? text.length };
}

function candidateFromBlock(
  block: QuestionBlock,
  answerKey: Map<number, string>
): QuestionCandidate {
  const extracted = extractOptions(block.text);
  const detectedAnswer = inlineAnswer(block.text) || answerKey.get(block.number) || '';
  const optionKeys = new Set(extracted.options.map((option) => option.key));
  const answerTokens = normalizeAnswer(detectedAnswer).split(',').filter(Boolean);
  const usesOptionTokens =
    answerTokens.length > 0 && answerTokens.every((token) => /^[A-E]$/.test(token));
  const answerMatchesOptions = usesOptionTokens
    ? extracted.options.length >= 2 && answerTokens.every((token) => optionKeys.has(token))
    : true;
  const correctAnswer = answerMatchesOptions ? normalizeAnswer(detectedAnswer) : '';
  const stem = block.text
    .slice(0, extracted.firstOptionIndex)
    .split(/(?:^|\n)\s*(?:đáp\s*án|answer|correct\s*answer|lời\s*giải)\b/iu)[0]
    .trim();
  const explanationMatch = block.text.match(/(?:^|\n)\s*lời\s*giải\s*[:\-]?\s*([\s\S]*)$/iu);
  const explanation = explanationMatch?.[1]
    ?.replace(/(?:^|\n)\s*(?:đáp\s*án|answer|correct\s*answer)\s*[:\-].*$/giu, '')
    .trim();
  const questionType =
    extracted.options.length >= 2
      ? answerTokens.length > 1
        ? 'MULTIPLE_CHOICE_MULTIPLE'
        : 'MULTIPLE_CHOICE_SINGLE'
      : correctAnswer === 'TRUE' || correctAnswer === 'FALSE'
        ? 'TRUE_FALSE'
        : correctAnswer && Number.isFinite(Number(correctAnswer.replace(',', '.')))
          ? 'NUMERIC'
          : 'SHORT_ANSWER';
  const warnings: QuestionCandidate['warnings'] = [];
  if (!correctAnswer) {
    warnings.push({
      id: randomUUID(),
      code: 'MISSING_ANSWER',
      message: detectedAnswer
        ? `Đáp án phát hiện "${detectedAnswer}" không khớp với các phương án đã tách.`
        : 'Chưa tìm thấy đáp án trong tài liệu.',
      actions: ['EDIT', 'NO_ANSWER', 'SKIP'],
    });
  }
  if (
    /\$|\\frac|√|∫|∑|\^\{|_\{|bảng\s+biến\s+thiên|bảng\s+xét\s+dấu|đồ\s+thị|hình\s+vẽ/iu.test(
      block.text
    )
  ) {
    warnings.push({
      id: randomUUID(),
      code: 'SUSPECT_MATH',
      message: 'Phát hiện công thức toán hoặc cấu trúc trực quan cần đối chiếu với tài liệu gốc.',
      actions: ['EDIT', 'RESELECT_REGION'],
    });
  }
  const validationErrors: NonNullable<QuestionCandidate['validationErrors']> = [];
  if (!stem) {
    validationErrors.push({
      code: 'MISSING_STEM',
      message: 'Nội dung câu hỏi không được để trống.',
      field: 'content',
    });
  }
  if (extracted.options.length === 1 || (usesOptionTokens && extracted.options.length < 2)) {
    validationErrors.push({
      code: 'TOO_FEW_OPTIONS',
      message: 'Cần ít nhất 2 phương án lựa chọn.',
      field: 'options',
    });
  }
  if (!correctAnswer) {
    validationErrors.push({
      code: 'MISSING_ANSWER',
      message: 'Cần có đáp án đúng trước khi lưu.',
      field: 'correctAnswer',
    });
  }
  const reviewLevel =
    validationErrors.length > 0
      ? 'BLOCKING'
      : warnings.some((warning) => warning.code === 'SUSPECT_MATH')
        ? 'REVIEW'
        : 'READY';
  return {
    id: randomUUID(),
    number: block.number,
    sourcePageIds: [],
    sourcePages: block.pages,
    sourceBounds: block.sourceBounds,
    questionType,
    content: stem,
    options: extracted.options,
    statements: [],
    correctAnswer,
    detectedSelectedAnswer: '',
    explanation: explanation ?? '',
    sharedContext: '',
    questionAssetDescription: '',
    chapter: '',
    lesson: '',
    concept: '',
    difficulty: 'INTERMEDIATE',
    status: warnings.length > 0 ? 'WARNING' : 'UNREVIEWED',
    fieldConfidence: {
      content: stem ? 'HIGH' : 'UNCERTAIN',
      options:
        extracted.options.length >= 2 || extracted.options.length === 0 ? 'HIGH' : 'UNCERTAIN',
      answer: correctAnswer ? 'HIGH' : 'UNCERTAIN',
      asset: warnings.some((warning) => warning.code === 'SUSPECT_MATH') ? 'REVIEW' : 'HIGH',
      classification: 'UNCERTAIN',
    },
    warnings,
    updatedAt: new Date().toISOString(),
    reviewLevel,
    validationErrors,
  };
}

export function candidatesFromDocumentPages(pages: ExtractedDocumentPage[]): QuestionCandidate[] {
  const { blocks, answerKey } = blocksFromPages(pages);
  return blocks.map((block) => {
    const candidate = recomputeMediaReadiness(candidateFromBlock(block, answerKey));
    const sourcePage = pages.find((page) => page.pageNumber === block.pages[0]);
    return { ...candidate, sourceBounds: block.sourceBounds ?? sourcePage?.textBounds };
  });
}

export function planDocumentRecovery(
  pages: ExtractedDocumentPage[],
  candidates: QuestionCandidate[]
): DocumentRecoveryPlan {
  const triage = new Map<number, Set<DocumentPageTriage>>();
  const add = (pageNumber: number, reason: DocumentPageTriage) => {
    const reasons = triage.get(pageNumber) ?? new Set<DocumentPageTriage>();
    if (reason !== 'CONFIDENT') reasons.add(reason);
    triage.set(pageNumber, reasons);
  };
  const candidatePages = new Set(candidates.flatMap((candidate) => candidate.sourcePages ?? []));
  const sortedCandidates = [...candidates].sort((a, b) => a.number - b.number);

  for (const page of pages) {
    const lines = pageLines(page);
    const hasBoundary = lines.some((line) => questionBoundary(line.text) !== null);
    const hasAnswerKey = lines.some((line) => answerKeyHeading(line.text) !== null);
    const hasSuspectMath =
      /\$|\\\\(?:frac|sqrt|int|sum)|√|∫|∑|\^\{|_\{|bảng\s+(?:biến\s+thiên|xét\s+dấu)|đồ\s+thị|hình\s+vẽ/iu.test(
        page.text
      );
    if (page.lowText) add(page.pageNumber, 'LOW_TEXT');
    if (
      !page.lowText &&
      page.text.trim() &&
      !hasBoundary &&
      !hasAnswerKey &&
      !candidatePages.has(page.pageNumber)
    ) {
      add(page.pageNumber, 'NO_BOUNDARY');
    }
    if (hasSuspectMath && candidatePages.has(page.pageNumber)) add(page.pageNumber, 'SUSPECT_MATH');
  }

  for (let index = 1; index < sortedCandidates.length; index += 1) {
    const previous = sortedCandidates[index - 1];
    const current = sortedCandidates[index];
    if (current.number > previous.number + 1) {
      for (const pageNumber of current.sourcePages ?? []) add(pageNumber, 'NUMBERING_GAP');
    }
  }

  const normalized = new Map<number, DocumentPageTriage[]>();
  for (const page of pages) {
    const reasons = [...(triage.get(page.pageNumber) ?? [])];
    normalized.set(page.pageNumber, reasons.length > 0 ? reasons : ['CONFIDENT']);
  }
  return {
    pageNumbers: pages
      .filter((page) =>
        (normalized.get(page.pageNumber) ?? []).some((reason) => reason !== 'CONFIDENT')
      )
      .map((page) => page.pageNumber),
    triage: normalized,
  };
}

interface ResolvedPageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function isValidPageBounds(
  bounds: ResolvedPageBounds,
  pageWidth: number,
  pageHeight: number
): boolean {
  return (
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    bounds.width > 0 &&
    bounds.height > 0 &&
    bounds.x >= 0 &&
    bounds.y >= 0 &&
    bounds.x + bounds.width <= pageWidth + 1 &&
    bounds.y + bounds.height <= pageHeight + 1
  );
}

/**
 * Deterministic extraction stores sourceBounds in PDF points, while visual recovery may
 * return percentage-like 0..100 bounds. Resolve either shape into page-space points.
 */
function resolveCandidatePageBounds(
  candidate: QuestionCandidate,
  pageWidth: number,
  pageHeight: number
): ResolvedPageBounds | undefined {
  const bounds = candidate.sourceBounds;
  if (!bounds) return undefined;

  const pointBounds: ResolvedPageBounds = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };

  const looksLikePercentage =
    bounds.x >= 0 &&
    bounds.y >= 0 &&
    bounds.width > 0 &&
    bounds.height > 0 &&
    bounds.x <= 100 &&
    bounds.y <= 100 &&
    bounds.width <= 100 &&
    bounds.height <= 100 &&
    bounds.x + bounds.width <= 100.5 &&
    bounds.y + bounds.height <= 100.5;

  const percentageBounds: ResolvedPageBounds | undefined = looksLikePercentage
    ? {
        x: (bounds.x / 100) * pageWidth,
        y: (bounds.y / 100) * pageHeight,
        width: (bounds.width / 100) * pageWidth,
        height: (bounds.height / 100) * pageHeight,
      }
    : undefined;

  const pointIsValid = isValidPageBounds(pointBounds, pageWidth, pageHeight);
  const percentageIsValid =
    percentageBounds !== undefined && isValidPageBounds(percentageBounds, pageWidth, pageHeight);

  if (!pointIsValid) return percentageIsValid ? percentageBounds : undefined;
  if (!percentageIsValid) return pointBounds;

  // A recovered percentage box such as { x: 8.5, width: 83 } is far too narrow when
  // interpreted as PDF points. Prefer the percentage interpretation in that case.
  const pointWidthRatio = pointBounds.width / pageWidth;
  const percentageWidthRatio = percentageBounds.width / pageWidth;
  const pointHeightRatio = pointBounds.height / pageHeight;
  const percentageHeightRatio = percentageBounds.height / pageHeight;

  if (
    (pointWidthRatio < 0.18 && percentageWidthRatio >= 0.18) ||
    (pointHeightRatio < 0.025 && percentageHeightRatio >= 0.025)
  ) {
    return percentageBounds;
  }

  return pointBounds;
}

function comparableText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('vi')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[$`*_{}[\]|<>]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(
    comparableText(left)
      .split(' ')
      .filter((token) => token.length > 1)
  );
  const rightTokens = new Set(
    comparableText(right)
      .split(' ')
      .filter((token) => token.length > 1)
  );
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  return overlap / Math.min(leftTokens.size, rightTokens.size);
}

function isRecoveredVisualRepresentationLine(line: string): boolean {
  const value = line.trim();
  if (!value) return false;

  return (
    /^\|.*\|$/.test(value) ||
    /^\|?\s*:?-{3,}:?(?:\s*\|\s*:?-{3,}:?)+\s*\|?$/.test(value) ||
    /^\[(?:hình|image|figure|bảng|đồ\s*thị|diagram)[^\]]*\]$/iu.test(value)
  );
}

const RECOVERED_VISUAL_LATEX_ENVIRONMENTS = new Set([
  'array',
  'matrix',
  'pmatrix',
  'bmatrix',
  'Bmatrix',
  'vmatrix',
  'Vmatrix',
  'cases',
  'tabular',
  'tikzpicture',
]);

function latexVisualEnvironmentStart(line: string): string | undefined {
  const match = line.trim().match(/^\\begin\{([^}]+)\}/);
  const environment = match?.[1];
  return environment && RECOVERED_VISUAL_LATEX_ENVIRONMENTS.has(environment)
    ? environment
    : undefined;
}

function stripLeadingRecoveredVisualSerialization(lines: string[]): string[] {
  let index = 0;

  const skipBlankLines = () => {
    while (index < lines.length && !lines[index].trim()) index += 1;
  };

  skipBlankLines();

  let removedVisual = false;

  while (index < lines.length) {
    const environment = latexVisualEnvironmentStart(lines[index]);

    if (environment) {
      removedVisual = true;
      index += 1;

      while (index < lines.length) {
        const value = lines[index];
        index += 1;
        if (value.includes(`\\end{${environment}}`)) break;
      }

      skipBlankLines();
      continue;
    }

    if (isRecoveredVisualRepresentationLine(lines[index])) {
      removedVisual = true;
      index += 1;
      skipBlankLines();
      continue;
    }

    break;
  }

  return removedVisual ? lines.slice(index) : lines;
}

function splitContentAroundVisualCue(content: string): {
  introduction: string;
  remainder: string;
  cueLine: string;
} {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const cueIndex = lines.findIndex((line) => hasRequiredVisualCue(line));

  if (cueIndex < 0) {
    return { introduction: content.trim(), remainder: '', cueLine: '' };
  }

  const introduction = lines
    .slice(0, cueIndex + 1)
    .join('\n')
    .trim();
  const cueLine = lines[cueIndex].trim();
  const afterCue = stripLeadingRecoveredVisualSerialization(lines.slice(cueIndex + 1));

  return {
    introduction,
    remainder: afterCue.join('\n').trim(),
    cueLine,
  };
}

function lineOverlapsBoundsVertically(
  line: ExtractedTextLine,
  bounds: ResolvedPageBounds,
  padding = 8
): boolean {
  const lineBottom = line.y + line.height;
  const boundsBottom = bounds.y + bounds.height;
  return lineBottom >= bounds.y - padding && line.y <= boundsBottom + padding;
}

function lineOverlapsBoundsHorizontally(
  line: ExtractedTextLine,
  bounds: ResolvedPageBounds,
  padding = 12
): boolean {
  const lineRight = line.x + line.width;
  const boundsRight = bounds.x + bounds.width;
  return lineRight >= bounds.x - padding && line.x <= boundsRight + padding;
}

function findCandidateCueLine(
  lines: ExtractedTextLine[],
  cueText: string,
  bounds?: ResolvedPageBounds
): { line: ExtractedTextLine; index: number } | undefined {
  const normalizedCue = comparableText(cueText);
  if (!normalizedCue) return undefined;

  const verticalPadding = bounds ? Math.max(12, bounds.height * 0.15) : 0;
  const horizontalPadding = bounds ? Math.max(16, bounds.width * 0.08) : 0;

  const scored = lines
    .map((line, index) => {
      const normalizedLine = comparableText(line.text);
      const similarity = tokenSimilarity(line.text, cueText);
      const containsCue =
        normalizedLine.includes(normalizedCue) || normalizedCue.includes(normalizedLine);
      const hasCue = hasRequiredVisualCue(line.text);

      if (!containsCue && !hasCue && similarity < 0.45) return null;

      const insideBounds =
        !bounds ||
        (lineOverlapsBoundsVertically(line, bounds, verticalPadding) &&
          lineOverlapsBoundsHorizontally(line, bounds, horizontalPadding));

      const positionScore = bounds
        ? Math.max(0, 1 - Math.abs(line.y - bounds.y) / Math.max(bounds.height, 1))
        : 0;

      const score =
        similarity * 4 +
        (containsCue ? 2 : 0) +
        (hasCue ? 1 : 0) +
        (insideBounds ? 1 : 0) +
        positionScore;

      return { line, index, score, insideBounds };
    })
    .filter(
      (
        value
      ): value is {
        line: ExtractedTextLine;
        index: number;
        score: number;
        insideBounds: boolean;
      } => Boolean(value)
    );

  if (scored.length === 0) return undefined;

  const scoped = bounds ? scored.filter((item) => item.insideBounds) : scored;
  const candidates = scoped.length > 0 ? scoped : scored;
  candidates.sort((left, right) => right.score - left.score || left.line.y - right.line.y);

  return candidates[0];
}

function isLikelyContinuationText(line: ExtractedTextLine): boolean {
  const normalized = comparableText(line.text);
  if (!normalized) return false;

  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length >= 4) return true;

  return /[?.:;]$/.test(line.text.trim());
}

function findContinuationLine(
  lines: ExtractedTextLine[],
  cue: ExtractedTextLine,
  remainder: string,
  bounds?: ResolvedPageBounds
): ExtractedTextLine | undefined {
  const remainderLines = stripLeadingRecoveredVisualSerialization(
    remainder
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.trim())
  ).filter(Boolean);

  /*
   * sourceBounds from visual recovery is a hint, not a hard crop box.
   * A recovered question may span pages or the model may stop its box
   * before the sentence that follows a table/graph. Restricting Y to the
   * recovered box is therefore too aggressive.
   *
   * We only use the horizontal bounds as a soft column constraint and
   * search the whole remainder of the physical page vertically.
   */
  const horizontalSlack = bounds ? Math.max(24, bounds.width * 0.12) : 0;

  const afterCue = lines
    .filter((line) => line !== cue && line.y > cue.y + cue.height + 3)
    .filter((line) => !bounds || lineOverlapsBoundsHorizontally(line, bounds, horizontalSlack))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  let best:
    | {
        line: ExtractedTextLine;
        score: number;
      }
    | undefined;

  for (const expected of remainderLines.slice(0, 4)) {
    for (const line of afterCue) {
      const similarity = tokenSimilarity(line.text, expected);
      if (similarity < 0.3) continue;

      const insideVerticalHint =
        bounds && lineOverlapsBoundsVertically(line, bounds, Math.max(24, bounds.height * 0.35));
      const distance = Math.max(0, line.y - (cue.y + cue.height));
      const distancePenalty = Math.min(0.12, distance / 2400);
      const score = similarity + (insideVerticalHint ? 0.03 : 0) - distancePenalty;

      if (!best || score > best.score || (score === best.score && line.y < best.line.y)) {
        best = { line, score };
      }
    }
  }

  if (best) return best.line;

  /*
   * Conservative geometry fallback. Text inside a variation/sign table
   * (x, f'(x), numbers, +/-) must not be mistaken for continuation text.
   */
  const minimumGap = Math.max(18, (bounds?.height ?? 0) * 0.05);
  let previousBottom = cue.y + cue.height;

  for (const line of afterCue) {
    const gap = line.y - previousBottom;

    if (gap >= minimumGap && isLikelyContinuationText(line)) {
      return line;
    }

    previousBottom = Math.max(previousBottom, line.y + line.height);
  }

  return undefined;
}

interface LocatedCue {
  page: ExtractedDocumentPage;
  line: ExtractedTextLine;
  bounds?: ResolvedPageBounds;
  score: number;
}

function candidatePagesInOrder(
  pages: ExtractedDocumentPage[],
  candidate: QuestionCandidate
): ExtractedDocumentPage[] {
  const requested = candidate.sourcePages ?? [];
  if (requested.length === 0) return [];

  const byNumber = new Map(pages.map((page) => [page.pageNumber, page]));
  return requested.flatMap((pageNumber) => {
    const page = byNumber.get(pageNumber);
    return page ? [page] : [];
  });
}

function findCueAcrossCandidatePages(
  pages: ExtractedDocumentPage[],
  candidate: QuestionCandidate,
  cueLine: string
): LocatedCue | undefined {
  const candidatePages = candidatePagesInOrder(pages, candidate);
  let best: LocatedCue | undefined;

  for (let pageIndex = 0; pageIndex < candidatePages.length; pageIndex += 1) {
    const page = candidatePages[pageIndex];
    if (!page.width || !page.height) continue;

    /* sourceBounds currently has no page discriminator. Treat it as a
     * first-page hint only; applying it to page 2+ can reject a valid cue. */
    const bounds =
      pageIndex === 0 ? resolveCandidatePageBounds(candidate, page.width, page.height) : undefined;
    const match = findCandidateCueLine(page.layoutLines ?? [], cueLine, bounds);
    if (!match) continue;

    const similarity = tokenSimilarity(match.line.text, cueLine);
    const pagePriority = pageIndex === 0 ? 0.08 : 0;
    const score = similarity + pagePriority;

    if (!best || score > best.score) {
      best = { page, line: match.line, bounds, score };
    }
  }

  return best;
}

function visualAltText(content: string, questionNumber: number): string {
  if (/bảng\s+biến\s+thiên/iu.test(content)) {
    return `Bảng biến thiên của câu ${questionNumber}`;
  }
  if (/bảng\s+xét\s+dấu/iu.test(content)) {
    return `Bảng xét dấu của câu ${questionNumber}`;
  }
  if (/đồ\s*thị/iu.test(content)) {
    return `Đồ thị hàm số của câu ${questionNumber}`;
  }
  if (/biểu\s*đồ/iu.test(content)) {
    return `Biểu đồ của câu ${questionNumber}`;
  }
  return `Hình minh họa câu ${questionNumber}`;
}

function candidateHasAttachedImage(candidate: QuestionCandidate): boolean {
  return Boolean(
    candidate.orderedContent?.some((block) => block.type === 'IMAGE') ||
    candidate.mediaCandidates?.length
  );
}

function withoutRecoveredVisualPlaceholders(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => !isRecoveredVisualRepresentationLine(line))
    .join('\n')
    .trim();
}

async function attachVisualCrop(
  sourcePage: ExtractedDocumentPage,
  candidate: QuestionCandidate,
  sourceRegion: { x: number; y: number; width: number; height: number },
  canvasModule: typeof import('@napi-rs/canvas')
): Promise<boolean> {
  if (!sourcePage.rasterPng || candidateHasAttachedImage(candidate)) return false;
  const region = normalizedRegion(sourceRegion);
  if (region.width <= 0 || region.height <= 0) return false;

  const raster = await canvasModule.loadImage(sourcePage.rasterPng);
  const sourceX = Math.max(0, Math.floor(region.x * raster.width));
  const sourceY = Math.max(0, Math.floor(region.y * raster.height));
  const cropWidth = Math.max(
    1,
    Math.min(raster.width - sourceX, Math.ceil(region.width * raster.width))
  );
  const cropHeight = Math.max(
    1,
    Math.min(raster.height - sourceY, Math.ceil(region.height * raster.height))
  );
  const crop = canvasModule.createCanvas(cropWidth, cropHeight);
  crop
    .getContext('2d')
    .drawImage(raster, sourceX, sourceY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  const id = randomUUID();
  const alt = visualAltText(candidate.content, candidate.number);
  sourcePage.visualCrops ??= [];
  sourcePage.visualCrops.push({
    id,
    bytes: crop.toBuffer('image/png'),
    width: cropWidth,
    height: cropHeight,
    sourceRegion: region,
  });

  const { introduction, remainder } = splitContentAroundVisualCue(candidate.content);
  const before = withoutRecoveredVisualPlaceholders(introduction);
  const after = withoutRecoveredVisualPlaceholders(remainder);
  candidate.sourcePageIds = [id];
  candidate.mediaCandidates = [
    {
      id,
      alt,
      sourcePage: sourcePage.pageNumber,
      sourceRegion: region,
      confidence: 'HIGH',
    },
  ];
  candidate.orderedContent = [
    ...(before ? [{ id: `text-before-${candidate.id}`, type: 'TEXT' as const, text: before }] : []),
    {
      id: `image-${id}`,
      type: 'IMAGE' as const,
      media: {
        assetId: id,
        alt,
        sourcePage: sourcePage.pageNumber,
        sourceRegion: region,
      },
    },
    ...(after ? [{ id: `text-after-${candidate.id}`, type: 'TEXT' as const, text: after }] : []),
  ];
  Object.assign(candidate, recomputeMediaReadiness(candidate));
  return true;
}

/**
 * Attach real source-PDF visual crops to final candidates.
 *
 * Important: call this only after deterministic extraction and visual recovery
 * have been reconciled. This function is idempotent for candidates that already
 * contain media.
 */
export async function enrichPdfCandidatesWithMedia(
  pages: ExtractedDocumentPage[],
  candidates: QuestionCandidate[]
): Promise<QuestionCandidate[]> {
  let canvasModule: typeof import('@napi-rs/canvas') | undefined;

  for (const candidate of candidates) {
    if (candidateHasAttachedImage(candidate)) {
      Object.assign(candidate, recomputeMediaReadiness(candidate));
      continue;
    }

    if (!hasRequiredVisualCue(candidate.content)) {
      Object.assign(candidate, recomputeMediaReadiness(candidate));
      continue;
    }

    const { remainder, cueLine } = splitContentAroundVisualCue(candidate.content);
    const cueLocation = findCueAcrossCandidatePages(pages, candidate, cueLine);

    if (!cueLocation) {
      Object.assign(candidate, recomputeMediaReadiness(candidate));
      continue;
    }

    const sourcePage = cueLocation.page;
    if (!sourcePage.rasterPng || !sourcePage.width || !sourcePage.height) {
      Object.assign(candidate, recomputeMediaReadiness(candidate));
      continue;
    }
    const pageWidth = sourcePage.width;
    const pageHeight = sourcePage.height;
    const lines = sourcePage.layoutLines ?? [];
    const candidateBounds = cueLocation.bounds;
    const cueLineOnPage = cueLocation.line;

    const continuation = findContinuationLine(lines, cueLineOnPage, remainder, candidateBounds);

    if (!continuation) {
      Object.assign(candidate, recomputeMediaReadiness(candidate));
      continue;
    }

    const verticalPadding = Math.max(3, pageHeight * 0.004);
    const top = Math.max(0, cueLineOnPage.y + cueLineOnPage.height + verticalPadding);
    const bottom = Math.min(pageHeight, continuation.y - verticalPadding);
    const height = bottom - top;
    const minHeight = Math.max(24, pageHeight * 0.03);

    if (height < minHeight) {
      Object.assign(candidate, recomputeMediaReadiness(candidate));
      continue;
    }

    const fallbackLeft = sourcePage.textBounds?.x ?? 0;
    const fallbackRight = sourcePage.textBounds
      ? sourcePage.textBounds.x + sourcePage.textBounds.width
      : pageWidth;

    const horizontalPadding = Math.max(4, pageWidth * 0.008);
    const rawLeft = candidateBounds?.x ?? fallbackLeft;
    const rawRight = candidateBounds ? candidateBounds.x + candidateBounds.width : fallbackRight;
    const left = Math.max(0, rawLeft - horizontalPadding);
    const right = Math.min(pageWidth, rawRight + horizontalPadding);
    const width = right - left;

    if (width < pageWidth * 0.2) {
      Object.assign(candidate, recomputeMediaReadiness(candidate));
      continue;
    }

    const sourceRegion = normalizedRegion({
      x: left / pageWidth,
      y: top / pageHeight,
      width: width / pageWidth,
      height: height / pageHeight,
    });

    canvasModule ??= await import('@napi-rs/canvas');
    await attachVisualCrop(sourcePage, candidate, sourceRegion, canvasModule);
  }

  return candidates;
}

/** Deterministically crops and attaches only validated high-confidence Vision regions. */
export async function attachDetectedQuestionVisuals(
  pages: ExtractedDocumentPage[],
  candidates: QuestionCandidate[],
  detections: ValidatedVisualDetection[]
): Promise<QuestionCandidate[]> {
  const pagesByNumber = new Map(pages.map((page) => [page.pageNumber, page]));
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  let canvasModule: typeof import('@napi-rs/canvas') | undefined;

  for (const detection of detections) {
    if (
      detection.decision !== 'AUTO_ATTACH' ||
      detection.pageNumber === undefined ||
      !detection.sourceRegion
    ) {
      continue;
    }
    const candidate = candidatesById.get(detection.candidateId);
    const sourcePage = pagesByNumber.get(detection.pageNumber);
    if (!candidate || !sourcePage?.rasterPng || candidate.number !== detection.questionNumber)
      continue;
    canvasModule ??= await import('@napi-rs/canvas');
    await attachVisualCrop(sourcePage, candidate, detection.sourceRegion, canvasModule);
  }

  return candidates.map((candidate) => recomputeMediaReadiness(candidate));
}

export async function extractPdfDeterministically(
  bytes: Buffer
): Promise<DocumentExtractionResult> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { createCanvas } = await import('@napi-rs/canvas');
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true })
    .promise;
  const pages: ExtractedDocumentPage[] = [];
  const warnings: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const rasterViewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(
      Math.max(1, Math.ceil(rasterViewport.width)),
      Math.max(1, Math.ceil(rasterViewport.height))
    );

    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: canvas.getContext('2d') as unknown as CanvasRenderingContext2D,
      viewport: rasterViewport,
    }).promise;

    const rasterPng = canvas.toBuffer('image/png');
    const content = await page.getTextContent();
    const positionedItems: PositionedTextItem[] = content.items.flatMap((rawItem) => {
      const item = rawItem as {
        str?: string;
        transform?: number[];
        width?: number;
        height?: number;
      };
      if (!item.str?.trim() || !item.transform || item.transform.length < 6) return [];
      return [
        {
          str: item.str,
          x: item.transform[4] ?? 0,
          y: item.transform[5] ?? 0,
          width: item.width ?? 0,
          height: item.height ?? Math.abs(item.transform[3] ?? 0),
        },
      ];
    });

    const reconstructed = reconstructPositionedText(
      positionedItems,
      viewport.width,
      viewport.height
    );
    const text = reconstructed.text.trim();
    const lowText = text.length < 40;
    const left = positionedItems.length ? Math.min(...positionedItems.map((item) => item.x)) : 0;
    const right = positionedItems.length
      ? Math.max(...positionedItems.map((item) => item.x + item.width))
      : 0;
    const bottom = positionedItems.length ? Math.min(...positionedItems.map((item) => item.y)) : 0;
    const top = positionedItems.length
      ? Math.max(...positionedItems.map((item) => item.y + item.height))
      : 0;

    if (lowText) {
      warnings.push(
        `Page ${pageNumber} has little extractable text and needs OCR or region recovery.`
      );
    }

    pages.push({
      pageNumber,
      text,
      width: viewport.width,
      height: viewport.height,
      rasterPng,
      layoutLines: reconstructed.lines,
      textBounds:
        positionedItems.length > 0
          ? {
              x: left,
              y: Math.max(0, viewport.height - top),
              width: Math.max(0, right - left),
              height: Math.max(0, top - bottom),
            }
          : undefined,
      lowText,
    });
  }

  const candidates = candidatesFromDocumentPages(pages);
  return { pages, candidates, warnings };
}

export async function extractDocxDeterministically(
  bytes: Buffer
): Promise<DocumentExtractionResult> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer: bytes });
  const text = result.value.replace(/\r\n/g, '\n').trim();
  const warnings = result.messages.map((message) => message.message);
  if (result.messages.length > 0) {
    warnings.push(
      'DOCX media, table, or equation conversion emitted warnings; review OMML/equation-heavy regions manually.'
    );
  }
  const pages = [{ pageNumber: 1, text, lowText: text.length < 40 }];
  return { pages, candidates: candidatesFromDocumentPages(pages), warnings };
}

export function reconcileDocumentCandidates(
  deterministic: QuestionCandidate[],
  recovered: QuestionCandidate[]
): QuestionCandidate[] {
  const result = [...deterministic];
  const known = new Set(
    deterministic.map((candidate) => `${candidate.number}:${candidate.sourcePages?.[0] ?? 0}`)
  );
  for (const candidate of recovered) {
    const key = `${candidate.number}:${candidate.sourcePages?.[0] ?? 0}`;
    if (!known.has(key)) {
      result.push(candidate);
      known.add(key);
    }
  }
  return result.sort((a, b) => a.number - b.number);
}
