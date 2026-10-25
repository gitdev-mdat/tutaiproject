import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuestionMath, QuestionPrompt } from './question-content-renderer';

const text = (source: string) =>
  renderToStaticMarkup(createElement(QuestionMath, { text: source }))
    .replace(/<[^>]+>/g, '')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&#x27;/g, "'")
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

describe('QuestionMath on the published "Tính đơn điệu của hàm số (P1)"', () => {
  // The exact RECAP line from Production, after a JSON (jsonb) round trip.
  const recap = JSON.parse(
    JSON.stringify(
      String.raw`Các bước làm bài: Tập xác định $\rightarrow$ Tính $f'(x)$ $\rightarrow$ Xét dấu $f'(x)$ $\rightarrow$ Kết luận.`
    )
  ) as string;

  it('renders \\rightarrow as an arrow instead of raw source', () => {
    expect(text(recap)).toBe(
      "Các bước làm bài: Tập xác định → Tính f'(x) → Xét dấu f'(x) → Kết luận."
    );
    expect(text(recap)).not.toContain('\\');
  });

  it('keeps every other command the lesson uses rendering', () => {
    expect(text(String.raw`$K \Rightarrow$`)).toBe('K ⇒');
    expect(text(String.raw`$x \in K$, $f'(x) \ge 0$, $\le 0$`)).toBe("x ∈ K, f'(x) ≥ 0, ≤ 0");
    expect(text(String.raw`$(-\infty; 0) \cup (2; +\infty)$`)).toBe('(-∞; 0) ∪ (2; +∞)');
    expect(text(String.raw`$y' = 0 \Leftrightarrow 3x(x - 2) = 0$`)).toBe("y' = 0 ⇔ 3x(x - 2) = 0");
    expect(text(String.raw`$D = \mathbb{R}$`)).toBe('D = ℝ');
  });
});

describe('QuestionMath reader', () => {
  it('renders arrows used for monotonicity and procedures', () => {
    expect(text(String.raw`$\nearrow$ $\searrow$ $\to$ $\leftarrow$ $\iff$ $\implies$`)).toBe(
      '↗ ↘ → ← ⟺ ⟹'
    );
  });

  it('handles nested groups in fractions, roots and powers', () => {
    expect(text(String.raw`$\frac{x^{2} + 1}{2x}$`)).toBe('x2 + 12x');
    expect(text(String.raw`$\sqrt{x^{2} + 1}$`)).toBe('√x2 + 1');
    expect(text(String.raw`$\sqrt[3]{x}$`)).toBe('3√x');
    expect(text(String.raw`$e^{-x}$ $x^10$ $x^2x$`)).toBe('e-x x10 x2x');
  });

  it('keeps an unknown command visible rather than hiding it', () => {
    expect(text(String.raw`$\begin{cases} x \end{cases}$`)).toContain('\\begin');
  });

  it('never turns text into markup', () => {
    const html = renderToStaticMarkup(
      createElement(QuestionMath, { text: '$\\text{<img src=x onerror=alert(1)>}$ <b>x</b>' })
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
  });
});

describe('QuestionPrompt', () => {
  it('renders the public textbook figure alongside the original question text', () => {
    const html = renderToStaticMarkup(
      createElement(QuestionPrompt, {
        questionId: 'q-22',
        stem: 'Đồ thị y = f\u2032(x).',
        content: [
          { id: 'text', type: 'TEXT', text: 'Đồ thị y = f\u2032(x).' },
          {
            id: 'figure',
            type: 'IMAGE',
            media: {
              assetId: '/textbook-figures/derivative-sign-q22.svg',
              alt: 'Đồ thị đạo hàm',
            },
          },
        ],
      })
    );
    expect(html).toContain('src="/textbook-figures/derivative-sign-q22.svg"');
    expect(html).toContain('alt="Đồ thị đạo hàm"');
    expect(html).toContain('Đồ thị y = f′(x).');
  });
});
