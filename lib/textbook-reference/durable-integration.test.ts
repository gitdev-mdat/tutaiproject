import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { closeSql, getSql } from '@/lib/db/postgres';
import { runMigrations } from '@/lib/db/migrations';
import { readTextbookStore, writeTextbookStore, type TextbookIndexStore } from './repository';
import {
  deletePrivateTextbook,
  uploadPrivateTextbook,
  withPrivateTextbookFile,
} from './object-storage';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const dbName = TEST_DATABASE_URL ? new URL(TEST_DATABASE_URL).pathname.replace(/^\/+/, '') : '';
const dedicatedDb = dbName === 'textbook_reference_test';
const TEST_STORAGE_READY =
  Boolean(process.env.TEST_SUPABASE_URL) &&
  Boolean(process.env.TEST_SUPABASE_SERVICE_ROLE_KEY) &&
  process.env.TEST_TEXTBOOK_STORAGE_BUCKET === 'textbook-reference-test';

describe.skipIf(!TEST_DATABASE_URL || !dedicatedDb)(
  'durable textbook PostgreSQL integration',
  () => {
    const savedDatabaseUrl = process.env.DATABASE_URL;
    const documentId = `textbook-test-${randomUUID()}`;
    const entryId = 'toc-test-1';
    const store: TextbookIndexStore = {
      schemaVersion: 1,
      documents: [
        {
          id: documentId,
          originalFilename: 'isolated-test.pdf',
          title: 'Isolated integration test',
          sha256: randomUUID().replaceAll('-', '').padEnd(64, '0').slice(0, 64),
          pdfPageCount: 1,
          storageKey: `integration-tests/${documentId}.pdf`,
          status: 'INDEXED',
          importedAt: new Date().toISOString(),
          sourceVersion: 'integration-test',
          tocIndexCompleteness: 'PARTIAL',
          processingErrors: [],
          anchors: [
            {
              printedPage: 1,
              pdfPage: 1,
              position: 'FULL',
              evidence: 'Integration fixture.',
            },
          ],
          tocEntries: [
            {
              id: entryId,
              parentId: null,
              originalHeading: 'Isolated test heading',
              normalizedHeading: 'isolated test heading',
              level: 1,
              printedStartPage: 1,
              printedEndPage: 1,
              locations: [],
              status: 'OBSERVED',
            },
          ],
        },
      ],
      mappings: [
        {
          id: `${documentId}-mapping`,
          documentId,
          knowledgeNodeId: 'isolated-existing-node-id',
          entryId,
          confidence: 1,
          status: 'CONFIRMED',
          confirmationRequired: false,
          updatedAt: new Date().toISOString(),
        },
      ],
      jobs: [
        {
          id: `${documentId}-job`,
          documentId,
          knowledgeNodeId: 'isolated-existing-node-id',
          entryIds: [entryId],
          printedPages: [1],
          extractionKey: randomUUID().replaceAll('-', '').padEnd(64, '0').slice(0, 64),
          status: 'QUEUED',
          attempts: 0,
          provider: 'manual',
          pagesProcessed: [],
          cacheHit: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      artifacts: [
        {
          id: `${documentId}-artifact`,
          documentId,
          entryId,
          kind: 'THEORY',
          title: 'Before review',
          content: 'Unpublished test reference.',
          mathematicalNotation: [],
          printedPages: [1],
          pdfPages: [1],
          reviewStatus: 'NEEDS_REVIEW',
          verificationNotes: ['Test fixture.'],
          extractionKey: randomUUID().replaceAll('-', '').padEnd(64, '0').slice(0, 64),
          createdAt: new Date().toISOString(),
        },
      ],
    };

    beforeAll(async () => {
      process.env.DATABASE_URL = TEST_DATABASE_URL;
      const admin = postgres(TEST_DATABASE_URL!, { max: 1, onnotice: () => {} });
      try {
        await runMigrations(admin);
      } finally {
        await admin.end();
      }
    });

    afterAll(async () => {
      try {
        const sql = getSql();
        await sql`delete from tutai.textbook_documents where id = ${documentId}`;
      } finally {
        await closeSql();
        if (savedDatabaseUrl) process.env.DATABASE_URL = savedDatabaseUrl;
        else delete process.env.DATABASE_URL;
      }
    });

    it('persists indexing, jobs, mappings and review decisions; claims a job once', async () => {
      await writeTextbookStore(store);
      let loaded = await readTextbookStore();
      expect(loaded.documents.find((item) => item.id === documentId)?.tocEntries).toHaveLength(1);
      expect(loaded.documents.find((item) => item.id === documentId)?.anchors).toHaveLength(1);
      expect(loaded.mappings.find((item) => item.documentId === documentId)?.status).toBe(
        'CONFIRMED'
      );
      expect(loaded.jobs.find((item) => item.documentId === documentId)?.status).toBe('QUEUED');

      const artifact = loaded.artifacts.find((item) => item.documentId === documentId)!;
      artifact.reviewStatus = 'APPROVED';
      await writeTextbookStore(loaded);
      loaded.artifacts.find((item) => item.documentId === documentId)!.title =
        'Changed after approval';
      loaded.artifacts.find((item) => item.documentId === documentId)!.reviewStatus =
        'NEEDS_REVIEW';
      await writeTextbookStore(loaded);
      loaded = await readTextbookStore();
      expect(loaded.artifacts.find((item) => item.documentId === documentId)).toMatchObject({
        reviewStatus: 'APPROVED',
        title: 'Before review',
      });

      const claims = await Promise.all([claimJob(), claimJob()]);
      expect(claims.filter(Boolean)).toHaveLength(1);
      const sql = getSql();
      const jobId = `${documentId}-job`;
      await sql`
        update tutai.textbook_extraction_jobs
        set worker_lease_until = now() - interval '1 second'
        where id = ${jobId}
      `;
      expect((await claimJob())?.attempts).toBe(2);
      loaded = await readTextbookStore();
      expect(loaded.jobs.find((item) => item.documentId === documentId)?.history).toHaveLength(3);
    });
  }
);

async function claimJob() {
  const { claimNextTextbookJob } = await import('./repository');
  return claimNextTextbookJob();
}

describe.skipIf(!TEST_STORAGE_READY)('private textbook Storage integration', () => {
  const old = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: process.env.TEXTBOOK_STORAGE_BUCKET,
    databaseUrl: process.env.DATABASE_URL,
  };
  const objectKey = `integration-tests/${randomUUID()}.pdf`;
  const bytes = Buffer.from('%PDF-1.4\nprivate storage integration fixture\n%%EOF\n');

  beforeAll(() => {
    process.env.SUPABASE_URL = process.env.TEST_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
    process.env.TEXTBOOK_STORAGE_BUCKET = process.env.TEST_TEXTBOOK_STORAGE_BUCKET;
    // The object helper selects remote storage whenever a DB URL is set.
    process.env.DATABASE_URL ??= 'postgres://integration-test.invalid/textbook_reference_test';
  });

  afterAll(async () => {
    await deletePrivateTextbook(objectKey).catch(() => {});
    if (old.url) process.env.SUPABASE_URL = old.url;
    else delete process.env.SUPABASE_URL;
    if (old.key) process.env.SUPABASE_SERVICE_ROLE_KEY = old.key;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (old.bucket) process.env.TEXTBOOK_STORAGE_BUCKET = old.bucket;
    else delete process.env.TEXTBOOK_STORAGE_BUCKET;
    if (old.databaseUrl) process.env.DATABASE_URL = old.databaseUrl;
    else delete process.env.DATABASE_URL;
  });

  it('uploads and downloads bytes through an explicitly named private test bucket', async () => {
    await uploadPrivateTextbook(objectKey, bytes);
    await withPrivateTextbookFile(objectKey, async (filePath) => {
      expect(await readFile(filePath)).toEqual(bytes);
    });
  });
});
