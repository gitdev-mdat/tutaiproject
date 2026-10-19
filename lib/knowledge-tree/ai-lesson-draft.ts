/**
 * AI lesson drafting — provider-agnostic core.
 *
 * Builds the prompt from curriculum context, calls an injected provider with a
 * timeout, and turns its raw text into a validated, sanitized draft. Nothing in
 * this module stores or publishes anything: the admin reviews the draft in the
 * editor and saves it through the normal article flow.
 */

import { z } from 'zod';
import {
  executeWithAbortableProviderTimeout,
  ProviderTimeoutError,
} from '@/lib/ai/provider-timeout';
import {
  MATH_GROUP_COMMANDS,
  MATH_SYMBOLS,
  normalizeGeneratedMath,
} from '@/lib/content/math-notation';
import { parseFunction } from '@/lib/learning/function-model';
import type { KnowledgeArticleBlock } from './knowledge-tree-types';

/**
 * Blocks the AI may propose. References are excluded so sources are never invented.
 * GRAPH is only kept when it is a function the interactive graph can draw.
 */
export const AI_DRAFT_BLOCK_TYPES = [
  'INTRO',
  'OBJECTIVE',
  'MAIN_CONTENT',
  'EXAMPLE',
  'RECAP',
  'COMMON_MISTAKE',
  'GRAPH',
] as const satisfies ReadonlyArray<KnowledgeArticleBlock['type']>;

export type AiDraftBlockType = (typeof AI_DRAFT_BLOCK_TYPES)[number];
export type AiLessonDraft = Record<AiDraftBlockType, string>;

export const AI_DRAFT_LIMITS = {
  noteChars: 500,
  prerequisitesChars: 400,
  existingBlockChars: 6000,
  existingTotalChars: 20000,
  outputBlockChars: 6000,
  timeoutMs: 60_000,
} as const;

/**
 * Where the lesson sits in learning: a first encounter, practice applying it,
 * going beyond the standard, or revising for an exam. It decides how much
 * formality, how many exceptions and which mistakes belong in the draft.
 */
export const LESSON_STAGES = ['INTRODUCTORY', 'APPLICATION', 'EXTENSION', 'REVISION'] as const;
export type LessonStage = (typeof LESSON_STAGES)[number];

/** Who the draft is written for. */
export const LEARNER_LEVELS = ['FOUNDATION', 'STANDARD', 'ADVANCED'] as const;
export type LearnerLevel = (typeof LEARNER_LEVELS)[number];

/** Where a context value came from, shown to the admin next to it. */
export type ContextSource = 'admin' | 'title' | 'default';

export const STAGE_LABELS: Record<LessonStage, string> = {
  INTRODUCTORY: 'Bài mở đầu (học lần đầu)',
  APPLICATION: 'Bài vận dụng',
  EXTENSION: 'Bài nâng cao, mở rộng',
  REVISION: 'Ôn tập, luyện thi',
};

export const LEARNER_LEVEL_LABELS: Record<LearnerLevel, string> = {
  FOUNDATION: 'Học sinh cần củng cố nền',
  STANDARD: 'Học sinh trung bình – khá',
  ADVANCED: 'Học sinh khá – giỏi',
};

export interface LessonSequence {
  /** 1-based position among the knowledge items of the same chapter. */
  position: number;
  total: number;
  /** Titles of the items placed before this one, nearest last. */
  earlier: string[];
  /** Titles of the next items, nearest first. */
  later: string[];
}

export interface LessonDraftContext {
  subject: string;
  grade: string;
  /** Chapter and any intermediate groups between grade and the knowledge item. */
  chapterPath: string[];
  title: string;
  description: string;
  sequence?: LessonSequence;
  stage?: LessonStage;
  stageSource?: ContextSource;
  learnerLevel?: LearnerLevel;
  learnerLevelSource?: ContextSource;
  /** Prerequisites the admin states; the only prerequisites treated as verified. */
  prerequisites?: string;
  /** Present only when the admin chose to send the current content. */
  existing?: Partial<Record<AiDraftBlockType, string>>;
  note?: string;
}

/** What the model says it assumed and introduced; shown to the admin, never to students. */
export interface LessonDraftPlan {
  prerequisites: string[];
  newNotation: string[];
  teacherNotes: string[];
}

export interface LessonDraftResult {
  draft: AiLessonDraft;
  plan: LessonDraftPlan;
}

