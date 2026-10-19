import 'server-only';

import path from 'node:path';
import type { PagePosition } from './types';

/**
 * Renders PDF pages in-process with pdf.js and @napi-rs/canvas (both already
 * dependencies), so the worker needs no system binaries such as Poppler.
 */

type PdfDocument = Awaited<ReturnType<typeof openPdf>>;

export async function openPdf(bytes: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    isEvalSupported: false,
    verbosity: 0,
    // Scanned books are often JBIG2/JPEG 2000; their decoders ship as wasm next to pdf.js.
    wasmUrl: `${path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'wasm').replaceAll(path.sep, '/')}/`,
  }).promise;
}

async function renderPage(pdf: PdfDocument, pdfPage: number, targetWidth: number) {
  const { createCanvas } = await import('@napi-rs/canvas');
  const page = await pdf.getPage(pdfPage);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: targetWidth / base.width });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({
    canvas: canvas as unknown as HTMLCanvasElement,
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;
  page.cleanup();
  return canvas;
}

/** Crops one printed page (a half for two-up scans) out of each requested PDF page as PNG. */
export async function renderPrintedPageCrops(
  bytes: Uint8Array,
  pages: Array<{ printedPage: number; pdfPage: number; position: PagePosition }>,
  printedPageWidth = 1100
): Promise<Array<{ printedPage: number; pdfPage: number; position: PagePosition; bytes: Buffer }>> {
  const { createCanvas } = await import('@napi-rs/canvas');
  const pdf = await openPdf(bytes);
  try {
    const output = [];
    for (const location of pages) {
      if (location.position === 'UNCERTAIN' || location.pdfPage < 1 || location.pdfPage > pdf.numPages)
        throw new Error(`Printed page ${location.printedPage} has no verified PDF-page location.`);
      const half = location.position === 'LEFT' || location.position === 'RIGHT';
      const full = await renderPage(pdf, location.pdfPage, half ? printedPageWidth * 2 : printedPageWidth);
      const width = half ? Math.floor(full.width / 2) : full.width;
      const crop = createCanvas(width, full.height);
      crop
        .getContext('2d')
        .drawImage(full, location.position === 'RIGHT' ? full.width - width : 0, 0, width, full.height, 0, 0, width, full.height);
      output.push({ ...location, bytes: crop.toBuffer('image/png') });
    }
    return output;
  } finally {
    await pdf.destroy();
  }
}

/** Whole PDF pages as PNG, for reading a printed table of contents. */
export async function renderPdfPages(
  bytes: Uint8Array,
  pdfPages: number[],
  width = 1800
): Promise<Array<{ pdfPage: number; bytes: Buffer }>> {
  const pdf = await openPdf(bytes);
  try {
    const output = [];
    for (const pdfPage of pdfPages) {
      if (pdfPage < 1 || pdfPage > pdf.numPages) throw new Error(`PDF page ${pdfPage} does not exist.`);
      output.push({ pdfPage, bytes: (await renderPage(pdf, pdfPage, width)).toBuffer('image/png') });
    }
    return output;
  } finally {
    await pdf.destroy();
  }
}

/** Page count and a text-layer sample that tells scanned books from digital ones. */
export async function inspectPdf(bytes: Uint8Array) {
  const pdf = await openPdf(bytes);
  try {
    const sampledPdfPages = [1, 5, 6, 7].filter((page) => page <= pdf.numPages);
    const textCharacterCounts = [];
    for (const pageNumber of sampledPdfPages) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      textCharacterCounts.push(
        content.items.map((item) => ('str' in item ? item.str : '')).join('').trim().length
      );
    }
    return {
      pdfPageCount: pdf.numPages,
      scanDetection: {
        sampledPdfPages,
        textCharacterCounts,
        scanned: textCharacterCounts.every((length) => length < 40),
      },
    };
  } finally {
    await pdf.destroy();
  }
}
