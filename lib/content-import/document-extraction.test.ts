import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  candidatesFromDocumentPages,
  extractPdfDeterministically,
  reconcileDocumentCandidates,
  reconstructPositionedText,
  type ExtractedDocumentPage,
  type PositionedTextItem,
} from './document-extraction';

function page(pageNumber: number, text: string): ExtractedDocumentPage {
  return { pageNumber, text, lowText: false };
}

describe('deterministic document question extraction', () => {
  it('extracts a real PDF fixture deterministically without mocking PDF.js', async () => {
    const fixture = await readFile(
      new URL('../../test/fixtures/content-import/question-bank-import.pdf', import.meta.url)
    );

    const first = await extractPdfDeterministically(fixture);
    const second = await extractPdfDeterministically(fixture);

    expect(second.pages).toEqual(first.pages);
    expect(first.warnings).toEqual([]);
    expect(first.candidates).toHaveLength(1);
    expect(first.candidates[0]).toMatchObject({
      number: 1,
      content: 'What is two plus two?',
      options: [
        { key: 'A', content: 'Three' },
        { key: 'B', content: 'Four' },
        { key: 'C', content: 'Five' },
        { key: 'D', content: 'Six' },
      ],
      correctAnswer: 'B',
      reviewLevel: 'READY',
    });
  });

  it('extracts and validates an inline answer declaration', () => {
    const [candidate] = candidatesFromDocumentPages([
      page(
        1,
        [
          'Câu 1: Giá trị của 1 + 1 là bao nhiêu?',
          'A. 1',
          'B. 2',
          'C. 3',
          'D. 4',
          'Đáp án: B',
        ].join('\n')
      ),
    ]);

    expect(candidate.content).toBe('Giá trị của 1 + 1 là bao nhiêu?');
    expect(candidate.options).toHaveLength(4);
    expect(candidate.correctAnswer).toBe('B');
    expect(candidate.reviewLevel).toBe('READY');
    expect(candidate.warnings).toEqual([]);
  });

  it('recognizes an answer declared in a solution', () => {
    const [candidate] = candidatesFromDocumentPages([
      page(
        1,
        [
          'Bài 1. Chọn số nguyên tố.',
          'A. 4',
          'B. 6',
          'C. 7',
          'D. 8',
          'Lời giải: 7 là số nguyên tố. Chọn C.',
        ].join('\n')
      ),
    ]);

    expect(candidate.correctAnswer).toBe('C');
    expect(candidate.explanation).toContain('7 là số nguyên tố');
    expect(candidate.reviewLevel).toBe('READY');
  });

  it('matches a bounded trailing answer-key table by question number', () => {
    const candidates = candidatesFromDocumentPages([
      page(
        1,
        [
          'Câu 1: Chọn phương án thứ nhất.',
          'A. Alpha',
          'B. Beta',
          'C. Gamma',
          'D. Delta',
          'Câu 2: Chọn phương án thứ hai.',
          'A. Một',
          'B. Hai',
          'C. Ba',
          'D. Bốn',
        ].join('\n')
      ),
      page(2, 'BẢNG ĐÁP ÁN: 1-A 2.B'),
    ]);

    expect(candidates.map((candidate) => candidate.correctAnswer)).toEqual(['A', 'B']);
    expect(candidates.map((candidate) => candidate.reviewLevel)).toEqual(['READY', 'READY']);
  });

  it('keeps a question without an answer in blocking staging', () => {
    const [candidate] = candidatesFromDocumentPages([
      page(1, ['Câu 1: Chọn đáp án đúng.', 'A. Một', 'B. Hai', 'C. Ba', 'D. Bốn'].join('\n')),
    ]);

    expect(candidate.correctAnswer).toBe('');
    expect(candidate.reviewLevel).toBe('BLOCKING');
    expect(candidate.warnings.map((warning) => warning.code)).toContain('MISSING_ANSWER');
    expect(candidate.validationErrors?.map((error) => error.code)).toContain('MISSING_ANSWER');
  });

  it('rejects a detected answer token that is not an extracted option key', () => {
    const [candidate] = candidatesFromDocumentPages([
      page(
        1,
        ['Câu 1: Chọn đáp án đúng.', 'A. Một', 'B. Hai', 'C. Ba', 'D. Bốn', 'Đáp án: E'].join('\n')
      ),
    ]);

    expect(candidate.correctAnswer).toBe('');
    expect(candidate.reviewLevel).toBe('BLOCKING');
    expect(
      candidate.warnings.find((warning) => warning.code === 'MISSING_ANSWER')?.message
    ).toContain('không khớp');
  });

  it('excludes cover pages that do not contain an explicit question boundary', () => {
    const candidates = candidatesFromDocumentPages([
      page(1, 'ĐỀ KIỂM TRA CUỐI KỲ\nThời gian làm bài 90 phút\nKhông sử dụng tài liệu'),
      page(
        2,
        ['Question 7: Select the result.', 'A. 1', 'B. 2', 'C. 3', 'D. 4', 'Answer: D'].join('\n')
      ),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].number).toBe(7);
    expect(candidates[0].content).not.toContain('ĐỀ KIỂM TRA');
    expect(candidates[0].sourcePages).toEqual([2]);
  });

  it('reconciles recovered candidates without duplicating deterministic candidates', () => {
    const deterministic = candidatesFromDocumentPages([
      page(1, ['Câu 1: Câu đã tách.', 'A. Một', 'B. Hai', 'Đáp án: A'].join('\n')),
    ]);
    const recovered = candidatesFromDocumentPages([
      page(1, ['Câu 1: Câu phục hồi.', 'A. Một', 'B. Hai', 'Đáp án: B'].join('\n')),
      page(2, ['Câu 2: Câu mới.', 'A. Ba', 'B. Bốn'].join('\n')),
    ]);

    const reconciled = reconcileDocumentCandidates(deterministic, recovered);
    expect(reconciled).toHaveLength(2);
    expect(reconciled[0].content).toBe('Câu đã tách.');
    expect(reconciled[1].number).toBe(2);
  });

  it('orders a positioned two-column page down the left column before the right', () => {
    const items: PositionedTextItem[] = [
      { str: 'Câu 1: Left', x: 40, y: 700, width: 90, height: 12 },
      { str: 'A. left option', x: 40, y: 680, width: 90, height: 12 },
      { str: 'Câu 2: Right', x: 330, y: 700, width: 100, height: 12 },
      { str: 'A. right option', x: 330, y: 680, width: 100, height: 12 },
    ];

    const result = reconstructPositionedText(items, 600, 800);
    expect(result.lines.map((line) => line.text)).toEqual([
      'Câu 1: Left',
      'A. left option',
      'Câu 2: Right',
      'A. right option',
    ]);
  });
});
