import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getSql } from '@/lib/db/postgres';
import type {
  TextbookArtifact,
  TextbookDocumentRecord,
  TextbookExtractionJob,
  TextbookKnowledgeMapping,
} from './types';

const ROOT = path.join(process.cwd(), 'tmp', 'textbook-reference');
const PRIVATE = path.join(ROOT, 'private');
const DATA = path.join(ROOT, 'index');

export function usesDatabaseTextbookStore(env = process.env): boolean {
  return Boolean(env.DATABASE_URL);
}

export function durableTextbookBackendConfigured(env = process.env): boolean {
  return Boolean(
    env.DATABASE_URL &&
    env.SUPABASE_URL &&
    env.SUPABASE_SERVICE_ROLE_KEY &&
    env.TEXTBOOK_STORAGE_BUCKET
  );
}

export function assertTextbookPersistenceAvailable(): void {
  const production =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    process.env.VERCEL_ENV === 'production';
  if (production && !usesDatabaseTextbookStore()) {
    throw new Error(
      'Textbook processing is disabled: DATABASE_URL is required for durable storage.'
    );
  }
  if (production && !durableTextbookBackendConfigured()) {
    throw new Error(
      'Textbook processing is disabled: PostgreSQL and private Supabase Storage are required.'
    );
  }
}

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
  assertTextbookPersistenceAvailable();
  if (usesDatabaseTextbookStore()) return readDatabaseTextbookStore();
  return readLocalTextbookStore();
}

export async function readLocalTextbookStore(): Promise<TextbookIndexStore> {
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
  assertTextbookPersistenceAvailable();
  if (usesDatabaseTextbookStore()) return writeDatabaseTextbookStore(store);
  await atomicWrite(path.join(DATA, 'store.json'), JSON.stringify(store, null, 2));
}

/** Atomically leases a durable job so independent worker processes cannot run it twice. */
export async function claimNextTextbookJob(): Promise<TextbookExtractionJob | null> {
  if (!usesDatabaseTextbookStore()) return null;
  assertTextbookPersistenceAvailable();
  const sql = getSql();
  return sql.begin(async (tx) => {
    const [row] = await tx`
      select id, payload from tutai.textbook_extraction_jobs
      where status = 'QUEUED'
         or (status in ('RUNNING', 'PARTIAL') and
             (worker_lease_until is null or worker_lease_until < now()))
      order by created_at
      limit 1
      for update skip locked`;
    if (!row) return null;
    const job = row.payload as TextbookExtractionJob;
    job.status = 'RUNNING';
    job.attempts += 1;
    job.updatedAt = new Date().toISOString();
    job.history = [
      ...(job.history ?? []),
      { status: 'RUNNING', attempts: job.attempts, at: job.updatedAt },
    ];
    await tx`
      update tutai.textbook_extraction_jobs
      set status = 'RUNNING', payload = ${tx.json(job as never)},
          updated_at = ${job.updatedAt}, worker_lease_until = now() + interval '10 minutes'
      where id = ${job.id}`;
    return job;
  }) as Promise<TextbookExtractionJob | null>;
}

