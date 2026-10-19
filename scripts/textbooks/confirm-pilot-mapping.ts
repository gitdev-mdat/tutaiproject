import { readFile } from 'node:fs/promises';
import { readTextbookStore, writeTextbookStore } from '@/lib/textbook-reference/repository';
import { normalizedHeading } from '@/lib/textbook-reference/page-mapping';

async function main() {
  const documentId = process.argv[2];
  const nodeId = process.argv[3];
  const entryId = process.argv[4];
  if (!documentId || !nodeId || !entryId)
    throw new Error(
      'Usage: pnpm exec tsx --conditions=react-server scripts/textbooks/confirm-pilot-mapping.ts <document-id> <knowledge-node-id> <toc-entry-id>'
    );
  const store = await readTextbookStore();
  const document = store.documents.find((item) => item.id === documentId);
  const entry = document?.tocEntries.find((item) => item.id === entryId);
  if (!document || !entry) throw new Error('Document or TOC entry not found.');
  const tree = JSON.parse(await readFile('data/knowledge-tree/tree.json', 'utf8')) as {
    nodes: Array<{ id: string; title: string }>;
  };
  const node = tree.nodes.find((item) => item.id === nodeId);
  if (
    !node ||
    normalizedHeading(node.title) !== normalizedHeading('Tính đơn điệu của hàm số') ||
    !normalizedHeading(entry.originalHeading).includes('tính đơn điệu của hàm số')
  ) {
    throw new Error(
      'Pilot mapping requires the exact existing monotonicity node and matching section.'
    );
  }
  const now = new Date().toISOString();
  const mapping = {
    id: `map-${documentId}-${entryId}-${nodeId}`,
    documentId,
    entryId,
    knowledgeNodeId: nodeId,
    confidence: 1,
    status: 'CONFIRMED' as const,
    confirmationRequired: false,
    updatedAt: now,
  };
  store.mappings = store.mappings.filter((item) => item.id !== mapping.id).concat(mapping);
  await writeTextbookStore(store);
  console.log(
    JSON.stringify(
      { mapping, knowledgeNodeTitle: node.title, entryHeading: entry.originalHeading },
      null,
      2
    )
  );
}

void main();
