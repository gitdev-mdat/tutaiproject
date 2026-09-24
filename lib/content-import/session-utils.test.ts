import { describe, expect, it } from 'vitest';
import { codesNeedConfirmation, normalizeExamCode } from './session-utils';

describe('content import session utilities', () => {
  it('keeps raw codes distinguishable while normalizing leading zeroes', () => {
    expect(normalizeExamCode('0119')).toBe('119');
    expect(normalizeExamCode('119')).toBe('119');
    expect(codesNeedConfirmation('0119', '119')).toBe(true);
  });

  it('does not request confirmation for identical raw codes', () => {
    expect(codesNeedConfirmation('119', '119')).toBe(false);
  });
});
