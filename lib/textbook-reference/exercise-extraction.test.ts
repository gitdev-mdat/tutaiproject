import { describe, expect, it } from 'vitest';
import {
  buildExtractionPrompt,
  classifyOutcome,
  exerciseSetFor,
  parseExtractionResponse,
  problemTypeOf,
  MAX_ITEMS_PER_BATCH,
  salvageItems,
  TEXTBOOK_RESPONSE_SCHEMA,
  validateItem,
  type ItemValidationContext,
} from './extraction-response';
import { mapPrintedPage } from './page-mapping';
import { proposeSolutions, solutionProblemTypes, statementMatches } from './solution-matching';
import { checkMonotonicityAnswer } from './math-checks';
import { sectionState, usableByAi } from './section-state';
import { selectLessonReferences } from './reference-service';
import type { TextbookAnchor, TextbookArtifact, TextbookTocEntry } from './types';

/** The production anchors and outline of math_book_3 (Admin-checked anchors 13 and 39). */
const ANCHORS: TextbookAnchor[] = [
  { printedPage: 13, pdfPage: 7, position: 'RIGHT', evidence: 'Admin' },
  { printedPage: 39, pdfPage: 20, position: 'RIGHT', evidence: 'Admin' },
];
const entry = (
  id: string,
  parentId: string | null,
  level: number,
  heading: string,
  start: number,
  end: number
): TextbookTocEntry => ({
  id,
  parentId,
  level,
  originalHeading: heading,
  normalizedHeading: heading.toLowerCase(),
  printedStartPage: start,
  printedEndPage: end,
  locations: [],
  status: 'OBSERVED',
});
const TOC = [
  entry('toc-1', null, 1, 'Chủ đề 1: Hàm số và các ứng dụng của đạo hàm', 13, 136),
  entry('toc-2', 'toc-1', 2, 'I.I. Tính đơn điệu của hàm số', 13, 33),
  entry('toc-3', 'toc-2', 3, 'A. Lý thuyết', 13, 13),
  entry('toc-4', 'toc-2', 3, 'B. Bài tập trong các đề thi thử của các trường', 14, 33),
  entry('toc-5', 'toc-4', 4, 'Dạng 1: Bài toán không chứa tham số', 14, 18),
  entry('toc-6', 'toc-4', 4, 'Bài tập rèn luyện kỹ năng', 19, 20),
  entry('toc-7', 'toc-4', 4, 'Dạng 2: Bài toán chứa tham số', 21, 27),
  entry('toc-8', 'toc-4', 4, 'Bài tập rèn luyện kỹ năng', 28, 28),
  entry('toc-9', 'toc-4', 4, 'Hướng dẫn giải chi tiết', 29, 33),
];

const context = (pages: number[], entryId = 'toc-6'): ItemValidationContext => ({
  documentId: 'doc',
  entryId,
  extractionKey: 'k'.repeat(64),
  pages,
  pdfPageOf: (page) => mapPrintedPage(page, ANCHORS, 'TWO_UP').pdfPage,
  exerciseSet: exerciseSetFor(
    TOC.find((item) => item.id === entryId)!,
    TOC
  ),
  createdAt: '2026-10-24T00:00:00.000Z',
});

const question = (number: number, statement: string, page = 19) => ({
  kind: 'EXERCISE',
  questionNumber: String(number),
  title: `Câu ${number}`,
  content: `${statement}\nA. $(-\\infty; 0)$\nB. $(0; 2)$\nC. $(2; +\\infty)$\nD. $\\mathbb{R}$`,
  choices: [
    { label: 'A', text: '$(-\\infty; 0)$' },
    { label: 'B', text: '$(0; 2)$' },
    { label: 'C', text: '$(2; +\\infty)$' },
    { label: 'D', text: '$\\mathbb{R}$' },
  ],
  printedPages: [page],
});

