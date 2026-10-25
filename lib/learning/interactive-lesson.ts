/**
 * The interactive version of a lesson about a function's graph: observe →
 * predict → interact → discover → apply → achieve.
 *
 * Nothing here is written for one lesson. The plan is derived from what the
 * admin already authored (the article blocks) and from the analysis of the
 * GRAPH function: which parts exist, what each question asks and every answer
 * it checks. The admin may add functions for students to work on themselves
 * (GRAPH_PRACTICE); a pilot lesson may supply defaults for them in
 * config/interactive-lessons.ts until the admin does.
 */

import {
  blockText,
  listItems,
  parseExamples,
  splitConcepts,
  type ConceptChunk,
  type LessonJourney,
  type WorkedExample,
} from '@/lib/knowledge-tree/lesson-journey';
import type { KnowledgeArticleBlock } from '@/lib/knowledge-tree/knowledge-tree-types';
import {
  analyzeFunction,
  isPolynomial,
  nonTurningPoints,
  parseFunction,
  sameFunction,
  type FunctionAnalysis,
} from './function-model';

export type InteractiveStageKind =
  | 'shape' // where does the graph go up or down?
  | 'slope' // the tangent's slope is f′: discover the rule
  | 'flat' // f′ = 0 at a single point need not change the direction
  | 'solve' // the worked example, done by the student step by step
  | 'challenge' // a new function, graph hidden until solved
  | 'finish';

export interface InteractiveStage {
  /** Stable ids, saved in the student's progress. */
  id: 'bat-dau' | 'kham-pha' | 'mo-rong' | 'vi-du' | 'thu-suc' | 'tong-ket';
  kind: InteractiveStageKind;
  title: string;
  /** One line under the part's title: what the student will do here. */
  goal: string;
}

export interface InteractivePlan {
  /** The GRAPH function, "y = …". */
  main: string;
  /** For "Đến lượt em": a polynomial with turning points, different from `main`. */
  practice: string | null;
  /** A function where f′ = 0 at a point it does not turn at (y = x³). */
  flat: string | null;
  intro: string;
  /** The opening assumption ("Giả sử hàm số y = f(x) có đạo hàm trên khoảng K."). */
  hypothesis: string | null;
  /** The rule the student discovers, in the admin's words. */
  theorem: { title: string; items: string[] } | null;
  /** The extension (f′ ≥ 0 with finitely many zeros), in the admin's words. */
  extension: { title: string; body: string } | null;
  /** The procedure ("Bước 1 … Bước 4"), shown beside the worked example. */
  method: { title: string; steps: string[] } | null;
  /** The admin's worked example about `main`, used to compare after each step. */
  example: WorkedExample | null;
  recap: string[];
  objectives: string[];
  references: string;
  stages: InteractiveStage[];
  /**
   * For progress saved with the text lesson: the interactive stage that now
   * holds each of its stages, by id.
   */
  aliases: Record<string, InteractiveStage['id']>;
}

const STEP_LINE = /^\s*(?:[-*•]\s*)?(?:\*\*)?(?:Bước\s*\d+|\d+[.)])\s*[:.)]?/i;

