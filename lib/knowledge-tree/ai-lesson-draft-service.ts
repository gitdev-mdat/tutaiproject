import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { GEMINI_MODELS } from '@/lib/config/models';
import {
  AI_DRAFT_BLOCK_TYPES,
  LESSON_DRAFT_PROMPT_VERSION,
  LESSON_DRAFT_RESPONSE_SCHEMA,
  LessonDraftError,
  generateLessonDraft,
  inferLessonStage,
  parseLessonDraftRequest,
  withDraftLock,
  type AiLessonDraft,
  type ContextSource,
  type LearnerLevel,
  type LessonDraftContext,
  type LessonDraftMode,
  type LessonDraftPlan,
  type LessonDraftProvider,
  type LessonSequence,
  type LessonStage,
} from './ai-lesson-draft';
import { reviewLessonDraft, type DraftCheck } from './ai-lesson-quality';
import { knowledgeBreadcrumb } from './knowledge-tree';
import {
  lessonReferencesForNode,
  type LessonReference,
} from '@/lib/textbook-reference/reference-service';
import { readKnowledgeTree } from './knowledge-tree-storage';
import {
  draftProvenanceAvailable,
  listDraftGenerations,
  recordDraftGeneration,
  type DraftGeneration,
  type DraftReferenceProvenance,
} from './draft-provenance';
import { durableTextbookBackendConfigured } from '@/lib/textbook-reference/repository';
import {
  loadLessonTextbook,
  type LessonTextbookReadiness,
} from '@/lib/textbook-reference/lesson-view';
import type { KnowledgeTreeNode } from './knowledge-tree-types';

export type LessonDraftProviderName = 'gemini' | 'mock';

export interface LessonDraftAvailability {
  available: boolean;
  reason?: string;
}

type Env = Record<string, string | undefined>;

/**
 * Whether drafting can run in this deployment. Who may run it is decided by the
 * route's server-side admin guard; this only checks configuration. The mock
 * provider never runs in production, so a stray env var cannot show fake drafts.
 */
export function getLessonDraftAvailability(env: Env = process.env): LessonDraftAvailability {
  if (providerName(env) === 'mock') {
    return env.NODE_ENV === 'production'
      ? { available: false, reason: 'Bản nháp giả lập không được dùng trên bản triển khai.' }
      : { available: true };
  }
  if (!env.GEMINI_API_KEY) {
    return { available: false, reason: 'Máy chủ chưa cấu hình khóa Gemini.' };
  }
  return { available: true };
}

function providerName(env: Env): LessonDraftProviderName {
  return env.KNOWLEDGE_AI_PROVIDER === 'mock' ? 'mock' : 'gemini';
}

const geminiProvider: LessonDraftProvider = async (prompt, signal) => {
  const { gemini } = await import('@/lib/ai/gemini-client');
  const response = await gemini.models.generateContent({
    model: GEMINI_MODELS.lessonDrafting,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: LESSON_DRAFT_RESPONSE_SCHEMA,
      temperature: 0.4,
      // Room for the model's own reasoning plus a full lesson; the schema caps each field.
      maxOutputTokens: 16384,
      abortSignal: signal,
    },
  });
  return (response as { text?: string }).text ?? '';
};

/**
 * Deterministic local provider for development and browser checks without a paid key.
 * Markers in the admin note simulate provider failures.
 */
