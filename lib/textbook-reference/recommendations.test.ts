import { describe, expect, it } from 'vitest';
import { curriculumOrder, recommendSections, topicOf } from './recommendations';
import { artifactsCoveredByMappings, mappingSpan } from './lesson-coverage';
import type { TextbookKnowledgeMapping, TextbookTocEntry } from './types';

// The outline of math_book_3.pdf as indexed on Production (first topic), pages as printed.
const toc = (
  id: string,
  parentId: string | null,
  level: number,
  heading: string,
  start: number,
  end: number,
  verified = false
): TextbookTocEntry => ({
  id,
  parentId,
  level,
  originalHeading: heading,
  normalizedHeading: heading.toLocaleLowerCase('vi'),
  printedStartPage: start,
  printedEndPage: end,
  locations: [],
  status: verified ? 'VERIFIED' : 'OBSERVED',
});

const BOOK = {
  id: 'book-3',
  title: 'math_book_3',
  tocEntries: [
    toc('toc-1', null, 1, 'Chủ đề 1: Hàm số và các ứng dụng của đạo hàm', 13, 136),
    toc('toc-2', 'toc-1', 2, 'I.I. Tính đơn điệu của hàm số', 13, 33),
    toc('toc-3', 'toc-2', 3, 'A. Lý thuyết', 13, 13, true),
    toc('toc-4', 'toc-2', 3, 'B. Bài tập trong các đề thi thử của các trường', 14, 33),
    toc('toc-5', 'toc-4', 4, 'Dạng 1: Bài toán không chứa tham số', 14, 18),
    toc('toc-6', 'toc-4', 4, 'Bài tập rèn luyện kỹ năng', 19, 20),
    toc('toc-7', 'toc-4', 4, 'Dạng 2: Bài toán chứa tham số', 21, 27),
    toc('toc-8', 'toc-4', 4, 'Bài tập rèn luyện kỹ năng', 28, 28),
    toc('toc-9', 'toc-4', 4, 'Hướng dẫn giải chi tiết', 29, 33),
    toc(
      'toc-10',
      'toc-1',
      2,
      'I.II. Cực trị của hàm số và giá trị lớn nhất, giá trị nhỏ nhất của hàm số',
      34,
      97
    ),
    toc('toc-11', 'toc-10', 3, 'A. Lý thuyết về cực trị của hàm số', 34, 36),
  ],
};

const P1 = { id: 'p1', title: 'Tính đơn điệu của hàm số (P1)' };
const P2 = { id: 'p2', title: 'Tính đơn điệu của hàm số (P2)' };
const CT1 = { id: 'ct1', title: 'Cực trị của hàm số (P1)' };
const CURRICULUM = [P1, P2, CT1];

const link = (
  node: string,
  entryId: string,
  status: 'CONFIRMED' | 'REJECTED' = 'CONFIRMED',
  range?: [number, number]
): TextbookKnowledgeMapping => ({
  id: `map-${entryId}-${node}`,
  documentId: BOOK.id,
  entryId,
  knowledgeNodeId: node,
  confidence: 1,
  status,
  confirmationRequired: false,
  updatedAt: '2026-10-24T00:00:00.000Z',
  ...(range && { printedStartPage: range[0], printedEndPage: range[1] }),
});

// Production state: P1 linked to A, Dạng 1 and its exercises; P2 had the topic and A unlinked.
const PRODUCTION = [
  link('p1', 'toc-3'),
  link('p1', 'toc-5'),
  link('p1', 'toc-6'),
  link('p2', 'toc-2', 'REJECTED'),
  link('p2', 'toc-3', 'REJECTED'),
];

const recommend = (lesson: typeof P1, mappings: TextbookKnowledgeMapping[]) =>
  recommendSections({ lesson, curriculum: CURRICULUM, documents: [BOOK], mappings });

