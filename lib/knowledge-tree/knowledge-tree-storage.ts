import 'server-only';

import fs from 'fs/promises';
import path from 'path';
import { readKnowledgeGraph } from '@/lib/knowledge-graph/kg-storage';
import { buildKnowledgeTreeFromGraph } from './knowledge-tree';
import type { KnowledgeTreeDocument } from './knowledge-tree-types';

const TREE_DIR = path.join(process.cwd(), 'data', 'knowledge-tree');
const TREE_FILE = path.join(TREE_DIR, 'tree.json');

let cachedTree: KnowledgeTreeDocument | null = null;
// Route handlers and server components can load separate module instances, so the
// cache is keyed by the file's mtime: a write from one instance invalidates the others.
let cachedMtimeMs: number | null = null;

export function clearKnowledgeTreeStorageCache() {
  cachedTree = null;
  cachedMtimeMs = null;
}

async function treeFileMtime(): Promise<number | null> {
  try {
    return (await fs.stat(TREE_FILE)).mtimeMs;
  } catch {
    return null;
  }
}

export async function readKnowledgeTree(): Promise<KnowledgeTreeDocument> {
  const mtimeMs = await treeFileMtime();
  if (cachedTree && mtimeMs === cachedMtimeMs) return structuredClone(cachedTree);
  try {
    const raw = await fs.readFile(TREE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as KnowledgeTreeDocument;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.nodes)) {
      throw new Error('Knowledge Tree schema không hợp lệ.');
    }
    cachedTree = parsed;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    // Compatibility read-model only: preserve every existing graph ID and do not write graph.json.
    cachedTree = buildKnowledgeTreeFromGraph(await readKnowledgeGraph());
  }
  cachedMtimeMs = mtimeMs;
  return structuredClone(cachedTree);
}

export async function writeKnowledgeTree(tree: KnowledgeTreeDocument): Promise<void> {
  const next = structuredClone(tree);
  await fs.mkdir(TREE_DIR, { recursive: true });
  const temporaryFile = `${TREE_FILE}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(next, null, 2), 'utf8');
  await fs.rename(temporaryFile, TREE_FILE);
  cachedTree = next;
  cachedMtimeMs = await treeFileMtime();
}
