import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readTextbookStore } from '@/lib/textbook-reference/repository';
import { renderPrintedPageCrops } from '@/lib/textbook-reference/pdf-pages';

async function main() {
  const documentId = process.argv[2];
  if (!documentId)
    throw new Error(
      'Usage: pnpm exec tsx --conditions=react-server scripts/textbooks/render-pilot-pages.ts <document-id>'
    );
  const store = await readTextbookStore();
  const document = store.documents.find((item) => item.id === documentId);
  if (!document) throw new Error('Textbook not found.');
  const pages = [13, 16, 19, 29].map((printedPage) => {
    const pdfPage = Math.floor(printedPage / 2) + 1;
    return {
      printedPage,
      pdfPage,
      position: printedPage % 2 === 0 ? ('LEFT' as const) : ('RIGHT' as const),
    };
  });
  const images = await renderPrintedPageCrops(document.storageKey, pages);
  const out = path.join(process.cwd(), 'tmp', 'textbook-reference', 'rendered');
  await mkdir(out, { recursive: true });
  await Promise.all(
    images.map((image) =>
      writeFile(path.join(out, `printed-${image.printedPage}.png`), image.bytes)
    )
  );
  console.log(
    JSON.stringify({
      path: out,
      pages: images.map(({ printedPage, pdfPage, position }) => ({
        printedPage,
        pdfPage,
        position,
      })),
    })
  );
}

void main();
