import { describe, expect, it } from 'vitest';
import type { Question } from '@/lib/question-bank/qb-types';
import type { ExamRecord } from './exam-types';
import {
  EXAM_GRACE_SECONDS,
  examParts,
  examScope,
  gradeExam,
  isExamTakeable,
  isPastDeadline,
  scoreOutOfTen,
} from './student-exam-rules';

function question(id: string, overrides: Partial<Question> = {}): Question {
  return {
    id,
    code: id,
    stem: 'Câu hỏi',
    questionType: 'MULTIPLE_CHOICE_SINGLE',
    options: [
      { key: 'A', content: '1' },
      { key: 'B', content: '2' },
    ],
    correctAnswer: 'A',
    explanation: 'Lời giải',
    subjectId: 'MATH',
    grade: '12',
    difficulty: 'FOUNDATIONAL',
    accessTier: 'OPEN',
    usageContexts: ['SEMESTER_EXAM'],
    editorialStatus: 'PUBLISHED',
    ...overrides,
  } as Question;
}

function exam(overrides: Partial<ExamRecord> = {}): ExamRecord {
  return {
    id: 'e',
    name: 'Đề',
    publishStatus: 'PUBLISHED',
    durationMinutes: 45,
    questionIds: ['a'],
    publishedSnapshot: {
      questions: [question('a')],
      metadata: { name: 'Đề', durationMinutes: 45 },
    },
    ...overrides,
  } as unknown as ExamRecord;
}

describe('examScope', () => {
  it('groups exam types the student recognises', () => {
    expect(examScope('NATIONAL_EXAM_MOCK')).toBe('NATIONAL');
    expect(examScope('OFFICIAL')).toBe('NATIONAL');
    expect(examScope('SEMESTER')).toBe('SEMESTER');
    expect(examScope(undefined)).toBe('OTHER');
  });
});

describe('isExamTakeable', () => {
  it('needs a published snapshot with a time limit', () => {
    expect(isExamTakeable(exam())).toBe(true);
    expect(isExamTakeable(exam({ publishStatus: 'DRAFT' }))).toBe(false);
    expect(isExamTakeable(exam({ publishedSnapshot: undefined }))).toBe(false);
  });
});

describe('gradeExam', () => {
  const questions = [
    question('a'),
    question('b', { questionType: 'NUMERIC', options: [], correctAnswer: '2,5' }),
    question('c'),
  ];

  it('counts blanks and unreadable answers as wrong', () => {
    const { results, correct } = gradeExam(questions, {
      a: { choice: 'A' },
      b: { value: '2.5' },
      c: { choice: 'Z' },
    });
    expect(correct).toBe(2);
    expect(results.find((r) => r.questionId === 'c')).toMatchObject({ correct: false });
    expect(gradeExam(questions, {}).results.every((r) => !r.answered)).toBe(true);
  });

  it('groups parts in exam order', () => {
    expect(examParts(questions).map((p) => [p.type, p.count])).toEqual([
      ['MULTIPLE_CHOICE_SINGLE', 2],
      ['NUMERIC', 1],
    ]);
  });
});

describe('score and deadline', () => {
  it('scores out of ten with one decimal', () => {
    expect(scoreOutOfTen(7, 12)).toBe(5.8);
    expect(scoreOutOfTen(0, 0)).toBe(0);
  });

  it('allows a short grace period after the deadline', () => {
    const deadline = new Date('2026-10-16T10:00:00Z');
    expect(
      isPastDeadline(deadline, new Date(deadline.getTime() + (EXAM_GRACE_SECONDS - 1) * 1000))
    ).toBe(false);
    expect(
      isPastDeadline(deadline, new Date(deadline.getTime() + (EXAM_GRACE_SECONDS + 1) * 1000))
    ).toBe(true);
  });
});
