/**
 * "Tính đơn điệu của hàm số (P1)" as published on Production after the
 * curriculum reset (tutai.content_documents, knowledge-tree/articles, updated
 * 2026-10-19, read-only on 2026-10-25; md5 of the article 01b2f622…). Used by
 * the interactive lesson tests; never written back anywhere.
 */
import type { KnowledgeArticleBlock } from '../knowledge-tree-types';

export const DON_DIEU_P1_LESSON_ID = 'knowledge-45c34e43-ad2e-47bf-8845-68782b67cfb9';

export const DON_DIEU_P1_CURRENT: KnowledgeArticleBlock[] = [
  {
    id: 'block-title',
    type: 'TITLE',
    content: 'Tính đơn điệu của hàm số (P1)',
  },
  {
    id: 'block-intro-1',
    type: 'INTRO',
    content:
      'Ở chương trình Toán 10, học sinh đã biết khái niệm hàm số đồng biến và nghịch biến dựa vào việc so sánh giá trị hàm số. Sang lớp 12, công cụ đạo hàm giúp chúng ta xét tính đơn điệu của hàm số một cách nhanh chóng và hiệu quả hơn. Đây là bước nền tảng đầu tiên và rất quan trọng trong việc khảo sát và vẽ đồ thị của hàm số.',
  },
  {
    id: 'block-objective-2',
    type: 'OBJECTIVE',
    content:
      '- Trình bày được điều kiện đủ và điều kiện mở rộng để hàm số đồng biến, nghịch biến trên một khoảng.\n- Xây dựng được quy trình 4 bước để xét tính đơn điệu của một hàm số.\n- Xác định được các khoảng đồng biến, nghịch biến của các hàm số đa thức cơ bản.',
  },
  {
    id: 'block-main_content-3',
    type: 'MAIN_CONTENT',
    content:
      "Giả sử hàm số $y = f(x)$ có đạo hàm trên khoảng $K$.\n\n1. Điều kiện đủ để hàm số đơn điệu:\n- Nếu $f'(x) > 0$ với mọi $x \\in K$ thì hàm số $y = f(x)$ đồng biến trên khoảng $K$.\n- Nếu $f'(x) < 0$ với mọi $x \\in K$ thì hàm số $y = f(x)$ nghịch biến trên khoảng $K$.\n- Nếu $f'(x) = 0$ với mọi $x \\in K$ thì hàm số $y = f(x)$ không đổi trên khoảng $K$.\n\n2. Mở rộng điều kiện đơn điệu:\nNếu $f'(x) \\ge 0$ (hoặc $f'(x) \\le 0$) với mọi $x \\in K$ và $f'(x) = 0$ chỉ tại một số hữu hạn điểm thuộc $K$ thì hàm số đồng biến (hoặc nghịch biến) trên khoảng $K$.\n\n3. Quy trình xét tính đơn điệu:\n- Bước 1: Tìm tập xác định của hàm số.\n- Bước 2: Tính đạo hàm $f'(x)$. Giải phương trình $f'(x) = 0$ để tìm nghiệm và tìm các điểm $x$ làm cho $f'(x)$ không xác định.\n- Bước 3: Xét dấu đạo hàm $f'(x)$ (hoặc lập bảng biến thiên).\n- Bước 4: Kết luận các khoảng đồng biến, nghịch biến của hàm số.",
  },
  {
    id: 'block-example-4',
    type: 'EXAMPLE',
    content:
      "Ví dụ: Tìm các khoảng đồng biến và nghịch biến của hàm số $y = x^3 - 3x^2 + 2$.\n\nLời giải:\nBước 1: Tập xác định của hàm số là $D = \\mathbb{R}$.\n\nBước 2: Tính đạo hàm $y' = 3x^2 - 6x$.\nCho $y' = 0 \\Leftrightarrow 3x^2 - 6x = 0 \\Leftrightarrow 3x(x - 2) = 0 \\Leftrightarrow x = 0$ hoặc $x = 2$.\n\nBước 3: Xét dấu $y'$:\n- $y' > 0$ trên các khoảng $(-\\infty; 0)$ và $(2; +\\infty)$.\n- $y' < 0$ trên khoảng $(0; 2)$.\n\nBước 4: Kết luận:\n- Hàm số đồng biến trên các khoảng $(-\\infty; 0)$ và $(2; +\\infty)$.\n- Hàm số nghịch biến trên khoảng $(0; 2)$.",
  },
  {
    id: 'block-recap-5',
    type: 'RECAP',
    content:
      "- $f'(x) > 0$ trên $K \\Rightarrow$ hàm số đồng biến trên $K$.\n- $f'(x) < 0$ trên $K \\Rightarrow$ hàm số nghịch biến trên $K$.\n- $f'(x) \\ge 0$ (hoặc $\\le 0$) trên $K$ và $f'(x) = 0$ tại hữu hạn điểm $\\Rightarrow$ hàm số vẫn đồng biến (hoặc nghịch biến) trên $K$.\n- Các bước làm bài: Tập xác định $\\rightarrow$ Tính $f'(x)$ $\\rightarrow$ Xét dấu $f'(x)$ $\\rightarrow$ Kết luận.",
  },
  {
    id: 'block-common_mistake-6',
    type: 'COMMON_MISTAKE',
    content: '',
  },
  {
    id: 'block-graph-7',
    type: 'GRAPH',
    content: 'y = x^3 - 3x^2 + 2',
  },
  {
    id: 'block-references-8',
    type: 'REFERENCES',
    content: '',
  },
];
