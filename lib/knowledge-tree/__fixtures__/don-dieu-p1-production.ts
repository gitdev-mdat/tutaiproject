/**
 * "Tính đơn điệu của hàm số (P1)" exactly as Gemini generated it and the admin
 * published it on Production (tutai.content_documents, knowledge-tree/articles,
 * read on 2026-10-17). Used as a regression fixture for rendering and for the
 * draft quality checks; never written back anywhere.
 */
import type { KnowledgeArticleBlock } from '../knowledge-tree-types';

export const DON_DIEU_P1_PRODUCTION: KnowledgeArticleBlock[] = [
  { id: 'block-title', type: 'TITLE', content: 'Tính đơn điệu của hàm số (P1)' },
  {
    id: 'block-intro-1',
    type: 'INTRO',
    content:
      'Ở chương trình Toán 10, học sinh đã biết khái niệm hàm số đồng biến và nghịch biến dựa vào việc so sánh giá trị hàm số. Sang lớp 12, công cụ đạo hàm giúp chúng ta xét tính đơn điệu của hàm số một cách nhanh chóng và hiệu quả hơn. Đây là bước nền tảng đầu tiên và rất quan trọng trong việc khảo sát và vẽ đồ thị của hàm số.',
  },
  {
    id: 'block-objective-2',
    type: 'OBJECTIVE',
    content: String.raw`- Trình bày được điều kiện đủ và điều kiện mở rộng để hàm số đồng biến, nghịch biến trên một khoảng.
- Xây dựng được quy trình 4 bước để xét tính đơn điệu của một hàm số.
- Xác định được các khoảng đồng biến, nghịch biến của các hàm số đa thức cơ bản.`,
  },
  {
    id: 'block-main_content-3',
    type: 'MAIN_CONTENT',
    content: String.raw`Giả sử hàm số $y = f(x)$ có đạo hàm trên khoảng $K$.

1. Điều kiện đủ để hàm số đơn điệu:
- Nếu $f'(x) > 0$ với mọi $x \in K$ thì hàm số $y = f(x)$ đồng biến trên khoảng $K$.
- Nếu $f'(x) < 0$ với mọi $x \in K$ thì hàm số $y = f(x)$ nghịch biến trên khoảng $K$.
- Nếu $f'(x) = 0$ với mọi $x \in K$ thì hàm số $y = f(x)$ không đổi trên khoảng $K$.

2. Mở rộng điều kiện đơn điệu:
Nếu $f'(x) \ge 0$ (hoặc $f'(x) \le 0$) với mọi $x \in K$ và $f'(x) = 0$ chỉ tại một số hữu hạn điểm thuộc $K$ thì hàm số đồng biến (hoặc nghịch biến) trên khoảng $K$.

3. Quy trình xét tính đơn điệu:
- Bước 1: Tìm tập xác định của hàm số.
- Bước 2: Tính đạo hàm $f'(x)$. Giải phương trình $f'(x) = 0$ để tìm nghiệm và tìm các điểm $x$ làm cho $f'(x)$ không xác định.
- Bước 3: Xét dấu đạo hàm $f'(x)$ (hoặc lập bảng biến thiên).
- Bước 4: Kết luận các khoảng đồng biến, nghịch biến của hàm số.`,
  },
  {
    id: 'block-example-4',
    type: 'EXAMPLE',
    content: String.raw`Ví dụ: Tìm các khoảng đồng biến và nghịch biến của hàm số $y = x^3 - 3x^2 + 2$.

Lời giải:
Bước 1: Tập xác định của hàm số là $D = \mathbb{R}$.

Bước 2: Tính đạo hàm $y' = 3x^2 - 6x$.
Cho $y' = 0 \Leftrightarrow 3x^2 - 6x = 0 \Leftrightarrow 3x(x - 2) = 0 \Leftrightarrow x = 0$ hoặc $x = 2$.

Bước 3: Xét dấu $y'$:
- $y' > 0$ trên các khoảng $(-\infty; 0)$ và $(2; +\infty)$.
- $y' < 0$ trên khoảng $(0; 2)$.

Bước 4: Kết luận:
- Hàm số đồng biến trên các khoảng $(-\infty; 0)$ và $(2; +\infty)$.
- Hàm số nghịch biến trên khoảng $(0; 2)$.`,
  },
  {
    id: 'block-recap-5',
    type: 'RECAP',
    content: String.raw`- $f'(x) > 0$ trên $K \Rightarrow$ hàm số đồng biến trên $K$.
- $f'(x) < 0$ trên $K \Rightarrow$ hàm số nghịch biến trên $K$.
- $f'(x) \ge 0$ (hoặc $\le 0$) trên $K$ và $f'(x) = 0$ tại hữu hạn điểm $\Rightarrow$ hàm số vẫn đồng biến (hoặc nghịch biến) trên $K$.
- Các bước làm bài: Tập xác định $\rightarrow$ Tính $f'(x)$ $\rightarrow$ Xét dấu $f'(x)$ $\rightarrow$ Kết luận.`,
  },
  {
    id: 'block-common_mistake-6',
    type: 'COMMON_MISTAKE',
    content: String.raw`- Dùng ký hiệu hợp $\cup$ khi kết luận khoảng đồng biến, nghịch biến (ví dụ $(-\infty; 0) \cup (2; +\infty)$). Cách tránh: Dùng từ "và" hoặc liệt kê riêng các khoảng.
- Bỏ qua bước tìm tập xác định dẫn đến xác định sai khoảng xét dấu. Cách tránh: Luôn đặt điều kiện và tìm tập xác định đầu tiên.
- Nhầm lẫn khi $f'(x) = 0$ tại vô số điểm liên tục vẫn áp dụng định lý mở rộng. Cách tránh: Luôn kiểm tra xem số nghiệm của $f'(x) = 0$ có phải là hữu hạn hay không.`,
  },
  { id: 'block-graph-7', type: 'GRAPH', content: '' },
  { id: 'block-references-8', type: 'REFERENCES', content: '' },
];
