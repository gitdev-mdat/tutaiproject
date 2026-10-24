import { createHash } from 'node:crypto';
import { PREVIOUS_PROMPT_VERSIONS, PROMPT_VERSION } from './prompt-version';
import type {
  ExerciseChoice,
  ExerciseSetRef,
  ExtractedArtifactKind,
  ExtractionDiagnostics,
  ExtractionOutcome,
  ExtractionPageReport,
  TextbookArtifact,
  TextbookTocEntry,
} from './types';

/**
 * Reading a page batch, independent of the provider: the prompt, the response
 * schema and the item-by-item validation. Exercise pages are first-class: each
 * printed question is its own item whether or not its solution is on the page,
 * and one bad item never discards the valid ones.
 */

export { PROMPT_VERSION, PREVIOUS_PROMPT_VERSIONS };
export const MAX_ITEMS_PER_BATCH = 40;

const KINDS: ExtractedArtifactKind[] = [
  'THEORY',
  'METHOD',
  'WORKED_EXAMPLE',
  'EXERCISE',
  'SOLUTION',
];
const PAGE_STATUSES: ExtractionPageReport['status'][] = [
  'READ',
  'PARTLY_READABLE',
  'UNREADABLE',
  'NO_EDUCATIONAL_CONTENT',
];

export const TEXTBOOK_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pages', 'items', 'unreadable'],
  properties: {
    pages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['printedPage', 'status'],
        properties: {
          printedPage: { type: 'integer' },
          status: { type: 'string', enum: PAGE_STATUSES },
          note: { type: 'string' },
        },
      },
    },
    items: {
      type: 'array',
      maxItems: MAX_ITEMS_PER_BATCH,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'title', 'content', 'printedPages'],
        properties: {
          kind: { type: 'string', enum: KINDS },
          questionNumber: { type: 'string' },
          title: { type: 'string' },
          content: { type: 'string' },
          choices: {
            type: 'array',
            maxItems: 4,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label', 'text'],
              properties: {
                label: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
                text: { type: 'string' },
              },
            },
          },
          hasDiagram: { type: 'boolean' },
          answerChoice: { type: 'string' },
          exerciseSetLabel: { type: 'string' },
          mathematicalNotation: { type: 'array', items: { type: 'string' } },
          printedPages: { type: 'array', items: { type: 'integer' } },
          verificationNotes: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    unreadable: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['printedPage', 'reference', 'reason'],
        properties: {
          printedPage: { type: 'integer' },
          reference: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  },
} as const;

/** "Dạng 1: Bài toán không chứa tham số" → "dạng 1". */
export function problemTypeOf(text: string | null | undefined): string | null {
  const match = /d[ạa]ng\s*(\d+)/iu.exec(text?.normalize('NFC') ?? '');
  return match ? `dạng ${Number(match[1])}` : null;
}

/**
 * The exercise set an outline entry stands for: its level-2 chapter, and its
 * problem type from its own heading or the nearest preceding "Dạng n" sibling
 * ("Bài tập rèn luyện kỹ năng" follows "Dạng 1: …" in this book).
 */
export function exerciseSetFor(
  entry: TextbookTocEntry,
  tocEntries: TextbookTocEntry[]
): ExerciseSetRef {
  let chapter: TextbookTocEntry | undefined = entry;
  while (chapter && chapter.level > 2)
    chapter = tocEntries.find((candidate) => candidate.id === chapter?.parentId);
  let problemType = problemTypeOf(entry.originalHeading);
  if (!problemType) {
    const index = tocEntries.findIndex((candidate) => candidate.id === entry.id);
    for (let i = index - 1; i >= 0; i -= 1) {
      const sibling = tocEntries[i];
      if (sibling.parentId !== entry.parentId) continue;
      problemType = problemTypeOf(sibling.originalHeading);
      if (problemType) break;
    }
  }
  return {
    entryId: entry.id,
    heading: entry.originalHeading,
    chapterEntryId: chapter && chapter.level <= 2 ? chapter.id : null,
    problemType,
  };
}

