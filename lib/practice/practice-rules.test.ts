import { describe, expect, it } from 'vitest';
import type { Question } from '@/lib/question-bank/qb-types';
import {
  isPassingScore,
  pickLessonChecks,
  pickLessonSession,
  practiceQuestionState,
} from './practice-rules';

function question(overrides: Partial<Question>): Question {
  return {
    id: 'q',
    code: 'Q',
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
    primaryKnowledgeNodeId: 'lesson',
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

describe('which questions students receive', () => {
  it('only published, free, open-practice, gradable questions', () => {
    expect(practiceQuestionState(question({})).state).toBe('IN_PRACTICE');
    expect(practiceQuestionState(question({ editorialStatus: 'DRAFT' })).state).toBe('DRAFT');
    expect(practiceQuestionState(question({ editorialStatus: 'IN_REVIEW' })).state).toBe(
      'IN_REVIEW'
    );
    expect(practiceQuestionState(question({ accessTier: 'PLUS' })).state).toBe(
      'PUBLISHED_ELSEWHERE'
    );
    expect(practiceQuestionState(question({ usageContexts: ['SEMESTER_EXAM'] })).state).toBe(
      'PUBLISHED_ELSEWHERE'
    );
    expect(practiceQuestionState(question({ questionType: 'SHORT_ANSWER' })).state).toBe(
      'NOT_USABLE'
    );
  });

  it('picks the lesson questions, easiest first, at most 10', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      question({
        id: `q${i}`,
        difficulty: i % 2 ? 'ADVANCED' : 'FOUNDATIONAL',
        createdAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
      })
    );
    const other = question({ id: 'other', primaryKnowledgeNodeId: 'another-lesson' });
    const picked = pickLessonSession([...many, other], 'lesson');
    expect(picked).toHaveLength(10);
    expect(picked.map((q) => q.id).slice(0, 6)).toEqual(['q0', 'q2', 'q4', 'q6', 'q8', 'q10']);
    expect(picked.some((q) => q.id === 'other')).toBe(false);
  });

  it('passes at 80%', () => {
    expect(isPassingScore(4, 5)).toBe(true);
    expect(isPassingScore(3, 5)).toBe(false);
    expect(isPassingScore(0, 0)).toBe(false);
  });
});

describe('quick questions inside the lesson', () => {
  const easy1 = question({ id: 'e1', createdAt: '2026-01-01T00:00:00.000Z' });
  const easy2 = question({ id: 'e2', createdAt: '2026-01-02T00:00:00.000Z' });
  const easy3 = question({ id: 'e3', createdAt: '2026-01-03T00:00:00.000Z' });
  const hard = question({ id: 'h', difficulty: 'ADVANCED' });
  const draft = question({ id: 'd', editorialStatus: 'DRAFT', usageContexts: ['LESSON_CHECK'] });

  it('defaults to the two easiest practice questions of the lesson', () => {
    expect(pickLessonChecks([hard, easy3, easy1, easy2], 'lesson').map((q) => q.id)).toEqual([
      'e1',
      'e2',
    ]);
  });

  it('uses the questions the admin pinned, but only ones students may receive', () => {
    const pinned = question({
      id: 'p',
      difficulty: 'ADVANCED',
      usageContexts: ['OPEN_PRACTICE', 'LESSON_CHECK'],
    });
    expect(pickLessonChecks([easy1, pinned, draft], 'lesson').map((q) => q.id)).toEqual(['p']);
  });

  it('falls back to the easiest available, and to nothing for other lessons', () => {
    expect(pickLessonChecks([hard], 'lesson').map((q) => q.id)).toEqual(['h']);
    expect(pickLessonChecks([easy1], 'other')).toEqual([]);
  });
});
