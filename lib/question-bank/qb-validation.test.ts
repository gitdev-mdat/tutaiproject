/**
 * Question Bank — Core validation tests
 */

import { describe, it, expect } from 'vitest';
import {
  validateForPublishing,
  validateForDraft,
  validateForManualCreation,
  validateForImportCandidate,
  validateAnswer,
  validateSpecialQuestion,
  rightsBlocksPublish,
  isValidStatusTransition,
} from './qb-validation';
import { computeContentHash } from './qb-hash';
import type { Question, QuestionOption } from './qb-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOption(key: string, content = `Option ${key}`): QuestionOption {
  return { key, content };
}

function baseQuestion(overrides: Partial<Question> = {}): Partial<Question> {
  return {
    stem: 'Hàm số f(x) = x² đạt giá trị nhỏ nhất tại?',
    questionType: 'MULTIPLE_CHOICE_SINGLE',
    options: [makeOption('A', 'x = 0'), makeOption('B', 'x = 1'), makeOption('C', 'x = -1')],
    correctAnswer: 'A',
    subjectId: 'MATH',
    grade: 12,
    chapterId: 'dao-ham',
    conceptCodes: ['cuc-tri-ham-so'],
    skillCodes: [],
    accessTier: 'OPEN',
    usageContexts: ['OPEN_PRACTICE'],
    editorialStatus: 'DRAFT',
    isSpecial: false,
    roadmapEligible: false,
    prerequisiteConceptCodes: [],
    source: { sourceType: 'INTERNAL_EDITORIAL', rightsStatus: 'OWNED' },
    explanation: "f'(x) = 2x = 0 tại x = 0.",
    ...overrides,
  };
}

function baseManualQuestion(overrides: Record<string, unknown> = {}) {
  return {
    stem: 'Tính giá trị của biểu thức.',
    questionType: 'MULTIPLE_CHOICE_SINGLE',
    options: [makeOption('A'), makeOption('B')],
    correctAnswer: 'A',
    primaryKnowledgeNodeId: 'concept-1',
    knowledgeCoverage: 'FOCUS',
    cognitiveLevel: 'APPLICATION',
    difficulty: 'INTERMEDIATE',
    ...overrides,
  };
}

describe('validateForManualCreation', () => {
  it('accepts each canonical answer shape', () => {
    const inputs = [
      baseManualQuestion(),
      baseManualQuestion({
        questionType: 'MULTIPLE_CHOICE_MULTIPLE',
        correctAnswer: 'A,B',
      }),
      baseManualQuestion({ questionType: 'TRUE_FALSE', options: [], correctAnswer: 'TRUE' }),
      baseManualQuestion({
        questionType: 'SHORT_ANSWER',
        options: [],
        correctAnswer: 'Dòng 1\nDòng 2',
      }),
      baseManualQuestion({ questionType: 'NUMERIC', options: [], correctAnswer: '-3.25' }),
    ];

    inputs.forEach((input) => expect(validateForManualCreation(input).valid).toBe(true));
  });

  it('rejects enum values outside the canonical bounds', () => {
    const result = validateForManualCreation(
      baseManualQuestion({
        questionType: 'ESSAY',
        difficulty: 'IMPOSSIBLE',
        knowledgeCoverage: 'UNKNOWN',
        cognitiveLevel: 'SYNTHESIS',
      })
    );

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(['questionType', 'difficulty', 'knowledgeCoverage', 'cognitiveLevel'])
    );
  });

  it('requires 2–5 non-empty sequential A–E options', () => {
    const result = validateForManualCreation(
      baseManualQuestion({
        options: [makeOption('A'), makeOption('C', ''), makeOption('D')],
      })
    );

    expect(result.errors.some((error) => error.code === 'NON_SEQUENTIAL_OPTION_KEYS')).toBe(true);
    expect(result.errors.some((error) => error.code === 'EMPTY_OPTION_CONTENT')).toBe(true);
  });

  it('requires unique multiple-choice answers and accepts normalizable ordering', () => {
    const result = validateForManualCreation(
      baseManualQuestion({
        questionType: 'MULTIPLE_CHOICE_MULTIPLE',
        correctAnswer: 'B,A,A',
      })
    );

    expect(result.errors.some((error) => error.code === 'INVALID_MULTIPLE_ANSWER')).toBe(true);
    expect(
      validateForManualCreation(
        baseManualQuestion({
          questionType: 'MULTIPLE_CHOICE_MULTIPLE',
          correctAnswer: ' b, a ',
        })
      ).valid
    ).toBe(true);
  });

  it('accepts decimal comma but rejects non-finite numeric values', () => {
    expect(
      validateForManualCreation(
        baseManualQuestion({ questionType: 'NUMERIC', options: [], correctAnswer: '1,25' })
      ).valid
    ).toBe(true);
    expect(
      validateForManualCreation(
        baseManualQuestion({ questionType: 'NUMERIC', options: [], correctAnswer: 'Infinity' })
      ).valid
    ).toBe(false);
  });
});

