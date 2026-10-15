import { describe, expect, it } from 'vitest';
import {
  buildLessonJourney,
  exampleUsesGraph,
  paragraphLabel,
  parseExamples,
  splitConcepts,
} from './lesson-journey';
import type { KnowledgeArticleBlock } from './knowledge-tree-types';

const block = (type: KnowledgeArticleBlock['type'], content: string): KnowledgeArticleBlock => ({
  id: type,
  type,
  content,
});

// The published Production article "Tính đơn điệu của hàm số", as stored.
const MAIN = [
  '**Định nghĩa.** Hàm số $y = f(x)$ đồng biến trên khoảng $K$ nếu với mọi $x_1 < x_2$ thuộc $K$ ta có $f(x_1) < f(x_2)$; nghịch biến nếu $f(x_1) > f(x_2)$.',
  '',
  '**Định lí.** Cho hàm số $y = f(x)$ có đạo hàm trên $K$.',
  "- Nếu $f'(x) > 0$ với mọi $x \\in K$ thì hàm số đồng biến trên $K$.",
  "- Nếu $f'(x) < 0$ với mọi $x \\in K$ thì hàm số nghịch biến trên $K$.",
  '',
  '**Các bước xét tính đơn điệu.**',
  '1. Tìm tập xác định.',
  "2. Tính $f'(x)$, tìm các điểm làm $f'(x) = 0$ hoặc không xác định.",
  "3. Lập bảng xét dấu $f'(x)$.",
  '4. Kết luận các khoảng đồng biến, nghịch biến.',
].join('\n');

const EXAMPLE = [
  '**Ví dụ.** Xét tính đơn điệu của $y = x^3 - 3x$.',
  '',
  "Tập xác định $\\mathbb{R}$. Ta có $y' = 3x^2 - 3 = 3(x - 1)(x + 1)$, $y' = 0 \\Leftrightarrow x = \\pm 1$.",
  '',
  "$y' > 0$ trên $(-\\infty; -1)$ và $(1; +\\infty)$; $y' < 0$ trên $(-1; 1)$.",
  '',
  'Vậy hàm số đồng biến trên $(-\\infty; -1)$ và $(1; +\\infty)$, nghịch biến trên $(-1; 1)$.',
].join('\n');

const PRODUCTION: KnowledgeArticleBlock[] = [
  block('INTRO', 'Khi nhìn đồ thị từ trái sang phải, có đoạn đường cong đi lên, có đoạn đi xuống.'),
  block('OBJECTIVE', '- Nêu được định nghĩa.\n- Dùng dấu của đạo hàm.'),
  block('MAIN_CONTENT', MAIN),
  block('EXAMPLE', EXAMPLE),
  block('COMMON_MISTAKE', '- Viết hợp hai khoảng: sai.\n- Quên tập xác định.'),
  block('RECAP', "- $f' > 0$ thì đồng biến."),
];

describe('splitConcepts', () => {
  it('splits at the bold labels the author wrote', () => {
    const chunks = splitConcepts(MAIN);
    expect(chunks.map((chunk) => chunk.title)).toEqual([
      'Định nghĩa',
      'Định lí',
      'Các bước xét tính đơn điệu',
    ]);
    expect(chunks[0].body).toMatch(/^Hàm số \$y = f\(x\)\$ đồng biến/);
    expect(chunks[1].body).toContain("f'(x) > 0");
    expect(chunks[2].body).toMatch(/^1\. Tìm tập xác định/);
  });

  it('still reads the older "1. Khái niệm:" headings', () => {
    const chunks = splitConcepts(
      '1. Khái niệm:\nHàm số đồng biến khi…\n\n2. Điều kiện đủ:\n- Nếu…'
    );
    expect(chunks.map((chunk) => chunk.title)).toEqual(['Khái niệm', 'Điều kiện đủ']);
  });

  it('does not treat bold emphasis inside a sentence, or a plain list, as a label', () => {
    expect(paragraphLabel('**Hàm số** đồng biến khi…')).toBeNull();
    expect(paragraphLabel('1. Một\n2. Hai')).toBeNull();
  });

  it('groups unlabelled paragraphs into short chunks without titles', () => {
    const long = Array.from({ length: 4 }, (_, i) => `Đoạn ${i} ` + 'chữ '.repeat(50)).join('\n\n');
    const chunks = splitConcepts(long);
    expect(chunks.length).toBe(4);
    expect(chunks.every((chunk) => chunk.title === null)).toBe(true);
    expect(splitConcepts('Một đoạn.\n\nHai đoạn ngắn.')).toHaveLength(1);
  });
});

