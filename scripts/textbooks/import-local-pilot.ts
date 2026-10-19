import { loadEnvFile } from 'node:process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  durableTextbookBackendConfigured,
  readLocalTextbookStore,
  readTextbookStore,
  registerTextbook,
  writeTextbookStore,
} from '@/lib/textbook-reference/repository';

async function main() {
  try {
    loadEnvFile('.env.local');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (!durableTextbookBackendConfigured()) {
    throw new Error(
      'Set DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and TEXTBOOK_STORAGE_BUCKET before importing the pilot.'
    );
  }
  const sourcePath = process.argv[2];
  if (!sourcePath) throw new Error('Usage: pnpm textbooks:import-local-pilot -- <source-pdf-path>');
  const bytes = await readFile(sourcePath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const local = await readLocalTextbookStore();
  const source = local.documents.find((document) => document.sha256 === sha256);
  if (!source) throw new Error('The selected PDF does not match a document in the local QA index.');

  const registered = await registerTextbook(sourcePath, source.title);
  if (registered.document.sha256 !== source.sha256)
    throw new Error('Source SHA-256 changed during import.');
  const durable = await readTextbookStore();
  const document = {
    ...source,
    id: registered.document.id,
    storageKey: registered.document.storageKey,
    tocIndexCompleteness: source.tocIndexCompleteness ?? 'PARTIAL',
  };
  const importedIds = new Set([document.id]);
  const mergeById = <T extends { id: string }>(current: T[], incoming: T[]) => {
    const map = new Map(current.map((item) => [item.id, item]));
    for (const item of incoming) if (!map.has(item.id)) map.set(item.id, item);
    return [...map.values()];
  };
  await writeTextbookStore({
    schemaVersion: 1,
    documents: mergeById(durable.documents, [document]),
    mappings: mergeById(
      durable.mappings,
      local.mappings.filter((item) => importedIds.has(item.documentId))
    ),
    jobs: mergeById(
      durable.jobs,
      local.jobs.filter((item) => importedIds.has(item.documentId))
    ),
    artifacts: mergeById(
      durable.artifacts,
      local.artifacts.filter((item) => importedIds.has(item.documentId))
    ),
  });
  console.log(
    JSON.stringify({
      imported: true,
      duplicateSource: registered.duplicate,
      documentId: document.id,
      sha256,
      tocEntries: document.tocEntries.length,
      tocIndexCompleteness: document.tocIndexCompleteness,
      artifacts: local.artifacts.filter((item) => item.documentId === document.id).length,
      jobs: local.jobs.filter((item) => item.documentId === document.id).length,
    })
  );
}

void main();
