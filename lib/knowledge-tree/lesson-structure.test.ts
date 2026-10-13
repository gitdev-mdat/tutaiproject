import { describe, expect, it } from 'vitest';
import {
  estimateReadingMinutes,
  extractSignChart,
  learningPromise,
  parseMistakes,
  parseWorkedExample,
  splitIntoChunks,
} from './lesson-structure';
import type { KnowledgeArticleBlock } from './knowledge-tree-types';

const block = (type: KnowledgeArticleBlock['type'], content: string): KnowledgeArticleBlock => ({
  id: type,
  type,
  content,
});

const EXAMPLE = [
  'Đề bài: Tìm các khoảng đồng biến và nghịch biến của hàm số $y = x^3 - 3x^2 + 2$.',
  '',
  'Lời giải:',
  'Bước 1: Tập xác định $D = \\mathbb{R}$.',
  '',
  "Bước 2: Tính đạo hàm $y' = 3x^2 - 6x$.",
  "Cho $y' = 0 \\Leftrightarrow x = 0$ hoặc $x = 2$.",
  '',
  "Bước 3: Xét dấu đạo hàm $y'$.",
  "- $y' > 0$ trên các khoảng $(-\\infty; 0)$ và $(2; +\\infty)$.",
  "- $y' < 0$ trên khoảng $(0; 2)$.",
  '',
  'Bước 4: Kết luận.',
].join('\n');

describe('lesson structure', () => {
  it('splits main content at its numbered headings', () => {
    const chunks = splitIntoChunks(
      "1. Khái niệm:\nHàm số đồng biến khi…\n\n2. Điều kiện đủ:\n- Nếu $f'(x) > 0$ thì…\n\n3. Quy trình:\n- Bước 1: …"
    );
    expect(chunks.map((chunk) => chunk.title)).toEqual(['Khái niệm', 'Điều kiện đủ', 'Quy trình']);
    expect(chunks[1].body).toContain("f'(x) > 0");
  });

  it('keeps a plain numbered list and unstructured text as one chunk', () => {
    expect(splitIntoChunks('1. Một\n2. Hai\n3. Ba')).toEqual([
      { title: null, body: '1. Một\n2. Hai\n3. Ba' },
    ]);
    expect(splitIntoChunks('Chỉ một đoạn văn.')).toHaveLength(1);
  });

  it('reads a worked example into problem and steps', () => {
    const example = parseWorkedExample(EXAMPLE)!;
    expect(example.problem).toMatch(/^Tìm các khoảng/);
    expect(example.steps.map((step) => step.label)).toEqual([
      'Bước 1',
      'Bước 2',
      'Bước 3',
      'Bước 4',
    ]);
    expect(example.steps[1].body).toContain('x = 2');
    expect(parseWorkedExample("Cho $f(x)=x^2$. Tính $f'(1)$.")).toBeNull();
  });

  it('builds a sign chart only from intervals that cover the real line', () => {
    expect(extractSignChart(EXAMPLE)).toEqual({
      derivative: "y'",
      points: [0, 2],
      intervals: [
        { from: -Infinity, to: 0, sign: '+' },
        { from: 0, to: 2, sign: '-' },
        { from: 2, to: Infinity, sign: '+' },
      ],
    });
    expect(
      extractSignChart("- $y' > 0$ trên khoảng $(-\\infty; 0)$.\n- $y' < 0$ trên $(1; 2)$.")
    ).toBeNull();
    expect(extractSignChart("Nếu $f'(x) > 0$ với mọi $x \\in K$ thì hàm số đồng biến.")).toBeNull();
  });

  it('pairs each common mistake with its fix', () => {
    expect(parseMistakes('- Quên tập xác định. Cách tránh: luôn tìm trước.\n- Lỗi khác')).toEqual([
      { trap: 'Quên tập xác định', fix: 'luôn tìm trước.' },
      { trap: 'Lỗi khác', fix: null },
    ]);
  });

  it('derives the learning promise and a reading time from the saved blocks', () => {
    const blocks = [
      block('OBJECTIVE', '- Tìm được các khoảng đơn điệu.\n- Vẽ được bảng biến thiên.'),
      block('MAIN_CONTENT', 'chữ '.repeat(390)),
      block('EXAMPLE', EXAMPLE),
    ];
    expect(learningPromise(blocks)).toBe('Tìm được các khoảng đơn điệu');
    expect(estimateReadingMinutes(blocks)).toBe(6);
    expect(learningPromise([block('INTRO', 'Câu đầu. Câu sau.')])).toBe('Câu đầu.');
  });
});
