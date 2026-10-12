import 'server-only';

import { GEMINI_MODELS } from '@/lib/config/models';
import {
  LessonDraftError,
  withDraftLock,
  type LessonDraftProvider,
} from '@/lib/knowledge-tree/ai-lesson-draft';
import { knowledgeBreadcrumb } from '@/lib/knowledge-tree/knowledge-tree';
import { readKnowledgeArticles } from '@/lib/knowledge-tree/knowledge-article-storage';
import { readKnowledgeTree } from '@/lib/knowledge-tree/knowledge-tree-storage';
import { listQuestions } from '@/lib/question-bank/qb-storage';
import {
  SUGGESTION_LIMITS,
  SUGGESTION_RESPONSE_SCHEMA,
  generateSuggestions,
  type QuestionSuggestion,
} from './ai-question-suggest';

type Env = Record<string, string | undefined>;

/**
 * Suggestions run for signed-in admins only (the route checks), with Gemini
 * when GEMINI_API_KEY is set, or the local mock with KNOWLEDGE_AI_PROVIDER=mock
 * outside production.
 */
export function getSuggestionAvailability(env: Env = process.env): {
  available: boolean;
  reason?: string;
} {
  if (env.KNOWLEDGE_AI_PROVIDER === 'mock') {
    return env.NODE_ENV === 'production'
      ? { available: false, reason: 'Bản giả lập AI không chạy trên bản triển khai.' }
      : { available: true };
  }
  if (!env.GEMINI_API_KEY)
    return { available: false, reason: 'Máy chủ chưa cấu hình khóa Gemini.' };
  return { available: true };
}

const geminiProvider: LessonDraftProvider = async (prompt, signal) => {
  const { gemini } = await import('@/lib/ai/gemini-client');
  const response = await gemini.models.generateContent({
    model: GEMINI_MODELS.lessonDrafting,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: SUGGESTION_RESPONSE_SCHEMA,
      temperature: 0.3,
      maxOutputTokens: 8192,
      abortSignal: signal,
    },
  });
  return (response as { text?: string }).text ?? '';
};

/** Deterministic suggestions for local development and browser checks. */
const mockProvider: LessonDraftProvider = async (prompt) => {
  if (prompt.includes('[mock:error]')) throw new Error('provider down');
  if (prompt.includes('[mock:quota]')) throw Object.assign(new Error('quota'), { status: 429 });
  const title = /Tên kiến thức: (.+)/.exec(prompt)?.[1]?.trim() ?? 'Kiến thức';
  return JSON.stringify({
    questions: [
      {
        questionType: 'MULTIPLE_CHOICE_SINGLE',
        stem: `(Giả lập) Hàm số $y = x^3 - 3x$ đồng biến trên khoảng nào? [${title}]`,
        options: ['$(-1; 1)$', '$(1; +\\infty)$', '$(-\\infty; 1)$', '$(0; 2)$'],
        correctAnswer: 'B',
        explanation:
          "$y' = 3x^2 - 3 = 3(x-1)(x+1)$. $y' > 0$ khi $x < -1$ hoặc $x > 1$, nên hàm số đồng biến trên $(1; +\\infty)$.",
        difficulty: 'FOUNDATIONAL',
      },
      {
        questionType: 'NUMERIC',
        stem: '(Giả lập) Hàm số $y = x^2 - 4x + 1$ đạt cực tiểu tại $x$ bằng bao nhiêu?',
        correctAnswer: '2',
        explanation:
          "$y' = 2x - 4 = 0 \\Leftrightarrow x = 2$, và $y'$ đổi dấu từ âm sang dương tại $x = 2$.",
        difficulty: 'FOUNDATIONAL',
      },
    ],
  });
};

function providerFor(env: Env): LessonDraftProvider {
  return env.KNOWLEDGE_AI_PROVIDER === 'mock' ? mockProvider : geminiProvider;
}

export function parseSuggestionRequest(body: unknown): { count: number; note?: string } {
  const input = (body ?? {}) as { count?: unknown; note?: unknown };
  const count = Number(input.count ?? 3);
  if (!Number.isInteger(count) || count < 1 || count > SUGGESTION_LIMITS.maxCount) {
    throw new LessonDraftError(
      'INVALID_REQUEST',
      `Chọn từ 1 đến ${SUGGESTION_LIMITS.maxCount} câu.`
    );
  }
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > SUGGESTION_LIMITS.noteChars) {
    throw new LessonDraftError('INVALID_REQUEST', 'Ghi chú quá dài.');
  }
  return { count, ...(note ? { note } : {}) };
}

export async function suggestLessonQuestions(
  lessonId: string,
  body: unknown,
  env: Env = process.env
): Promise<QuestionSuggestion[]> {
  const availability = getSuggestionAvailability(env);
  if (!availability.available) throw new LessonDraftError('UNAVAILABLE', availability.reason);
  const request = parseSuggestionRequest(body);
  const [tree, articles, { questions }] = await Promise.all([
    readKnowledgeTree(),
    readKnowledgeArticles(),
    listQuestions({ curriculumItemId: lessonId, pageSize: 10_000 }),
  ]);
  const node = tree.nodes.find((item) => item.id === lessonId);
  if (!node || node.kind !== 'KNOWLEDGE') {
    throw new LessonDraftError('INVALID_REQUEST', 'Không tìm thấy bài học.');
  }
  const article = articles.articles[lessonId];
  return withDraftLock(`questions:${lessonId}`, () =>
    generateSuggestions(
      {
        path: knowledgeBreadcrumb(tree.nodes, lessonId)
          .slice(0, -1)
          .map((item) => item.title),
        title: node.title,
        description: node.description ?? '',
        lessonText: article?.blocks.map((block) => block.content).join('\n\n') ?? '',
        existingStems: questions
          .filter((q) => q.editorialStatus !== 'ARCHIVED')
          .map((q) => q.stem.slice(0, 200)),
        ...request,
      },
      providerFor(env)
    )
  );
}
