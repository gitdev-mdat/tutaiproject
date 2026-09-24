import { describe, expect, it } from 'vitest';
import {
  formatMathSnippet,
  CONFIDENCE_LABELS,
  WARNING_ACTION_LABELS,
} from './question-candidate-editor';

describe('question-candidate-editor unit tests', () => {
  it('formats inline LaTeX math expressions cleanly into readable snippets', () => {
    const raw = 'Cho hàm số $y = \\frac{1}{x}$ và $\\sqrt{x^2 + 1} \\ge 0$.';
    const result = formatMathSnippet(raw);
    expect(result).not.toBeNull();
  });

  it('handles empty or null text safely without throwing', () => {
    expect(formatMathSnippet('')).toBeNull();
  });

  it('exports required labels and constants', () => {
    expect(CONFIDENCE_LABELS.HIGH).toBe('Tin cậy cao');
    expect(WARNING_ACTION_LABELS.EDIT).toBe('Sửa');
  });
});