async function readDatabaseTextbookStore(): Promise<TextbookIndexStore> {
  const sql = getSql();
  const snapshot = await sql.begin(async (tx) => {
    await tx`set transaction isolation level repeatable read read only`;
    const [documents, anchors, entries, mappings, jobs, artifacts] = await Promise.all([
      tx`select id, metadata from tutai.textbook_documents order by created_at`,
      tx`select document_id, payload from tutai.textbook_page_anchors order by printed_page`,
      tx`select document_id, payload from tutai.textbook_toc_entries order by document_id, id`,
      tx`select payload from tutai.textbook_knowledge_mappings order by updated_at`,
      tx`select payload from tutai.textbook_extraction_jobs order by created_at`,
      tx`select payload from tutai.textbook_artifacts order by created_at`,
    ]);
    return { documents, anchors, entries, mappings, jobs, artifacts };
  });
  const { documents, anchors, entries, mappings, jobs, artifacts } = snapshot;
  const grouped = <T extends { document_id: string; payload: unknown }>(rows: T[]) => {
    const result = new Map<string, unknown[]>();
    for (const row of rows)
      result.set(row.document_id, [...(result.get(row.document_id) ?? []), row.payload]);
    return result;
  };
  const anchorsByDocument = grouped(
    anchors as unknown as Array<{ document_id: string; payload: unknown }>
  );
  const entriesByDocument = grouped(
    entries as unknown as Array<{ document_id: string; payload: unknown }>
  );
  return {
    schemaVersion: 1,
    documents: documents.map((row) => ({
      ...(row.metadata as Omit<TextbookDocumentRecord, 'anchors' | 'tocEntries'>),
      anchors: (anchorsByDocument.get(row.id as string) ?? []) as TextbookDocumentRecord['anchors'],
      tocEntries: (entriesByDocument.get(row.id as string) ??
        []) as TextbookDocumentRecord['tocEntries'],
    })),
    mappings: mappings.map((row) => row.payload as TextbookKnowledgeMapping),
    jobs: jobs.map((row) => row.payload as TextbookExtractionJob),
    artifacts: artifacts.map((row) => row.payload as TextbookArtifact),
  };
}

