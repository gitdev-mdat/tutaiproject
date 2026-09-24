import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Question } from '@/lib/question-bank/qb-types';
import type { ExamRecord } from './exam-types';
import { getExam, listExams, publishExam, saveExam } from './exam-storage';

let testDirectory = '';

function question(id: string, overrides: Partial<Question> = {}): Question {
  const now = '2026-08-21T00:00:00.000Z';
  return {
    id,
    code: id.toUpperCase(),
    stem: `Nội dung gốc ${id}`,
    questionType: 'MULTIPLE_CHOICE_SINGLE',
    options: [
      { key: 'A', content: 'Đúng' },
      { key: 'B', content: 'Sai' },
    ],
    correctAnswer: 'A',
    explanation: 'Giải thích và đáp án',
    subjectId: 'MATH',
    grade: 12,
    chapterId: 'chapter-1',
    conceptCodes: [],
    skillCodes: [],
    difficulty: 'FOUNDATIONAL',
    accessTier: 'OPEN',
    usageContexts: ['SEMESTER_EXAM'],
    editorialStatus: 'PUBLISHED',
    isSpecial: false,
    roadmapEligible: false,
    prerequisiteConceptCodes: [],
    source: { sourceType: 'ORIGINAL', rightsStatus: 'OWNED' },
    contentHash: `hash-${id}`,
    assets: [
      {
        id: `asset-${id}`,
        role: 'QUESTION_IMAGE',
        storageKey: `questions/${id}/figure.png`,
        mimeType: 'image/png',
        checksum: `checksum-${id}`,
        createdAt: now,
      },
    ],
    examSetIds: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function exam(questionIds: string[]): ExamRecord {
  const now = '2026-08-21T00:00:00.000Z';
  return {
    id: 'exam-1',
    name: 'Đề kiểm tra',
    subjectId: 'MATH',
    grade: 12,
    questionIds,
    durationMinutes: 45,
    sourceName: '',
    sourceUrl: '',
    rightsStatus: 'INTERNAL_CONTENT',
    importMethod: 'QUESTION_BANK',
    importStatus: 'COMPLETED',
    publishStatus: 'DRAFT',
    rawExamCode: '',
    normalizedExamCode: '',
    createdAt: now,
    updatedAt: now,
  };
}

beforeEach(async () => {
  testDirectory = path.join(os.tmpdir(), `tutai-exams-${randomUUID()}`);
  await fs.mkdir(testDirectory, { recursive: true });
  process.env.TUTAI_EXAMS_FILE = path.join(testDirectory, 'exams.json');
});

afterEach(async () => {
  delete process.env.TUTAI_EXAMS_FILE;
  if (path.basename(testDirectory).startsWith('tutai-exams-')) {
    await fs.rm(testDirectory, { recursive: true, force: true });
  }
});

describe('exam storage', () => {
  it('persists a draft and preserves ordered canonical references', async () => {
    await saveExam(exam(['q-2', 'q-1']));

    expect((await listExams())[0].questionIds).toEqual(['q-2', 'q-1']);
    expect((await getExam('exam-1'))?.publishStatus).toBe('DRAFT');
  });

  it('freezes an immutable, render-complete snapshot during publication', async () => {
    const canonical = question('q-1');
    await saveExam(exam([canonical.id]));
    const published = await publishExam('exam-1', [canonical]);

    canonical.stem = 'Nội dung đã bị sửa sau xuất bản';
    canonical.correctAnswer = 'B';
    canonical.assets?.splice(0);

    const persisted = await getExam('exam-1');
    expect(persisted?.publishStatus).toBe('PUBLISHED');
    expect(persisted?.publishedSnapshot?.metadata.questionIds).toEqual(['q-1']);
    expect(persisted?.publishedSnapshot?.questions[0]).toMatchObject({
      stem: 'Nội dung gốc q-1',
      correctAnswer: 'A',
      assets: [expect.objectContaining({ storageKey: 'questions/q-1/figure.png' })],
    });

    await expect(saveExam({ ...published, name: 'Tên đã sửa' })).rejects.toThrow(
      'PUBLISHED_EXAM_IMMUTABLE'
    );
  });

  it('rejects taxonomy mismatches atomically during publication', async () => {
    const wrongSubject = question('q-physics', { subjectId: 'PHYSICS' });
    await saveExam(exam([wrongSubject.id]));

    await expect(publishExam('exam-1', [wrongSubject])).rejects.toThrow(
      'QUESTION_SUBJECT_MISMATCH'
    );
    const persisted = await getExam('exam-1');
    expect(persisted?.publishStatus).toBe('DRAFT');
    expect(persisted?.publishedSnapshot).toBeUndefined();
  });

  it('requires the publication path instead of accepting a forged published record', async () => {
    await expect(saveExam({ ...exam(['q-1']), publishStatus: 'PUBLISHED' })).rejects.toThrow(
      'PUBLISHED_EXAM_REQUIRES_PUBLISH'
    );
    expect(await listExams()).toEqual([]);
  });
});