describe('parseExamples', () => {
  it('reads the Production example: problem, then one reasoning step per paragraph', () => {
    const [example] = parseExamples(EXAMPLE);
    expect(example.title).toBe('Ví dụ');
    expect(example.problem).toBe('Xét tính đơn điệu của $y = x^3 - 3x$.');
    expect(example.steps).toHaveLength(3);
    expect(example.steps[2].body).toMatch(/^Vậy/);
    expect(example.fn).not.toBeNull();
    expect(exampleUsesGraph(example, 'y = x^3 - 3x')).toBe(true);
    expect(exampleUsesGraph(example, 'y = x^3 + 3x')).toBe(false);
    expect(exampleUsesGraph(example, null)).toBe(false);
  });

  it('reads "Bước n" examples and splits several examples', () => {
    const text = [
      '**Ví dụ 1.** Đề bài: Xét $y = x^2$.',
      'Lời giải:',
      'Bước 1: Tập xác định $\\mathbb{R}$.',
      "Bước 2: $y' = 2x$.",
      '',
      '**Ví dụ 2.** Xét $y = \\dfrac{1}{x}$.',
      '',
      "$y' = -\\dfrac{1}{x^2} < 0$.",
    ].join('\n');
    const examples = parseExamples(text);
    expect(examples.map((example) => example.title)).toEqual(['Ví dụ 1', 'Ví dụ 2']);
    expect(examples[0].problem).toBe('Xét $y = x^2$.');
    expect(examples[0].steps.map((step) => step.label)).toEqual(['Bước 1', 'Bước 2']);
    expect(examples[1].steps).toHaveLength(1);
  });
});

describe('buildLessonJourney', () => {
  it('orders the Production lesson as a learning journey without a graph', () => {
    const journey = buildLessonJourney(PRODUCTION, { checks: 2 });
    expect(journey.stages.map((stage) => stage.id)).toEqual([
      'bat-dau',
      'y-1',
      'y-2',
      'vi-du',
      'thu-suc',
      'tong-ket',
    ]);
    expect(journey.graphSource).toBeNull();
    expect(journey.keyIdea).toBe("$f' > 0$ thì đồng biến.");
    expect(journey.stages.every((stage) => !('graph' in stage) || stage.graph === null)).toBe(true);
  });

  it('adds graph interactions only when the GRAPH block parses', () => {
    const withGraph = buildLessonJourney([...PRODUCTION, block('GRAPH', 'y = x^3 - 3x')], {
      checks: 0,
    });
    const graphs = withGraph.stages.map((stage) => ('graph' in stage ? stage.graph : null));
    expect(graphs).toEqual(['predict', 'values', 'derivative', null, null, null]);
    expect(withGraph.stages.some((stage) => stage.kind === 'check')).toBe(false);

    const broken = buildLessonJourney([...PRODUCTION, block('GRAPH', 'y = sin x')], { checks: 0 });
    expect(broken.graphSource).toBeNull();
  });

  it('applies the procedure in the worked example and reads the traps before trying', () => {
    const journey = buildLessonJourney(PRODUCTION, { checks: 2 });
    const example = journey.stages.find((stage) => stage.kind === 'example');
    expect(example?.kind === 'example' && example.method).toEqual({
      title: 'Các bước xét tính đơn điệu',
      steps: [
        'Tìm tập xác định.',
        "Tính $f'(x)$, tìm các điểm làm $f'(x) = 0$ hoặc không xác định.",
        "Lập bảng xét dấu $f'(x)$.",
        'Kết luận các khoảng đồng biến, nghịch biến.',
      ],
    });
    const check = journey.stages.find((stage) => stage.kind === 'check');
    expect(check?.kind === 'check' && check.mistakes).toHaveLength(2);
  });

  it('maps progress saved with the older eight-stage order onto the new stages', () => {
    const journey = buildLessonJourney(PRODUCTION, { checks: 2 });
    // bat-dau, y-1, y-2, y-3, vi-du, thu-suc, bay, tong-ket
    expect(journey.legacyStageIds).toEqual([
      'bat-dau',
      'y-1',
      'y-2',
      'vi-du',
      'vi-du',
      'thu-suc',
      'thu-suc',
      'tong-ket',
    ]);
    const noChecks = buildLessonJourney(PRODUCTION, { checks: 0 });
    expect(noChecks.stages.map((stage) => stage.id)).toEqual([
      'bat-dau',
      'y-1',
      'y-2',
      'vi-du',
      'bay',
      'tong-ket',
    ]);
    expect(noChecks.legacyStageIds).toEqual([
      'bat-dau',
      'y-1',
      'y-2',
      'vi-du',
      'vi-du',
      'bay',
      'tong-ket',
    ]);
  });

  it('keeps a procedure as its own idea when there is no example to apply it to', () => {
    const journey = buildLessonJourney([block('MAIN_CONTENT', MAIN)], { checks: 0 });
    expect(journey.stages.map((stage) => stage.id)).toEqual(['y-1', 'y-2', 'y-3', 'tong-ket']);
    expect(journey.legacyStageIds).toEqual(['y-1', 'y-2', 'y-3', 'tong-ket']);
  });

  it('handles a sparse lesson with only a main idea', () => {
    const journey = buildLessonJourney([block('MAIN_CONTENT', 'Một ý duy nhất.')], { checks: 0 });
    expect(journey.stages.map((stage) => stage.kind)).toEqual(['concept', 'finish']);
    expect(journey.minutes).toBeGreaterThanOrEqual(2);
  });
});
