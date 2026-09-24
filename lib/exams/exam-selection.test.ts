import { describe, expect, it } from 'vitest';
import type { Question } from '@/lib/question-bank/qb-types';
import {
  criteriaForQuestion,
  findQuestionCandidates,
  findReplacementCandidates,
  selectQuestionsRandomly,
  selectQuestionsSequentially,
} from './exam-selection';

function question(id: string, overrides: Partial<Question> = {}): Question {
  const now = '2026-08-21T00:00:00.000Z';
  return {
    id,
    code: id.toUpperCase(),
    stem: `Nội dung ${id}`,
    questionType: 'MULTIPLE_CHOICE_SINGLE',
    options: [
      { key: 'A', content: 'Đúng' },
      { key: 'B', content: 'Sai' },
    ],
    correctAnswer: 'A',
    explanation: 'Giải thích',
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
    examSetIds: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('exam selection', () => {
  it('returns only published questions that pass publication validation', () => {
    const eligible = question('q-eligible');
    const draft = question('q-draft', { editorialStatus: 'DRAFT' });
    const invalid = question('q-invalid', { usageContexts: [] });

    expect(findQuestionCandidates([invalid, draft, eligible])).toEqual([eligible]);
  });

  it('allocates overlapping rules sequentially without duplicates and reports shortfalls', () => {
    const questions = [question('q-1'), question('q-2')];
    const result = selectQuestionsSequentially(questions, [
      { count: 2, subjectId: 'MATH' },
      { count: 1, subjectId: 'MATH', difficulty: 'FOUNDATIONAL' },
    ]);

    expect(result.ok).toBe(false);
    expect(result.questionIds).toEqual([]);
    expect(new Set(result.questionIds).size).toBe(result.questionIds.length);
    if (!result.ok) {
      expect(result.error).toBe('INSUFFICIENT_QUESTIONS');
      expect(result.shortfalls).toEqual([
        expect.objectContaining({ ruleIndex: 1, requested: 1, selected: 0, shortage: 1 }),
      ]);
    }
  });

  it('matches chapter, lesson and primary or related knowledge-node taxonomy', () => {
    const primary = question('q-primary', {
      chapterId: 'chapter-1',
      lessonId: 'lesson-1',
      primaryKnowledgeNodeId: 'node-a',
    });
    const related = question('q-related', {
      chapterId: 'chapter-1',
      lessonId: 'lesson-1',
      primaryKnowledgeNodeId: 'node-b',
      relatedKnowledgeNodeIds: ['node-a'],
    });
    const otherLesson = question('q-other', {
      chapterId: 'chapter-1',
      lessonId: 'lesson-2',
      primaryKnowledgeNodeId: 'node-a',
    });

    expect(
      findQuestionCandidates([otherLesson, related, primary], {
        chapterId: 'chapter-1',
        lessonId: 'lesson-1',
        knowledgeNodeId: 'node-a',
      }).map((item) => item.id)
    ).toEqual(['q-primary', 'q-related']);
  });

  it('randomizes only inside a constrained pool and still honors exclusions', () => {
    const result = selectQuestionsRandomly(
      [question('q-1'), question('q-2'), question('q-3', { difficulty: 'ADVANCED' })],
      [{ count: 1, subjectId: 'MATH', difficulty: 'FOUNDATIONAL' }],
      ['q-1'],
      () => 0
    );

    expect(result).toMatchObject({ ok: true, questionIds: ['q-2'] });
  });

  it('finds replacement candidates while excluding every current exam question', () => {
    const questions = [question('q-1'), question('q-2'), question('q-3')];
    const candidates = findReplacementCandidates(
      questions,
      { subjectId: 'MATH', grade: 12, difficulty: 'FOUNDATIONAL' },
      ['q-1', 'q-2']
    );

    expect(candidates.map((candidate) => candidate.id)).toEqual(['q-3']);
  });

  it('derives replacement criteria from the target question taxonomy', () => {
    expect(
      criteriaForQuestion(
        question('q-1', {
          lessonId: 'lesson-1',
          primaryKnowledgeNodeId: 'node-1',
          difficulty: 'ADVANCED',
        })
      )
    ).toMatchObject({
      subjectId: 'MATH',
      grade: 12,
      chapterId: 'chapter-1',
      lessonId: 'lesson-1',
      knowledgeNodeId: 'node-1',
      difficulty: 'ADVANCED',
    });
  });
});