const mockProvider: LessonDraftProvider = async (prompt) => {
  const title = /Tên bài: (.+)/.exec(prompt)?.[1]?.trim() ?? 'Kiến thức';
  if (prompt.includes('[mock:quota]')) throw Object.assign(new Error('quota'), { status: 429 });
  if (prompt.includes('[mock:malformed]')) return '{"OBJECTIVE": 42}';
  if (prompt.includes('[mock:error]')) throw new Error('provider down');
  // Echoes which approved extracts it was given, so a local check can follow input to output.
  const sources = [...prompt.matchAll(/^\[Tư liệu (\d+): ([^\]]+)\]$/gm)].map((match) => match[2]);
  return JSON.stringify({
    plan: {
      prerequisites: ['Đạo hàm của hàm đa thức (Toán 11)'],
      newNotation: ["$f'(x)$: đạo hàm của $f$ tại $x$"],
      teacherNotes: [
        'Bản nháp giả lập, không do AI viết.',
        sources.length
          ? `Giả lập đã nhận ${sources.length} tư liệu: ${sources.join(' | ')}`
          : 'Giả lập không nhận tư liệu sách nào.',
      ],
    },
    INTRO: `${title} là một nội dung quan trọng của chương. (Bản nháp giả lập)`,
    OBJECTIVE: `- Phát biểu được khái niệm ${title}.\n- Vận dụng được ${title} để giải bài tập cơ bản.`,
    MAIN_CONTENT: `Khái niệm ${title} được trình bày ở đây.\n\nCông thức minh họa: $f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}$.`,
    EXAMPLE: `Ví dụ 1. Cho $f(x) = x^2$. Tính $f'(x)$.\n\nLời giải: $f'(x) = 2x$.`,
    RECAP: `- Nắm vững định nghĩa ${title}.\n- Kiểm tra điều kiện trước khi áp dụng.`,
    COMMON_MISTAKE: '- Quên điều kiện xác định. Cách tránh: luôn ghi điều kiện trước khi biến đổi.',
  });
};

function providerFor(env: Env): LessonDraftProvider {
  return providerName(env) === 'mock' ? mockProvider : geminiProvider;
}

/** The knowledge items of the same chapter, in order, around this one. */
function lessonSequence(nodes: KnowledgeTreeNode[], node: KnowledgeTreeNode): LessonSequence {
  const siblings = nodes
    .filter((item) => item.parentId === node.parentId && item.kind === 'KNOWLEDGE')
    .sort((a, b) => a.order - b.order);
  const index = siblings.findIndex((item) => item.id === node.id);
  return {
    position: index + 1,
    total: siblings.length,
    earlier: siblings.slice(Math.max(0, index - 6), index).map((item) => item.title),
    later: siblings.slice(index + 1, index + 3).map((item) => item.title),
  };
}

/** Curriculum context comes from the server's own tree, never from the client. */
export async function buildLessonDraftContext(nodeId: string): Promise<LessonDraftContext> {
  const tree = await readKnowledgeTree();
  const node = tree.nodes.find((item) => item.id === nodeId);
  if (!node) throw new LessonDraftError('INVALID_REQUEST', 'Không tìm thấy kiến thức.');
  if (node.kind !== 'KNOWLEDGE') {
    throw new LessonDraftError('INVALID_REQUEST', 'Chỉ soạn bài cho mục kiến thức.');
  }
  const path = knowledgeBreadcrumb(tree.nodes, nodeId).slice(0, -1);
  const [subject, grade, ...chapterPath] = path.map((item) => item.title);
  const inferred = inferLessonStage(node.title);
  return {
    subject: subject ?? '',
    grade: grade ?? '',
    chapterPath,
    title: node.title,
    description: node.description ?? '',
    sequence: lessonSequence(tree.nodes, node),
    stage: inferred.stage,
    stageSource: inferred.source,
    learnerLevel: 'STANDARD',
    learnerLevelSource: 'default',
  };
}

/** What the model was told, so the admin can see and correct it. */
export interface LessonDraftContextSummary {
  path: string;
  sequence: LessonSequence | null;
  stage: LessonStage;
  stageSource: ContextSource;
  learnerLevel: LearnerLevel;
  learnerLevelSource: ContextSource;
  prerequisites: string | null;
  /** Curriculum facts the tree does not have and the admin may want to give. */
  missing: string[];
  /** Approved textbook references linked to this lesson, and which were sent. */
  references: ReferenceSummary;
}

/** One approved extract as the admin sees it: provenance plus the exact text sent. */
export type ReferenceItem = Omit<LessonReference, 'contentSha256'>;