export function buildExtractionPrompt(input: {
  pages: number[];
  headings: string[];
  chapterHeading: string | null;
  problemType: string | null;
}): string {
  const context = [
    input.chapterHeading,
    ...input.headings,
    input.problemType && !input.headings.some((heading) => problemTypeOf(heading))
      ? `(thuộc ${input.problemType})`
      : null,
  ]
    .filter(Boolean)
    .join(' / ');
  return [
    `Các ảnh đính kèm là ${input.pages.length} trang in của một sách tham khảo Toán tiếng Việt, bản quét, mỗi ảnh đúng một trang, theo thứ tự: ${input.pages.map((page) => `tr. ${page}`).join(', ')}. Mục lục: ${context}.`,
    'Trang có thể là lý thuyết, phương pháp, ví dụ có lời giải, bài tập luyện tập (thường CHỈ có đề; lời giải in ở phần "Hướng dẫn giải" khác trong sách) hoặc phần hướng dẫn giải. Trích đúng những gì in trên các trang này:',
    '- THEORY, METHOD, WORKED_EXAMPLE: mỗi khối kiến thức, phương pháp hoặc ví dụ (kèm lời giải in ngay sau nó) là một item.',
    '- EXERCISE: MỖI câu hỏi là một item riêng, kể cả khi trang không có lời giải. questionNumber: số Câu in trên sách (chỉ chữ số, ví dụ "7"). title: "Câu 7". content: nguyên văn đề, rồi mỗi phương án A./B./C./D. trên một dòng riêng. choices: các phương án đúng như in. hasDiagram: true nếu đề dựa vào hình vẽ, đồ thị hoặc bảng biến thiên. Không ghi đáp án, không giải, không đoán đáp án; không mô tả hình nếu không đọc rõ.',
    '- SOLUTION: chỉ khi lời giải in trên chính các trang này; mỗi câu một item. questionNumber: số Câu. answerChoice: phương án sách chọn (ví dụ "A"), để trống nếu sách không ghi. exerciseSetLabel: tiêu đề phần hoặc dạng in phía trên lời giải (ví dụ "Dạng 1"), nếu thấy.',
    '- Không bỏ câu hỏi vì không có lời giải. Không tự ghép câu hỏi với lời giải: hệ thống đối chiếu sau.',
    '- Câu hoặc vùng không đọc được: không đoán, không đưa vào items; ghi vào unreadable {printedPage, reference (ví dụ "Câu 9"), reason}. Ký hiệu lẻ không đọc chắc thì viết [?] và nêu trong verificationNotes.',
    '- pages: mỗi trang đã gửi một dòng, status READ (đọc được hết), PARTLY_READABLE, UNREADABLE (không đọc được) hoặc NO_EDUCATIONAL_CONTENT (trang trắng, bìa, quảng cáo).',
    '- printedPages của mỗi item: số trang in (trong danh sách trên) mà item nằm trên đó.',
    "Viết MỌI công thức, ký hiệu toán trong content, title và choices bằng LaTeX đặt trong $...$ (ví dụ $f'(x) \\ge 0$, $x \\in I$, $y = \\frac{ax+b}{cx+d}$, $D = \\mathbb{R} \\setminus \\{-3\\}$). Trong $...$ chỉ dùng lệnh LaTeX thông dụng (\\frac, \\sqrt, \\le, \\ge, \\ne, \\in, \\infty, \\mathbb{R}, \\setminus, \\Leftrightarrow, \\Rightarrow, \\forall, chữ Hy Lạp); lời văn để ngoài $...$, không dùng \\text, không dùng môi trường \\begin{...}: hệ hoặc tuyển nghiệm viết bằng lời. Giữ bố cục của sách bằng ký tự xuống dòng: mỗi ý, mỗi mệnh đề a./b./c., mỗi phương án, mỗi bước biến đổi một dòng; giữa các đoạn một dòng trống.",
    'Trả JSON {"pages":[...],"items":[...],"unreadable":[...]}. Không bổ sung điều không có trên trang.',
  ].join('\n');
}

function stripFence(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
}

/**
 * Complete objects of the `items` array of a JSON answer that was cut off: a
 * truncated response still holds every item that finished before the cut.
 */
export function salvageItems(text: string): unknown[] {
  const start = text.search(/"items"\s*:\s*\[/);
  if (start < 0) return [];
  let index = text.indexOf('[', start) + 1;
  const items: unknown[] = [];
  let depth = 0;
  let objectStart = -1;
  let inString = false;
  for (; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (char === '\\') index += 1;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') {
      if (depth === 0) objectStart = index;
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        try {
          items.push(JSON.parse(text.slice(objectStart, index + 1)));
        } catch {}
        objectStart = -1;
      }
    } else if (char === ']' && depth === 0) break;
  }
  return items;
}

export interface ParsedResponse {
  /** Null when no JSON object could be read at all. */
  items: unknown[] | null;
  pages: ExtractionPageReport[];
  unreadable: ExtractionDiagnostics['unreadable'];
  truncated: boolean;
}

