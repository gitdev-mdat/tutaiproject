import { describe, expect, it } from 'vitest';
import { examAccessTier, parseExamAccess } from './exam-access';

describe('examAccessTier', () => {
  it('treats exams without a stored tier as free', () => {
    expect(examAccessTier({})).toBe('FREE');
    expect(examAccessTier({ accessTier: 'PLUS' })).toBe('PLUS');
  });
});

describe('parseExamAccess', () => {
  it('keeps current values for fields left out', () => {
    expect(parseExamAccess({}, { accessTier: 'PLUS', curatorNote: 'Ghi chú' })).toEqual({
      ok: true,
      value: { accessTier: 'PLUS', curatorNote: 'Ghi chú' },
    });
  });

  it('drops the note on a free exam and tidies whitespace', () => {
    expect(parseExamAccess({ accessTier: 'FREE', curatorNote: 'x' })).toEqual({
      ok: true,
      value: { accessTier: 'FREE', curatorNote: undefined },
    });
    expect(parseExamAccess({ accessTier: 'PLUS', curatorNote: '  a \n b ' })).toEqual({
      ok: true,
      value: { accessTier: 'PLUS', curatorNote: 'a b' },
    });
  });

  it('rejects unknown tiers and long notes', () => {
    expect(parseExamAccess({ accessTier: 'GOLD' }).ok).toBe(false);
    expect(parseExamAccess({ accessTier: 'PLUS', curatorNote: 'a'.repeat(161) }).ok).toBe(false);
    expect(parseExamAccess({ accessTier: 'PLUS', curatorNote: 42 }).ok).toBe(false);
  });
});
