import 'server-only';

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rmdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { PagePosition } from './types';
import { withTextbookPdf } from './repository';

const execFileAsync = promisify(execFile);

export async function renderPrintedPageCrops(
  storageKey: string,
  pages: Array<{ printedPage: number; pdfPage: number; position: PagePosition }>,
  scale = 1.8
): Promise<Array<{ printedPage: number; pdfPage: number; position: PagePosition; bytes: Buffer }>> {
  await mkdir(path.join(process.cwd(), 'tmp', 'textbook-reference'), { recursive: true });
  return withTextbookPdf(storageKey, async (sourcePath) => {
    const canvasModule = await import('@napi-rs/canvas');
    const { createCanvas } = canvasModule;
    const output = [];
    for (const location of pages) {
      if (location.position === 'UNCERTAIN' || location.pdfPage < 1) {
        throw new Error(`Printed page ${location.printedPage} has no verified PDF-page location.`);
      }
      const scratch = await mkdtemp(
        path.join(process.cwd(), 'tmp', 'textbook-reference', 'render-')
      );
      const prefix = path.join(scratch, 'page');
      const rendered = `${prefix}.png`;
      try {
        await execFileAsync(
          'pdftoppm',
          [
            '-f',
            String(location.pdfPage),
            '-l',
            String(location.pdfPage),
            '-singlefile',
            '-png',
            '-r',
            String(Math.round(scale * 88.8889)),
            sourcePath,
            prefix,
          ],
          { windowsHide: true, timeout: 30_000 }
        );
        const full = await createCanvasImage(await readFile(rendered), canvasModule);
        const leftHalf = location.position === 'LEFT';
        const crop = createCanvas(Math.floor(full.width / 2), full.height);
        const context = crop.getContext('2d');
        context.drawImage(
          full.image,
          leftHalf ? 0 : Math.floor(full.width / 2),
          0,
          crop.width,
          crop.height,
          0,
          0,
          crop.width,
          crop.height
        );
        output.push({ ...location, bytes: crop.toBuffer('image/png') });
      } catch (error) {
        throw new Error(
          `Could not render PDF page ${location.pdfPage} with Poppler (pdftoppm): ${error instanceof Error ? error.message : String(error)}`
        );
      } finally {
        await unlink(rendered).catch(() => {});
        await rmdir(scratch).catch(() => {});
      }
    }
    return output;
  });
}

async function createCanvasImage(bytes: Buffer, canvasModule: typeof import('@napi-rs/canvas')) {
  const image = await canvasModule.loadImage(bytes);
  return { image, width: image.width, height: image.height };
}