export function parseExtractionResponse(
  text: string,
  options: { truncated: boolean; pages: number[] }
): ParsedResponse {
  const cleaned = stripFence(text);
  let parsed: Record<string, unknown> | null = null;
  try {
    const value = JSON.parse(cleaned) as unknown;
    if (value && typeof value === 'object') parsed = value as Record<string, unknown>;
  } catch {}
  const asPages = (value: unknown): ExtractionPageReport[] =>
    Array.isArray(value)
      ? value
          .filter((page): page is Record<string, unknown> => !!page && typeof page === 'object')
          .map((page) => ({
            printedPage: Number(page.printedPage),
            status: PAGE_STATUSES.includes(page.status as ExtractionPageReport['status'])
              ? (page.status as ExtractionPageReport['status'])
              : 'READ',
            note: typeof page.note === 'string' && page.note ? page.note : undefined,
          }))
          .filter((page) => options.pages.includes(page.printedPage))
      : [];
  const asUnreadable = (value: unknown): ExtractionDiagnostics['unreadable'] =>
    Array.isArray(value)
      ? value
          .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
          .map((item) => ({
            printedPage: Number(item.printedPage),
            reference: String(item.reference ?? ''),
            reason: String(item.reason ?? ''),
          }))
      : [];
  if (parsed && Array.isArray(parsed.items))
    return {
      items: parsed.items,
      pages: asPages(parsed.pages),
      unreadable: asUnreadable(parsed.unreadable),
      truncated: options.truncated,
    };
  if (parsed)
    return { items: null, pages: asPages(parsed.pages), unreadable: [], truncated: false };
  // Not valid JSON: a cut-off answer still yields its finished items.
  const salvaged = salvageItems(cleaned);
  const pagesMatch = /"pages"\s*:\s*(\[[^\]]*\])/.exec(cleaned);
  let pages: ExtractionPageReport[] = [];
  try {
    pages = pagesMatch ? asPages(JSON.parse(pagesMatch[1])) : [];
  } catch {}
  return {
    items: salvaged.length || options.truncated ? salvaged : null,
    pages,
    unreadable: [],
    truncated: true,
  };
}

function questionNumberOf(item: Record<string, unknown>): string | undefined {
  const explicit = typeof item.questionNumber === 'string' ? item.questionNumber : '';
  const source = `${explicit} ${String(item.title ?? '')} ${String(item.content ?? '').slice(0, 40)}`;
  const match = /^\s*(\d+)\b/.exec(explicit) ?? /C[âa]u\s*(\d+)/iu.exec(source);
  return match ? String(Number(match[1])) : undefined;
}

function choicesOf(raw: unknown): { choices?: ExerciseChoice[]; problem?: string } {
  if (!Array.isArray(raw) || raw.length === 0) return {};
  const choices = raw
    .filter((choice): choice is Record<string, unknown> => !!choice && typeof choice === 'object')
    .map((choice) => ({
      label: String(choice.label ?? '')
        .trim()
        .toUpperCase() as ExerciseChoice['label'],
      text: String(choice.text ?? '').trim(),
    }));
  const labels = choices.map((choice) => choice.label);
  if (
    choices.some((choice) => !['A', 'B', 'C', 'D'].includes(choice.label) || !choice.text) ||
    new Set(labels).size !== labels.length
  )
    return {
      problem:
        'Phương án trả lời không đọc trọn vẹn (thiếu nhãn A–D hoặc nội dung); kiểm tra với bản quét.',
    };
  return { choices: choices.sort((a, b) => a.label.localeCompare(b.label)) };
}

export interface ItemValidationContext {
  documentId: string;
  entryId: string;
  extractionKey: string;
  pages: number[];
  pdfPageOf: (printedPage: number) => number;
  exerciseSet: ExerciseSetRef;
  createdAt: string;
}

export type ItemResult =
  | { ok: true; artifact: TextbookArtifact; partial: boolean }
  | { ok: false; reference: string; reason: string };

