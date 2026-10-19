import { describe, expect, it } from 'vitest';
import { findMathIssues, hasMathIssues, normalizeGeneratedMath } from './math-notation';

describe('normalizeGeneratedMath', () => {
  it('turns a prose arrow written as a command into the arrow character', () => {
    expect(
      normalizeGeneratedMath(String.raw`Tính f'(x) \rightarrow Xét dấu f'(x) \rightarrow Kết luận`)
    ).toBe("Tính f'(x) → Xét dấu f'(x) → Kết luận");
  });

  it('collapses a double-escaped command but keeps valid source untouched', () => {
    expect(normalizeGeneratedMath(String.raw`$x \\in K$`)).toBe(String.raw`$x \in K$`);
    const valid = String.raw`$\frac{1}{2} \in \mathbb{R}$, $A \cup B$, $x \geq 0 \Rightarrow y$`;
    expect(normalizeGeneratedMath(valid)).toBe(valid);
  });

  it('wraps a formula command written outside $…$', () => {
    expect(normalizeGeneratedMath(String.raw`Ta có \frac{1}{2} là số dương`)).toBe(
      String.raw`Ta có $\frac{1}{2}$ là số dương`
    );
  });

  it('leaves unknown commands for the checks to report', () => {
    expect(normalizeGeneratedMath(String.raw`xem \foo`)).toBe(String.raw`xem \foo`);
  });
});

describe('findMathIssues', () => {
  it('finds nothing wrong in the published RECAP once \\rightarrow is supported', () => {
    const recap = String.raw`Tập xác định $\rightarrow$ Tính $f'(x)$ $\rightarrow$ Kết luận.`;
    expect(hasMathIssues(findMathIssues(recap))).toBe(false);
  });

  it('reports commands outside maths, unknown commands and unclosed formulas', () => {
    const issues = findMathIssues(String.raw`a \rightarrow b, $\begin{cases}x\end{cases}$, $x`);
    expect(issues.outsideMath).toContain('\\rightarrow');
    expect(issues.unsupported).toContain('\\begin');
    expect(issues.unbalancedDollar).toBe(true);
    expect(findMathIssues(String.raw`$\frac{1}{2$`).unbalancedBraces).toBe(true);
  });
});

describe('normalizeGeneratedMath, an unclosed formula', () => {
  it('stays on its own line instead of swallowing the next one', () => {
    // From a real Gemini draft: the first line lost its closing $.
    const text = String.raw`- đồng biến trên $\mathbb{R}.
- vì sao $y' \ge 0$ khi $\Delta \le 0$.`;
    expect(normalizeGeneratedMath(text).split('\n')[1]).toBe(
      String.raw`- vì sao $y' \ge 0$ khi $\Delta \le 0$.`
    );
  });
});

describe('normalizeGeneratedMath, closing a formula', () => {
  it('closes a one-token formula left open at the end of a line', () => {
    expect(normalizeGeneratedMath(String.raw`- đồng biến trên $\mathbb{R}.`)).toBe(
      String.raw`- đồng biến trên $\mathbb{R}$.`
    );
  });

  it('does not guess where a longer unclosed formula ends', () => {
    const text = String.raw`Ta có $y' = 3x^2 - 3 với mọi x.`;
    expect(normalizeGeneratedMath(text)).toBe(text);
  });

  it('leaves balanced lines alone', () => {
    const text = String.raw`Với $x \in \mathbb{R}$ thì $y' > 0$.`;
    expect(normalizeGeneratedMath(text)).toBe(text);
  });
});