describe('curriculum-aware section recommendations', () => {
  it('suggests the section that continues where P1 ends (tr. 21), inside the same topic', () => {
    const { recommendations, coverage } = recommend(P2, PRODUCTION);
    expect(coverage[0].previous).toMatchObject({ nodeId: 'p1', span: { start: 13, end: 20 } });
    const [first] = recommendations;
    expect(first.entry.id).toBe('toc-7');
    expect(first.basis).toBe('CONTINUATION');
    expect(first.strength).toBe('STRONG');
    expect(first.span).toEqual({ start: 21, end: 27 });
    expect(first.reasons.join(' ')).toContain('dừng ở tr. 20');
    expect(first.reasons.join(' ')).toContain('I.I. Tính đơn điệu của hàm số');
    // Outline pages only: never presented as verified.
    expect(first.pagesVerified).toBe(false);
    expect(first.warnings.join(' ')).toContain('chưa đối chiếu');
  });

  it('offers the following exercises and the far-away worked solutions, never what P1 has', () => {
    const ids = recommend(P2, PRODUCTION).recommendations.map((item) => item.entry.id);
    expect(ids).toContain('toc-8');
    expect(ids).toContain('toc-9');
    for (const taken of ['toc-3', 'toc-5', 'toc-6']) expect(ids).not.toContain(taken);
  });

  it('does not re-suggest sections the Admin unlinked from this lesson', () => {
    const ids = recommend(P2, PRODUCTION).recommendations.map((item) => item.entry.id);
    expect(ids).not.toContain('toc-2');
  });

  it('warns that a broad title match also contains P1’s pages', () => {
    const fresh = recommend(P2, [link('p1', 'toc-3'), link('p1', 'toc-5'), link('p1', 'toc-6')]);
    const broad = fresh.recommendations.find((item) => item.entry.id === 'toc-2');
    expect(broad?.strength).toBe('WEAK');
    expect(broad?.warnings.join(' ')).toContain('Tính đơn điệu của hàm số (P1)');
  });

  it('continues inside a section P1 only used part of', () => {
    const { recommendations } = recommend(P2, [
      link('p1', 'toc-3'),
      link('p1', 'toc-5', 'CONFIRMED', [14, 16]),
    ]);
    expect(recommendations[0]).toMatchObject({
      entry: { id: 'toc-5' },
      span: { start: 17, end: 18 },
      partial: true,
    });
  });

  it('ignores a linked solutions section when finding where P1 ends', () => {
    const { recommendations, coverage } = recommend(P2, [...PRODUCTION, link('p1', 'toc-9')]);
    expect(coverage[0].previous?.span.end).toBe(20);
    expect(recommendations[0].entry.id).toBe('toc-7');
    // Shared solutions stay available, and say who uses them.
    const solutions = recommendations.find((item) => item.entry.id === 'toc-9');
    expect(solutions?.linkedElsewhere.map((item) => item.nodeId)).toEqual(['p1']);
  });

  it('uses curriculum order, not the last edited lesson: CT1 continues from P2, skipping nothing', () => {
    const mappings = [...PRODUCTION, link('p2', 'toc-7'), link('p2', 'toc-8'), link('p2', 'toc-9')];
    const { recommendations, coverage } = recommend(CT1, mappings);
    expect(coverage[0].previous?.nodeId).toBe('p2');
    expect(coverage[0].previous?.span.end).toBe(28);
    // Next content after p. 28 is outside the topic; it is the next topic, which matches the title.
    const first = recommendations[0];
    expect(['toc-10', 'toc-11']).toContain(first.entry.id);
    expect(first.reasons.join(' ')).toContain('khớp tên bài');
  });

  it('does not push the rest of P2’s topic onto a lesson about something else', () => {
    // P2 kept only tr. 21–24 of "Dạng 2"; the next lesson is about extrema.
    const mappings = [...PRODUCTION, link('p2', 'toc-7', 'CONFIRMED', [21, 24])];
    const { recommendations } = recommend(CT1, mappings);
    const rest = recommendations.find((item) => item.entry.id === 'toc-7');
    expect(rest).toMatchObject({ strength: 'WEAK', span: { start: 25, end: 27 } });
    expect(rest?.warnings.join(' ')).toContain('không khớp');
    // The topic that matches the lesson title is offered, and ranks above the weak remainder.
    const extrema = recommendations.find((item) => ['toc-10', 'toc-11'].includes(item.entry.id));
    expect(extrema?.strength).not.toBe('WEAK');
    expect(recommendations.indexOf(extrema!)).toBeLessThan(recommendations.indexOf(rest!));
    // Solutions of the old topic are not suggested for the new one.
    expect(recommendations.map((item) => item.entry.id)).not.toContain('toc-9');
  });

  it('suggests the rest of a split section to the lesson that continues it', () => {
    const P3 = { id: 'p3', title: 'Tính đơn điệu của hàm số (P3)' };
    const result = recommendSections({
      lesson: P3,
      curriculum: [P1, P2, P3, CT1],
      documents: [BOOK],
      mappings: [...PRODUCTION, link('p2', 'toc-7', 'CONFIRMED', [21, 24])],
    });
    expect(result.recommendations[0]).toMatchObject({
      entry: { id: 'toc-7' },
      strength: 'STRONG',
      span: { start: 25, end: 27 },
    });
  });

  it('never suggests a section a later lesson already links', () => {
    const mappings = [link('p1', 'toc-3'), link('ct1', 'toc-11')];
    const ids = recommend(P2, mappings).recommendations.map((item) => item.entry.id);
    expect(ids).not.toContain('toc-11');
  });

  it('keeps independent page sequences per book', () => {
    const other = {
      ...BOOK,
      id: 'book-x',
      title: 'Sách khác',
      tocEntries: BOOK.tocEntries.map((entry) => ({ ...entry })),
    };
    const result = recommendSections({
      lesson: P2,
      curriculum: CURRICULUM,
      documents: [BOOK, other],
      mappings: PRODUCTION,
    });
    // P1 links nothing in the other book, so there is no continuation there.
    expect(result.coverage.map((item) => item.documentId)).toEqual(['book-3']);
    expect(
      result.recommendations.filter(
        (item) => item.documentId === 'book-x' && item.basis === 'CONTINUATION'
      )
    ).toHaveLength(0);
  });

  it('finds the topic of a section', () => {
    expect(topicOf(BOOK.tocEntries, BOOK.tocEntries[5]).id).toBe('toc-2');
    expect(topicOf(BOOK.tocEntries, BOOK.tocEntries[0]).id).toBe('toc-1');
  });
});

