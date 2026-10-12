import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuestionMath } from './question-content-renderer';

const text = (source: string) =>
  renderToStaticMarkup(createElement(QuestionMath, { text: source }))
    .replace(/<[^>]+>/g, '')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');

describe('QuestionMath', () => {
  it('renders the symbols AI lesson drafts use for monotonicity', () => {
    expect(text('$x_1, x_2 \\in I$')).toBe('x1, x2 ∈ I');
    expect(text('$3x(x - 2) = 0 \\Leftrightarrow x = 0$')).toBe('3x(x - 2) = 0 ⇔ x = 0');
    expect(text('$(-\\infty; 0) \\cup (2; +\\infty)$')).toBe('(-∞; 0) ∪ (2; +∞)');
    expect(text('$D = \\mathbb{R} \\setminus \\{1\\}$')).toContain('ℝ');
    expect(text('$\\dfrac{1}{x}$')).toBe('1x');
    expect(text('$\\lim_{x \\to 0} \\sin x$')).toBe('limx → 0 sin x');
  });

  it('does not eat letters after a short command', () => {
    expect(text('$\\left( x \\right)$')).toBe('( x )');
    expect(text('$\\int f$, $\\infty$, $\\in$')).toBe('∫ f, ∞, ∈');
  });

  it('keeps the existing symbols', () => {
    expect(text('$a \\le b \\ge c \\neq d$')).toBe('a ≤ b ≥ c ≠ d');
    expect(text('$\\text{khi } x > 0$')).toBe('khi  x > 0');
  });
});
