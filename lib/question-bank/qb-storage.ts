/**
 * Question Bank — Storage layer.
 *
 * Persistence: JSON files in data/question-bank/.
 * Uses atomic write via temp file + rename (same pattern as kg-storage).
 * In-memory cache is cleared on write.
 */

import fs from 'fs/promises';
import path from 'path';
import type {
  Question,
  QuestionAuditEntry,
  ImportJob,
  QuestionBankMetrics,
  QuestionFilter,
  QuestionListResult,
} from './qb-types';
import { computeQuestionFingerprints } from './qb-hash';

// ─── Paths ────────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data', 'question-bank');
const QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');
const AUDITS_FILE = path.join(DATA_DIR, 'audits.json');
const JOBS_FILE = path.join(DATA_DIR, 'import-jobs.json');

// ─── In-memory cache ──────────────────────────────────────────────────────────

interface QbStore {
  questions: Question[];
  audits: QuestionAuditEntry[];
  jobs: ImportJob[];
}

let cache: QbStore | null = null;

export function clearQbCache(): void {
  cache = null;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return fallback;
    }
    throw err;
  }
}

async function atomicWrite(filePath: string, data: unknown): Promise<void> {
  const tmp = `${filePath}.tmp.${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
  await safeRename(tmp, filePath);
}

async function safeRename(src: string, dest: string): Promise<void> {
  let retries = 10;
  while (retries > 0) {
    try {
      await fs.rename(src, dest);
      return;
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'EPERM' || nodeErr.code === 'EBUSY') {
        retries--;
        await new Promise((resolve) => setTimeout(resolve, 100));
      } else {
        throw err;
      }
    }
  }
  await fs.rename(src, dest);
}

// ─── Read full store ──────────────────────────────────────────────────────────

async function readStore(): Promise<QbStore> {
  if (cache) return cache;
  await ensureDir();
  const [questions, audits, jobs] = await Promise.all([
    readJsonFile<Question[]>(QUESTIONS_FILE, []),
    readJsonFile<QuestionAuditEntry[]>(AUDITS_FILE, []),
    readJsonFile<ImportJob[]>(JOBS_FILE, []),
  ]);
  cache = { questions, audits, jobs };
  return cache;
}

// ─── Questions ────────────────────────────────────────────────────────────────

export async function listQuestions(filter: QuestionFilter): Promise<QuestionListResult> {
  const store = await readStore();
  let results = store.questions;

  // Search
  if (filter.search) {
    const q = filter.search.toLowerCase();
    results = results.filter(
      (question) =>
        question.code.toLowerCase().includes(q) ||
        question.stem.toLowerCase().includes(q) ||
        (question.externalId ?? '').toLowerCase().includes(q) ||
        (question.source.sourceName ?? '').toLowerCase().includes(q) ||
        question.conceptCodes.some((c) => c.toLowerCase().includes(q)) ||
        question.skillCodes.some((s) => s.toLowerCase().includes(q))
    );
  }

  // Filters
  if (filter.subjectId) results = results.filter((q) => q.subjectId === filter.subjectId);
  if (filter.grade) results = results.filter((q) => q.grade === filter.grade);
  if (filter.chapterId) results = results.filter((q) => q.chapterId === filter.chapterId);
  if (filter.lessonId) results = results.filter((q) => q.lessonId === filter.lessonId);
  if (filter.curriculumItemId)
    results = results.filter((q) => q.primaryKnowledgeNodeId === filter.curriculumItemId);
  if (filter.questionType) results = results.filter((q) => q.questionType === filter.questionType);
  if (filter.difficulty) results = results.filter((q) => q.difficulty === filter.difficulty);
  if (filter.accessTier) results = results.filter((q) => q.accessTier === filter.accessTier);
  if (filter.usageContext)
    results = results.filter((q) => q.usageContexts.includes(filter.usageContext!));
  if (filter.editorialStatus)
    results = results.filter((q) => q.editorialStatus === filter.editorialStatus);
  if (filter.roadmapEligible !== undefined)
    results = results.filter((q) => q.roadmapEligible === filter.roadmapEligible);
  if (filter.isSpecial !== undefined)
    results = results.filter((q) => q.isSpecial === filter.isSpecial);
  if (filter.sourceType) results = results.filter((q) => q.source.sourceType === filter.sourceType);
  if (filter.importOrigin)
    results = results.filter(
      (q) => (q.importOrigin ?? (q.importJobId ? 'EXCEL' : 'MANUAL')) === filter.importOrigin
    );

  const total = results.length;
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 50;
  const start = (page - 1) * pageSize;
  const paged = results.slice(start, start + pageSize);

  return { questions: paged, total, page, pageSize };
}

export async function getQuestion(id: string): Promise<Question | null> {
  const store = await readStore();
  return store.questions.find((q) => q.id === id) ?? null;
}

export async function getQuestionByCode(code: string): Promise<Question | null> {
  const store = await readStore();
  return store.questions.find((q) => q.code === code) ?? null;
}

export async function getQuestionByExternalId(externalId: string): Promise<Question | null> {
  const store = await readStore();
  return store.questions.find((q) => q.externalId === externalId) ?? null;
}

export async function getQuestionByContentHash(hash: string): Promise<Question | null> {
  const store = await readStore();
  return (
    store.questions.find((question) => {
      if (question.contentHash === hash || question.fingerprints?.full === hash) return true;
      return (
        computeQuestionFingerprints(question.stem, question.options, question.correctAnswer)
          .full === hash
      );
    }) ?? null
  );
}

export async function getQuestionByAnyFingerprint(input: {
  stem: string;
  stemAndOptions: string;
  full: string;
}): Promise<Question | null> {
  const store = await readStore();
  return (
    store.questions.find((question) => {
      const fingerprints =
        question.fingerprints ??
        computeQuestionFingerprints(question.stem, question.options, question.correctAnswer);
      return (
        fingerprints.stem === input.stem ||
        fingerprints.stemAndOptions === input.stemAndOptions ||
        fingerprints.full === input.full
      );
    }) ?? null
  );
}

export async function deleteQuestion(id: string): Promise<boolean> {
  const store = await readStore();
  const next = store.questions.filter((question) => question.id !== id);
  if (next.length === store.questions.length) return false;
  store.questions = next;
  store.audits = store.audits.filter((entry) => entry.questionId !== id);
  await ensureDir();
  await Promise.all([
    atomicWrite(QUESTIONS_FILE, store.questions),
    atomicWrite(AUDITS_FILE, store.audits),
  ]);
  return true;
}

export async function saveQuestion(question: Question): Promise<void> {
  const store = await readStore();
  const idx = store.questions.findIndex((q) => q.id === question.id);
  if (idx >= 0) {
    store.questions[idx] = question;
  } else {
    store.questions.push(question);
  }
  await ensureDir();
  await atomicWrite(QUESTIONS_FILE, store.questions);
}

export async function saveManyQuestions(questions: Question[]): Promise<void> {
  const store = await readStore();
  for (const q of questions) {
    const idx = store.questions.findIndex((ex) => ex.id === q.id);
    if (idx >= 0) {
      store.questions[idx] = q;
    } else {
      store.questions.push(q);
    }
  }
  await ensureDir();
  await atomicWrite(QUESTIONS_FILE, store.questions);
}

export async function getMetrics(): Promise<QuestionBankMetrics> {
  const store = await readStore();
  const all = store.questions;
  return {
    total: all.length,
    draft: all.filter((q) => q.editorialStatus === 'DRAFT').length,
    inReview: all.filter((q) => q.editorialStatus === 'IN_REVIEW').length,
    published: all.filter((q) => q.editorialStatus === 'PUBLISHED').length,
    open: all.filter((q) => q.accessTier === 'OPEN').length,
    plus: all.filter((q) => q.accessTier === 'PLUS').length,
    roadmapEligible: all.filter((q) => q.roadmapEligible).length,
  };
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export async function appendAuditEntry(entry: QuestionAuditEntry): Promise<void> {
  const store = await readStore();
  store.audits.push(entry);
  await ensureDir();
  await atomicWrite(AUDITS_FILE, store.audits);
}

export async function listAuditEntries(questionId: string): Promise<QuestionAuditEntry[]> {
  const store = await readStore();
  return store.audits.filter((a) => a.questionId === questionId);
}

// ─── Import Jobs ──────────────────────────────────────────────────────────────

export async function listImportJobs(): Promise<ImportJob[]> {
  const store = await readStore();
  return [...store.jobs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getImportJob(id: string): Promise<ImportJob | null> {
  const store = await readStore();
  return store.jobs.find((j) => j.id === id) ?? null;
}

export async function getImportJobByIdempotencyKey(key: string): Promise<ImportJob | null> {
  const store = await readStore();
  return store.jobs.find((j) => j.idempotencyKey === key) ?? null;
}

export async function saveImportJob(job: ImportJob): Promise<void> {
  const store = await readStore();
  const idx = store.jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) {
    store.jobs[idx] = job;
  } else {
    store.jobs.push(job);
  }
  await ensureDir();
  await atomicWrite(JOBS_FILE, store.jobs);
}

// ─── Roadmap query contract ───────────────────────────────────────────────────

export interface RoadmapQuestionQuery {
  subjectId: SubjectId;
  grade: Grade;
  conceptCode?: string;
  skillCode?: string;
  difficulty?: Difficulty;
  roadmapPurpose?: RoadmapPurpose;
  accessTier: AccessTier;
  excludeIds?: string[];
  maxResults?: number;
}

import type { SubjectId, Grade, Difficulty, RoadmapPurpose, AccessTier } from './qb-types';

export async function queryRoadmapQuestions(query: RoadmapQuestionQuery): Promise<Question[]> {
  const store = await readStore();
  return store.questions
    .filter(
      (q) =>
        q.editorialStatus === 'PUBLISHED' &&
        q.roadmapEligible === true &&
        q.subjectId === query.subjectId &&
        q.grade === query.grade &&
        q.accessTier === query.accessTier &&
        (query.conceptCode === undefined || q.conceptCodes.includes(query.conceptCode)) &&
        (query.skillCode === undefined || q.skillCodes.includes(query.skillCode)) &&
        (query.difficulty === undefined || q.difficulty === query.difficulty) &&
        (query.roadmapPurpose === undefined || q.roadmapPurpose === query.roadmapPurpose) &&
        (query.excludeIds === undefined || !query.excludeIds.includes(q.id))
    )
    .slice(0, query.maxResults ?? 100);
}