/** Validates one returned item on its own; a bad item is reported, never fatal to the batch. */
export function validateItem(
  raw: unknown,
  index: number,
  context: ItemValidationContext
): ItemResult {
  const fallbackReference = `Mục thứ ${index + 1}`;
  if (!raw || typeof raw !== 'object')
    return { ok: false, reference: fallbackReference, reason: 'Không phải một mục hợp lệ.' };
  const item = raw as Record<string, unknown>;
  const kind = String(item.kind) as ExtractedArtifactKind;
  const title = String(item.title ?? '').trim();
  const reference = title || fallbackReference;
  if (!KINDS.includes(kind))
    return { ok: false, reference, reason: `Loại nội dung không hợp lệ (${String(item.kind)}).` };
  const content = String(item.content ?? '').trim();
  if (!content) return { ok: false, reference, reason: 'Nội dung trống.' };
  const printedPages = Array.isArray(item.printedPages)
    ? [...new Set(item.printedPages.map(Number))].sort((a, b) => a - b)
    : [];
  if (!printedPages.length || printedPages.some((page) => !context.pages.includes(page)))
    return { ok: false, reference, reason: 'Ghi số trang không thuộc các trang đã gửi.' };

  const notes = Array.isArray(item.verificationNotes)
    ? item.verificationNotes.map(String).filter(Boolean)
    : [];
  let partial = /\[\?\]/.test(`${title}\n${content}`);
  if (partial)
    notes.push('Có ký hiệu chưa đọc chắc ([?]); đối chiếu với bản quét trước khi duyệt.');
  const questionNumber =
    kind === 'EXERCISE' || kind === 'SOLUTION' ? questionNumberOf(item) : undefined;
  if ((kind === 'EXERCISE' || kind === 'SOLUTION') && !questionNumber)
    notes.push('Không thấy số Câu in trên sách; không thể ghép lời giải tự động.');

  const artifact: TextbookArtifact = {
    id: `art-${createHash('sha256')
      .update(`${context.extractionKey}\0${index}\0${kind}\0${questionNumber ?? title}`)
      .digest('hex')
      .slice(0, 32)}`,
    documentId: context.documentId,
    entryId: context.entryId,
    kind,
    title: title || (questionNumber ? `Câu ${questionNumber}` : KIND_TITLES[kind]),
    content,
    mathematicalNotation: Array.isArray(item.mathematicalNotation)
      ? item.mathematicalNotation.map(String)
      : [],
    printedPages,
    pdfPages: [...new Set(printedPages.map(context.pdfPageOf))],
    reviewStatus: 'NEEDS_REVIEW',
    verificationNotes: notes.length
      ? [...new Set(notes)]
      : ['AI extraction; human review required.'],
    extractionKey: context.extractionKey,
    createdAt: context.createdAt,
    promptVersion: PROMPT_VERSION,
  };
  if (kind === 'EXERCISE') {
    const { choices, problem } = choicesOf(item.choices);
    if (problem) {
      artifact.verificationNotes.push(problem);
      partial = true;
    }
    Object.assign(artifact, {
      questionNumber,
      exerciseReference: questionNumber ? `Câu ${questionNumber}` : undefined,
      choices,
      hasDiagram: item.hasDiagram === true,
      exerciseSet: context.exerciseSet,
      solutionStatus: 'UNRESOLVED',
      answer: { status: 'UNRESOLVED' },
    } satisfies Partial<TextbookArtifact>);
    if (artifact.hasDiagram)
      artifact.verificationNotes.push(
        'Câu này dùng hình, đồ thị hoặc bảng: xem trên bản quét, hình không được chép lại.'
      );
  }
  if (kind === 'SOLUTION') {
    const answer = String(item.answerChoice ?? '')
      .trim()
      .toUpperCase();
    const label = typeof item.exerciseSetLabel === 'string' ? item.exerciseSetLabel : '';
    Object.assign(artifact, {
      questionNumber,
      solutionReference: questionNumber ? `Câu ${questionNumber}` : undefined,
      answerChoice: /^[A-D]$/.test(answer) ? answer : null,
      exerciseSet: {
        ...context.exerciseSet,
        // The printed heading above a solution names its set; the outline entry of a
        // "Hướng dẫn giải" section covers several sets and says nothing about which one.
        problemType: problemTypeOf(label) ?? problemTypeOf(context.exerciseSet.heading),
      },
    } satisfies Partial<TextbookArtifact>);
  }
  return { ok: true, artifact, partial };
}

const KIND_TITLES: Record<ExtractedArtifactKind, string> = {
  THEORY: 'Lý thuyết',
  METHOD: 'Phương pháp',
  WORKED_EXAMPLE: 'Ví dụ',
  EXERCISE: 'Bài tập',
  SOLUTION: 'Lời giải',
};

/**
 * What a batch yielded, from validated facts only. Returns null for a valid
 * EMPTY result; failures (unreadable scan, unusable answer) are separate.
 */
export function classifyOutcome(input: {
  accepted: number;
  rejected: number;
  partialItems: number;
  truncated: boolean;
  pages: ExtractionPageReport[];
  unreadable: number;
}): ExtractionOutcome | 'UNREADABLE' | 'INVALID_RESPONSE' {
  const pagesUnreadable = input.pages.filter((page) => page.status === 'UNREADABLE').length;
  if (input.accepted === 0) {
    if (input.pages.length > 0 && pagesUnreadable === input.pages.length) return 'UNREADABLE';
    if (
      input.pages.length > 0 &&
      input.pages.every((page) => page.status === 'NO_EDUCATIONAL_CONTENT')
    )
      return 'EMPTY';
    if (input.unreadable > 0 && input.rejected === 0) return 'UNREADABLE';
    // The pages were read (or nothing was said about them) yet nothing usable came back.
    return 'INVALID_RESPONSE';
  }
  const incomplete =
    input.rejected > 0 ||
    input.partialItems > 0 ||
    input.truncated ||
    input.unreadable > 0 ||
    input.pages.some((page) => page.status === 'UNREADABLE' || page.status === 'PARTLY_READABLE');
  return incomplete ? 'PARTIAL' : 'COMPLETE';
}
