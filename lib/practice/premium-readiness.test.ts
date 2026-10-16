import { describe, expect, it } from 'vitest';
import type { Question } from '@/lib/question-bank/qb-types';
import type { ExamRecord } from '@/lib/exams/exam-types';
import { computePremiumReadiness } from './premium-readiness';

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
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Question;
}

const plus = (overrides: Partial<Question> = {}) =>
  question({ accessTier: 'PLUS', usageContexts: ['PLUS_SPECIAL'], ...overrides });

const programs = [
  {
    title: 'Toán 12',
    chapters: [
      {
        id: 'c1',
        title: 'Hàm số',
        lessons: [
          { id: 'l1', title: 'Đơn điệu' },
          { id: 'l2', title: 'Cực trị' },
        ],
      },
    ],
  },
];

function exam(overrides: Partial<ExamRecord>): ExamRecord {
  return {
    id: 'e',
    name: 'Đề',
    publishStatus: 'PUBLISHED',
    durationMinutes: 45,
    questionIds: ['a', 'b'],
    publishedSnapshot: {
      questions: [question({ id: 'a' }), question({ id: 'b' })],
      metadata: { name: 'Đề', durationMinutes: 45 },
    },
    ...overrides,
  } as unknown as ExamRecord;
}

describe('computePremiumReadiness', () => {
  it('reports a Production-like catalog: one lesson with free questions, nothing Plus', () => {
    const questions = [
      question({}),
      question({}),
      question({}),
      question({ editorialStatus: 'ARCHIVED' }),
    ];
    const result = computePremiumReadiness(programs, questions, []);
    expect(result.questions).toEqual({
      published: 3,
      publishedOpen: 3,
      publishedPlus: 0,
      plusSpecialEligible: 0,
      plusSpecialUnpublished: 0,
      plusSpecialOutsideOpenChapters: 0,
    });
    const [chapter] = result.chapters;
    expect(chapter.lessonsWithPractice).toBe(1);
    expect(chapter.review).toEqual({ ready: false, lessonsNeeded: 1 });
    expect(chapter.synthesis).toMatchObject({ ready: false, eligible: 0, needed: 3 });
    expect(result.exams).toEqual([]);
  });

  it('opens synthesis at three eligible questions and explains what holds others back', () => {
    const questions = [
      question({}),
      question({ primaryKnowledgeNodeId: 'l2' }),
      question({ primaryKnowledgeNodeId: 'l2' }),
      plus(),
      plus({ primaryKnowledgeNodeId: 'l2' }),
      plus({ primaryKnowledgeNodeId: 'c1' }),
      plus({ editorialStatus: 'DRAFT' }),
      plus({ editorialStatus: 'IN_REVIEW' }),
      plus({ primaryKnowledgeNodeId: 'elsewhere' }),
    ];
    const result = computePremiumReadiness(programs, questions, []);
    const [chapter] = result.chapters;
    expect(chapter.review.ready).toBe(true);
    expect(chapter.synthesis).toEqual({
      ready: true,
      eligible: 3,
      needed: 0,
      unpublished: 2,
      notGradable: 0,
    });
    expect(result.questions.plusSpecialEligible).toBe(4);
    expect(result.questions.plusSpecialUnpublished).toBe(2);
    expect(result.questions.plusSpecialOutsideOpenChapters).toBe(1);
  });

  it('does not count Free questions or Plus questions without "Plus đặc biệt"', () => {
    const questions = [
      question({}),
      question({}),
      question({}),
      question({ accessTier: 'PLUS', usageContexts: ['OPEN_PRACTICE'] }),
    ];
    const [chapter] = computePremiumReadiness(programs, questions, []).chapters;
    expect(chapter.synthesis).toMatchObject({ ready: false, eligible: 0, needed: 3 });
  });

  it('flags published Plus questions that cannot be graded on the web', () => {
    const questions = [plus(), plus({ questionType: 'ESSAY', correctAnswer: undefined })];
    const [chapter] = computePremiumReadiness(programs, questions, []).chapters;
    expect(chapter.synthesis).toMatchObject({ eligible: 1, needed: 2, notGradable: 1 });
  });

  it('separates take-able exams from drafts and broken published exams', () => {
    const exams = [
      exam({ id: 'free' }),
      exam({ id: 'plus', accessTier: 'PLUS' } as Partial<ExamRecord>),
      exam({ id: 'draft', publishStatus: 'DRAFT', publishedSnapshot: undefined }),
      exam({ id: 'no-time', durationMinutes: undefined, publishedSnapshot: undefined }),
    ];
    const result = computePremiumReadiness(programs, [], exams);
    expect(result.exams.map((e) => [e.id, e.status, e.accessTier, e.takeable])).toEqual([
      ['free', 'PUBLISHED', 'FREE', true],
      ['plus', 'PUBLISHED', 'PLUS', true],
      ['draft', 'DRAFT', 'FREE', false],
      ['no-time', 'PUBLISHED', 'FREE', false],
    ]);
    expect(result.exams[0].questionCount).toBe(2);
  });
});