describe('pages 19–20 of the scanned book', () => {
  it('map to the right half of PDF page 10 and the left half of PDF page 11', () => {
    expect(mapPrintedPage(19, ANCHORS, 'TWO_UP')).toMatchObject({
      pdfPage: 10,
      position: 'RIGHT',
      crop: { x: 0.5, width: 0.5 },
    });
    expect(mapPrintedPage(20, ANCHORS, 'TWO_UP')).toMatchObject({
      pdfPage: 11,
      position: 'LEFT',
      crop: { x: 0, width: 0.5 },
    });
  });

  it('belong to the "Dạng 1" exercise set of chapter I.I', () => {
    expect(exerciseSetFor(TOC[5], TOC)).toEqual({
      entryId: 'toc-6',
      heading: 'Bài tập rèn luyện kỹ năng',
      chapterEntryId: 'toc-2',
      problemType: 'dạng 1',
    });
    expect(exerciseSetFor(TOC[7], TOC).problemType).toBe('dạng 2');
    expect(problemTypeOf('DẠNG 2: Bài toán chứa tham số')).toBe('dạng 2');
  });
});

describe('extraction prompt', () => {
  it('asks for every question on its own and never requires a solution', () => {
    const prompt = buildExtractionPrompt({
      pages: [19, 20],
      headings: ['Bài tập rèn luyện kỹ năng'],
      chapterHeading: 'I.I. Tính đơn điệu của hàm số',
      problemType: 'dạng 1',
    });
    expect(prompt).toContain('tr. 19, tr. 20');
    expect(prompt).toContain('MỖI câu hỏi là một item riêng, kể cả khi trang không có lời giải');
    expect(prompt).toContain('Không bỏ câu hỏi vì không có lời giải');
    expect(prompt).toContain('không đoán đáp án');
    // The v8 rule that emptied exercise-only pages is gone.
    expect(prompt).not.toMatch(/bỏ cả hai|Chỉ trả tối đa 5 item/);
  });
});

describe('item validation', () => {
  it('accepts a multiple-choice question with no solution, keeping provenance and an explicit unresolved answer', () => {
    const result = validateItem(
      question(1, 'Câu 1: Hàm số $y = x^3 - 3x^2 + 2$ nghịch biến trên khoảng nào?', 20),
      0,
      context([19, 20])
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact).toMatchObject({
      kind: 'EXERCISE',
      questionNumber: '1',
      printedPages: [20],
      pdfPages: [11],
      solutionStatus: 'UNRESOLVED',
      answer: { status: 'UNRESOLVED' },
      reviewStatus: 'NEEDS_REVIEW',
      exerciseSet: { entryId: 'toc-6', chapterEntryId: 'toc-2', problemType: 'dạng 1' },
    });
    expect(result.artifact.choices?.map((choice) => choice.label)).toEqual(['A', 'B', 'C', 'D']);
    expect(result.artifact.content.split('\n')).toHaveLength(5);
  });

  it('rejects only the bad item: a page outside the batch or empty content', () => {
    expect(
      validateItem({ ...question(2, 'Câu 2: …'), printedPages: [25] }, 1, context([19, 20]))
    ).toMatchObject({ ok: false, reason: expect.stringContaining('không thuộc') });
    expect(
      validateItem(
        { kind: 'EXERCISE', title: 'Câu 3', content: ' ', printedPages: [19] },
        2,
        context([19, 20])
      )
    ).toMatchObject({ ok: false });
  });

  it('flags unsure symbols and incomplete choices as partial instead of guessing', () => {
    const result = validateItem(
      {
        ...question(4, 'Câu 4: Cho hàm số $y = x^4 - [?]x^2$.'),
        choices: [{ label: 'A', text: '' }],
      },
      3,
      context([19, 20])
    );
    expect(result).toMatchObject({ ok: true, partial: true });
    if (result.ok) expect(result.artifact.choices).toBeUndefined();
  });

  it('gives the same id to the same item of the same request (a re-run cannot duplicate)', () => {
    const a = validateItem(question(5, 'Câu 5: …'), 4, context([19, 20]));
    const b = validateItem(question(5, 'Câu 5: …'), 4, context([19, 20]));
    expect(a.ok && b.ok && a.artifact.id === b.artifact.id).toBe(true);
  });
});

