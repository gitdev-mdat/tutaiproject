import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  TextbookArtifact,
  TextbookDocumentRecord,
  TextbookExtractionJob,
  TextbookKnowledgeMapping,
} from './types';

const ROOT = path.join(process.cwd(), 'tmp', 'textbook-reference');
const PRIVATE = path.join(ROOT, 'private');
const DATA = path.join(ROOT, 'index');

export interface TextbookIndexStore {
  schemaVersion: 1;
  documents: TextbookDocumentRecord[];
  jobs: TextbookExtractionJob[];
  artifacts: TextbookArtifact[];
  mappings: TextbookKnowledgeMapping[];
}

async function atomicWrite(filePath: string, data: string | Buffer): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, data);
  await fs.rename(temporary, filePath);
}

export async function readTextbookStore(): Promise<TextbookIndexStore> {
  try {
    return JSON.parse(
      await fs.readFile(path.join(DATA, 'store.json'), 'utf8')
    ) as TextbookIndexStore;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { schemaVersion: 1, documents: [], jobs: [], artifacts: [], mappings: [] };
  }
}

export async function writeTextbookStore(store: TextbookIndexStore): Promise<void> {
  await atomicWrite(path.join(DATA, 'store.json'), JSON.stringify(store, null, 2));
}

export async function registerTextbook(sourcePath: string, title?: string) {
  const resolved = path.resolve(sourcePath);
  const bytes = await fs.readFile(resolved);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const store = await readTextbookStore();
  const existing = store.documents.find((document) => document.sha256 === sha256);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loading = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  const pdf = await loading.promise;
  const textSamples = await Promise.all(
    [1, 5, 6, 7]
      .filter((pageNumber) => pageNumber <= pdf.numPages)
      .map(async (pageNumber) => {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        return content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join('')
          .trim().length;
      })
  );
  const scanDetection = {
    sampledPdfPages: [1, 5, 6, 7].filter((pageNumber) => pageNumber <= pdf.numPages),
    textCharacterCounts: textSamples,
    scanned: textSamples.every((length) => length < 40),
  };
  if (existing) {
    existing.scanDetection = scanDetection;
    await writeTextbookStore(store);
    await (pdf as unknown as { destroy(): Promise<void> }).destroy();
    return { document: existing, duplicate: true, scanDetection };
  }
  const documentId = `textbook-${sha256.slice(0, 16)}`;
  const filename = path.basename(resolved);
  const storageKey = `${documentId}/${filename}`;
  await fs.mkdir(path.join(PRIVATE, documentId), { recursive: true });
  await atomicWrite(path.join(PRIVATE, storageKey), bytes);
  const document: TextbookDocumentRecord = {
    id: documentId,
    originalFilename: filename,
    title: title ?? filename.replace(/\.pdf$/i, ''),
    sha256,
    pdfPageCount: pdf.numPages,
    storageKey,
    status: 'REGISTERED',
    importedAt: new Date().toISOString(),
    sourceVersion: sha256,
    processingErrors: [],
    scanDetection,
    anchors: [],
    tocEntries: [],
  };
  store.documents.push(document);
  await writeTextbookStore(store);
  await (pdf as unknown as { destroy(): Promise<void> }).destroy();
  return {
    document,
    duplicate: false,
    scanDetection,
  };
}

export async function addTextbookJob(job: TextbookExtractionJob): Promise<void> {
  const store = await readTextbookStore();
  if (!store.jobs.some((existing) => existing.id === job.id)) store.jobs.push(job);
  await writeTextbookStore(store);
}

export function textbookPrivateFile(storageKey: string): string {
  const safe = path.normalize(storageKey);
  if (safe.startsWith('..') || path.isAbsolute(safe))
    throw new Error('Invalid textbook storage key.');
  return path.join(PRIVATE, safe);
}

export function textbookStoreRoot(): string {
  return ROOT;
}
