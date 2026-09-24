import 'server-only';

import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { Question } from '@/lib/question-bank/qb-types';
import { isSelectableQuestion } from './exam-selection';
import type { ExamRecord, PublishedExamSnapshot } from './exam-types';

let mutationQueue: Promise<void> = Promise.resolve();

function examsFile(): string {
  return process.env.TUTAI_EXAMS_FILE ?? path.join(process.cwd(), 'data', 'exams', 'exams.json');
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function readExams(): Promise<ExamRecord[]> {
  const file = examsFile();
  try {
    const parsed = JSON.parse(await fs.readFile(/* turbopackIgnore: true */ file, 'utf8')) as Array<
      ExamRecord & Record<string, unknown>
    >;
    return parsed.map((record) => {
      const normalized = { ...record };
      // Remove the legacy per-question blueprint cache; replacements derive live taxonomy.
      delete normalized.selectionCriteriaByQuestionId;
      return normalized;
    });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function writeExams(exams: ExamRecord[]): Promise<void> {
  const file = examsFile();
  const directory = path.dirname(file);
  await fs.mkdir(/* turbopackIgnore: true */ directory, { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(/* turbopackIgnore: true */ temporary, JSON.stringify(exams, null, 2), 'utf8');
  await fs.rename(/* turbopackIgnore: true */ temporary, /* turbopackIgnore: true */ file);
}

async function mutate<T>(operation: (exams: ExamRecord[]) => Promise<T> | T): Promise<T> {
  let resolveResult!: (value: T | PromiseLike<T>) => void;
  let rejectResult!: (reason?: unknown) => void;
  const result = new Promise<T>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  mutationQueue = mutationQueue
    .catch(() => undefined)
    .then(async () => {
      try {
        const exams = await readExams();
        const value = await operation(exams);
        await writeExams(exams);
        resolveResult(value);
      } catch (error: unknown) {
        rejectResult(error);
      }
    });
  return result;
}

export async function listExams(): Promise<ExamRecord[]> {
  const exams = await readExams();
  return clone(exams.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
}

export async function getExam(id: string): Promise<ExamRecord | null> {
  const exam = (await readExams()).find((item) => item.id === id);
  return exam ? clone(exam) : null;
}

export async function saveExam(exam: ExamRecord): Promise<ExamRecord> {
  return mutate((exams) => {
    const persisted = clone(exam);
    const index = exams.findIndex((item) => item.id === exam.id);
    if (persisted.publishStatus === 'PUBLISHED' && index < 0) {
      throw new Error('PUBLISHED_EXAM_REQUIRES_PUBLISH');
    }
    if (index >= 0 && exams[index].publishStatus === 'PUBLISHED') {
      if (JSON.stringify(exams[index]) !== JSON.stringify(persisted)) {
        throw new Error('PUBLISHED_EXAM_IMMUTABLE');
      }
      return clone(exams[index]);
    }
    if (persisted.publishStatus === 'PUBLISHED') {
      throw new Error('PUBLISHED_EXAM_REQUIRES_PUBLISH');
    }
    if (index >= 0) exams[index] = persisted;
    else exams.push(persisted);
    return clone(persisted);
  });
}

export async function deleteExam(id: string): Promise<boolean> {
  return mutate((exams) => {
    const index = exams.findIndex((item) => item.id === id);
    if (index < 0) return false;
    if (exams[index].publishStatus === 'PUBLISHED') {
      throw new Error('PUBLISHED_EXAM_IMMUTABLE');
    }
    exams.splice(index, 1);
    return true;
  });
}

export async function publishExam(
  id: string,
  canonicalQuestions: readonly Question[]
): Promise<ExamRecord> {
  return mutate((exams) => {
    const index = exams.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('EXAM_NOT_FOUND');
    const existing = exams[index];
    if (existing.publishStatus === 'PUBLISHED' && existing.publishedSnapshot) {
      return clone(existing);
    }
    if (existing.questionIds.length === 0) throw new Error('EXAM_HAS_NO_QUESTIONS');
    if (new Set(existing.questionIds).size !== existing.questionIds.length) {
      throw new Error('EXAM_HAS_DUPLICATE_QUESTIONS');
    }

    const byId = new Map(canonicalQuestions.map((question) => [question.id, question]));
    const orderedQuestions = existing.questionIds.map((questionId) => byId.get(questionId));
    if (orderedQuestions.some((question) => !question)) throw new Error('QUESTION_NOT_FOUND');
    if (orderedQuestions.some((question) => !isSelectableQuestion(question as Question))) {
      throw new Error('QUESTION_NOT_PUBLISHABLE');
    }
    if (
      existing.subjectId &&
      orderedQuestions.some((question) => question?.subjectId !== existing.subjectId)
    ) {
      throw new Error('QUESTION_SUBJECT_MISMATCH');
    }
    if (existing.grade && orderedQuestions.some((question) => question?.grade !== existing.grade)) {
      throw new Error('QUESTION_GRADE_MISMATCH');
    }

    const publishedAt = new Date().toISOString();
    const snapshot: PublishedExamSnapshot = clone({
      version: 1,
      publishedAt,
      metadata: {
        name: existing.name,
        subjectId: existing.subjectId,
        grade: existing.grade,
        examType: existing.examType,
        durationMinutes: existing.durationMinutes,
        questionIds: [...existing.questionIds],
        rawExamCode: existing.rawExamCode,
        normalizedExamCode: existing.normalizedExamCode,
      },
      questions: orderedQuestions as Question[],
    });
    const published: ExamRecord = {
      ...existing,
      publishStatus: 'PUBLISHED',
      importStatus: 'COMPLETED',
      publishedAt,
      publishedSnapshot: snapshot,
      updatedAt: publishedAt,
    };
    exams[index] = published;
    return clone(published);
  });
}