describe('response parsing and outcome', () => {
  it('reads an empty items list as a contradiction when the pages were readable, not as success', () => {
    const parsed = parseExtractionResponse(
      JSON.stringify({ pages: [{ printedPage: 19, status: 'READ' }], items: [], unreadable: [] }),
      { truncated: false, pages: [19, 20] }
    );
    expect(parsed.items).toEqual([]);
    expect(
      classifyOutcome({
        accepted: 0,
        rejected: 0,
        partialItems: 0,
        truncated: false,
        pages: parsed.pages,
        unreadable: 0,
      })
    ).toBe('INVALID_RESPONSE');
  });

  it('separates valid empty, unreadable, partial and complete results', () => {
    const base = { rejected: 0, partialItems: 0, truncated: false, unreadable: 0 };
    expect(
      classifyOutcome({
        ...base,
        accepted: 0,
        pages: [{ printedPage: 19, status: 'NO_EDUCATIONAL_CONTENT' }],
      })
    ).toBe('EMPTY');
    expect(
      classifyOutcome({ ...base, accepted: 0, pages: [{ printedPage: 19, status: 'UNREADABLE' }] })
    ).toBe('UNREADABLE');
    expect(
      classifyOutcome({
        ...base,
        accepted: 3,
        unreadable: 1,
        pages: [{ printedPage: 19, status: 'READ' }],
      })
    ).toBe('PARTIAL');
    expect(
      classifyOutcome({ ...base, accepted: 3, pages: [{ printedPage: 19, status: 'READ' }] })
    ).toBe('COMPLETE');
  });

  it('keeps the finished items of a cut-off answer', () => {
    const full = JSON.stringify({
      pages: [{ printedPage: 19, status: 'READ' }],
      items: [question(1, 'Câu 1: a'), question(2, 'Câu 2: "b" {c}')],
    });
    const cut = full.slice(0, full.length - 40);
    expect(salvageItems(cut)).toHaveLength(1);
    const parsed = parseExtractionResponse(cut, { truncated: true, pages: [19] });
    expect(parsed).toMatchObject({ truncated: true });
    expect(parsed.items).toHaveLength(1);
    expect(parsed.pages).toEqual([{ printedPage: 19, status: 'READ' }]);
  });

  it('sends a schema Gemini accepts (no maxItems) and caps the items when parsing', () => {
    // gemini-3.5-flash answered 400 INVALID_ARGUMENT for the real pages 19–20
    // request while the schema carried maxItems.
    expect(JSON.stringify(TEXTBOOK_RESPONSE_SCHEMA)).not.toMatch(/maxItems/);
    const items = Array.from({ length: MAX_ITEMS_PER_BATCH + 5 }, (_, i) => ({
      title: `Câu ${i}`,
    }));
    const parsed = parseExtractionResponse(JSON.stringify({ pages: [], items, unreadable: [] }), {
      truncated: false,
      pages: [19, 20],
    });
    expect(parsed.items).toHaveLength(MAX_ITEMS_PER_BATCH);
  });

  it('reports non-JSON as unusable', () => {
    expect(
      parseExtractionResponse('Xin lỗi, tôi không đọc được', { truncated: false, pages: [19] })
        .items
    ).toBeNull();
  });
});

