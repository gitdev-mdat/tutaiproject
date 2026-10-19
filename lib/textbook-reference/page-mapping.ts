import type {
  PageLayout,
  PagePosition,
  TextbookAnchor,
  TextbookPageLocation,
} from './types';

const UNCERTAIN = (printedPage: number, pdfPage = -1): TextbookPageLocation => ({
  printedPage,
  pdfPage,
  position: 'UNCERTAIN',
  crop: { x: 0, y: 0, width: 1, height: 1 },
  verification: 'NEEDS_REVIEW',
});

export function layoutOf(anchors: TextbookAnchor[]): PageLayout {
  return anchors.some((anchor) => anchor.position === 'FULL') ? 'SINGLE' : 'TWO_UP';
}

/**
 * The page "slot" offset an anchor implies. Two anchors agree on the book's
 * pagination exactly when their offsets are equal: for two-up scans the slot
 * is 2·pdfPage (+1 for the right half), for single pages it is the PDF page.
 */
function slotOffset(anchor: TextbookAnchor, layout: PageLayout): number | null {
  if (layout === 'SINGLE') return anchor.position === 'FULL' ? anchor.pdfPage - anchor.printedPage : null;
  if (anchor.position !== 'LEFT' && anchor.position !== 'RIGHT') return null;
  return 2 * anchor.pdfPage + (anchor.position === 'RIGHT' ? 1 : 0) - anchor.printedPage;
}

/** True when every anchor implies the same pagination for the given layout. */
export function anchorsAgree(anchors: TextbookAnchor[], layout: PageLayout): boolean {
  const offsets = anchors.map((anchor) => slotOffset(anchor, layout));
  return offsets.every((offset) => offset !== null && offset === offsets[0]);
}

/** Map only inside an interval whose two ends were checked and agree. */
export function mapPrintedPage(
  printedPage: number,
  anchors: TextbookAnchor[],
  layout: PageLayout = layoutOf(anchors)
): TextbookPageLocation {
  const sorted = [...anchors].sort((a, b) => a.printedPage - b.printedPage);
  const lower = [...sorted].reverse().find((anchor) => anchor.printedPage <= printedPage);
  const upper = sorted.find((anchor) => anchor.printedPage >= printedPage);
  if (!lower || !upper) return UNCERTAIN(printedPage);
  const offset = slotOffset(lower, layout);
  if (offset === null || offset !== slotOffset(upper, layout) || lower.pdfPage > upper.pdfPage)
    return UNCERTAIN(printedPage);

  const isAnchored = lower.printedPage === printedPage || upper.printedPage === printedPage;
  const insideVerifiedInterval = lower.printedPage !== upper.printedPage;
  const slot = printedPage + offset;
  const pdfPage = layout === 'SINGLE' ? slot : Math.floor(slot / 2);
  if (pdfPage < 1 || (!isAnchored && !insideVerifiedInterval)) return UNCERTAIN(printedPage, pdfPage);

  const position: PagePosition = layout === 'SINGLE' ? 'FULL' : slot % 2 ? 'RIGHT' : 'LEFT';
  return {
    printedPage,
    pdfPage,
    position,
    crop:
      position === 'LEFT'
        ? { x: 0, y: 0, width: 0.5, height: 1 }
        : position === 'RIGHT'
          ? { x: 0.5, y: 0, width: 0.5, height: 1 }
          : { x: 0, y: 0, width: 1, height: 1 },
    verification: isAnchored ? 'VERIFIED' : 'OBSERVED',
  };
}

export function normalizedHeading(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim();
}