export type LessonDraftErrorCode =
  'UNAVAILABLE' | 'INVALID_REQUEST' | 'BUSY' | 'TIMEOUT' | 'QUOTA' | 'MALFORMED' | 'PROVIDER';

const ERROR_MESSAGES: Record<LessonDraftErrorCode, string> = {
  UNAVAILABLE: 'Tính năng soạn nháp bằng AI chưa được bật.',
  INVALID_REQUEST: 'Yêu cầu không hợp lệ.',
  BUSY: 'AI đang soạn nháp cho bài này. Chờ yêu cầu trước hoàn tất.',
  TIMEOUT: 'AI phản hồi quá lâu nên yêu cầu đã dừng. Thử lại sau ít phút.',
  QUOTA: 'Đã hết hạn mức gọi AI. Thử lại sau hoặc kiểm tra gói Gemini.',
  MALFORMED: 'AI trả về nội dung không đúng cấu trúc. Thử tạo lại.',
  PROVIDER: 'Dịch vụ AI đang gặp lỗi. Thử lại sau.',
};

const ERROR_STATUS: Record<LessonDraftErrorCode, number> = {
  UNAVAILABLE: 403,
  INVALID_REQUEST: 400,
  BUSY: 409,
  TIMEOUT: 504,
  QUOTA: 429,
  MALFORMED: 502,
  PROVIDER: 502,
};

export class LessonDraftError extends Error {
  constructor(
    public readonly code: LessonDraftErrorCode,
    message: string = ERROR_MESSAGES[code]
  ) {
    super(message);
    this.name = 'LessonDraftError';
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }
}

/** Provider contract: receives the full prompt, returns the model's raw JSON text. */
export type LessonDraftProvider = (prompt: string, signal: AbortSignal) => Promise<string>;

// ─── Request parsing ─────────────────────────────────────────────────────────

export interface LessonDraftRequest {
  existing?: Partial<Record<AiDraftBlockType, string>>;
  note?: string;
  stage?: LessonStage;
  learnerLevel?: LearnerLevel;
  prerequisites?: string;
}

export function parseLessonDraftRequest(body: unknown): LessonDraftRequest {
  if (!body || typeof body !== 'object') return {};
  const input = body as Record<string, unknown>;
  const request: LessonDraftRequest = {};

  if (input.note !== undefined) {
    if (typeof input.note !== 'string') throw new LessonDraftError('INVALID_REQUEST');
    const note = input.note.trim();
    if (note.length > AI_DRAFT_LIMITS.noteChars) {
      throw new LessonDraftError(
        'INVALID_REQUEST',
        `Yêu cầu thêm dài quá ${AI_DRAFT_LIMITS.noteChars} ký tự.`
      );
    }
    if (note) request.note = note;
  }

  if (input.stage !== undefined && input.stage !== null && input.stage !== '') {
    if (!LESSON_STAGES.includes(input.stage as LessonStage)) {
      throw new LessonDraftError('INVALID_REQUEST');
    }
    request.stage = input.stage as LessonStage;
  }
  if (
    input.learnerLevel !== undefined &&
    input.learnerLevel !== null &&
    input.learnerLevel !== ''
  ) {
    if (!LEARNER_LEVELS.includes(input.learnerLevel as LearnerLevel)) {
      throw new LessonDraftError('INVALID_REQUEST');
    }
    request.learnerLevel = input.learnerLevel as LearnerLevel;
  }
  if (input.prerequisites !== undefined) {
    if (typeof input.prerequisites !== 'string') throw new LessonDraftError('INVALID_REQUEST');
    const prerequisites = input.prerequisites.trim();
    if (prerequisites.length > AI_DRAFT_LIMITS.prerequisitesChars) {
      throw new LessonDraftError(
        'INVALID_REQUEST',
        `Kiến thức nền dài quá ${AI_DRAFT_LIMITS.prerequisitesChars} ký tự.`
      );
    }
    if (prerequisites) request.prerequisites = prerequisites;
  }

  if (input.existing !== undefined && input.existing !== null) {
    if (typeof input.existing !== 'object') throw new LessonDraftError('INVALID_REQUEST');
    const existing: Partial<Record<AiDraftBlockType, string>> = {};
    let total = 0;
    for (const type of AI_DRAFT_BLOCK_TYPES) {
      const value = (input.existing as Record<string, unknown>)[type];
      if (value === undefined) continue;
      if (typeof value !== 'string') throw new LessonDraftError('INVALID_REQUEST');
      const text = value.trim();
      if (text.length > AI_DRAFT_LIMITS.existingBlockChars) {
        throw new LessonDraftError(
          'INVALID_REQUEST',
          `Mỗi phần gửi kèm tối đa ${AI_DRAFT_LIMITS.existingBlockChars} ký tự.`
        );
      }
      total += text.length;
      if (text) existing[type] = text;
    }
    if (total > AI_DRAFT_LIMITS.existingTotalChars) {
      throw new LessonDraftError(
        'INVALID_REQUEST',
        `Nội dung gửi kèm tối đa ${AI_DRAFT_LIMITS.existingTotalChars} ký tự.`
      );
    }
    if (Object.keys(existing).length) request.existing = existing;
  }

  return request;
}

