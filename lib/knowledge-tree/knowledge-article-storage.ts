import 'server-only';

import fs from 'fs/promises';
import path from 'path';
import {
  readContentDocument,
  writeContentDocument,
  type ContentDocumentSource,
} from '@/lib/content/document-store';
import type { KnowledgeArticle } from './knowledge-tree-types';

const ARTICLE_DIR = path.join(process.cwd(), 'data', 'knowledge-tree');
const ARTICLE_FILE = path.join(ARTICLE_DIR, 'articles.json');

export interface KnowledgeArticleDocument {
  schemaVersion: 1;
  updatedAt: string;
  /** Keyed by knowledge node id: one canonical article per knowledge node. */
  articles: Record<string, KnowledgeArticle>;
}

function emptyDocument(): KnowledgeArticleDocument {
  return { schemaVersion: 1, updatedAt: new Date(0).toISOString(), articles: {} };
}

/** Always reads from the store: the document is small and both admin APIs and student pages must agree. */
export async function readKnowledgeArticles(): Promise<KnowledgeArticleDocument> {
  const document = await readContentDocument(articleSource);
  if (document.schemaVersion !== 1 || !document.articles || typeof document.articles !== 'object') {
    throw new Error('Knowledge article schema không hợp lệ.');
  }
  return document;
}

export async function writeKnowledgeArticles(document: KnowledgeArticleDocument): Promise<void> {
  await writeContentDocument(articleSource, document);
}

const articleSource: ContentDocumentSource<KnowledgeArticleDocument> = {
  key: 'knowledge-tree/articles',
  readFile: readArticleFile,
  writeFile: writeArticleFile,
};

async function readArticleFile(): Promise<KnowledgeArticleDocument> {
  try {
    return JSON.parse(await fs.readFile(ARTICLE_FILE, 'utf8')) as KnowledgeArticleDocument;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyDocument();
    throw error;
  }
}

async function writeArticleFile(document: KnowledgeArticleDocument): Promise<void> {
  await fs.mkdir(ARTICLE_DIR, { recursive: true });
  const temporaryFile = `${ARTICLE_FILE}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(document, null, 2), 'utf8');
  await fs.rename(temporaryFile, ARTICLE_FILE);
}
