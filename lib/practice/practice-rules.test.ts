import { describe, expect, it } from 'vitest';
import type { Question } from '@/lib/question-bank/qb-types';
import {
  isPassingScore,
  pickLessonChecks,
  pickLessonSession,
  practiceQuestionState,
  resultsByDifficulty,
} from './practice-rules';
import { gradePracticeResponse } from './grading';

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

  it('includes the supported Q22 graph in lesson practice and still excludes drafts', () => {
    const graphQuestion = question({
      id: 'q22',
      code: 'Q22',
      stem: 'Đồ thị y = f′(x). Mệnh đề nào đúng?',
      correctAnswer: 'B',
      options: [
        { key: 'A', content: 'Đồng biến trên (1; 2)' },
        { key: 'B', content: 'Nghịch biến trên (0; 2)' },
        { key: 'C', content: 'Đồng biến trên (-2; 1)' },
        { key: 'D', content: 'Nghịch biến trên (-1; 1)' },
      ],
      explanation: 'Đồ thị cho thấy f′(x) < 0 trên (0; 2).',
      content: [
        { id: 'q22-text', type: 'TEXT', text: 'Đồ thị y = f′(x). Mệnh đề nào đúng?' },
        {
          id: 'q22-graph',
          type: 'IMAGE',
          media: {
            assetId: '/textbook-figures/derivative-sign-q22.svg',
            alt: 'Đồ thị dấu của đạo hàm f phẩy',
          },
        },
      ],
    });
    const draft = question({ id: 'draft', editorialStatus: 'DRAFT' });
    const otherLesson = question({ id: 'other-lesson', primaryKnowledgeNodeId: 'other' });

    expect(practiceQuestionState(graphQuestion)).toMatchObject({ state: 'IN_PRACTICE' });
    expect(pickLessonSession([draft, otherLesson, graphQuestion], 'lesson')).toEqual([
      graphQuestion,
    ]);
    expect(
      gradePracticeResponse(graphQuestion, {
        type: 'MULTIPLE_CHOICE_SINGLE',
        choice: 'B',
      }).correct
    ).toBe(true);
    expect(
      practiceQuestionState(
        question({
          id: 'unsupported-image',
          content: [
            {
              id: 'other-image',
              type: 'IMAGE',
              media: { assetId: '/private/image.png', alt: 'Unsupported image' },
            },
          ],
        })
      ).state
    ).toBe('NOT_USABLE');
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

describe('resultsByDifficulty', () => {
  it('tallies answers per level, easiest first, and leaves out questions that are gone', () => {
    expect(
      resultsByDifficulty([
        { difficulty: 'ADVANCED', correct: false },
        { difficulty: 'FOUNDATIONAL', correct: true },
        { difficulty: 'FOUNDATIONAL', correct: false },
        { difficulty: undefined, correct: true },
      ])
    ).toEqual([
      { difficulty: 'FOUNDATIONAL', correct: 1, total: 2 },
      { difficulty: 'ADVANCED', correct: 0, total: 1 },
    ]);
  });
});