// ─── Draft validation ─────────────────────────────────────────────────────────

describe('validateForDraft', () => {
  it('valid draft with only stem', () => {
    const result = validateForDraft({ stem: 'Some question' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('invalid draft without stem', () => {
    const result = validateForDraft({ stem: '' });
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('MISSING_STEM');
  });

  it('invalid draft with whitespace-only stem', () => {
    const result = validateForDraft({ stem: '   ' });
    expect(result.valid).toBe(false);
  });
});

// ─── Answer validation — single choice ───────────────────────────────────────

describe('validateAnswer — MULTIPLE_CHOICE_SINGLE', () => {
  const opts = [makeOption('A'), makeOption('B'), makeOption('C')];

  it('valid single answer', () => {
    const errors = validateAnswer('MULTIPLE_CHOICE_SINGLE', opts, 'A');
    expect(errors).toHaveLength(0);
  });

  it('answer not in options', () => {
    const errors = validateAnswer('MULTIPLE_CHOICE_SINGLE', opts, 'Z');
    expect(errors.some((e) => e.code === 'ANSWER_NOT_IN_OPTIONS')).toBe(true);
  });

  it('missing correct answer', () => {
    const errors = validateAnswer('MULTIPLE_CHOICE_SINGLE', opts, '');
    expect(errors.some((e) => e.code === 'MISSING_CORRECT_ANSWER')).toBe(true);
  });

  it('multiple answers provided for single-choice', () => {
    const errors = validateAnswer('MULTIPLE_CHOICE_SINGLE', opts, 'A,B');
    expect(errors.some((e) => e.code === 'SINGLE_CHOICE_MULTIPLE_ANSWERS')).toBe(true);
  });

  it('too few options', () => {
    const errors = validateAnswer('MULTIPLE_CHOICE_SINGLE', [makeOption('A')], 'A');
    expect(errors.some((e) => e.code === 'TOO_FEW_OPTIONS')).toBe(true);
  });
});

// ─── Answer validation — multiple choice ─────────────────────────────────────

describe('validateAnswer — MULTIPLE_CHOICE_MULTIPLE', () => {
  const opts = [makeOption('A'), makeOption('B'), makeOption('C'), makeOption('D')];

  it('valid multiple answers', () => {
    const errors = validateAnswer('MULTIPLE_CHOICE_MULTIPLE', opts, 'A,C');
    expect(errors).toHaveLength(0);
  });

  it('one invalid option in multi-answer', () => {
    const errors = validateAnswer('MULTIPLE_CHOICE_MULTIPLE', opts, 'A,Z');
    expect(errors.some((e) => e.code === 'ANSWER_NOT_IN_OPTIONS')).toBe(true);
  });
});

// ─── Answer validation — true/false ──────────────────────────────────────────

describe('validateAnswer — TRUE_FALSE', () => {
  it('valid TRUE', () => {
    const errors = validateAnswer('TRUE_FALSE', [], 'TRUE');
    expect(errors).toHaveLength(0);
  });

  it('valid FALSE', () => {
    const errors = validateAnswer('TRUE_FALSE', [], 'FALSE');
    expect(errors).toHaveLength(0);
  });

  it('invalid free text', () => {
    const errors = validateAnswer('TRUE_FALSE', [], 'yes');
    expect(errors.some((e) => e.code === 'INVALID_TRUE_FALSE_ANSWER')).toBe(true);
  });
});

// ─── Answer validation — numeric ─────────────────────────────────────────────

describe('validateAnswer — NUMERIC', () => {
  it('valid number', () => {
    const errors = validateAnswer('NUMERIC', [], '42');
    expect(errors).toHaveLength(0);
  });

  it('invalid non-numeric', () => {
    const errors = validateAnswer('NUMERIC', [], 'abc');
    expect(errors.some((e) => e.code === 'INVALID_NUMERIC_ANSWER')).toBe(true);
  });
});

// ─── Plus special question rules ──────────────────────────────────────────────

describe('validateSpecialQuestion', () => {
  it('special + PLUS + PLUS_SPECIAL context + reason = valid', () => {
    const errors = validateSpecialQuestion(
      true,
      'PLUS',
      ['PLUS_SPECIAL'],
      'Câu hỏi liên kết nhiều khái niệm'
    );
    expect(errors).toHaveLength(0);
  });

  it('special + OPEN = error (requires PLUS)', () => {
    const errors = validateSpecialQuestion(
      true,
      'OPEN',
      ['PLUS_SPECIAL', 'OPEN_PRACTICE'],
      'reason'
    );
    expect(errors.some((e) => e.code === 'SPECIAL_REQUIRES_PLUS')).toBe(true);
  });

  it('special + PLUS but missing PLUS_SPECIAL context', () => {
    const errors = validateSpecialQuestion(true, 'PLUS', ['OPEN_PRACTICE'], 'reason');
    expect(errors.some((e) => e.code === 'SPECIAL_REQUIRES_PLUS_SPECIAL_CONTEXT')).toBe(true);
  });

  it('special + PLUS + PLUS_SPECIAL but missing reason', () => {
    const errors = validateSpecialQuestion(true, 'PLUS', ['PLUS_SPECIAL'], '');
    expect(errors.some((e) => e.code === 'SPECIAL_REQUIRES_REASON')).toBe(true);
  });

  it('not special = no errors', () => {
    const errors = validateSpecialQuestion(false, 'OPEN', [], undefined);
    expect(errors).toHaveLength(0);
  });
});

// ─── Publishing validation ────────────────────────────────────────────────────

describe('validateForPublishing', () => {
  it('fully valid question passes', () => {
    const result = validateForPublishing(baseQuestion());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('missing stem fails', () => {
    const result = validateForPublishing(baseQuestion({ stem: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'MISSING_STEM')).toBe(true);
  });

  it('missing subject fails', () => {
    const result = validateForPublishing(baseQuestion({ subjectId: undefined }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'MISSING_SUBJECT')).toBe(true);
  });

  it('missing grade fails', () => {
    const result = validateForPublishing(baseQuestion({ grade: undefined }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'MISSING_GRADE')).toBe(true);
  });

  it('RIGHTS_REVIEW_REQUIRED blocks publish', () => {
    const result = validateForPublishing(
      baseQuestion({ source: { sourceType: 'PUBLIC_DOCUMENT', rightsStatus: 'REVIEW_REQUIRED' } })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'RIGHTS_REVIEW_REQUIRED')).toBe(true);
  });

  it('missing access tier fails', () => {
    const result = validateForPublishing(baseQuestion({ accessTier: undefined }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'MISSING_ACCESS_TIER')).toBe(true);
  });

  it('missing usage contexts fails', () => {
    const result = validateForPublishing(baseQuestion({ usageContexts: [] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'MISSING_USAGE_CONTEXT')).toBe(true);
  });

  it('special without plus fails', () => {
    const result = validateForPublishing(
      baseQuestion({
        isSpecial: true,
        accessTier: 'OPEN',
        usageContexts: ['PLUS_SPECIAL'],
        specialReason: 'reason',
      })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'SPECIAL_REQUIRES_PLUS')).toBe(true);
  });

  it('roadmap without estimatedTime fails', () => {
    const result = validateForPublishing(
      baseQuestion({
        roadmapEligible: true,
        usageContexts: ['ROADMAP', 'OPEN_PRACTICE'],
        estimatedTimeSeconds: undefined,
      })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'ROADMAP_REQUIRES_TIME')).toBe(true);
  });

  it('roadmap without ROADMAP context fails', () => {
    const result = validateForPublishing(
      baseQuestion({
        roadmapEligible: true,
        usageContexts: ['OPEN_PRACTICE'],
        estimatedTimeSeconds: 60,
      })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'ROADMAP_REQUIRES_ROADMAP_CONTEXT')).toBe(true);
  });
});

// ─── Rights status ────────────────────────────────────────────────────────────

describe('rightsBlocksPublish', () => {
  it('REVIEW_REQUIRED blocks', () => {
    expect(rightsBlocksPublish('REVIEW_REQUIRED')).toBe(true);
  });

  it('OWNED does not block', () => {
    expect(rightsBlocksPublish('OWNED')).toBe(false);
  });

  it('undefined does not block', () => {
    expect(rightsBlocksPublish(undefined)).toBe(false);
  });
});

// ─── Status transitions ───────────────────────────────────────────────────────

describe('isValidStatusTransition', () => {
  it('DRAFT → IN_REVIEW is valid', () => {
    expect(isValidStatusTransition('DRAFT', 'IN_REVIEW')).toBe(true);
  });

  it('IN_REVIEW → PUBLISHED is valid', () => {
    expect(isValidStatusTransition('IN_REVIEW', 'PUBLISHED')).toBe(true);
  });

  it('PUBLISHED → DRAFT is invalid', () => {
    expect(isValidStatusTransition('PUBLISHED', 'DRAFT')).toBe(false);
  });

  it('PUBLISHED → ARCHIVED is valid', () => {
    expect(isValidStatusTransition('PUBLISHED', 'ARCHIVED')).toBe(true);
  });

  it('DRAFT → PUBLISHED is invalid (must go through IN_REVIEW)', () => {
    expect(isValidStatusTransition('DRAFT', 'PUBLISHED')).toBe(false);
  });
});

// ─── Content hash — duplicate detection ──────────────────────────────────────

describe('computeContentHash', () => {
  const opts = [makeOption('A', 'Option A'), makeOption('B', 'Option B')];

  it('same content = same hash', () => {
    const h1 = computeContentHash('Same stem', opts, 'A');
    const h2 = computeContentHash('Same stem', opts, 'A');
    expect(h1).toBe(h2);
  });

  it('different stem = different hash', () => {
    const h1 = computeContentHash('Stem one', opts, 'A');
    const h2 = computeContentHash('Stem two', opts, 'A');
    expect(h1).not.toBe(h2);
  });

  it('whitespace normalization', () => {
    const h1 = computeContentHash('  stem  ', opts, 'A');
    const h2 = computeContentHash('stem', opts, 'A');
    expect(h1).toBe(h2);
  });

  it('different answer = different hash', () => {
    const h1 = computeContentHash('stem', opts, 'A');
    const h2 = computeContentHash('stem', opts, 'B');
    expect(h1).not.toBe(h2);
  });

  it('case-insensitive answer matching', () => {
    const h1 = computeContentHash('stem', opts, 'a');
    const h2 = computeContentHash('stem', opts, 'A');
    expect(h1).toBe(h2);
  });

  it('returns a non-empty hex string', () => {
    const h = computeContentHash('test', opts, 'A');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ─── OPEN vs PLUS scope ───────────────────────────────────────────────────────

describe('OPEN vs PLUS access scope', () => {
  it('OPEN question can be in OPEN_PRACTICE', () => {
    const result = validateForPublishing(
      baseQuestion({ accessTier: 'OPEN', usageContexts: ['OPEN_PRACTICE'] })
    );
    expect(result.valid).toBe(true);
  });

  it('OPEN question can also be in ROADMAP', () => {
    const result = validateForPublishing(
      baseQuestion({
        accessTier: 'OPEN',
        usageContexts: ['OPEN_PRACTICE', 'ROADMAP'],
        roadmapEligible: true,
        estimatedTimeSeconds: 60,
        conceptCodes: ['some-concept'],
      })
    );
    expect(result.valid).toBe(true);
  });

  it('PLUS question can be in ROADMAP for Plus roadmap', () => {
    const result = validateForPublishing(
      baseQuestion({
        accessTier: 'PLUS',
        usageContexts: ['ROADMAP'],
        roadmapEligible: true,
        estimatedTimeSeconds: 90,
        conceptCodes: ['some-concept'],
      })
    );
    expect(result.valid).toBe(true);
  });

  it('PLUS_SPECIAL without PLUS access tier fails', () => {
    const result = validateForPublishing(
      baseQuestion({
        accessTier: 'OPEN',
        usageContexts: ['PLUS_SPECIAL'],
        isSpecial: true,
        specialReason: 'reason',
      })
    );
    expect(result.errors.some((e) => e.code === 'SPECIAL_REQUIRES_PLUS')).toBe(true);
  });
});

// ─── Import Candidate Validation ─────────────────────────────────────────────

describe('validateForImportCandidate', () => {
  it('validates candidate with attached knowledge node successfully', () => {
    const result = validateForImportCandidate({
      stem: 'Một câu hỏi mẫu?',
      questionType: 'MULTIPLE_CHOICE_SINGLE',
      options: [makeOption('A', 'Đáp án 1'), makeOption('B', 'Đáp án 2')],
      correctAnswer: 'A',
      primaryKnowledgeNodeId: 'node-123',
      primaryKnowledgeNodeActive: true,
      source: { sourceType: 'INTERNAL_EDITORIAL', rightsStatus: 'OWNED' },
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails with Vietnamese error when primaryKnowledgeNodeId is missing', () => {
    const result = validateForImportCandidate({
      stem: 'Một câu hỏi mẫu?',
      questionType: 'MULTIPLE_CHOICE_SINGLE',
      options: [makeOption('A', 'Đáp án 1'), makeOption('B', 'Đáp án 2')],
      correctAnswer: 'A',
      primaryKnowledgeNodeId: '',
    });

    expect(result.valid).toBe(false);
    const nodeError = result.errors.find((e) => e.code === 'MISSING_PRIMARY_KNOWLEDGE_NODE');
    expect(nodeError).toBeDefined();
    expect(nodeError?.message).toBe(
      'Chưa xác định kiến thức. Hãy chọn mục kiến thức trước khi duyệt câu hỏi.'
    );
  });

  it('fails with Vietnamese error when knowledge node is inactive', () => {
    const result = validateForImportCandidate({
      stem: 'Một câu hỏi mẫu?',
      questionType: 'MULTIPLE_CHOICE_SINGLE',
      options: [makeOption('A', 'Đáp án 1'), makeOption('B', 'Đáp án 2')],
      correctAnswer: 'A',
      primaryKnowledgeNodeId: 'node-archived',
      primaryKnowledgeNodeActive: false,
    });

    expect(result.valid).toBe(false);
    const nodeError = result.errors.find((e) => e.code === 'INACTIVE_PRIMARY_KNOWLEDGE_NODE');
    expect(nodeError).toBeDefined();
    expect(nodeError?.message).toBe(
      'Mục kiến thức đã chọn không hoạt động hoặc không thể gắn câu hỏi.'
    );
  });
});