function artifact(
  fields: Partial<TextbookArtifact> & Pick<TextbookArtifact, 'id' | 'kind' | 'content'>
): TextbookArtifact {
  return {
    documentId: 'doc',
    entryId: 'toc-6',
    title: fields.questionNumber ? `Câu ${fields.questionNumber}` : 'x',
    mathematicalNotation: [],
    printedPages: [19],
    pdfPages: [10],
    reviewStatus: 'NEEDS_REVIEW',
    verificationNotes: [],
    extractionKey: 'k',
    createdAt: '2026-10-24T00:00:00.000Z',
    ...fields,
  };
}
const set1 = {
  entryId: 'toc-6',
  heading: 'Bài tập rèn luyện kỹ năng',
  chapterEntryId: 'toc-2',
  problemType: 'dạng 1',
};
const set2 = { ...set1, entryId: 'toc-8', problemType: 'dạng 2' };
const solutionSet = (problemType: string | null) => ({
  entryId: 'toc-9',
  heading: 'Hướng dẫn giải chi tiết',
  chapterEntryId: 'toc-2',
  problemType,
});

describe('question/solution matching', () => {
  it('checks the statement: restated function, or the derivative of the exercise function', () => {
    const exercise = 'Hàm số $y = x^3 - 3x^2 + 2$ nghịch biến trên khoảng nào?';
    expect(
      statementMatches(exercise, "Ta có $y' = 3x^2 - 6x$; $y' < 0 \\Leftrightarrow 0 < x < 2$.").ok
    ).toBe(true);
    expect(statementMatches(exercise, "Ta có $y' = 3x^2 - 6x = 3x(x - 2)$.").ok).toBe(true);
    expect(statementMatches(exercise, 'Xét hàm số $y = x^3 - 3x^2 + 2$ có ...').ok).toBe(true);
    expect(statementMatches(exercise, "Ta có $y' = 4x^3 - 4x$.").ok).toBe(false);
    expect(statementMatches(exercise, 'Chọn B.').ok).toBe(false);
    // Câu 2 and Câu 7 as Gemini read them from printed pages 19 and 29.
    const real = 'Cho hàm số $y = x - \\ln(x + 1)$. Khẳng định nào dưới đây là đúng?';
    expect(
      statementMatches(real, "Câu 2: Đáp án D.\n$y' = [x - \\ln(x + 1)]' = \\frac{x}{x + 1}$.").ok
    ).toBe(true);
    expect(statementMatches(real, 'Câu 7: Đáp án C.').ok).toBe(false);
  });

  it('auto-matches the radical-function regression from its derivative and unique interval', () => {
    const exercise = artifact({
      id: 'e13',
      kind: 'EXERCISE',
      questionNumber: '13',
      exerciseSet: set1,
      content: 'Câu 13: Hàm số $y = \\sqrt{2x - x^2}$ đồng biến trên khoảng nào?',
      choices: [
        { label: 'A', text: '$(-\\infty; 2)$' },
        { label: 'B', text: '$(0; 1)$' },
        { label: 'C', text: '$(1; 2)$' },
        { label: 'D', text: '$(1; +\\infty)$' },
      ],
    });
    const solution = artifact({
      id: 's13',
      kind: 'SOLUTION',
      questionNumber: '13',
      exerciseSet: solutionSet('dạng 1'),
      printedPages: [30],
      content:
        "Câu 13: $D = [0; 2]$. $y' = \\frac{-2x+2}{2\\sqrt{2x-x^2}} = \\frac{1-x}{\\sqrt{2x-x^2}}$. $y' > 0$ $\\forall x \\in (0; 1)$ nên hàm số đồng biến trên $(0;1)$.",
    });
    expect(statementMatches(exercise.content, solution.content)).toMatchObject({ ok: true });
    expect(proposeSolutions([exercise, solution]).get('e13')).toMatchObject({
      status: 'SUGGESTED',
      candidates: [{ solutionId: 's13', strength: 'STRONG', answerChoice: 'B', conflicts: [] }],
    });
    const wrong = {
      ...solution,
      id: 's13-wrong',
      answerChoice: 'C',
      content: solution.content + ' Đáp án C.',
    };
    expect(proposeSolutions([exercise, wrong]).get('e13')?.candidates[0].strength).toBe('WEAK');
    expect(statementMatches(exercise.content, solution.content.replace('1-x', '1+x')).ok).toBe(
      false
    );
  });

  it('keeps a correct answer in review when any other choice cannot be checked', () => {
    expect(
      checkMonotonicityAnswer(
        'Hàm số $y = x^2$ đồng biến trên khoảng nào?',
        [
          { label: 'A', text: 'Một mệnh đề khác' },
          { label: 'B', text: '$(0; +\\infty)$' },
          { label: 'C', text: '$(-\\infty; 0)$' },
        ],
        'B'
      ).status
    ).toBe('AMBIGUOUS');
  });

  it('suggests only within the same chapter, problem type and number, with a verified statement', () => {
    const exercises = [
      artifact({
        id: 'e1',
        kind: 'EXERCISE',
        questionNumber: '1',
        exerciseSet: set1,
        solutionStatus: 'UNRESOLVED',
        content: 'Câu 1: Hàm số $y = x^3 - 3x^2 + 2$ nghịch biến trên khoảng nào?',
      }),
      artifact({
        id: 'e2',
        kind: 'EXERCISE',
        questionNumber: '2',
        exerciseSet: set1,
        solutionStatus: 'UNRESOLVED',
        content: 'Câu 2: Hàm số $y = x^4 - 2x^2$ đồng biến trên khoảng nào?',
      }),
      artifact({
        id: 'e1b',
        kind: 'EXERCISE',
        questionNumber: '1',
        exerciseSet: set2,
        solutionStatus: 'UNRESOLVED',
        content: 'Câu 1: Tìm $m$ để $y = x^3 - mx$ đồng biến trên $\\mathbb{R}$.',
      }),
    ];
    const solutions = [
      // Right set and number, derivative matches Câu 1 of Dạng 1.
      artifact({
        id: 's1',
        kind: 'SOLUTION',
        questionNumber: '1',
        answerChoice: 'B',
        exerciseSet: solutionSet('dạng 1'),
        printedPages: [29],
        content: "Câu 1. Chọn B.\nTa có $y' = 3x^2 - 6x$.",
      }),
      // Same number, other set: must never pair with Dạng 1 Câu 1.
      artifact({
        id: 's1b',
        kind: 'SOLUTION',
        questionNumber: '1',
        exerciseSet: solutionSet('dạng 2'),
        printedPages: [31],
        content: "Câu 1. $y' = 3x^2 - m$.",
      }),
      // Right set and number for Câu 2, but about another function: an unrelated solution.
      artifact({
        id: 's2',
        kind: 'SOLUTION',
        questionNumber: '2',
        exerciseSet: solutionSet('dạng 1'),
        printedPages: [29],
        content: "Câu 2. Ta có $y' = 6x^2 - 6$.",
      }),
    ];
    const proposals = proposeSolutions([...exercises, ...solutions]);
    expect(proposals.get('e1')).toMatchObject({
      status: 'SUGGESTED',
      candidates: [{ solutionId: 's1', strength: 'STRONG', answerChoice: 'B' }],
    });
    // Same number and set, but the mathematics is about another function: weak, never suggested.
    expect(proposals.get('e2')).toMatchObject({
      status: 'NEEDS_CONFIRMATION',
      candidates: [{ solutionId: 's2', strength: 'WEAK' }],
    });
    // Dạng 2 Câu 1 only sees the Dạng 2 solution, and only as a weak candidate.
    expect(proposals.get('e1b')?.candidates.map((c) => c.solutionId)).toEqual(['s1b']);
    expect(proposals.get('e1b')?.status).toBe('NEEDS_CONFIRMATION');
  });

  it('asks for confirmation when two solutions fit, or the solution names no set', () => {
    const exercise = artifact({
      id: 'e1',
      kind: 'EXERCISE',
      questionNumber: '1',
      exerciseSet: set1,
      content: 'Câu 1: $y = x^2 - 2x$',
    });
    const a = artifact({
      id: 'a',
      kind: 'SOLUTION',
      questionNumber: '1',
      exerciseSet: solutionSet('dạng 1'),
      content: "$y' = 2x - 2$",
    });
    const b = artifact({
      id: 'b',
      kind: 'SOLUTION',
      questionNumber: '1',
      exerciseSet: solutionSet('dạng 1'),
      content: "$y' = 2x - 2$",
    });
    expect(proposeSolutions([exercise, a, b]).get('e1')?.status).toBe('NEEDS_CONFIRMATION');
    const unnamed = artifact({
      id: 'c',
      kind: 'SOLUTION',
      questionNumber: '1',
      exerciseSet: solutionSet(null),
      content: "$y' = 2x - 2$",
    });
    const lone = proposeSolutions([exercise, unnamed]).get('e1')!;
    expect(lone.status).toBe('NEEDS_CONFIRMATION');
    expect(lone.candidates[0].conflicts).toContain('Chưa xác định được lời giải thuộc dạng nào');
  });

  it('does not reuse a solution already paired to another exercise', () => {
    const exercise = artifact({
      id: 'e-open',
      kind: 'EXERCISE',
      questionNumber: '1',
      exerciseSet: set1,
      content: 'Hàm số $y = x^2 - 2x$ đồng biến trên khoảng nào?',
      choices: [
        { label: 'A', text: '$(1; +\\infty)$' },
        { label: 'B', text: '$(0; 1)$' },
      ],
    });
    const solution = artifact({
      id: 's-used',
      kind: 'SOLUTION',
      questionNumber: '1',
      exerciseSet: solutionSet('dạng 1'),
      pairedArtifactId: 'e-other',
      answerChoice: 'A',
      content: "$y' = 2x - 2$. Chọn A.",
    });
    expect(proposeSolutions([exercise, solution]).get(exercise.id)).toEqual({
      status: 'UNRESOLVED',
      candidates: [],
    });
  });

  it('infers the problem type of solutions printed after their heading page', () => {
    const sol = (id: string, n: string, page: number, type: string | null) =>
      artifact({
        id,
        kind: 'SOLUTION',
        entryId: 'toc-9',
        questionNumber: n,
        exerciseSet: solutionSet(type),
        printedPages: [page],
        content: `Câu ${n}: Đáp án A.`,
      });
    const types = solutionProblemTypes([
      sol('a1', '1', 29, 'dạng 1'),
      sol('a2', '2', 29, null),
      sol('a14', '14', 30, null),
      sol('a15', '15', 31, null),
      sol('b1', '1', 31, 'dạng 2'),
      sol('b2', '2', 31, null),
      sol('b3', '3', 32, null),
    ]);
    expect(Object.fromEntries([...types].map(([id, t]) => [id, t.problemType]))).toEqual({
      a1: 'dạng 1',
      a2: 'dạng 1',
      a14: 'dạng 1',
      a15: 'dạng 1',
      b1: 'dạng 2',
      b2: 'dạng 2',
      b3: 'dạng 2',
    });
    expect(types.get('a14')?.inferred).toBe(true);
    expect(types.get('b1')?.inferred).toBe(false);
  });

  it('drops rejected solutions and solutions confirmed for another question; flags a wrong answer', () => {
    const exercise = artifact({
      id: 'e3',
      kind: 'EXERCISE',
      questionNumber: '3',
      exerciseSet: set1,
      content: 'Câu 3: Hỏi hàm số $y = x^3 + 3x^2 - 4$ nghịch biến trên khoảng nào?',
      choices: [
        { label: 'A', text: '$(-2; 0)$' },
        { label: 'B', text: '$(-\\infty; -2)$' },
        { label: 'C', text: '$(0; +\\infty)$' },
        { label: 'D', text: '$\\mathbb{R}$' },
      ],
    });
    const right = artifact({
      id: 'r',
      kind: 'SOLUTION',
      questionNumber: '3',
      answerChoice: 'A',
      exerciseSet: solutionSet('dạng 1'),
      content: "Câu 3: Đáp án A.\n$y' = (x^3 + 3x^2 - 4)' = 3x^2 + 6x$",
    });
    const wrong = artifact({
      ...right,
      id: 'w',
      answerChoice: 'C',
      content: right.content.replace('Đáp án A', 'Đáp án C'),
    });
    const both = proposeSolutions([exercise, right, wrong]).get('e3')!;
    expect(both.candidates.find((c) => c.solutionId === 'r')).toMatchObject({
      strength: 'STRONG',
      conflicts: [],
    });
    expect(both.candidates.find((c) => c.solutionId === 'w')?.conflicts.join(' ')).toMatch(
      /phương án C không đúng/
    );
    expect(both.status).toBe('SUGGESTED');
    const rejected = proposeSolutions([
      { ...exercise, practice: { rejectedSolutionIds: ['r'] } },
      right,
    ]).get('e3')!;
    expect(rejected).toEqual({ status: 'UNRESOLVED', candidates: [] });
    const other = artifact({
      ...exercise,
      id: 'e3b',
      practice: {
        verification: {
          method: 'TEXTBOOK_SOLUTION',
          answer: 'A',
          solutionArtifactId: 'r',
          by: 'a',
          at: 't',
        },
      },
    });
    expect(proposeSolutions([exercise, other, right]).get('e3')?.candidates).toEqual([]);
  });
});