export interface ReferenceSummary {
  /** Approved artifacts reachable through confirmed mappings. */
  approved: number;
  /** The bounded selection that is (or would be) sent, with provenance and the sent text. */
  items: ReferenceItem[];
  /** Whether this draft used them (false for general drafting). */
  used: boolean;
  /** Set when references could not be read; drafting continues without them. */
  error?: string;
  /** Where the lesson's textbook links stand, for the "what is missing" message. */
  readiness?: LessonTextbookReadiness;
}

const toItem = (reference: LessonReference): ReferenceItem => {
  const item: Partial<LessonReference> = { ...reference };
  delete item.contentSha256;
  return item as ReferenceItem;
};

const NO_REFERENCES: ReferenceSummary = { approved: 0, items: [], used: false };

async function loadReferences(
  nodeId: string
): Promise<{ summary: ReferenceSummary; references: LessonReference[] }> {
  try {
    const { approvedCount, references } = await lessonReferencesForNode(nodeId);
    return {
      references,
      summary: {
        approved: approvedCount,
        items: references.map(toItem),
        used: references.length > 0,
      },
    };
  } catch (error) {
    console.warn('[ai-draft] textbook references unavailable', (error as Error)?.name);
    return {
      references: [],
      summary: {
        ...NO_REFERENCES,
        error: 'Không đọc được tư liệu sách tham chiếu; bản nháp sẽ không dùng tư liệu.',
      },
    };
  }
}

/** Linked / extracted / approved counts; null when the textbook backend is off or unreadable. */
async function loadReadiness(nodeId: string): Promise<LessonTextbookReadiness | undefined> {
  if (!durableTextbookBackendConfigured()) return undefined;
  try {
    return (await loadLessonTextbook(nodeId))?.readiness;
  } catch {
    return undefined;
  }
}

export function summarizeLessonDraftContext(
  context: LessonDraftContext,
  references: ReferenceSummary = NO_REFERENCES
): LessonDraftContextSummary {
  const missing: string[] = [];
  if (!context.description) missing.push('mô tả, mục tiêu của bài trong chương trình');
  if (!context.prerequisites) missing.push('kiến thức nền đã xác nhận');
  if (context.stageSource === 'default') missing.push('giai đoạn học của bài');
  return {
    path: [context.subject, context.grade, ...context.chapterPath].filter(Boolean).join(' › '),
    sequence: context.sequence ?? null,
    stage: context.stage ?? 'INTRODUCTORY',
    stageSource: context.stageSource ?? 'default',
    learnerLevel: context.learnerLevel ?? 'STANDARD',
    learnerLevelSource: context.learnerLevelSource ?? 'default',
    prerequisites: context.prerequisites ?? null,
    missing,
    references,
  };
}

export interface LessonDraftResponse {
  draft: AiLessonDraft;
  plan: LessonDraftPlan;
  checks: DraftCheck[];
  context: LessonDraftContextSummary;
  /** What was really sent, stored for later inspection (null when it could not be stored). */
  provenance: DraftGeneration & { stored: boolean };
}

export interface LessonDraftPreview extends LessonDraftContextSummary {
  /** Recent drafts of this lesson and what they were written from. */
  history: DraftGeneration[];
}

