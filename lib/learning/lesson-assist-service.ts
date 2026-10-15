import 'server-only';

import { createHash } from 'node:crypto';
import { ThinkingLevel } from '@google/genai';
import { getAuthRepository } from '@/lib/auth/repository';
import { GEMINI_MODELS } from '@/lib/config/models';
import { findLessonInCatalog } from '@/lib/knowledge-tree/learning-visibility';
import {
  getLearningCatalog,
  getVisibleLessonArticle,
} from '@/lib/knowledge-tree/knowledge-tree-service';
import { buildLessonJourney, problemFunctionSource } from '@/lib/knowledge-tree/lesson-journey';
import {
  PracticeResponseError,
  trueFalseStatements,
  type PracticeResponse,
} from '@/lib/practice/grading';
import {
  getAnsweredPracticeQuestion,
  gradeLessonCheckForAssist,
  PracticeError,
  type GradedQuestion,
} from '@/lib/practice/practice-service';
import {
  ASSIST_LIMITS,
  ASSIST_RESPONSE_SCHEMA,
  AssistError,
  generateAssist,
  type AssistContext,
  type AssistHelp,
  type AssistProvider,
  type AssistRequest,
} from './lesson-assist';

type Env = Record<string, string | undefined>;

/**
 * Usage limits per student. A confused student rarely needs more than a few
 * explanations in a row; the day cap bounds the cost of any one account.
 * Cached answers (same spot of the same lesson version) do not count.
 */
export const ASSIST_RATE_LIMITS = {
  burst: { max: 6, windowMs: 10 * 60 * 1000 },
  daily: { max: 30, windowMs: 24 * 60 * 60 * 1000 },
} as const;

export type AssistProviderName = 'gemini' | 'mock';

/**
 * Whether the assistant can run here. The mock provider is for local checks
 * only: never on Vercel, never in a production build unless explicitly allowed
 * for a local test run, and every mock answer is labelled in the UI.
 */
export function getAssistAvailability(env: Env = process.env): {
  available: boolean;
  provider: AssistProviderName | null;
} {
  if (env.STUDENT_ASSIST_PROVIDER === 'mock') {
    const allowed =
      !env.VERCEL && (env.NODE_ENV !== 'production' || env.STUDENT_ASSIST_ALLOW_MOCK === '1');
    return allowed ? { available: true, provider: 'mock' } : { available: false, provider: null };
  }
  if (env.STUDENT_ASSIST_DISABLED === '1' || !env.GEMINI_API_KEY) {
    return { available: false, provider: null };
  }
  return { available: true, provider: 'gemini' };
}

const geminiProvider: AssistProvider = async (prompt, signal) => {
  const { gemini } = await import('@/lib/ai/gemini-client');
  const response = await gemini.models.generateContent({
    model: GEMINI_MODELS.studentAssist,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: ASSIST_RESPONSE_SCHEMA,
      temperature: 0.3,
      maxOutputTokens: ASSIST_LIMITS.maxOutputTokens,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      abortSignal: signal,
    },
  });
  const finishReason = response.candidates?.[0]?.finishReason;
  if (finishReason && finishReason !== 'STOP') {
    // Counts only: a cut-off answer shows up as MALFORMED for the student.
    console.warn('[lesson-assist] gemini stopped early', {
      finishReason,
      outputTokens: response.usageMetadata?.candidatesTokenCount,
      thinkingTokens: response.usageMetadata?.thoughtsTokenCount,
    });
  }
  return response.text ?? '';
};

export type MockFailure = 'quota' | 'timeout' | 'malformed' | 'wrong-math';

/**
 * Deterministic local provider for browser checks without a paid key.
 * `failure` simulates what the real provider can do wrong.
 */
const mockProvider =
  (failure: MockFailure | null): AssistProvider =>
  async (prompt, signal) => {
    const heading = /Chỗ em chưa hiểu: (.+)/.exec(prompt)?.[1] ?? '';
    if (failure === 'quota') {
      throw Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 });
    }
    if (failure === 'timeout') {
      await new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason));
        setTimeout(resolve, 120_000);
      });
    }
    if (failure === 'malformed') return '{"summary": 1}';
    const fn = /hãy dùng đúng hàm của bài: y = (.+)\./.exec(prompt)?.[1] ?? null;
    const wrong = failure === 'wrong-math';
    // Without a function from the content (e.g. a question with a parameter m),
    // answer like a model would: about the expression in the question.
    const math = fn
      ? {
          function: fn,
          derivative: wrong ? '3x^2 + 3' : '3x^2 - 3',
          criticalPoints: wrong ? ['0'] : ['-1', '1'],
          increasing: [
            { from: '-inf', to: '-1' },
            { from: '1', to: '+inf' },
          ],
          decreasing: [{ from: '-1', to: '1' }],
        }
      : { function: 'x^3 + mx + 1' };
    return JSON.stringify({
      summary: `(Giả lập) Ý "${heading}" nói rằng: nhìn dấu của đạo hàm là biết đồ thị đi lên hay đi xuống.`,
      keyIdea: "(Giả lập) $y' > 0$ thì đồ thị đi lên, $y' < 0$ thì đồ thị đi xuống.",
      steps: [
        { title: 'Tìm tập xác định', detail: 'Hàm đa thức xác định trên $\\mathbb{R}$.' },
        { title: 'Tính đạo hàm', detail: "$y' = 3x^2 - 3$." },
        { title: 'Xét dấu', detail: "$y' = 0$ khi $x = \\pm 1$." },
      ],
      checkQuestion: {
        question: "(Giả lập) Nếu $y' < 0$ trên một khoảng thì sao?",
        answer: 'Hàm số nghịch biến trên khoảng đó.',
      },
      visual: fn ? 'table' : 'graph',
      math,
    });
  };

