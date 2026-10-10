import 'server-only';

import { GEMINI_MODELS } from '@/lib/config/models';
import {
  AI_DRAFT_BLOCK_TYPES,
  LESSON_DRAFT_RESPONSE_SCHEMA,
  LessonDraftError,
  generateLessonDraft,
  parseLessonDraftRequest,
  withDraftLock,
  type AiLessonDraft,
  type LessonDraftContext,
  type LessonDraftProvider,
} from './ai-lesson-draft';
import { knowledgeBreadcrumb } from './knowledge-tree';
import { readKnowledgeTree } from './knowledge-tree-storage';

export type LessonDraftProviderName = 'gemini' | 'mock';

export interface LessonDraftAvailability {
  available: boolean;
  reason?: string;
}

type Env = Record<string, string | undefined>;

/**
 * The admin area has no authorization yet, so a production deployment would let
 * anyone spend the project's Gemini quota. AI drafting therefore only runs outside
 * production until admin auth exists.
 */
export function getLessonDraftAvailability(env: Env = process.env): LessonDraftAvailability {
  if (env.NODE_ENV === 'production') {
    return {
      available: false,
      reason: 'Đang tạm khóa trên bản triển khai vì trang quản trị chưa có phân quyền.',
    };
  }
  if (providerName(env) === 'gemini' && !env.GEMINI_API_KEY) {
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
      maxOutputTokens: 8192,
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
  const title = /Tên kiến thức: (.+)/.exec(prompt)?.[1]?.trim() ?? 'Kiến thức';
  if (prompt.includes('[mock:quota]')) throw Object.assign(new Error('quota'), { status: 429 });
  if (prompt.includes('[mock:malformed]')) return '{"OBJECTIVE": 42}';
  if (prompt.includes('[mock:error]')) throw new Error('provider down');
  return JSON.stringify({
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
  return {
    subject: subject ?? '',
    grade: grade ?? '',
    chapterPath,
    title: node.title,
    description: node.description ?? '',
  };
}

export async function requestLessonDraft(
  nodeId: string,
  body: unknown,
  env: Env = process.env
): Promise<AiLessonDraft> {
  const availability = getLessonDraftAvailability(env);
  if (!availability.available) {
    throw new LessonDraftError('UNAVAILABLE', availability.reason);
  }
  const request = parseLessonDraftRequest(body);
  const context = await buildLessonDraftContext(nodeId);
  return withDraftLock(nodeId, () =>
    generateLessonDraft({ ...context, ...request }, providerFor(env))
  );
}

export { AI_DRAFT_BLOCK_TYPES };