async function writeDatabaseTextbookStore(store: TextbookIndexStore): Promise<void> {
  const sql = getSql();
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('tutai.textbook_reference.write'))`;
    for (const document of store.documents) {
      const { anchors, tocEntries, ...metadata } = document;
      await tx`
        insert into tutai.textbook_documents (id, sha256, metadata, updated_at)
        values (${document.id}, ${document.sha256}, ${tx.json(metadata as never)}, now())
        on conflict (id) do update set
          metadata = excluded.metadata, updated_at = excluded.updated_at`;
      for (const anchor of anchors) {
        await tx`
          insert into tutai.textbook_page_anchors (document_id, printed_page, pdf_page, payload)
          values (${document.id}, ${anchor.printedPage}, ${anchor.pdfPage}, ${tx.json(anchor as never)})
          on conflict (document_id, printed_page) do update set
            pdf_page = excluded.pdf_page, payload = excluded.payload`;
      }
      for (const entry of tocEntries) {
        await tx`
          insert into tutai.textbook_toc_entries (document_id, id, parent_id, payload)
          values (${document.id}, ${entry.id}, ${entry.parentId}, ${tx.json(entry as never)})
          on conflict (document_id, id) do update set
            parent_id = excluded.parent_id, payload = excluded.payload`;
      }
    }
    for (const mapping of store.mappings) {
      await tx`
        insert into tutai.textbook_knowledge_mappings (id, document_id, entry_id, knowledge_node_id, status, payload, updated_at)
        values (${mapping.id}, ${mapping.documentId}, ${mapping.entryId}, ${mapping.knowledgeNodeId}, ${mapping.status}, ${tx.json(mapping as never)}, ${mapping.updatedAt})
        on conflict (document_id, entry_id, knowledge_node_id) do update set
          id = excluded.id, status = excluded.status, payload = excluded.payload, updated_at = excluded.updated_at
        where tutai.textbook_knowledge_mappings.updated_at < excluded.updated_at`;
    }
    for (const job of store.jobs) {
      await tx`
        insert into tutai.textbook_extraction_jobs (id, document_id, extraction_key, status, payload, created_at, updated_at)
        values (${job.id}, ${job.documentId}, ${job.extractionKey}, ${job.status},
          jsonb_set(${tx.json(job as never)}, '{history}',
            jsonb_build_array(jsonb_build_object(
              'status', ${job.status}, 'attempts', ${job.attempts},
              'error', ${job.error ?? null}, 'at', ${job.updatedAt}
            )), true), ${job.createdAt}, ${job.updatedAt})
        on conflict (id) do update set
          status = excluded.status,
          payload = jsonb_set(
            excluded.payload, '{history}',
            coalesce(tutai.textbook_extraction_jobs.payload->'history', '[]'::jsonb) ||
            case when tutai.textbook_extraction_jobs.status is distinct from excluded.status
                       or tutai.textbook_extraction_jobs.payload->>'attempts' is distinct from excluded.payload->>'attempts'
              then jsonb_build_array(jsonb_build_object(
                'status', excluded.payload->>'status',
                'attempts', (excluded.payload->>'attempts')::int,
                'error', excluded.payload->'error',
                'at', excluded.payload->>'updatedAt'
              ))
              else '[]'::jsonb
            end, true),
          updated_at = excluded.updated_at
        where tutai.textbook_extraction_jobs.updated_at < excluded.updated_at`;
    }
    const artifactGroups = new Map<string, TextbookArtifact[]>();
    for (const artifact of store.artifacts) {
      const key = `${artifact.documentId}\0${artifact.extractionKey}`;
      artifactGroups.set(key, [...(artifactGroups.get(key) ?? []), artifact]);
    }
    for (const group of artifactGroups.values()) {
      const first = group[0];
      const ids = group.map((artifact) => artifact.id);
      await tx`
        delete from tutai.textbook_artifacts
        where document_id = ${first.documentId} and extraction_key = ${first.extractionKey}
          and review_status = 'NEEDS_REVIEW' and not (id = any(${ids}))`;
    }
    for (const artifact of store.artifacts) {
      await tx`
        insert into tutai.textbook_artifacts (id, document_id, entry_id, extraction_key, review_status, payload, created_at)
        values (${artifact.id}, ${artifact.documentId}, ${artifact.entryId}, ${artifact.extractionKey}, ${artifact.reviewStatus}, ${tx.json(artifact as never)}, ${artifact.createdAt})
        on conflict (id) do update set
          payload = case when tutai.textbook_artifacts.review_status = 'NEEDS_REVIEW' then excluded.payload else tutai.textbook_artifacts.payload end,
          review_status = case when tutai.textbook_artifacts.review_status = 'NEEDS_REVIEW' then excluded.review_status else tutai.textbook_artifacts.review_status end
        where tutai.textbook_artifacts.review_status = 'NEEDS_REVIEW'`;
    }
  });
}

export async function registerTextbook(sourcePath: string, title?: string) {
  assertTextbookPersistenceAvailable();
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
  const durable = usesDatabaseTextbookStore();
  const storageKey = durable ? `documents/${sha256}.pdf` : `${documentId}/${filename}`;
  if (durable) {
    const { uploadPrivateTextbook } = await import('./object-storage');
    await uploadPrivateTextbook(storageKey, bytes);
  } else {
    await fs.mkdir(path.join(PRIVATE, documentId), { recursive: true });
    await atomicWrite(path.join(PRIVATE, storageKey), bytes);
  }
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
    tocIndexCompleteness: 'PARTIAL',
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
  const normalized = storageKey.replaceAll('\\', '/');
  const parts = normalized.split('/');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    /^[a-zA-Z]:\//.test(normalized) ||
    parts.some((part) => !part || part === '.' || part === '..')
  )
    throw new Error('Invalid textbook storage key.');
  const resolved = path.resolve(PRIVATE, ...parts);
  if (!resolved.startsWith(`${path.resolve(PRIVATE)}${path.sep}`))
    throw new Error('Invalid textbook storage key.');
  return resolved;
}

export async function withTextbookPdf<T>(
  storageKey: string,
  operation: (filePath: string) => Promise<T>
): Promise<T> {
  if (usesDatabaseTextbookStore()) {
    const { withPrivateTextbookFile } = await import('./object-storage');
    return withPrivateTextbookFile(storageKey, operation);
  }
  return operation(textbookPrivateFile(storageKey));
}

export function textbookStoreRoot(): string {
  return ROOT;
}