// ─── Context from published content ──────────────────────────────────────────

const LETTERS = 'abcdefgh';

function describeQuestion(
  graded: GradedQuestion
): Pick<
  AssistContext,
  'content' | 'studentAnswer' | 'correctAnswer' | 'officialExplanation' | 'contextFunction'
> {
  const { question } = graded;
  const response = graded.response as PracticeResponse;
  const option = (key: string) => {
    const found = question.options.find((o) => o.key === key);
    return found ? `${key}. ${found.content}` : key;
  };
  const statements = trueFalseStatements(question);
  const content = [
    question.stem,
    ...question.options.map((o) => `${o.key}. ${o.content}`),
    ...statements.map((s, i) => `${LETTERS[i] ?? i + 1}) ${s.content}`),
  ].join('\n');

  let studentAnswer = '';
  let correctAnswer = '';
  switch (response.type) {
    case 'MULTIPLE_CHOICE_SINGLE':
      studentAnswer = option(response.choice);
      correctAnswer = question.correctAnswer
        .split(/[,;\s]+/)
        .filter(Boolean)
        .map(option)
        .join('; ');
      break;
    case 'MULTIPLE_CHOICE_MULTIPLE':
      studentAnswer = response.choices.map(option).join('; ');
      correctAnswer = question.correctAnswer
        .split(/[,;\s]+/)
        .filter(Boolean)
        .map(option)
        .join('; ');
      break;
    case 'TRUE_FALSE':
      studentAnswer = statements
        .map((s, i) => `${LETTERS[i] ?? i + 1}) ${response.statements[s.id] ? 'Đúng' : 'Sai'}`)
        .join(', ');
      correctAnswer = statements
        .map((s, i) => `${LETTERS[i] ?? i + 1}) ${s.isTrue ? 'Đúng' : 'Sai'}`)
        .join(', ');
      break;
    case 'NUMERIC':
      studentAnswer = response.value;
      correctAnswer = question.correctAnswer;
      break;
  }
  return {
    content,
    studentAnswer,
    correctAnswer,
    officialExplanation: question.explanation ?? '',
    contextFunction: problemFunctionSource(question.stem),
  };
}

export interface ResolvedAssist {
  context: AssistContext;
  /** Identifies the spot and the content version, without anything about the student. */
  cacheKey: string;
}

/**
 * Turns the student's pointer (lesson id + stage/example/question id) into the
 * content it points at, from published data only. Questions must belong to
 * this lesson and, for practice, to an attempt of this student that already
 * has an answer.
 */
