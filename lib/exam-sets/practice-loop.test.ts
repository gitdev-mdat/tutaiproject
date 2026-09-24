import { describe, expect, it } from 'vitest';

import type { KnowledgeTreeDocument } from '@/lib/knowledge-tree/knowledge-tree-types';
import type { Question } from '@/lib/question-bank/qb-types';

import { evaluatePracticeResult, filterQuestionsByKnowledgeNode } from './practice-evaluation';

const NOW = '2026-08-27T00:00:00.000Z';

function question(id: string, correctAnswer: string, primaryKnowledgeNodeId?: string): Question {
  return {
    id,
    code: id.toUpperCase(),
    stem: `Nội dung ${id}`,
    questionType: 'MULTIPLE_CHOICE_SINGLE',
    options: [
      { key: 'A', content: 'Đáp án A' },
      { key: 'B', content: 'Đáp án B' },
      { key: 'C', content: 'Đáp án C' },
      { key: 'D', content: 'Đáp án D' },
    ],
    correctAnswer,
    explanation: `Giải thích ${id}`,
    subjectId: 'MATH',
    grade: 12,
    chapterId: 'chapter-1',
    primaryKnowledgeNodeId,
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
    contentHash: `hash-${id}`,
    examSetIds: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const knowledgeTree: KnowledgeTreeDocument = {
  schemaVersion: 1,
  updatedAt: NOW,
  nodes: [
    {
      id: 'math',
      title: 'Toán học',
      description: '',
      parentId: null,
      order: 1,
      status: 'ACTIVE',
      kind: 'GROUP',
      identitySource: 'TREE_NATIVE',
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: 'grade-12',
      title: 'Lớp 12',
      description: '',
      parentId: 'math',
      order: 1,
      status: 'ACTIVE',
      kind: 'GROUP',
      identitySource: 'TREE_NATIVE',
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: 'node-a',
      title: 'Tính đơn điệu của hàm số',
      description: '',
      parentId: 'grade-12',
      order: 1,
      status: 'ACTIVE',
      kind: 'KNOWLEDGE',
      identitySource: 'TREE_NATIVE',
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: 'node-b',
      title: 'Cực trị của hàm số',
      description: '',
      parentId: 'grade-12',
      order: 2,
      status: 'ACTIVE',
      kind: 'KNOWLEDGE',
      identitySource: 'TREE_NATIVE',
      createdAt: NOW,
      updatedAt: NOW,
    },
  ],
};

describe('Student practice result loop', () => {
  const questions = [
    question('q1', 'A', 'node-a'),
    question('q2', 'B', 'node-a'),
    question('q3', 'C', 'node-b'),
    question('q4', 'D', 'node-a'),
    question('q5', 'A', 'node-b'),
    question('q6', 'B', 'node-b'),
    question('q7', 'C', 'node-b'),
    question('q8', 'D', 'node-a'),
    question('q9', 'A', 'node-b'),
    question('q10', 'B', 'node-a'),
  ];

  it('calculates a deterministic mixed score and preserves question review states', () => {
    const result = evaluatePracticeResult(questions, {
      q1: 'A',
      q2: 'A',
      q3: 'C',
      q4: 'A',
      q5: 'A',
      q6: 'B',
      q7: 'C',
      q8: 'D',
      q9: 'A',
    });

    expect(result.correctCount).toBe(7);
    expect(result.incorrectCount).toBe(2);
    expect(result.unansweredCount).toBe(1);
    expect(result.total).toBe(10);
    expect(result.percentage).toBe(70);

    expect(result.items.find((item) => item.questionId === 'q1')).toMatchObject({
      selectedAnswer: 'A',
      correctAnswer: 'A',
      isCorrect: true,
      isUnanswered: false,
      primaryKnowledgeNodeId: 'node-a',
    });
    expect(result.items.find((item) => item.questionId === 'q10')).toMatchObject({
      selectedAnswer: null,
      correctAnswer: 'B',
      isCorrect: false,
      isUnanswered: true,
    });
  });

  it('groups wrong answers by node and sorts by incorrect count descending', () => {
    const result = evaluatePracticeResult(
      [question('q2', 'B', 'node-a'), question('q4', 'D', 'node-a'), question('q7', 'C', 'node-b')],
      { q2: 'A', q4: 'A', q7: 'A' },
      knowledgeTree
    );

    expect(result.weakAreas).toEqual([
      expect.objectContaining({
        knowledgeNodeId: 'node-a',
        incorrectCount: 2,
        title: 'Tính đơn điệu của hàm số',
      }),
      expect.objectContaining({
        knowledgeNodeId: 'node-b',
        incorrectCount: 1,
        title: 'Cực trị của hàm số',
      }),
    ]);
    expect(result.weakAreas[0].breadcrumb.join(' › ')).toContain('Toán học');
    expect(JSON.stringify(result.weakAreas)).not.toContain('Chưa phân loại kiến thức');
  });

  it('uses a safe fallback for an incorrect unmapped question', () => {
    const result = evaluatePracticeResult([question('legacy-q', 'B')], { 'legacy-q': 'A' });

    expect(result.items[0]).toMatchObject({
      questionId: 'legacy-q',
      isCorrect: false,
      primaryKnowledgeNodeId: undefined,
    });
    expect(result.weakAreas[0]).toMatchObject({
      title: 'Chưa phân loại kiến thức',
      incorrectCount: 1,
    });
  });

  it('returns a restrained perfect-result state without weak areas', () => {
    const result = evaluatePracticeResult([question('q1', 'A', 'node-a')], { q1: 'A' });

    expect(result.percentage).toBe(100);
    expect(result.isPerfect).toBe(true);
    expect(result.weakAreas).toHaveLength(0);
  });

  it('filters a new practice set to the selected knowledge node', () => {
    expect(
      filterQuestionsByKnowledgeNode(
        [
          question('q1', 'A', 'node-a'),
          question('q2', 'B', 'node-b'),
          question('q3', 'C', 'node-a'),
        ],
        'node-a'
      ).map((item) => item.id)
    ).toEqual(['q1', 'q3']);
  });
});
