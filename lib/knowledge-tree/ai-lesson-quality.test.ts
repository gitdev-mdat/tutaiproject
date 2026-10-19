import { describe, expect, it } from 'vitest';
import type { AiLessonDraft } from './ai-lesson-draft';
import { reviewLessonDraft } from './ai-lesson-quality';
import { DON_DIEU_P1_PRODUCTION } from './__fixtures__/don-dieu-p1-production';

const production = Object.fromEntries(
  DON_DIEU_P1_PRODUCTION.map((block) => [block.type, block.content])
) as AiLessonDraft;
const options = { stage: 'INTRODUCTORY' as const, subject: 'Toán' };
const ids = (draft: AiLessonDraft) => reviewLessonDraft(draft, options).map((check) => check.id);

/** A beginner-oriented draft of the same lesson, written the way the new contract asks. */
const improved: AiLessonDraft = {
  INTRO:
    'Đi xe đạp lên dốc rồi xuống dốc, em cảm nhận ngay mình đang lên hay xuống. Bài này giúp em nhìn ra điều đó trên đồ thị hàm số bằng đạo hàm.',
  OBJECTIVE:
    '- Giải thích được vì sao dấu của đạo hàm cho biết hàm số đồng biến hay nghịch biến.\n- Tìm được các khoảng đồng biến, nghịch biến của hàm đa thức.',
  MAIN_CONTENT: String.raw`**Nhắc lại nhanh.** Đạo hàm $f'(x)$ là hệ số góc của tiếp tuyến với đồ thị tại điểm có hoành độ $x$. Ví dụ với $f(x) = x^2$ thì $f'(x) = 2x$, nên $f'(1) = 2$.

**Ý nghĩa của dấu đạo hàm.** Khi $f'(x) > 0$, tiếp tuyến dốc lên nên đồ thị đi lên; khi $f'(x) < 0$, đồ thị đi xuống. Với $y = x^2$: trên $(-\infty; 0)$ thì $2x < 0$ nên đồ thị đi xuống, trên $(0; +\infty)$ thì $2x > 0$ nên đồ thị đi lên.

**Phát biểu.** Cho hàm số $y = f(x)$ có đạo hàm trên khoảng $K$ (một khoảng như $(0; 5)$). Nếu $f'(x) > 0$ với mọi $x \in K$ thì hàm số đồng biến trên $K$; nếu $f'(x) < 0$ với mọi $x \in K$ thì hàm số nghịch biến trên $K$.

**Các bước xét tính đơn điệu.**
1. Tìm tập xác định, vì chỉ xét hàm số ở nơi nó có nghĩa.
2. Tính $f'(x)$ và giải $f'(x) = 0$ để tìm chỗ đạo hàm có thể đổi dấu.
3. Xét dấu $f'(x)$ trên từng khoảng.
4. Kết luận theo dấu.`,
  EXAMPLE: String.raw`Ví dụ 1. Xét tính đơn điệu của hàm số $y = x^2 - 4x$.
Lời giải.
Bước 1: Tập xác định $D = \mathbb{R}$.
Bước 2: $y' = 2x - 4$, $y' = 0 \Leftrightarrow x = 2$.
Bước 3: $y' < 0$ khi $x < 2$, $y' > 0$ khi $x > 2$.
Bước 4: Hàm số nghịch biến trên $(-\infty; 2)$ và đồng biến trên $(2; +\infty)$.

Ví dụ 2. Tìm các khoảng đồng biến, nghịch biến của hàm số $y = x^3 - 3x^2 + 2$.
Lời giải.
Bước 1: Tập xác định $D = \mathbb{R}$.
Bước 2: $y' = 3x^2 - 6x$, $y' = 0 \Leftrightarrow x = 0$ hoặc $x = 2$.
Bước 3: $y' > 0$ trên $(-\infty; 0)$ và $(2; +\infty)$, $y' < 0$ trên $(0; 2)$.
Bước 4: Hàm số đồng biến trên $(-\infty; 0)$ và $(2; +\infty)$, nghịch biến trên $(0; 2)$.`,
  COMMON_MISTAKE: String.raw`- Giải $y = 0$ thay vì $y' = 0$ khi tìm chỗ đạo hàm đổi dấu. Cách đúng: dấu của $y'$ mới quyết định đồng biến hay nghịch biến.
- Đảo kết luận: thấy $y' < 0$ lại ghi đồng biến. Cách đúng: $y'$ âm thì đồ thị đi xuống, tức nghịch biến.`,
  RECAP: String.raw`- Dấu của $f'(x)$ trên một khoảng cho biết hàm số đồng biến hay nghịch biến trên khoảng đó.
- Các bước: tập xác định → tính $f'(x)$ → xét dấu → kết luận.`,
  GRAPH: 'y = x^3 - 3x^2 + 2',
};

describe('reviewLessonDraft on the published "Tính đơn điệu của hàm số (P1)"', () => {
  const found = ids(production);

  it('flags the formal opening, the single example and the unexplained f′(x)', () => {
    expect(found).toContain('formal-opening');
    expect(found).toContain('one-example');
    expect(found.some((id) => id.startsWith('notation-đạo hàm'))).toBe(true);
  });

  it('flags the advanced common mistakes (∪ notation, f′ = 0 at infinitely many points)', () => {
    expect(found.filter((id) => id.startsWith('advanced-mistake')).length).toBe(2);
  });

  it('finds the example mathematically consistent and the maths renderable', () => {
    expect(found.some((id) => id.startsWith('example-0-'))).toBe(false);
    expect(found.some((id) => id.startsWith('math-format'))).toBe(false);
  });
});

describe('reviewLessonDraft on a beginner-oriented draft', () => {
  it('raises no warnings', () => {
    const warnings = reviewLessonDraft(improved, options).filter((c) => c.severity === 'warning');
    expect(warnings).toEqual([]);
  });

  it('catches a wrong derivative and a reversed conclusion in a worked example', () => {
    const wrong = {
      ...improved,
      EXAMPLE: improved.EXAMPLE.replace("$y' = 3x^2 - 6x$", "$y' = 3x^2 - 3x$").replace(
        'nghịch biến trên $(-\\infty; 2)$ và đồng biến trên $(2; +\\infty)$',
        'đồng biến trên $(-\\infty; 2)$ và nghịch biến trên $(2; +\\infty)$'
      ),
    };
    const found = ids(wrong);
    expect(found).toContain('example-1-derivative');
    expect(
      found.filter((id) => id.startsWith('example-0-up') || id.startsWith('example-0-down'))
    ).toHaveLength(2);
  });

  it('catches raw LaTeX outside $…$ and solving f(x) = 0 to study the derivative sign', () => {
    const found = ids({
      ...improved,
      RECAP: String.raw`- Các bước: tập xác định \rightarrow kết luận.`,
      MAIN_CONTENT: `${improved.MAIN_CONTENT}\n\n**Lưu ý.** Để xét dấu đạo hàm ta giải $f(x) = 0$.`,
    });
    expect(found).toContain('math-format-RECAP');
    expect(found.some((id) => id.startsWith('wrong-equation'))).toBe(true);
  });

  it('allows edge cases among the mistakes of an extension lesson', () => {
    const found = reviewLessonDraft(production, { stage: 'EXTENSION', subject: 'Toán' }).map(
      (c) => c.id
    );
    expect(found.some((id) => id.startsWith('advanced-mistake'))).toBe(false);
    expect(found).not.toContain('formal-opening');
  });
});
