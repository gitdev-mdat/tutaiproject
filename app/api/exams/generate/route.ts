import { NextResponse } from 'next/server';
import { getQuestion, listQuestions } from '@/lib/question-bank/qb-storage';
import type { Question, QuestionFilter } from '@/lib/question-bank/qb-types';
import {
  COGNITIVE_LEVEL_VALUES,
  DIFFICULTY_VALUES,
  GRADE_VALUES,
  QUESTION_TYPE_VALUES,
  SUBJECT_ID_VALUES,
  USAGE_CONTEXT_VALUES,
} from '@/lib/question-bank/qb-types';
import {
  criteriaForQuestion,
  findQuestionCandidates,
  selectQuestionsByRules,
  type ExamSelectionStrategy,
} from '@/lib/exams/exam-selection';
import type { ExamQuestionCriteria, ExamSelectionRule } from '@/lib/exams/exam-types';

interface GenerateRequest {
  mode?: 'GENERATE' | 'CANDIDATES' | 'REPLACEMENT';
  strategy?: ExamSelectionStrategy;
  criteria?: unknown;
  rules?: unknown;
  excludeQuestionIds?: unknown;
  currentQuestionIds?: unknown;
  targetQuestionId?: unknown;
  limit?: unknown;
}

const MAX_RULES = 50;
const MAX_GENERATED_QUESTIONS = 500;
const MAX_EXCLUDED_QUESTIONS = 10_000;
const MAX_CANDIDATE_RESULTS = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function optionalText(value: unknown, maxLength = 200): string | undefined | null {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return null;
  const result = value.trim();
  return result && result.length <= maxLength ? result : null;
}

function isAllowed<T extends readonly unknown[]>(values: T, value: unknown): value is T[number] {
  return values.includes(value);
}

function parseCriteria(value: unknown): ExamQuestionCriteria | null {
  if (value === undefined) return {};
  if (!isRecord(value)) return null;

  const search = optionalText(value.search, 300);
  const chapterId = optionalText(value.chapterId);
  const lessonId = optionalText(value.lessonId);
  const topicId = optionalText(value.topicId);
  const knowledgeNodeId = optionalText(value.knowledgeNodeId);
  if ([search, chapterId, lessonId, topicId, knowledgeNodeId].includes(null)) return null;
  if (value.subjectId !== undefined && !isAllowed(SUBJECT_ID_VALUES, value.subjectId)) return null;
  if (value.grade !== undefined && !isAllowed(GRADE_VALUES, value.grade)) return null;
  if (value.questionType !== undefined && !isAllowed(QUESTION_TYPE_VALUES, value.questionType))
    return null;
  if (value.difficulty !== undefined && !isAllowed(DIFFICULTY_VALUES, value.difficulty))
    return null;
  if (
    value.cognitiveLevel !== undefined &&
    !isAllowed(COGNITIVE_LEVEL_VALUES, value.cognitiveLevel)
  )
    return null;
  if (value.usageContext !== undefined && !isAllowed(USAGE_CONTEXT_VALUES, value.usageContext))
    return null;

  return {
    search: search ?? undefined,
    subjectId: value.subjectId as ExamQuestionCriteria['subjectId'],
    grade: value.grade as ExamQuestionCriteria['grade'],
    chapterId: chapterId ?? undefined,
    lessonId: lessonId ?? undefined,
    topicId: topicId ?? undefined,
    knowledgeNodeId: knowledgeNodeId ?? undefined,
    questionType: value.questionType as ExamQuestionCriteria['questionType'],
    difficulty: value.difficulty as ExamQuestionCriteria['difficulty'],
    cognitiveLevel: value.cognitiveLevel as ExamQuestionCriteria['cognitiveLevel'],
    usageContext: value.usageContext as ExamQuestionCriteria['usageContext'],
  };
}

function parseQuestionIds(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_EXCLUDED_QUESTIONS) return null;
  if (value.some((id) => typeof id !== 'string' || !id.trim())) return null;
  return [...new Set(value.map((id) => (id as string).trim()))];
}

function parseRules(value: unknown): ExamSelectionRule[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_RULES) return null;
  const rules: ExamSelectionRule[] = [];
  let total = 0;
  for (const item of value) {
    if (!isRecord(item) || !Number.isInteger(item.count) || Number(item.count) <= 0) return null;
    const criteria = parseCriteria(item);
    if (!criteria) return null;
    const count = Number(item.count);
    total += count;
    if (total > MAX_GENERATED_QUESTIONS) return null;
    rules.push({ ...criteria, count });
  }
  return rules;
}

function storageFilter(
  criteria: ExamQuestionCriteria,
  page = 1,
  pageSize = 1_000_000
): QuestionFilter {
  return {
    search: criteria.search,
    subjectId: criteria.subjectId,
    grade: criteria.grade,
    chapterId: criteria.chapterId,
    lessonId: criteria.lessonId,
    questionType: criteria.questionType,
    difficulty: criteria.difficulty,
    usageContext: criteria.usageContext,
    editorialStatus: 'PUBLISHED',
    page,
    pageSize,
  };
}