// ─── Context defaults ────────────────────────────────────────────────────────

/**
 * A transparent guess at the lesson's stage from its title, used only when the
 * admin has not chosen one. The tree stores no stage, so the guess and its
 * source are shown to the admin before generating.
 */
export function inferLessonStage(title: string): { stage: LessonStage; source: ContextSource } {
  const t = title.toLocaleLowerCase('vi');
  if (/ôn tập|tổng ôn|luyện thi|luyện đề|kiểm tra|đề thi/.test(t)) {
    return { stage: 'REVISION', source: 'title' };
  }
  if (/nâng cao|mở rộng/.test(t)) return { stage: 'EXTENSION', source: 'title' };
  if (/vận dụng|luyện tập|bài toán thực tế|giải quyết bài toán/.test(t)) {
    return { stage: 'APPLICATION', source: 'title' };
  }
  const part = /\(\s*(?:p|phần)\s*(\d+)\s*\)/i.exec(title);
  if (part) {
    return { stage: Number(part[1]) <= 1 ? 'INTRODUCTORY' : 'APPLICATION', source: 'title' };
  }
  return { stage: 'INTRODUCTORY', source: 'default' };
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const STAGE_GUIDE: Record<LessonStage, string> = {
  INTRODUCTORY: [
    'Đây là bài MỞ ĐẦU: học sinh gặp nội dung này lần đầu.',
    '- Đi từ tình huống, hình ảnh hoặc ví dụ số cụ thể đến phát biểu chính thức; không mở bài bằng "Giả sử…", "Cho hàm số…" hay một định lí.',
    '- Mỗi ký hiệu, thuật ngữ mới được giải thích nghĩa bằng lời thường ngay lần đầu xuất hiện, kèm một ví dụ rất nhỏ.',
    '- Chỉ dạy trường hợp chuẩn. Không đưa ngoại lệ, trường hợp đặc biệt, điều kiện mở rộng hay mẹo thi; nếu thật cần thì nói một câu rằng sẽ học ở bài sau.',
    '- Ví dụ: một ví dụ thật đơn giản chỉ minh hoạ khái niệm, rồi một ví dụ điển hình làm đủ các bước.',
  ].join('\n'),
  APPLICATION: [
    'Đây là bài VẬN DỤNG: khái niệm đã học ở bài trước nhưng học sinh có thể chưa vững.',
    '- Mở đầu bằng phần nhắc lại cốt lõi trong 2–3 câu, rồi tập trung vào cách áp dụng cho các dạng bài thường gặp, độ khó tăng dần.',
    '- Điều kiện và trường hợp đặc biệt chỉ nêu khi ví dụ của bài cần đến, và giải thích vì sao.',
    '- Ví dụ: 2–3 ví dụ từ quen thuộc đến khó hơn.',
  ].join('\n'),
  EXTENSION: [
    'Đây là bài NÂNG CAO, MỞ RỘNG cho học sinh đã nắm phần cơ bản.',
    '- Được bàn về giả thiết, trường hợp đặc biệt, phản ví dụ; luôn giải thích vì sao và chỉ ra chỗ khác với trường hợp cơ bản.',
    '- Ví dụ: 2 ví dụ có độ khó cao hơn, lời giải vẫn đủ bước.',
  ].join('\n'),
  REVISION: [
    'Đây là bài ÔN TẬP, LUYỆN THI: không dạy lại từ đầu.',
    '- Hệ thống hoá kiến thức chính, so sánh các dạng bài và cách nhận ra từng dạng.',
    '- Ví dụ tổng hợp như trong đề kiểm tra; lỗi hay gặp là các lỗi thường mất điểm khi làm bài.',
  ].join('\n'),
};

const LEVEL_GUIDE: Record<LearnerLevel, string> = {
  FOUNDATION:
    'Người đọc: học sinh cần củng cố nền. Bài ngắn hơn bản thường, câu ngắn, mỗi phép tính viết ra từng bước, nhắc lại cụ thể công thức của lớp dưới khi dùng tới, số liệu đơn giản. Ưu tiên cách làm dễ kiểm chứng (ví dụ thay một giá trị thử để biết dấu) hơn quy tắc phải nhớ; không thêm dạng ví dụ mới.',
  STANDARD:
    'Người đọc: học sinh trung bình – khá. Giải thích đủ ý, không bỏ bước quan trọng, nhắc lại ngắn kiến thức nền khi cần.',
  ADVANCED:
    'Người đọc: học sinh khá – giỏi. Có thể viết gọn hơn nhưng vẫn giải thích vì sao; được thêm một câu hỏi gợi suy nghĩ.',
};

function subjectGuidance(subject: string): string {
  const s = subject.toLocaleLowerCase('vi');
  if (/toán/.test(s)) {
    return 'Môn Toán: phát biểu nào cũng nêu đủ điều kiện áp dụng (trên tập/khoảng nào, cần giả thiết gì); không rút gọn đến mức sai. Lời giải ví dụ trình bày từng bước, mỗi bước nói làm gì và vì sao, có kết luận.';
  }
  if (/lý|lí|hóa|hoá|sinh/.test(s)) {
    return 'Môn khoa học tự nhiên: nêu rõ đại lượng, đơn vị SI; giải thích hiện tượng trước khi đưa công thức. Ví dụ là bài tập định lượng hoặc hiện tượng thực tế có giải thích.';
  }
  if (/văn|ngữ/.test(s)) {
    return 'Môn Ngữ văn: không dùng công thức; ví dụ là đoạn trích ngắn hoặc dàn ý có phân tích.';
  }
  if (/anh|english/.test(s)) {
    return 'Môn Tiếng Anh: giải thích bằng tiếng Việt, ví dụ câu tiếng Anh kèm nghĩa tiếng Việt.';
  }
  return 'Giải thích khái niệm bằng ví dụ cụ thể trước khi khái quát.';
}

const isMath = (subject: string) => /toán/.test(subject.toLocaleLowerCase('vi'));

/** The LaTeX the reader renders, so the model does not use commands that would show raw. */
const SUPPORTED_LATEX = [
  ...Object.keys(MATH_GROUP_COMMANDS).filter((name) =>
    ['frac', 'dfrac', 'sqrt', 'text', 'mathbb', 'vec', 'overline'].includes(name)
  ),
  ...Object.keys(MATH_SYMBOLS).filter((name) =>
    [
      'le',
      'ge',
      'ne',
      'in',
      'notin',
      'cup',
      'cap',
      'subset',
      'infty',
      'pm',
      'times',
      'cdot',
      'Rightarrow',
      'Leftrightarrow',
      'rightarrow',
      'to',
      'nearrow',
      'searrow',
      'forall',
      'exists',
      'pi',
      'alpha',
      'Delta',
      'sin',
      'cos',
      'tan',
      'log',
      'ln',
      'lim',
      'int',
      'sum',
    ].includes(name)
  ),
]
  .map((name) => `\\${name}`)
  .join(', ');

function contextLines(context: LessonDraftContext): string[] {
  const path = [context.subject, context.grade, ...context.chapterPath].filter(Boolean).join(' › ');
  const stage = context.stage ?? inferLessonStage(context.title).stage;
  const level = context.learnerLevel ?? 'STANDARD';
  const lines = [`Vị trí trong chương trình: ${path}`, `Tên bài: ${context.title}`];
  if (context.description) lines.push(`Mô tả có sẵn: ${context.description}`);
  const sequence = context.sequence;
  if (sequence) {
    lines.push(`Thứ tự: bài ${sequence.position}/${sequence.total} của chương này.`);
    lines.push(
      sequence.earlier.length
        ? `Các bài xếp trước trong chương: ${sequence.earlier.join('; ')}. (Xếp trước KHÔNG có nghĩa là học sinh đã nắm vững.)`
        : 'Đây là bài đầu tiên của chương.'
    );
    if (sequence.later.length) {
      lines.push(
        `Các bài tiếp theo: ${sequence.later.join('; ')}. Không dạy trước nội dung của các bài này.`
      );
    }
  }
  lines.push(`Giai đoạn học: ${STAGE_LABELS[stage]}.`, STAGE_GUIDE[stage], LEVEL_GUIDE[level]);
  lines.push(
    context.prerequisites
      ? `Kiến thức nền giáo viên xác nhận bài này cần: ${context.prerequisites}. Nhắc lại ngắn những phần bài dùng tới; không coi là học sinh đã thành thạo.`
      : 'Chưa có danh sách kiến thức nền được xác nhận. Tự xác định kiến thức nền cần thiết theo chương trình GDPT 2018, nhắc lại ngắn phần bài dùng tới và liệt kê chúng trong plan.prerequisites để giáo viên kiểm tra.'
  );
  return lines;
}

export function buildLessonDraftPrompt(context: LessonDraftContext): string {
  const math = isMath(context.subject);
  const existing = context.existing
    ? AI_DRAFT_BLOCK_TYPES.filter((type) => context.existing?.[type])
        .map((type) => `[${type}]\n${context.existing![type]}`)
        .join('\n\n')
    : '';

  return [
    `Bạn là giáo viên ${context.subject || 'THPT'} giỏi, soạn BẢN NHÁP bài học cho học sinh THPT Việt Nam trên nền tảng Tú Tài. Giáo viên sẽ duyệt và sửa trước khi học sinh thấy.`,
    'Mục tiêu: học sinh ở đúng trình độ dưới đây tự đọc và HIỂU được bài, giải thích được vì sao cách làm đúng; không phải một bản tóm tắt kiến thức chỉ đúng về mặt nội dung.',
    'Viết bằng tiếng Việt tự nhiên, gần gũi, đúng chương trình giáo dục phổ thông 2018. Không bịa số liệu, tên sách, trang sách hay nguồn tham khảo.',
    '',
    '# Bối cảnh',
    ...contextLines(context),
    subjectGuidance(context.subject),
    '',
    '# Cách dạy',
    '- Trước một phát biểu chính thức (định nghĩa, định lí, công thức, quy tắc), cho học sinh thấy vấn đề hoặc trực giác qua một trường hợp cụ thể.',
    '- Lần đầu dùng một ký hiệu hay thuật ngữ, nói ngay nó nghĩa là gì và vì sao cần nó. Ví dụ cách viết: "$\\overrightarrow{AB}$ là vectơ đi từ điểm $A$ đến điểm $B$". Cách nói tắt quen miệng của giáo viên (như "trong trái ngoài cùng", $\\Delta\'$, "giá của vectơ") cũng phải giải thích hoặc nói đầy đủ.',
    '- Phát biểu đúng mức: điều kiện đủ viết "nếu … thì"; chỉ viết "khi và chỉ khi" khi điều đó thật sự đúng; giữ đủ giả thiết (tập xác định, khoảng đang xét).',
    '- Ví dụ làm đúng theo các bước vừa nêu, cùng số và tên bước. Không nhắc đến bảng nếu lời giải không trình bày nó; xét dấu bằng lời hoặc bằng giá trị thử.',
    '- Ký hiệu theo sách giáo khoa Việt Nam: $A(1; -2; 3)$, $D = \\mathbb{R} \\setminus \\{1\\}$. Không dùng một chữ cái cho hai đối tượng trong cùng bài (ví dụ điểm $A$ và hệ số $A$).',
    '- Khi bài dựa vào kiến thức cũ, viết một ý "Nhắc lại nhanh" 2–4 câu kèm một ví dụ nhỏ; không dạy lại cả chương cũ.',
    '- Giải thích vì sao quy tắc, quy trình đúng, đủ để học sinh tự giải thích lại cho bạn. Với quy tắc trung tâm của bài, viết 1–2 câu "vì sao" ngay trước khi phát biểu, dựa trên ý nghĩa học sinh đã biết (hình ảnh, ý nghĩa hình học hay một phép thử bằng số nhỏ). Một chữ "Do đó" không thay được lời giải thích.',
    '- Có thể kết thúc một ý quan trọng bằng một dòng "Thử nhanh: …" và đáp án ngay sau đó.',
    '- Ngắn gọn: mỗi ý khoảng 60–150 từ, không lặp một ý ở nhiều phần. Mục tiêu là giải thích đúng lúc, không phải viết dài.',
    '',
    '# Học sinh sẽ thấy bài thế nào',
    'Bài hiện từng phần trên một màn hình: Mở đầu → từng ý của Nội dung chính → Ví dụ (kèm các bước làm) → Lỗi hay gặp, ngay trước khi học sinh tự làm bài → Ghi nhớ.',
    '- INTRO: 2–4 câu. Một câu hỏi hoặc tình huống gợi mở, vì sao cần học, nối với điều học sinh đã biết.',
    '- OBJECTIVE: 2–4 dòng "- ", mỗi dòng một động từ đo được, khớp với những gì bài thực sự dạy.',
    '- MAIN_CONTENT: 2–4 ý theo thứ tự dạy. Mỗi ý là một đoạn bắt đầu bằng nhãn in đậm có dấu chấm, như "**Nhắc lại nhanh.** …" hoặc "**Ý nghĩa của dấu đạo hàm.** …". Các đoạn cách nhau một dòng trống. Nếu bài có quy trình làm bài, đặt nó ở ý cuối, nhãn bắt đầu bằng "**Các bước", mỗi bước một dòng "1. …", "2. …" kèm lí do ngắn.',
    '- EXAMPLE: mỗi ví dụ bắt đầu bằng "Ví dụ 1." (rồi "Ví dụ 2." …) và đề bài; dòng "Lời giải." rồi mỗi bước một dòng "Bước 1: …". Mỗi bước nói làm gì và vì sao, có kết luận. Các ví dụ cách nhau một dòng trống.' +
      (math ? ' Hàm số trong đề viết dạng "$y = …$".' : ''),
    '- COMMON_MISTAKE: chỉ 1–3 lỗi mà học sinh ở đúng giai đoạn này dễ mắc khi làm bài tập của CHÍNH bài này, gắn với tình huống bài đã dạy hoặc ví dụ đã làm. Mỗi lỗi đúng MỘT dòng "- ": cách làm sai cụ thể (kèm ví dụ ngắn nếu được), vì sao sai (tốt nhất bằng một phản ví dụ hay phép thử số), cách làm đúng. Không đưa trường hợp hiếm, cách viết hình thức hay tình huống nâng cao chỉ để bài trông sâu. Không cần đủ 3 lỗi.',
    '- RECAP: 3–5 dòng "- ", dòng đầu là ý cốt lõi nhất của bài.',
    math
      ? '- GRAPH: chỉ với bài về hàm số và đồ thị: một hàm đa thức hoặc phân thức, dạng "y = …" (ví dụ y = x^3 - 3x), để học sinh khám phá trên đồ thị tương tác: dự đoán đồ thị đi lên hay đi xuống, kéo điểm xem dấu đạo hàm, xem bảng biến thiên. Phải trùng hàm của một ví dụ trong bài. Bài không cần đồ thị, hoặc không có hàm nào hợp, thì để chuỗi rỗng.'
      : '- GRAPH: để chuỗi rỗng.',
    '',
    '# Định dạng',
    '- Văn bản thuần. Chỉ dùng in đậm cho nhãn đầu mỗi ý; không HTML, không tiêu đề "#", không khối mã, không bảng.',
    `- Mọi biểu thức toán viết trong $...$ theo LaTeX đơn giản. Chỉ dùng các lệnh: ${SUPPORTED_LATEX}, cùng ^ và _. Không viết lệnh LaTeX nào ngoài cặp $...$; trong lời văn dùng ký tự "→", "⇒".`,
    '',
    existing
      ? `# Nội dung giáo viên đã viết\nGiữ ý đúng, bổ sung chỗ thiếu, sửa chỗ sai, viết lại theo cách dạy ở trên:\n${existing}`
      : '',
    context.note ? `# Yêu cầu thêm của giáo viên\n${context.note}` : '',
    '',
    '# Trước khi trả lời, tự kiểm tra',
    '- Tính lại mọi phép tính, đạo hàm, nghiệm, dấu và kết luận trong ví dụ.',
    '- Mỗi ví dụ minh hoạ đúng ý nó được dùng để minh hoạ; lời giải khớp với lí thuyết đã nêu.',
    '- Mọi ký hiệu, thuật ngữ đều đã được giải thích trước hoặc ngay khi dùng.',
    '- Mỗi lỗi hay gặp liên quan trực tiếp đến điều bài đã dạy và hợp với giai đoạn học.',
    '- Đọc lại mọi phát biểu tổng quát, kể cả trong Ghi nhớ và Lỗi hay gặp: đúng giả thiết, không nói quá.',
    '',
    'Trả về đúng một đối tượng JSON theo schema. Khóa "plan" dành cho giáo viên, học sinh không thấy: plan.prerequisites là kiến thức nền bài giả định và đã nhắc lại; plan.newNotation là ký hiệu, thuật ngữ mới bài giải thích; plan.teacherNotes là tối đa 3 điểm giáo viên nên kiểm tra hoặc bổ sung (ví dụ thông tin chương trình còn thiếu).',
    'Trong chuỗi JSON, mỗi dấu \\ của LaTeX phải viết thành \\\\ (ví dụ \\\\frac, \\\\rightarrow, \\\\notin).',
  ]
    .filter((line, index, lines) => line !== '' || (index > 0 && lines[index - 1] !== ''))
    .join('\n')
    .trim();
}

const blockSchema = (maxLength: number) => ({ type: 'string', maxLength });
const listSchema = { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 200 } };

