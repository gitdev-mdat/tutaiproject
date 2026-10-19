import type { PagePosition, TextbookAnchor, TextbookPageLocation } from './types';

/** Map only inside an interval whose two ends were visually checked. */
export function mapPrintedPage(
  printedPage: number,
  anchors: TextbookAnchor[]
): TextbookPageLocation {
  const sorted = [...anchors].sort((a, b) => a.printedPage - b.printedPage);
  const lower = [...sorted].reverse().find((anchor) => anchor.printedPage <= printedPage);
  const upper = sorted.find((anchor) => anchor.printedPage >= printedPage);
  const position: PagePosition = printedPage % 2 === 0 ? 'LEFT' : 'RIGHT';

  const consistentWithObservedPageConvention = (anchor: TextbookAnchor) =>
    anchor.pdfPage === Math.floor(anchor.printedPage / 2) + 1 &&
    anchor.position === (anchor.printedPage % 2 === 0 ? 'LEFT' : 'RIGHT');
  if (
    !lower ||
    !upper ||
    lower.pdfPage > upper.pdfPage ||
    !consistentWithObservedPageConvention(lower) ||
    !consistentWithObservedPageConvention(upper)
  ) {
    return {
      printedPage,
      pdfPage: -1,
      position: 'UNCERTAIN',
      crop: { x: 0, y: 0, width: 1, height: 1 },
      verification: 'NEEDS_REVIEW',
    };
  }

  const pdfPage = Math.floor(printedPage / 2) + 1;
  const isAnchored = lower.printedPage === printedPage || upper.printedPage === printedPage;
  const insideVerifiedInterval = lower.printedPage !== upper.printedPage;
  if (!isAnchored && !insideVerifiedInterval) {
    return {
      printedPage,
      pdfPage,
      position: 'UNCERTAIN',
      crop: { x: 0, y: 0, width: 1, height: 1 },
      verification: 'NEEDS_REVIEW',
    };
  }

  return {
    printedPage,
    pdfPage,
    position,
    crop:
      position === 'LEFT'
        ? { x: 0, y: 0, width: 0.5, height: 1 }
        : { x: 0.5, y: 0, width: 0.5, height: 1 },
    verification: isAnchored ? 'VERIFIED' : 'OBSERVED',
  };
}

export function normalizedHeading(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim();
}