describe('questions without solutions downstream', () => {
  const unresolved = artifact({
    id: 'e1',
    kind: 'EXERCISE',
    questionNumber: '1',
    solutionStatus: 'UNRESOLVED',
    reviewStatus: 'APPROVED',
    content: 'Câu 1: …',
  });
  const theory = artifact({
    id: 't',
    kind: 'THEORY',
    reviewStatus: 'APPROVED',
    content: 'Lí thuyết đã duyệt, đủ dài để được chọn làm tư liệu cho bản nháp.',
  });

  it('are reviewable but never counted as AI-ready nor sent to AI drafting', () => {
    expect(usableByAi(unresolved, new Set(['e1', 't']))).toBe(false);
    expect(usableByAi(theory, new Set(['e1', 't']))).toBe(true);
    const selected = selectLessonReferences([unresolved, theory], new Map([['doc', 'Sách']]));
    expect(selected.map((item) => item.artifactId)).toEqual(['t']);
  });

  it('show question and solution counts and do not repeat the failure reason in the section text', () => {
    const state = sectionState({
      documentId: 'doc',
      mapping: {},
      entry: TOC[5],
      tocEntries: TOC,
      artifacts: [{ ...unresolved, reviewStatus: 'NEEDS_REVIEW' }],
      jobs: [],
    });
    expect(state.questions).toEqual({
      total: 1,
      withSolution: 0,
      verified: 0,
      awaitingSolution: 1,
    });
    expect(state.key).toBe('NEEDS_REVIEW');
    const failed = sectionState({
      documentId: 'doc',
      mapping: {},
      entry: TOC[5],
      tocEntries: TOC,
      artifacts: [],
      jobs: [
        {
          id: 'j',
          kind: 'EXTRACT',
          documentId: 'doc',
          knowledgeNodeId: 'n',
          entryIds: ['toc-6'],
          printedPages: [19, 20],
          extractionKey: 'k',
          status: 'FAILED',
          attempts: 1,
          provider: 'gemini',
          pagesProcessed: [],
          cacheHit: false,
          error: 'Gemini đã trả lời nhưng không có câu hỏi nào dùng được.',
          createdAt: '2026-10-24T00:00:00.000Z',
          updatedAt: '2026-10-24T00:00:00.000Z',
        },
      ],
    });
    expect(failed.key).toBe('FAILED');
    expect(failed.next).not.toContain('Gemini');
  });
});