/** JSON schema handed to the provider for structured output. The plan comes first so it is written first. */
export const LESSON_DRAFT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    plan: {
      type: 'object',
      properties: {
        prerequisites: listSchema,
        newNotation: listSchema,
        teacherNotes: { ...listSchema, maxItems: 3 },
      },
      required: ['prerequisites', 'newNotation', 'teacherNotes'],
    },
    INTRO: blockSchema(1200),
    OBJECTIVE: blockSchema(1000),
    MAIN_CONTENT: blockSchema(4500),
    EXAMPLE: blockSchema(4500),
    COMMON_MISTAKE: blockSchema(1500),
    RECAP: blockSchema(1000),
    GRAPH: blockSchema(120),
  },
  required: ['plan', 'INTRO', 'OBJECTIVE', 'MAIN_CONTENT', 'EXAMPLE', 'COMMON_MISTAKE', 'RECAP'],
  propertyOrdering: [
    'plan',
    'INTRO',
    'OBJECTIVE',
    'MAIN_CONTENT',
    'EXAMPLE',
    'COMMON_MISTAKE',
    'RECAP',
    'GRAPH',
  ],
} as const;

// ─── Output validation ───────────────────────────────────────────────────────

const HTML_TAG =
  /<\/?(?:a|abbr|b|br|code|div|em|font|h[1-6]|hr|i|iframe|img|li|link|meta|object|ol|p|pre|small|span|strong|style|sub|sup|table|tbody|td|th|thead|tr|u|ul|embed|svg|form|input|button)\b[^<>]*>/gi;

