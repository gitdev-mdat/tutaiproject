import { describe, expect, it } from 'vitest';
import type { Question } from '@/lib/question-bank/qb-types';
import {
  PracticeResponseError,
  gradePracticeResponse,
  parsePracticeResponse,
  practiceExclusionReason,
  toPracticeQuestion,
} from './grading';

function question(overrides: Partial<Question>): Question {
  return {
    id: 'q-1',
    code: 'MATH-1',
    stem: 'Câu hỏi',
    questionType: 'MULTIPLE_CHOICE_SINGLE',
    options: [
      { key: 'A', content: '1' },
      { key: 'B', content: '2' },
      { key: 'C', content: '3' },
      { key: 'D', content: '4' },
    ],
    correctAnswer: 'B',
    explanation: 'Vì vậy.',
    subjectId: 'MATH',
    grade: '12',
    conceptCodes: [],
    skillCodes: [],
    difficulty: 'FOUNDATIONAL',
    accessTier: 'OPEN',
    usageContexts: ['OPEN_PRACTICE'],
    editorialStatus: 'PUBLISHED',
    isSpecial: false,
    roadmapEligible: false,
    prerequisiteConceptCodes: [],
    source: { sourceType: 'ORIGINAL', rightsStatus: 'OWNED' },
    contentHash: 'h',
    examSetIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Question;
}

const grade = (q: Question, raw: unknown) =>
  gradePracticeResponse(q, parsePracticeResponse(q, raw));

describe('single choice', () => {
  it('matches the stored key, ignoring case', () => {
    expect(grade(question({}), { choice: 'b' }).correct).toBe(true);
    expect(grade(question({}), { choice: 'A' }).correct).toBe(false);
  });
  it('rejects a key that is not an option', () => {
    expect(() => parsePracticeResponse(question({}), { choice: 'E' })).toThrow(
      PracticeResponseError
    );
  });
});

describe('multiple choice', () => {
  const q = question({ questionType: 'MULTIPLE_CHOICE_MULTIPLE', correctAnswer: 'A, C' });
  it('needs exactly the stored set, in any order', () => {
    expect(grade(q, { choices: ['C', 'a'] }).correct).toBe(true);
    expect(grade(q, { choices: ['A'] }).correct).toBe(false);
    expect(grade(q, { choices: ['A', 'C', 'D'] }).correct).toBe(false);
  });
});

describe('true/false', () => {
  const q = question({
    questionType: 'TRUE_FALSE',
    options: [],
    correctAnswer: '',
    trueFalseStatements: [
      { id: 's1', content: 'a', isTrue: true },
      { id: 's2', content: 'b', isTrue: false },
    ],
  });
  it('is correct only when every statement is right, and reports each one', () => {
    expect(grade(q, { statements: { s1: true, s2: false } }).correct).toBe(true);
    const partial = grade(q, { statements: { s1: true, s2: true } });
    expect(partial.correct).toBe(false);
    expect(partial.statements?.map((s) => s.correct)).toEqual([true, false]);
  });
  it('requires an answer for every statement', () => {
    expect(() => parsePracticeResponse(q, { statements: { s1: true } })).toThrow(
      PracticeResponseError
    );
  });
  it('grades the legacy single-statement form', () => {
    const legacy = question({ questionType: 'TRUE_FALSE', options: [], correctAnswer: 'FALSE' });
    expect(grade(legacy, { statements: { statement: false } }).correct).toBe(true);
  });
});

describe('numeric', () => {
  const q = question({ questionType: 'NUMERIC', options: [], correctAnswer: '2.5' });
  it('accepts a comma or a dot as decimal separator', () => {
    expect(grade(q, { value: '2,5' }).correct).toBe(true);
    expect(grade(q, { value: '2.50' }).correct).toBe(true);
    expect(grade(q, { value: '2.6' }).correct).toBe(false);
  });
  it('rejects text that is not a number', () => {
    expect(() => parsePracticeResponse(q, { value: 'hai' })).toThrow(PracticeResponseError);
  });
});

describe('eligibility', () => {
  it('keeps out short answers, images and questions without an explanation', () => {
    expect(practiceExclusionReason(question({}))).toBeNull();
    expect(practiceExclusionReason(question({ questionType: 'SHORT_ANSWER' }))).not.toBeNull();
    expect(practiceExclusionReason(question({ hasMedia: true }))).not.toBeNull();
    expect(practiceExclusionReason(question({ explanation: ' ' }))).not.toBeNull();
    expect(practiceExclusionReason(question({ correctAnswer: 'E' }))).not.toBeNull();
  });
});

describe('student view', () => {
  it('never includes the answer or the explanation', () => {
    const view = JSON.stringify(toPracticeQuestion(question({ solutionGuidance: 'gợi ý' })));
    expect(view).not.toContain('correctAnswer');
    expect(view).not.toContain('Vì vậy');
    expect(view).not.toContain('gợi ý');
  });
});