function sharedStorageCriteria(rules: readonly ExamSelectionRule[]): ExamQuestionCriteria {
  const shared: ExamQuestionCriteria = {};
  const keys = [
    'search',
    'subjectId',
    'grade',
    'chapterId',
    'lessonId',
    'questionType',
    'difficulty',
    'usageContext',
  ] as const;
  for (const key of keys) {
    const first = rules[0][key];
    if (first !== undefined && rules.every((rule) => rule[key] === first)) {
      Object.assign(shared, { [key]: first });
    }
  }
  return shared;
}

async function eligibleQuestions(criteria: ExamQuestionCriteria) {
  return (await listQuestions(storageFilter(criteria))).questions;
}

async function scanEligibleCandidates(
  criteria: ExamQuestionCriteria,
  excludedQuestionIds: readonly string[],
  limit: number
): Promise<{ questions: Question[]; total: number }> {
  const pageSize = 250;
  const selected: Question[] = [];
  let total = 0;
  let page = 1;

  while (true) {
    const result = await listQuestions(storageFilter(criteria, page, pageSize));
    const matching = findQuestionCandidates(result.questions, criteria, excludedQuestionIds);
    total += matching.length;
    selected.push(...matching);
    selected.sort((left, right) => left.id.localeCompare(right.id));
    if (selected.length > limit) selected.splice(limit);
    if (page * pageSize >= result.total) break;
    page += 1;
  }
  return { questions: selected, total };
}

export async function POST(request: Request) {
  try {
    const parsed: unknown = await request.json();
    if (!isRecord(parsed)) {
      return NextResponse.json({ error: 'INVALID_REQUEST_BODY' }, { status: 400 });
    }
    const body = parsed as GenerateRequest;
    const mode = body.mode ?? 'GENERATE';
    if (!['GENERATE', 'CANDIDATES', 'REPLACEMENT'].includes(mode)) {
      return NextResponse.json({ error: 'INVALID_MODE' }, { status: 400 });
    }

    const excludedQuestionIds = parseQuestionIds(body.excludeQuestionIds);
    const currentQuestionIds = parseQuestionIds(body.currentQuestionIds);
    if (!excludedQuestionIds || !currentQuestionIds) {
      return NextResponse.json({ error: 'INVALID_QUESTION_IDS' }, { status: 400 });
    }

    if (mode === 'CANDIDATES') {
      const criteria = parseCriteria(body.criteria);
      if (!criteria) return NextResponse.json({ error: 'INVALID_CRITERIA' }, { status: 400 });
      const requestedLimit = Number.isInteger(body.limit) ? Number(body.limit) : 50;
      const limit = Math.min(Math.max(requestedLimit, 1), MAX_CANDIDATE_RESULTS);
      return NextResponse.json(await scanEligibleCandidates(criteria, excludedQuestionIds, limit));
    }

    if (mode === 'REPLACEMENT') {
      if (typeof body.targetQuestionId !== 'string' || !body.targetQuestionId.trim()) {
        return NextResponse.json({ error: 'TARGET_QUESTION_REQUIRED' }, { status: 400 });
      }
      const target = await getQuestion(body.targetQuestionId.trim());
      if (!target) return NextResponse.json({ error: 'QUESTION_NOT_FOUND' }, { status: 404 });
      const criteria = criteriaForQuestion(target);
      return NextResponse.json(await scanEligibleCandidates(criteria, currentQuestionIds, 20));
    }

    const rules = parseRules(body.rules);
    if (!rules) {
      return NextResponse.json(
        {
          error: 'INVALID_CRITERIA',
          message: `Cần 1-${MAX_RULES} nhóm hợp lệ và không quá ${MAX_GENERATED_QUESTIONS} câu.`,
        },
        { status: 400 }
      );
    }
    const strategy = body.strategy ?? 'SEQUENTIAL';
    if (strategy !== 'SEQUENTIAL' && strategy !== 'RANDOM') {
      return NextResponse.json({ error: 'INVALID_STRATEGY' }, { status: 400 });
    }

    const questions = await eligibleQuestions(sharedStorageCriteria(rules));
    const result = selectQuestionsByRules(questions, rules, excludedQuestionIds, strategy);
    if (!result.ok) return NextResponse.json(result, { status: 422 });
    const byId = new Map(questions.map((question) => [question.id, question]));
    return NextResponse.json({
      ...result,
      questions: result.questionIds.flatMap((questionId) => {
        const question = byId.get(questionId);
        return question ? [question] : [];
      }),
    });
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Không thể chọn câu hỏi.' },
      { status: 500 }
    );
  }
}
