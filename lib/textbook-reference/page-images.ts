import 'server-only';

import { downloadPrivateTextbook } from './object-storage';
import { mapPrintedPage } from './page-mapping';
import { renderPrintedPageCrops } from './pdf-pages';
import { getTextbookDocument } from './repository';

/**
 * One printed page of a private textbook as a PNG, for the Admin's side-by-side
 * check of an exercise and its solution. Two-up scans are cut to the half that
 * holds the page. The PDF never leaves the server and no URL to it is created;
 * the route that serves these images is Admin-only.
 */

const PAGE_WIDTH = 1000;
const MAX_IMAGES = 48;
const images = new Map<string, Buffer>();
let source: { key: string; bytes: Promise<Buffer> } | null = null;

export class PageImageError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 422
  ) {
    super(message);
    this.name = 'PageImageError';
  }
}

function pdfBytes(storageKey: string, read: (key: string) => Promise<Buffer>) {
  // A warm function instance keeps the last book it opened: pages are looked at in runs.
  if (source?.key !== storageKey) {
    const bytes = read(storageKey);
    source = { key: storageKey, bytes };
    bytes.catch(() => {
      if (source?.bytes === bytes) source = null;
    });
  }
  return source.bytes;
}

export async function printedPageImage(
  documentId: string,
  printedPage: number,
  read: (key: string) => Promise<Buffer> = downloadPrivateTextbook
): Promise<{ png: Buffer; pdfPage: number; position: string }> {
  const document = await getTextbookDocument(documentId);
  if (!document) throw new PageImageError('Không tìm thấy sách.', 404);
  const location = mapPrintedPage(printedPage, document.anchors, document.pageLayout);
  if (
    location.position === 'UNCERTAIN' ||
    location.pdfPage < 1 ||
    (document.pdfPageCount !== null && location.pdfPage > document.pdfPageCount)
  )
    throw new PageImageError('Trang này chưa xác định được vị trí trong PDF.', 422);
  const key = `${document.sha256}:${printedPage}`;
  let png = images.get(key);
  if (!png) {
    const [image] = await renderPrintedPageCrops(
      await pdfBytes(document.storageKey, read),
      [{ printedPage, pdfPage: location.pdfPage, position: location.position }],
      PAGE_WIDTH
    );
    png = image.bytes;
    images.set(key, png);
    if (images.size > MAX_IMAGES) images.delete(images.keys().next().value!);
  }
  return { png, pdfPage: location.pdfPage, position: location.position };
}
