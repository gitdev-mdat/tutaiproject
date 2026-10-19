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
