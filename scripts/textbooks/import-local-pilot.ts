// Copies the pre-database pilot (tmp/textbook-reference) into the configured
// durable backend without another Gemini call: the source PDF goes to private
// Storage, then its observed anchors, table of contents, mapping, extraction
// history and artifacts (with their review states) are inserted.
//   pnpm textbooks:import-local-pilot -- <source.pdf> [--node <knowledge-node-id>]
// --node maps the pilot's section to a different existing Knowledge Tree node
// (the pilot used the local seed tree's id).
import { loadEnvFile } from 'node:process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { closeSql } from '@/lib/db/postgres';
import { readKnowledgeTree } from '@/lib/knowledge-tree/knowledge-tree-storage';
import { registerLocalTextbook } from '@/lib/textbook-reference/document-service';
import {
  assertTextbookBackend,
  insertTextbookArtifacts,
  listTextbookJobs,
  readLocalTextbookPilot,
  recordFinishedTextbookJob,
  replaceTextbookAnchors,
  replaceTextbookToc,
  saveTextbookMapping,
  updateTextbookDocument,
} from '@/lib/textbook-reference/repository';
import type { TextbookExtractionJob } from '@/lib/textbook-reference/types';

async function main() {
  try {
    loadEnvFile('.env.local');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  assertTextbookBackend();
  const sourcePath = process.argv[2];
  if (!sourcePath)
    throw new Error('Usage: pnpm textbooks:import-local-pilot -- <source-pdf> [--node <id>]');
  const nodeFlag = process.argv.indexOf('--node');
  const nodeOverride = nodeFlag > 0 ? process.argv[nodeFlag + 1] : undefined;

  const bytes = await readFile(sourcePath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const local = await readLocalTextbookPilot();
  const source = local.documents.find((document) => document.sha256 === sha256);
  if (!source) throw new Error('The selected PDF does not match a document in the local pilot index.');

  const { document, duplicate } = await registerLocalTextbook(bytes, path.basename(sourcePath), source.title);
  if (duplicate && document.tocEntries.length)
    throw new Error(`Already imported as ${document.id}; nothing changed.`);

  const tree = await readKnowledgeTree();
  const mappings = local.mappings.filter((mapping) => mapping.documentId === source.id);
  const nodeFor = (id: string) => nodeOverride ?? id;
  for (const mapping of mappings)
    if (!tree.nodes.some((node) => node.id === nodeFor(mapping.knowledgeNodeId)))
      throw new Error(`Knowledge Tree node ${nodeFor(mapping.knowledgeNodeId)} does not exist here; pass --node.`);

  await replaceTextbookAnchors(document.id, source.anchors);
  await updateTextbookDocument(document.id, { pageLayout: 'TWO_UP', tocPdfPages: [5, 6, 7] });
  await replaceTextbookToc(document.id, source.tocEntries, source.tocIndexCompleteness ?? 'PARTIAL');
  // The import does not skip verification: the book stays VERIFYING until the worker checks it.
  const pendingVerify = (await listTextbookJobs({ documentId: document.id })).some(
    (job) => job.kind === 'VERIFY' && job.status !== 'COMPLETED'
  );
  if (pendingVerify) await updateTextbookDocument(document.id, { status: 'VERIFYING' });

  for (const mapping of mappings) {
    const knowledgeNodeId = nodeFor(mapping.knowledgeNodeId);
    await saveTextbookMapping({
      ...mapping,
      id: `map-${document.id}-${mapping.entryId}-${knowledgeNodeId}`,
      documentId: document.id,
      knowledgeNodeId,
      status: mapping.status === 'CONFIRMED' ? 'CONFIRMED' : 'REJECTED',
    });
  }
  const artifacts = local.artifacts
    .filter((artifact) => artifact.documentId === source.id)
    .map((artifact) => ({ ...artifact, documentId: document.id }));
  await insertTextbookArtifacts(artifacts);
  // Import keeps each artifact's review decision as recorded in the pilot.
  const { getSql } = await import('@/lib/db/postgres');
  for (const artifact of artifacts)
    await getSql()`update tutai.textbook_artifacts set review_status = ${artifact.reviewStatus} where id = ${artifact.id}`;
  const jobs = local.jobs.filter((job) => job.documentId === source.id);
  for (const job of jobs) {
    const status = (job.status as string) === 'PARTIAL' ? 'FAILED' : job.status;
    await recordFinishedTextbookJob({
      ...job,
      kind: 'EXTRACT',
      documentId: document.id,
      knowledgeNodeId: nodeFor(job.knowledgeNodeId),
      status: status === 'QUEUED' || status === 'RUNNING' ? 'CANCELLED' : status,
      error: job.error ?? (status === 'FAILED' ? 'Recorded in the local pilot.' : undefined),
    } as TextbookExtractionJob);
  }
  console.log(
    JSON.stringify({
      documentId: document.id,
      sha256,
      anchors: source.anchors.length,
      tocEntries: source.tocEntries.length,
      mappings: mappings.length,
      artifacts: artifacts.length,
      jobs: jobs.length,
      verification: pendingVerify ? 'queued for the worker' : 'already verified',
    })
  );
  await closeSql();
}

void main().catch(async (error) => {
  console.error((error as Error).message);
  await closeSql().catch(() => {});
  process.exit(1);
});