/** Bold that opens a line is an idea label ("**Định nghĩa.** …"); the lesson reader splits ideas on it. */
const LINE_LABEL = /^(\*\*[^*\n]{1,80}?\*\*)/;

/** Reduces model output to the plain text + $math$ format the reader renders. */
export function sanitizeDraftText(value: string): string {
  const text = value
    .replace(/\r\n?/g, '\n')
    .replace(/<(script|style|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(HTML_TAG, '')
    .replace(/^```[a-z]*\s*$/gim, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[*•]\s+/gm, '- ')
    .split('\n')
    .map((line) => {
      const label = LINE_LABEL.exec(line)?.[1] ?? '';
      return label + line.slice(label.length).replace(/\*\*(.+?)\*\*/g, '$1');
    })
    .join('\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normalizeGeneratedMath(text).slice(0, AI_DRAFT_LIMITS.outputBlockChars);
}

const requiredText = z.string().transform(sanitizeDraftText).pipe(z.string().min(20));
const optionalText = z
  .string()
  .optional()
  .transform((value) => sanitizeDraftText(value ?? ''));

/** A GRAPH proposal is kept only when the interactive graph can draw it. */
const graphText = z
  .string()
  .optional()
  .transform((value) => {
    const source = (value ?? '').replace(/\$/g, '').trim();
    if (!source) return '';
    const formula = /^(?:y|f\s*\(\s*x\s*\))\s*=/.test(source) ? source : `y = ${source}`;
    return parseFunction(formula).ok ? formula.slice(0, 120) : '';
  });

const planList = z
  .array(z.unknown())
  .optional()
  .transform((items) =>
    (items ?? [])
      .filter((item): item is string => typeof item === 'string')
      .map((item) => sanitizeDraftText(item).replace(/\n+/g, ' ').slice(0, 200))
      .filter(Boolean)
      .slice(0, 6)
  );

const draftSchema = z.object({
  INTRO: optionalText,
  OBJECTIVE: requiredText,
  MAIN_CONTENT: requiredText,
  EXAMPLE: requiredText,
  RECAP: optionalText,
  COMMON_MISTAKE: optionalText,
  GRAPH: graphText,
  plan: z
    .object({ prerequisites: planList, newNotation: planList, teacherNotes: planList })
    .partial()
    .optional(),
});

function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
}

// A lone backslash before a LaTeX command whose name starts with a JSON escape
// letter (\notin, \frac, \times, \beta, \rightarrow, \nearrow) would parse as a
// newline, form feed, tab, backspace or carriage return and silently corrupt the
// formula. Only full names of commands the reader knows are repaired, so an
// ordinary "\n" before a word is left alone.
const ESCAPE_LETTER_COMMANDS = [
  ...Object.keys(MATH_SYMBOLS),
  ...Object.keys(MATH_GROUP_COMMANDS),
  'right',
  'big',
  'bigl',
  'bigr',
  'nolimits',
  'textstyle',
]
  .filter((name) => /^[bfnrt]/.test(name))
  .sort((a, b) => b.length - a.length);
const AMBIGUOUS_LATEX_ESCAPE = new RegExp(
  String.raw`(?<!\\)((?:\\\\)*)\\(?=(?:${ESCAPE_LETTER_COMMANDS.join('|')})(?![A-Za-z]))`,
  'g'
);
// Any other backslash that is not a valid JSON escape (\in, \le, \sqrt, \underline).
const INVALID_JSON_ESCAPE = /(?<!\\)((?:\\\\)*)\\(?=[^"\\/bfnrtu]|u(?![0-9a-fA-F]{4}))/g;

/** Doubles backslashes the model left single inside LaTeX so JSON.parse keeps them. */
export function repairLatexEscapes(json: string): string {
  return json.replace(AMBIGUOUS_LATEX_ESCAPE, '$1\\\\').replace(INVALID_JSON_ESCAPE, '$1\\\\');
}

export function parseLessonDraftResult(raw: string): LessonDraftResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(repairLatexEscapes(stripJsonFence(raw)));
  } catch {
    throw new LessonDraftError('MALFORMED');
  }
  const result = draftSchema.safeParse(parsed);
  if (!result.success) throw new LessonDraftError('MALFORMED');
  const { plan, ...draft } = result.data;
  return {
    draft,
    plan: {
      prerequisites: plan?.prerequisites ?? [],
      newNotation: plan?.newNotation ?? [],
      teacherNotes: plan?.teacherNotes ?? [],
    },
  };
}

export function parseLessonDraft(raw: string): AiLessonDraft {
  return parseLessonDraftResult(raw).draft;
}

// ─── Orchestration ───────────────────────────────────────────────────────────

export function classifyProviderError(error: unknown): LessonDraftError {
  if (error instanceof LessonDraftError) return error;
  if (error instanceof ProviderTimeoutError) return new LessonDraftError('TIMEOUT');
  const status = (error as { status?: unknown } | null)?.status;
  const message = error instanceof Error ? error.message : String(error);
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(message)) {
    return new LessonDraftError('QUOTA');
  }
  if (error instanceof Error && error.name === 'AbortError') return new LessonDraftError('TIMEOUT');
  return new LessonDraftError('PROVIDER');
}

function redactProviderMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/AIza[0-9A-Za-z_-]{10,}/g, '[redacted]').slice(0, 300);
}

export async function generateLessonDraft(
  context: LessonDraftContext,
  provider: LessonDraftProvider,
  options: { timeoutMs?: number } = {}
): Promise<LessonDraftResult> {
  let raw: string;
  try {
    raw = await executeWithAbortableProviderTimeout(
      (signal) => provider(buildLessonDraftPrompt(context), signal),
      options.timeoutMs ?? AI_DRAFT_LIMITS.timeoutMs
    );
  } catch (error) {
    const classified = classifyProviderError(error);
    // Server log only: the code, HTTP status and a trimmed provider message help tell
    // a wrong model id or a revoked key from a quota problem. Keys never appear here.
    console.warn('[ai-draft] provider failure', {
      code: classified.code,
      status: (error as { status?: unknown } | null)?.status,
      message: redactProviderMessage(error),
    });
    throw classified;
  }
  if (!raw?.trim()) throw new LessonDraftError('MALFORMED');
  return parseLessonDraftResult(raw);
}

// ─── Duplicate-request guard ─────────────────────────────────────────────────

const inFlight = new Set<string>();

/** Runs `task` unless a draft for the same key is already being generated. */
export async function withDraftLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  if (inFlight.has(key)) throw new LessonDraftError('BUSY');
  inFlight.add(key);
  try {
    return await task();
  } finally {
    inFlight.delete(key);
  }
}