describe('curriculum order', () => {
  it('walks the grade depth-first by order', () => {
    const node = (id: string, parentId: string | null, order: number, kind = 'GROUP') => ({
      id,
      title: id,
      parentId,
      order,
      kind,
    });
    const nodes = [
      node('math', null, 1),
      node('g12', 'math', 1),
      node('ch2', 'g12', 2),
      node('ch1', 'g12', 1),
      node('b', 'ch1', 2, 'KNOWLEDGE'),
      node('a', 'ch1', 1, 'KNOWLEDGE'),
      node('c', 'ch2', 1, 'KNOWLEDGE'),
    ];
    expect(curriculumOrder(nodes, 'c').map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('lesson coverage', () => {
  const artifact = (id: string, entryId: string, pages: number[]) => ({
    id,
    documentId: BOOK.id,
    entryId,
    printedPages: pages,
  });
  const tocByDocument = new Map([[BOOK.id, BOOK.tocEntries]]);

  it('includes subsections of a linked section', () => {
    const result = artifactsCoveredByMappings(
      [artifact('a', 'toc-7', [21]), artifact('b', 'toc-11', [34])],
      [link('p2', 'toc-4')],
      tocByDocument
    );
    expect(result.map((item) => item.id)).toEqual(['a']);
  });

  it('limits a narrowed link to its pages, so P1’s extracts do not reach P2', () => {
    const result = artifactsCoveredByMappings(
      [artifact('p1-part', 'toc-5', [14]), artifact('p2-part', 'toc-5', [17])],
      [link('p2', 'toc-5', 'CONFIRMED', [17, 18])],
      tocByDocument
    );
    expect(result.map((item) => item.id)).toEqual(['p2-part']);
  });

  it('ignores declined links', () => {
    expect(
      artifactsCoveredByMappings(
        [artifact('a', 'toc-3', [13])],
        [link('p2', 'toc-3', 'REJECTED')],
        tocByDocument
      )
    ).toEqual([]);
  });

  it('reads the narrowed range, else the section range', () => {
    expect(mappingSpan(link('p', 'toc-5', 'CONFIRMED', [15, 16]), BOOK.tocEntries[4])).toEqual({
      start: 15,
      end: 16,
    });
    expect(mappingSpan(link('p', 'toc-5'), BOOK.tocEntries[4])).toEqual({ start: 14, end: 18 });
  });
});