/** A labelled idea whose lines are steps: "1. …" or "- Bước 1: …". */
export function isStepList(chunk: ConceptChunk): boolean {
  const lines = chunk.body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const steps = lines.filter((line) => STEP_LINE.test(line)).length;
  return steps >= 2 && steps >= lines.length - 1;
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Why a practice function can or cannot be used, for the admin field and for the plan. */
export type PracticeRole =
  | { ok: true; role: 'practice' | 'flat'; analysis: FunctionAnalysis }
  | { ok: false; error: string };

export function practiceRole(line: string, main: string | null): PracticeRole {
  const result = analyzeFunction(line);
  if (!result.ok) return result;
  const { analysis } = result;
  if (!isPolynomial(analysis.fn)) {
    return { ok: false, error: 'Phần tự làm hiện chỉ nhận hàm đa thức.' };
  }
  const parsedMain = main ? parseFunction(main) : null;
  if (parsedMain?.ok && sameFunction(parsedMain.fn, analysis.fn)) {
    return { ok: false, error: 'Trùng hàm minh hoạ: học sinh cần một hàm mới để tự làm.' };
  }
  if (nonTurningPoints(analysis).length) return { ok: true, role: 'flat', analysis };
  if (!analysis.criticalPoints.length) {
    return { ok: false, error: 'Hàm này không có điểm nào để y′ = 0, chưa hợp để tự làm.' };
  }
  return { ok: true, role: 'practice', analysis };
}

function practiceLines(blocks: KnowledgeArticleBlock[], defaults: string[]): string[] {
  const authored = listItems(blockText(blocks, 'GRAPH_PRACTICE'));
  return authored.length ? authored : defaults;
}

/**
 * The interactive plan for an article, or null when the lesson has no
 * drawable polynomial graph (it then keeps the text journey).
 */
export function buildInteractivePlan(
  blocks: KnowledgeArticleBlock[],
  options: { classic: LessonJourney; defaultPractice?: string[] }
): InteractivePlan | null {
  const main = blockText(blocks, 'GRAPH');
  const analysed = main ? analyzeFunction(main) : null;
  if (!analysed?.ok || !isPolynomial(analysed.analysis.fn)) return null;

  let practice: string | null = null;
  let flat: string | null = null;
  for (const line of practiceLines(blocks, options.defaultPractice ?? [])) {
    const role = practiceRole(line, main);
    if (!role.ok) continue;
    if (role.role === 'practice' && !practice) practice = line.trim();
    if (role.role === 'flat' && !flat) flat = line.trim();
  }

  const concepts = splitConcepts(blockText(blocks, 'MAIN_CONTENT'));
  const methodChunk = [...concepts].reverse().find((chunk) => chunk.title && isStepList(chunk));
  const theoremChunk =
    concepts.find(
      (chunk) =>
        chunk.title && /điều kiện đủ|định l[íý]/i.test(chunk.title) && chunk !== methodChunk
    ) ??
    concepts.find((chunk) => chunk !== methodChunk && /f'\(x\)\s*>\s*0/.test(chunk.body)) ??
    null;
  const extensionChunk =
    concepts.find(
      (chunk) =>
        chunk !== theoremChunk &&
        chunk !== methodChunk &&
        (/mở rộng/i.test(chunk.title ?? '') || /hữu hạn/i.test(chunk.body))
    ) ?? null;
  const opening = concepts[0];
  const hypothesis =
    opening && !opening.title && opening !== theoremChunk && words(opening.body) <= 40
      ? opening.body
      : null;

  const examples = parseExamples(blockText(blocks, 'EXAMPLE'));
  const example =
    examples.find((item) => item.fn && sameFunction(item.fn, analysed.analysis.fn)) ?? null;

  const stages: InteractiveStage[] = [
    {
      id: 'bat-dau',
      kind: 'shape',
      title: 'Đồ thị này đi đâu?',
      goal: 'Quan sát và tự tìm chỗ đồ thị đổi chiều.',
    },
    {
      id: 'kham-pha',
      kind: 'slope',
      title: 'Bí mật nằm ở độ dốc',
      goal: 'Kéo tiếp tuyến dọc đồ thị và tự tìm ra quy tắc.',
    },
  ];
  if (flat || extensionChunk) {
    stages.push({
      id: 'mo-rong',
      kind: 'flat',
      title: 'f′ = 0 thì sao?',
      goal: 'Kiểm chứng một trường hợp dễ nhầm.',
    });
  }
  stages.push({
    id: 'vi-du',
    kind: 'solve',
    title: 'Tự giải bài mẫu',
    goal: 'Làm từng bước, so với lời giải của thầy cô.',
  });
  if (practice) {
    stages.push({
      id: 'thu-suc',
      kind: 'challenge',
      title: 'Đến lượt em',
      goal: 'Một hàm mới. Giải xong, đồ thị sẽ hiện ra để em tự kiểm chứng.',
    });
  }
  stages.push({
    id: 'tong-ket',
    kind: 'finish',
    title: 'Em đã học xong bài này',
    goal: '',
  });

  // Progress saved on the text lesson lands on the part that teaches the same thing.
  const has = (id: InteractiveStage['id']) => stages.some((stage) => stage.id === id);
  const aliases: InteractivePlan['aliases'] = {};
  for (const stage of options.classic.stages) {
    if (stage.kind === 'hook') aliases[stage.id] = 'bat-dau';
    else if (stage.kind === 'concept') {
      const chunk = concepts.find((item) => item.title === stage.title || item.body === stage.body);
      aliases[stage.id] =
        chunk && chunk === extensionChunk && has('mo-rong')
          ? 'mo-rong'
          : chunk && chunk === methodChunk
            ? 'vi-du'
            : 'kham-pha';
    } else if (stage.kind === 'example') aliases[stage.id] = 'vi-du';
    else if (stage.kind === 'check' || stage.kind === 'mistakes')
      aliases[stage.id] = has('thu-suc') ? 'thu-suc' : 'tong-ket';
    else aliases[stage.id] = 'tong-ket';
  }

  return {
    main,
    practice,
    flat,
    intro: blockText(blocks, 'INTRO'),
    hypothesis,
    theorem: theoremChunk
      ? {
          title: theoremChunk.title ?? 'Quy tắc',
          items: listItems(theoremChunk.body),
        }
      : null,
    extension: extensionChunk
      ? { title: extensionChunk.title ?? 'Mở rộng', body: extensionChunk.body }
      : null,
    method: methodChunk
      ? { title: methodChunk.title ?? 'Các bước', steps: listItems(methodChunk.body) }
      : null,
    example,
    recap: listItems(blockText(blocks, 'RECAP')),
    objectives: listItems(blockText(blocks, 'OBJECTIVE')),
    references: blockText(blocks, 'REFERENCES'),
    stages,
    aliases,
  };
}

/**
 * Where to reopen an interactive lesson from saved progress, which may have
 * been saved by the text lesson (classic stage ids) or by this one.
 * `classicLegacy` is the text lesson's own map for its older layouts.
 */
export function restoreInteractiveStage(
  saved:
    { reached: number; total: number; stageId?: string; completedAt: string | null } | undefined,
  plan: Pick<InteractivePlan, 'stages' | 'aliases'>,
  classic: Pick<LessonJourney, 'stages' | 'legacyStageIds'>
): number {
  const ids = plan.stages.map((stage) => stage.id as string);
  const last = ids.length - 1;
  if (!saved) return 0;
  if (saved.completedAt) return last;
  const at = (id: string | undefined) => {
    if (!id) return -1;
    const direct = ids.indexOf(id);
    if (direct >= 0) return direct;
    const alias = plan.aliases[id];
    return alias ? ids.indexOf(alias) : -1;
  };
  const byId = at(saved.stageId);
  if (byId >= 0) return byId;
  // Older saves without an id: by position in the text lesson's layout.
  if (saved.total === classic.stages.length) {
    const index = at(classic.stages[Math.min(saved.reached, saved.total - 1)]?.id);
    if (index >= 0) return index;
  }
  if (saved.total === classic.legacyStageIds.length) {
    const index = at(classic.legacyStageIds[saved.reached]);
    if (index >= 0) return index;
  }
  return saved.total > 1 ? Math.round((saved.reached / (saved.total - 1)) * last) : 0;
}

// ─── Attempts and hints ──────────────────────────────────────────────────────

export interface Attempt {
  /** Wrong answers so far. */
  misses: number;
  /** How many hints are showing (0 = none). */
  hints: number;
  status: 'open' | 'correct' | 'revealed';
}

export const FRESH_ATTEMPT: Attempt = { misses: 0, hints: 0, status: 'open' };

/** After three misses the answer is shown and explained: a student is never stuck. */
export const MISSES_BEFORE_REVEAL = 3;

/**
 * One answer. A miss opens the next hint (up to `maxHints`); the third miss
 * reveals the answer. A right answer closes the attempt.
 */
export function answer(state: Attempt, correct: boolean, maxHints = 2): Attempt {
  if (state.status !== 'open') return state;
  if (correct) return { ...state, status: 'correct' };
  const misses = state.misses + 1;
  if (misses >= MISSES_BEFORE_REVEAL) return { misses, hints: state.hints, status: 'revealed' };
  return { misses, hints: Math.min(Math.max(state.hints, misses), maxHints), status: 'open' };
}

/** The student asks for a hint before answering wrong. */
export function askHint(state: Attempt, maxHints = 2): Attempt {
  if (state.status !== 'open') return state;
  return { ...state, hints: Math.min(state.hints + 1, maxHints) };
}

export type BeatOutcome = 'first-try' | 'with-help' | 'revealed';

export function outcomeOf(state: Attempt): BeatOutcome | null {
  if (state.status === 'open') return null;
  if (state.status === 'revealed') return 'revealed';
  return state.misses === 0 && state.hints === 0 ? 'first-try' : 'with-help';
}
