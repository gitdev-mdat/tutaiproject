import { describe, expect, it } from 'vitest';
import type { Question } from '@/lib/question-bank/qb-types';
import {
  isSetReady,
  isSynthesisQuestion,
  pickChapterReview,
  pickSynthesis,
  setFacts,
  setKindFromSegment,
} from './practice-sets';

let sequence = 0;
function question(overrides: Partial<Question>): Question {
  sequence += 1;
  return {
    id: `q${sequence}`,
    code: `Q${sequence}`,
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
    primaryKnowledgeNodeId: 'l1',
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
    createdAt: `2026-01-01T00:00:${String(sequence % 60).padStart(2, '0')}.000Z`,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Question;
}

const plus = (overrides: Partial<Question> = {}) =>
  question({ accessTier: 'PLUS', usageContexts: ['PLUS_SPECIAL'], ...overrides });

const chapter = { id: 'c1', lessonIds: ['l1', 'l2', 'l3'] };

describe('setKindFromSegment', () => {
  it('maps URL segments and rejects anything else', () => {
    expect(setKindFromSegment('chapter')).toBe('CHAPTER');
    expect(setKindFromSegment('synthesis')).toBe('SYNTHESIS');
    expect(setKindFromSegment('lesson')).toBeNull();
  });
});

describe('isSynthesisQuestion', () => {
  it('needs published, Plus tier and the Plus special context', () => {
    expect(isSynthesisQuestion(plus())).toBe(true);
    expect(isSynthesisQuestion(plus({ editorialStatus: 'ARCHIVED' }))).toBe(false);
    expect(isSynthesisQuestion(plus({ accessTier: 'OPEN' }))).toBe(false);
    expect(isSynthesisQuestion(plus({ usageContexts: ['SEMESTER_EXAM'] }))).toBe(false);
  });

  it('never treats free questions as Plus, whatever their text says', () => {
    expect(isSynthesisQuestion(question({ stem: 'Tổng hợp chương — Plus' }))).toBe(false);
  });
});

describe('pickChapterReview', () => {
  it('needs at least two lessons with free questions', () => {
    const only = [question({}), question({}), question({})];
    expect(pickChapterReview(only, chapter)).toEqual([]);
  });

  it('takes lesson by lesson so every lesson is covered, and never Plus questions', () => {
    const pool = [
      ...Array.from({ length: 8 }, () => question({ primaryKnowledgeNodeId: 'l1' })),
      question({ primaryKnowledgeNodeId: 'l2' }),
      question({ primaryKnowledgeNodeId: 'l3' }),
      plus({ primaryKnowledgeNodeId: 'l2' }),
    ];
    const picked = pickChapterReview(pool, chapter);
    expect(picked.length).toBe(10);
    expect(new Set(picked.map((q) => q.primaryKnowledgeNodeId))).toEqual(
      new Set(['l1', 'l2', 'l3'])
    );
    expect(picked.every((q) => q.accessTier === 'OPEN')).toBe(true);
  });
});

describe('pickSynthesis', () => {
  it('only takes Plus special questions from this chapter, easiest first', () => {
    const pool = [
      plus({ difficulty: 'ADVANCED', primaryKnowledgeNodeId: 'l2' }),
      plus({ difficulty: 'INTERMEDIATE', primaryKnowledgeNodeId: 'c1' }),
      plus({ primaryKnowledgeNodeId: 'other-lesson' }),
      question({}),
    ];
    const picked = pickSynthesis(pool, chapter);
    expect(picked.map((q) => q.difficulty)).toEqual(['INTERMEDIATE', 'ADVANCED']);
    expect(isSetReady(picked)).toBe(false);
  });
});

describe('setFacts', () => {
  it('counts only what the metadata says', () => {
    const picked = [
      plus({
        primaryKnowledgeNodeId: 'l1',
        relatedKnowledgeNodeIds: ['l2'],
        difficulty: 'ADVANCED',
      }),
      plus({
        primaryKnowledgeNodeId: 'l3',
        knowledgeCoverage: 'CROSS',
        isSpecial: true,
        specialReason: 'Hay',
      }),
      plus({ primaryKnowledgeNodeId: 'l3', difficulty: 'HIGH_DISCRIMINATION' }),
    ];
    const facts = setFacts(picked, chapter);
    expect(facts.questionCount).toBe(3);
    expect(facts.lessonsLinked).toBe(3);
    expect(facts.linkedCount).toBe(2);
    expect(facts.demandingCount).toBe(2);
    expect(facts.curatedCount).toBe(1);
    expect(isSetReady(picked)).toBe(true);
  });
});
