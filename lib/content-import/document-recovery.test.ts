import { describe, expect, it } from 'vitest';
import {
  candidatesFromDocumentPages,
  planDocumentRecovery,
  type ExtractedDocumentPage,
} from './document-extraction';

function page(pageNumber: number, text: string, lowText = false): ExtractedDocumentPage {
  return { pageNumber, text, lowText };
}

describe('document recovery planning', () => {
  it('identifies confident pages when questions have clear boundaries and no math/numbering gaps', () => {
    const pages = [
      page(
        1,
        [
          'Câu 1: Thủ đô của Việt Nam là gì?',
          'A. Hà Nội',
          'B. Huế',
          'C. Đà Nẵng',
          'D. Cần Thơ',
          'Đáp án: A',
        ].join('\n')
      ),
      page(2, ['Câu 2: 2 + 2 bằng mấy?', 'A. 1', 'B. 2', 'C. 3', 'D. 4', 'Đáp án: D'].join('\n')),
    ];
    const candidates = candidatesFromDocumentPages(pages);
    const plan = planDocumentRecovery(pages, candidates);

    expect(plan.pageNumbers).toEqual([]);
    expect(plan.triage.get(1)).toEqual(['CONFIDENT']);
    expect(plan.triage.get(2)).toEqual(['CONFIDENT']);
  });

  it('flags LOW_TEXT pages for recovery escalation', () => {
    const pages = [
      page(1, 'Scan page with minimal OCR text', true),
      page(2, ['Câu 1: Câu hỏi bình thường.', 'A. 1', 'B. 2', 'Đáp án: A'].join('\n')),
    ];
    const candidates = candidatesFromDocumentPages(pages);
    const plan = planDocumentRecovery(pages, candidates);

    expect(plan.pageNumbers).toContain(1);
    expect(plan.triage.get(1)).toContain('LOW_TEXT');
  });

  it('flags NO_BOUNDARY on non-empty pages lacking question markers or answer keys', () => {
    const pages = [
      page(
        1,
        'Đoạn văn hướng dẫn hoặc câu hỏi không có tiền tố câu tiêu chuẩn nhưng có nhiều chữ.'
      ),
      page(2, ['Câu 1: Câu hỏi chuẩn.', 'A. 1', 'B. 2', 'Đáp án: A'].join('\n')),
    ];
    const candidates = candidatesFromDocumentPages(pages);
    const plan = planDocumentRecovery(pages, candidates);

    expect(plan.pageNumbers).toContain(1);
    expect(plan.triage.get(1)).toContain('NO_BOUNDARY');
  });

  it('flags NUMBERING_GAP when question numbers skip', () => {
    const pages = [
      page(1, ['Câu 1: Câu số một.', 'A. 1', 'B. 2', 'Đáp án: A'].join('\n')),
      page(2, ['Câu 4: Câu số bốn bị nhảy số.', 'A. 1', 'B. 2', 'Đáp án: A'].join('\n')),
    ];
    const candidates = candidatesFromDocumentPages(pages);
    const plan = planDocumentRecovery(pages, candidates);

    expect(plan.pageNumbers).toContain(2);
    expect(plan.triage.get(2)).toContain('NUMBERING_GAP');
  });

  it('flags SUSPECT_MATH on pages with complex math or diagrams', () => {
    const pages = [
      page(
        1,
        ['Câu 1: Tính tích phân sau:', '$\\int_0^1 x dx$', 'A. 1/2', 'B. 1', 'Đáp án: A'].join('\n')
      ),
    ];
    const candidates = candidatesFromDocumentPages(pages);
    const plan = planDocumentRecovery(pages, candidates);

    expect(plan.pageNumbers).toContain(1);
    expect(plan.triage.get(1)).toContain('SUSPECT_MATH');
  });
});