/** Context preview for the panel: what would be sent, before anything is generated. */
export async function previewLessonDraftContext(nodeId: string): Promise<LessonDraftPreview> {
  const context = await buildLessonDraftContext(nodeId);
  const [{ summary }, readiness, history] = await Promise.all([
    loadReferences(nodeId),
    loadReadiness(nodeId),
    draftProvenanceAvailable()
      ? listDraftGenerations(nodeId).catch(() => [] as DraftGeneration[])
      : Promise.resolve([] as DraftGeneration[]),
  ]);
  return { ...summarizeLessonDraftContext(context, { ...summary, readiness }), history };
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

export async function requestLessonDraft(
  nodeId: string,
  body: unknown,
  env: Env = process.env,
  options: { provider?: LessonDraftProvider; actor?: string } = {}
): Promise<LessonDraftResponse> {
  const availability = getLessonDraftAvailability(env);
  if (!availability.available) {
    throw new LessonDraftError('UNAVAILABLE', availability.reason);
  }
  const request = parseLessonDraftRequest(body);
  const base = await buildLessonDraftContext(nodeId);
  const loaded = await loadReferences(nodeId);
  // The admin picks the mode before generating; older clients send useReferences.
  const mode: LessonDraftMode =
    request.mode ??
    (request.useReferences === false || !loaded.references.length ? 'GENERAL' : 'TEXTBOOK');
  if (mode === 'TEXTBOOK' && !loaded.references.length) {
    throw new LessonDraftError(
      'NO_REFERENCES',
      loaded.summary.error ? `${loaded.summary.error} Chọn soạn chung để tiếp tục.` : undefined
    );
  }
  const useReferences = mode === 'TEXTBOOK';
  const context: LessonDraftContext = {
    ...base,
    ...(useReferences && {
      references: loaded.references.map((reference) => ({
        kind: reference.kind,
        title: reference.title,
        content: reference.content,
        source: `${reference.documentTitle}, tr. ${reference.printedPages.join(', ')}`,
      })),
    }),
    existing: request.existing,
    note: request.note,
    prerequisites: request.prerequisites,
    ...(request.stage && { stage: request.stage, stageSource: 'admin' as const }),
    ...(request.learnerLevel && {
      learnerLevel: request.learnerLevel,
      learnerLevelSource: 'admin' as const,
    }),
  };
  // The exact text handed to the provider, so provenance is checked against it, not assumed.
  let sentPrompt = '';
  const provider = options.provider ?? providerFor(env);
  const recording: LessonDraftProvider = (prompt, signal) => {
    sentPrompt = prompt;
    return provider(prompt, signal);
  };
  const { draft, plan } = await withDraftLock(nodeId, () =>
    generateLessonDraft(context, recording)
  );
  const references: DraftReferenceProvenance[] = useReferences
    ? loaded.references.map((reference) => ({
        artifactId: reference.artifactId,
        documentId: reference.documentId,
        entryId: reference.entryId,
        kind: reference.kind,
        title: reference.title,
        documentTitle: reference.documentTitle,
        printedPages: reference.printedPages,
        contentSha256: reference.contentSha256,
        sentChars: reference.content.length,
        truncated: reference.truncated,
        includedInPrompt: sentPrompt.includes(reference.content),
      }))
    : [];
  const generation: DraftGeneration = {
    id: randomUUID(),
    knowledgeNodeId: nodeId,
    mode,
    status: 'PROPOSED',
    createdAt: new Date().toISOString(),
    model: providerName(env) === 'mock' ? 'mock' : GEMINI_MODELS.lessonDrafting,
    promptVersion: LESSON_DRAFT_PROMPT_VERSION,
    promptSha256: sha256(sentPrompt),
    promptChars: sentPrompt.length,
    references,
  };
  let stored = false;
  if (draftProvenanceAvailable(env)) {
    try {
      await recordDraftGeneration(generation, options.actor ?? 'unknown');
      stored = true;
    } catch (error) {
      console.warn('[ai-draft] provenance not stored', (error as Error)?.name);
    }
  }
  const summary = summarizeLessonDraftContext(context, {
    ...loaded.summary,
    // Only what was really placed in the prompt counts as used.
    items: useReferences
      ? loaded.summary.items.filter((item) =>
          references.some((ref) => ref.artifactId === item.artifactId && ref.includedInPrompt)
        )
      : [],
    used: references.some((reference) => reference.includedInPrompt),
  });
  return {
    draft,
    plan,
    checks: reviewLessonDraft(draft, { stage: summary.stage, subject: context.subject }),
    context: summary,
    provenance: { ...generation, stored },
  };
}

export { AI_DRAFT_BLOCK_TYPES };