export async function resolveAssistContext(
  studentId: string,
  lessonId: string,
  request: AssistRequest
): Promise<ResolvedAssist> {
  const article = await getVisibleLessonArticle(lessonId);
  if (!article) throw new AssistError('NOT_FOUND', 'Bài học này chưa mở.');
  if (request.contentVersion && request.contentVersion !== article.updatedAt) {
    throw new AssistError('STALE');
  }
  const found = findLessonInCatalog(await getLearningCatalog(), lessonId);
  const subject = found?.subject.title ?? '';
  const journey = buildLessonJourney(article.blocks, { checks: 0 });
  const base = { subject, lessonTitle: article.title };
  const { target } = request;
  const version = article.updatedAt;

  if (target.kind === 'concept') {
    const stage = journey.stages.find((s) => s.id === target.stageId);
    if (!stage || stage.kind !== 'concept') throw new AssistError('NOT_FOUND');
    return {
      context: {
        ...base,
        focus: 'concept',
        heading: stage.title,
        content: stage.body,
        contextFunction: journey.graphSource,
      },
      cacheKey: `concept:${lessonId}:${version}:${stage.id}`,
    };
  }

  if (target.kind === 'example') {
    const stage = journey.stages.find((s) => s.kind === 'example');
    const example = stage?.kind === 'example' ? stage.examples[target.exampleIndex] : undefined;
    if (!example) throw new AssistError('NOT_FOUND');
    const revealed = Math.min(target.revealedSteps, example.steps.length);
    // Help on an example comes after the student has tried and opened a step.
    if (example.steps.length > 0 && revealed === 0) throw new AssistError('NOT_ANSWERED');
    return {
      context: {
        ...base,
        focus: 'example',
        heading: example.title,
        content: example.problem,
        solution: example.steps
          .slice(0, revealed)
          .map((step) => (step.label ? `${step.label}: ${step.body}` : step.body)),
        revealedSteps: revealed,
        totalSteps: example.steps.length,
        contextFunction: problemFunctionSource(example.problem),
      },
      cacheKey: `example:${lessonId}:${version}:${target.exampleIndex}:${revealed}`,
    };
  }

  let graded: GradedQuestion | null;
  try {
    graded =
      target.kind === 'check'
        ? await gradeLessonCheckForAssist(lessonId, target.questionId, target.response)
        : await getAnsweredPracticeQuestion(
            studentId,
            lessonId,
            target.attemptId,
            target.questionId
          );
  } catch (error) {
    if (error instanceof PracticeError) {
      throw new AssistError(
        error.status === 404 || error.status === 410 ? 'NOT_FOUND' : 'INVALID_REQUEST'
      );
    }
    // An unreadable response for a quick question.
    if (error instanceof PracticeResponseError) throw new AssistError('NOT_ANSWERED');
    throw error;
  }
  if (!graded) throw new AssistError('NOT_ANSWERED');
  const described = describeQuestion(graded);
  const responseHash = createHash('sha256')
    .update(JSON.stringify(graded.response))
    .digest('hex')
    .slice(0, 16);
  return {
    context: {
      ...base,
      focus: graded.correct ? 'right-answer' : 'wrong-answer',
      heading: 'Câu hỏi',
      ...described,
    },
    cacheKey: `question:${lessonId}:${graded.question.id}:${graded.question.updatedAt}:${responseHash}`,
  };
}

// ─── Cost controls ───────────────────────────────────────────────────────────

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 300;
type CacheEntry = { help: AssistHelp; at: number };
const globalCache = globalThis as unknown as {
  tutaiAssistCache?: Map<string, CacheEntry>;
  tutaiAssistInFlight?: Set<string>;
};
const cache = (globalCache.tutaiAssistCache ??= new Map());
const inFlight = (globalCache.tutaiAssistInFlight ??= new Set());

/**
 * In-memory only: the same spot of the same lesson version gets the same
 * explanation, so repeat requests (by anyone) cost nothing. The key holds no
 * student identity; nothing is written to disk or the database.
 */
function cached(key: string): AssistHelp | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.help;
}

function remember(key: string, help: AssistHelp) {
  cache.set(key, { help, at: Date.now() });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

const rateKey = (kind: string, studentId: string) =>
  `assist-${kind}:${createHash('sha256').update(studentId).digest('hex')}`;

async function consumeQuota(studentId: string) {
  const repository = await getAuthRepository();
  const burst = await repository.consumeRateLimit(
    rateKey('burst', studentId),
    ASSIST_RATE_LIMITS.burst.windowMs
  );
  if (burst > ASSIST_RATE_LIMITS.burst.max) throw new AssistError('RATE_LIMITED');
  const daily = await repository.consumeRateLimit(
    rateKey('day', studentId),
    ASSIST_RATE_LIMITS.daily.windowMs
  );
  if (daily > ASSIST_RATE_LIMITS.daily.max) {
    throw new AssistError(
      'RATE_LIMITED',
      'Hôm nay em đã dùng hết lượt hỏi trợ lý. Ngày mai em hỏi tiếp nhé.'
    );
  }
}

export async function requestLessonAssist(
  studentId: string,
  lessonId: string,
  request: AssistRequest,
  options: { env?: Env; mockFailure?: MockFailure | null } = {}
): Promise<AssistHelp & { cached: boolean }> {
  const env = options.env ?? process.env;
  const availability = getAssistAvailability(env);
  if (!availability.available || !availability.provider) throw new AssistError('UNAVAILABLE');
  const { context, cacheKey } = await resolveAssistContext(studentId, lessonId, request);
  const mockFailure = availability.provider === 'mock' ? (options.mockFailure ?? null) : null;
  const key = `${availability.provider}:${mockFailure ?? ''}:${cacheKey}`;
  const hit = cached(key);
  if (hit) return { ...hit, cached: true };

  if (inFlight.has(studentId)) throw new AssistError('BUSY');
  inFlight.add(studentId);
  try {
    await consumeQuota(studentId);
    const help = await generateAssist(
      context,
      availability.provider === 'mock' ? mockProvider(mockFailure) : geminiProvider,
      availability.provider
    );
    remember(key, help);
    return { ...help, cached: false };
  } finally {
    inFlight.delete(studentId);
  }
}
