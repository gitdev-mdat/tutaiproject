import { describe, expect, it } from 'vitest';
import { mapPrintedPage } from './page-mapping';
import type { TextbookAnchor } from './types';

const anchors: TextbookAnchor[] = [
  { printedPage: 13, pdfPage: 7, position: 'RIGHT', evidence: 'folio visible' },
  { printedPage: 29, pdfPage: 15, position: 'RIGHT', evidence: 'folio visible' },
  { printedPage: 33, pdfPage: 17, position: 'RIGHT', evidence: 'folio visible' },
  { printedPage: 34, pdfPage: 18, position: 'LEFT', evidence: 'section boundary visible' },
];

describe('printed page mapping', () => {
  it('uses anchors and keeps printed page separate from PDF page', () => {
    expect(mapPrintedPage(13, anchors)).toMatchObject({
      printedPage: 13,
      pdfPage: 7,
      position: 'RIGHT',
      verification: 'VERIFIED',
    });
    expect(mapPrintedPage(14, anchors)).toMatchObject({
      printedPage: 14,
      pdfPage: 8,
      position: 'LEFT',
    });
    expect(mapPrintedPage(29, anchors)).toMatchObject({
      printedPage: 29,
      pdfPage: 15,
      position: 'RIGHT',
      verification: 'VERIFIED',
    });
    expect(mapPrintedPage(33, anchors)).toMatchObject({
      printedPage: 33,
      pdfPage: 17,
      position: 'RIGHT',
    });
    expect(mapPrintedPage(34, anchors)).toMatchObject({
      printedPage: 34,
      pdfPage: 18,
      position: 'LEFT',
      verification: 'VERIFIED',
    });
  });

  it('does not guess outside the observed anchor range', () => {
    expect(mapPrintedPage(12, anchors)).toMatchObject({
      pdfPage: -1,
      position: 'UNCERTAIN',
      verification: 'NEEDS_REVIEW',
    });
    expect(mapPrintedPage(35, anchors)).toMatchObject({
      pdfPage: -1,
      position: 'UNCERTAIN',
      verification: 'NEEDS_REVIEW',
    });
  });

  it('marks inconsistent anchor sequences uncertain', () => {
    expect(
      mapPrintedPage(14, [
        anchors[0],
        { printedPage: 29, pdfPage: 16, position: 'RIGHT', evidence: 'conflicting anchor' },
      ])
    ).toMatchObject({ position: 'UNCERTAIN', verification: 'NEEDS_REVIEW' });
  });
});
