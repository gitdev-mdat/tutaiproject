import { buildTocEntries, recomputeTocRanges } from './toc-service';
import type { TextbookAnchor } from './types';

const anchors: TextbookAnchor[] = [
  { printedPage: 13, pdfPage: 7, position: 'RIGHT', evidence: '' },
  { printedPage: 34, pdfPage: 18, position: 'LEFT', evidence: '' },
];

describe('table of contents structure', () => {
  const entries = buildTocEntries(
    [
      { heading: 'Chủ đề 1: Hàm số ..........13', level: 1, printedPage: 13 },
      { heading: 'I.I. Tính đơn điệu của hàm số', level: 2, printedPage: 13 },
      { heading: 'Dạng 1', level: 3, printedPage: 14 },
      { heading: 'Dạng 2', level: 3, printedPage: 21 },
      { heading: 'I.II. Cực trị', level: 2, printedPage: 34 },
    ],
    { anchors, pageLayout: 'TWO_UP' }
  );

  it('builds parents and page ranges from levels', () => {
    expect(entries[0].originalHeading).toBe('Chủ đề 1: Hàm số');
    expect(entries[2].parentId).toBe(entries[1].id);
    expect(entries[1]).toMatchObject({ printedStartPage: 13, printedEndPage: 33 });
    expect(entries[2]).toMatchObject({ printedStartPage: 14, printedEndPage: 20 });
    expect(entries[1].locations[0]).toMatchObject({ pdfPage: 7, position: 'RIGHT' });
  });

  it('recomputes ranges after a corrected start page, keeping ids and parents', () => {
    const corrected = recomputeTocRanges(
      entries.map((entry) =>
        entry.originalHeading === 'Dạng 2' ? { ...entry, printedStartPage: 22 } : entry
      ),
      { anchors, pageLayout: 'TWO_UP' }
    );
    expect(corrected.map((entry) => [entry.id, entry.parentId])).toEqual(
      entries.map((entry) => [entry.id, entry.parentId])
    );
    expect(corrected[2].printedEndPage).toBe(21);
    expect(corrected[3]).toMatchObject({ printedStartPage: 22, printedEndPage: 33 });
  });
});
