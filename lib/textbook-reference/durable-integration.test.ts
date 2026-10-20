/**
 * Write-based integration test against real, isolated infrastructure:
 * a PostgreSQL database named exactly `textbook_reference_test` and a Storage
 * bucket named exactly `textbook-reference-test`. It never touches any other
 * database or bucket. Enable it with:
 *
 *   TEST_DATABASE_URL=postgresql://…/textbook_reference_test
 *   TEST_SUPABASE_URL=…  TEST_SUPABASE_SERVICE_ROLE_KEY=…
 *   TEST_TEXTBOOK_STORAGE_BUCKET=textbook-reference-test
 *   TEST_TEXTBOOK_PDF=/path/to/math_book_3.pdf   (the real scanned pilot book)
 *
 * The vision provider is a counting stand-in so the test is deterministic and
 * free; the real Gemini calls are exercised by the browser pilot.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { vi } from 'vitest';

const session = vi.hoisted(() => ({
  user: null as null | { id: string; email: string | null; emailVerifiedAt: string | null },
}));
vi.mock('@/lib/auth/session', () => ({
  getAuthSession: async () => (session.user ? { user: session.user } : null),
}));

import { closeSql, getSql } from '@/lib/db/postgres';
import { runMigrations } from '@/lib/db/migrations';
import { readKnowledgeTree, writeKnowledgeTree } from '@/lib/knowledge-tree/knowledge-tree-storage';
import { buildLessonDraftPrompt } from '@/lib/knowledge-tree/ai-lesson-draft';
import { requestLessonDraft } from '@/lib/knowledge-tree/ai-lesson-draft-service';
import {
  completeTextbookUpload,
  initTextbookUpload,
  registerLocalTextbook,
  saveTextbookPageSetup,
  requestTocIndex,
} from './document-service';
import { queueTextbookExtraction } from './extraction-service';
import { ensurePrivateBucket } from './object-storage';
import {
  approvedArtifactsForNode,
  claimNextTextbookJob,
  finishTextbookJob,
  getTextbookDocument,
  listTextbookArtifacts,
  reviewTextbookArtifact,
  saveTextbookMapping,
  textbookWorkerStatus,
} from './repository';
import { lessonReferencesForNode } from './reference-service';
import { tusUpload } from './tus-upload';
import type { VisionProvider } from './vision-provider';
import { processNextTextbookJob, type WorkerIdentity } from './worker';

const env = process.env;
const dbName = env.TEST_DATABASE_URL ? new URL(env.TEST_DATABASE_URL).pathname.slice(1) : '';
const READY =
  dbName === 'textbook_reference_test' &&
  Boolean(env.TEST_SUPABASE_URL && env.TEST_SUPABASE_SERVICE_ROLE_KEY && env.TEST_TEXTBOOK_PDF) &&
  env.TEST_TEXTBOOK_STORAGE_BUCKET === 'textbook-reference-test';

const NODE_ID = 'node-s0f2jitge'; // "Tính đơn điệu của hàm số" in the repository seed tree

/** The pilot's observed table of contents (PDF pages 5–7), as the provider would read it. */
const PILOT_TOC = [
  ['Chủ đề 1: Hàm số và các ứng dụng của đạo hàm', 1, 13],
  ['I.I. Tính đơn điệu của hàm số', 2, 13],
  ['A. Lý thuyết', 3, 13],
  ['B. Bài tập trong các đề thi thử của các trường', 3, 14],
  ['Dạng 1: Bài toán không chứa tham số', 4, 14],
  ['Bài tập rèn luyện kỹ năng', 5, 19],
  ['Dạng 2: Bài toán chứa tham số', 4, 21],
  ['Bài tập rèn luyện kỹ năng', 5, 28],
  ['Hướng dẫn giải chi tiết', 3, 29],
  ['I.II. Cực trị của hàm số và giá trị lớn nhất, giá trị nhỏ nhất của hàm số', 2, 34],
  ['Chủ đề 2: Hàm số lũy thừa, hàm số mũ – hàm số logarit', 1, 137],
] as const;

const calls = { toc: 0, extract: 0 };
/** The printed page the stand-in provider cites, matching the batch being extracted. */
let citedPage = 13;
const provider: VisionProvider = async ({ prompt, images }) => {
  if (prompt.includes('trang mục lục')) {
    calls.toc += 1;
    return {
      text: JSON.stringify({
        entries: PILOT_TOC.map(([heading, level, printedPage]) => ({
          heading,
          level,
          printedPage,
        })),
      }),
    };
  }
  calls.extract += 1;
  expect(images.length).toBeGreaterThan(0);
  return {
    text: JSON.stringify({
      items: [
        {
          kind: 'THEORY',
          title: 'Điều kiện đủ để hàm số đơn điệu',
          content:
            "Nếu $f'(x) \\ge 0$ với mọi $x \\in I$ và $f'(x) = 0$ chỉ tại hữu hạn điểm thì $f$ đồng biến trên $I$.",
          mathematicalNotation: ["f'(x) \\ge 0"],
          printedPages: [citedPage],
          verificationNotes: ['Integration fixture.'],
        },
        {
          kind: 'EXERCISE',
          title: 'Câu 3',
          content: 'Câu 3: Hỏi hàm số y = x^3 + 3x^2 - 4 nghịch biến trên khoảng nào?',
          mathematicalNotation: [],
          printedPages: [citedPage],
          verificationNotes: [],
        },
      ],
    }),
    usage: { input: 10, output: 10 },
  };
};

const workerA: WorkerIdentity = {
  id: 'it-worker-a',
  hostname: 'test',
  startedAt: new Date().toISOString(),
};
const workerB: WorkerIdentity = {
  id: 'it-worker-b',
  hostname: 'test',
  startedAt: new Date().toISOString(),
};

/** A small valid PDF padded past two 6 MB chunks, so resuming can be exercised. */
function paddedPdf(seed: string, bytes = 13 * 1024 * 1024) {
  const padding = `% ${seed}\n`.padEnd(bytes, ' ');
  const stream = `${padding}\nBT /F1 12 Tf 20 100 Td (${seed}) Tj ET`;
  return Buffer.from(
    `%PDF-1.4\n1 0 obj <</Type/Catalog/Pages 2 0 R>> endobj\n2 0 obj <</Type/Pages/Kids[3 0 R]/Count 1>> endobj\n` +
      `3 0 obj <</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R>> endobj\n` +
      `4 0 obj <</Length ${stream.length}>> stream\n${stream}\nendstream endobj\ntrailer <</Root 1 0 R>>\n%%EOF\n`
  );
}

describe.skipIf(!READY)(
  'durable textbook workflow on isolated PostgreSQL + private Storage',
  () => {
    let documentId = '';
    let treeBefore = '';

    beforeAll(async () => {
      Object.assign(process.env, {
        DATABASE_URL: env.TEST_DATABASE_URL,
        SUPABASE_URL: env.TEST_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: env.TEST_SUPABASE_SERVICE_ROLE_KEY,
        TEXTBOOK_STORAGE_BUCKET: env.TEST_TEXTBOOK_STORAGE_BUCKET,
        KNOWLEDGE_AI_PROVIDER: 'mock',
        ADMIN_EMAILS: 'admin@test.local',
      });
      const admin = postgres(env.TEST_DATABASE_URL!, { max: 1, onnotice: () => {} });
      try {
        await runMigrations(admin);
        // A clean slate inside the dedicated test database only.
        await admin`truncate tutai.textbook_documents, tutai.textbook_uploads, tutai.textbook_workers cascade`;
      } finally {
        await admin.end();
      }
      await ensurePrivateBucket(50 * 1024 * 1024);
      const seed = JSON.parse(await readFile('data/knowledge-tree/tree.json', 'utf8'));
      await writeKnowledgeTree(seed);
      treeBefore = JSON.stringify(await readKnowledgeTree());
    }, 120_000);

    afterAll(async () => {
      await closeSql();
    });

    it('1–3 registers the real PDF privately and deduplicates it by SHA-256', async () => {
      const bytes = await readFile(env.TEST_TEXTBOOK_PDF!);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const first = await registerLocalTextbook(bytes, 'math_book_3.pdf', 'Công Phá Toán 3');
      documentId = first.document.id;
      expect(first.document).toMatchObject({
        sha256,
        status: 'VERIFYING',
        storageKey: `documents/${sha256}.pdf`,
      });
      const again = await registerLocalTextbook(bytes, 'renamed-copy.pdf');
      expect(again).toMatchObject({ duplicate: true, document: { id: documentId } });
      const init = await initTextbookUpload(
        { sha256, byteSize: bytes.length, filename: 'other-name.pdf' },
        'it-admin'
      );
      expect(init).toMatchObject({ kind: 'duplicate', document: { id: documentId } });

      // Private: no anonymous or public read path exists.
      const base = env.TEST_SUPABASE_URL!.replace(/\/+$/, '');
      const publicRead = await fetch(
        `${base}/storage/v1/object/public/textbook-reference-test/documents/${sha256}.pdf`
      );
      expect(publicRead.ok).toBe(false);
      const anonymous = await fetch(
        `${base}/storage/v1/object/authenticated/textbook-reference-test/documents/${sha256}.pdf`
      );
      expect(anonymous.ok).toBe(false);
      const bucket = await fetch(`${base}/storage/v1/bucket/textbook-reference-test`, {
        headers: {
          apikey: env.TEST_SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${env.TEST_SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }).then((response) => response.json());
      expect(bucket.public).toBe(false);
    });

    it('verifies the stored file in the worker (checksum, page count, scan detection)', async () => {
      const outcome = await processNextTextbookJob(workerA, { provider });
      expect(outcome?.job).toMatchObject({ kind: 'VERIFY', status: 'COMPLETED' });
      const document = await getTextbookDocument(documentId);
      expect(document).toMatchObject({ status: 'REGISTERED', pdfPageCount: 202 });
      expect(document?.scanDetection?.scanned).toBe(true);
    });

    it('4–5 indexes the table of contents and keeps printed-page/PDF-page mappings', async () => {
      await saveTextbookPageSetup(documentId, {
        layout: 'TWO_UP',
        tocPdfPages: [5, 6, 7],
        anchors: [
          { printedPage: 13, pdfPage: 7, position: 'RIGHT', evidence: 'folio 13' },
          { printedPage: 29, pdfPage: 15, position: 'RIGHT', evidence: 'folio 29' },
          { printedPage: 33, pdfPage: 17, position: 'RIGHT', evidence: 'folio 33' },
          { printedPage: 34, pdfPage: 18, position: 'LEFT', evidence: 'folio 34' },
        ],
      });
      await expect(
        saveTextbookPageSetup(documentId, {
          layout: 'TWO_UP',
          tocPdfPages: [5],
          anchors: [
            { printedPage: 13, pdfPage: 7, position: 'RIGHT', evidence: '' },
            { printedPage: 29, pdfPage: 16, position: 'RIGHT', evidence: '' },
          ],
        })
      ).rejects.toThrow(/không khớp/);
      const queued = await requestTocIndex(documentId);
      expect(queued.job.kind).toBe('INDEX_TOC');
      expect((await getTextbookDocument(documentId))?.status).toBe('INDEXING');
      const outcome = await processNextTextbookJob(workerA, { provider });
      expect(outcome?.job.status).toBe('COMPLETED');
      expect(calls.toc).toBe(1);
      const document = (await getTextbookDocument(documentId))!;
      expect(document.status).toBe('INDEXED');
      expect(document.tocEntries).toHaveLength(PILOT_TOC.length);
      const monotonicity = document.tocEntries.find((entry) =>
        entry.originalHeading.startsWith('I.I.')
      )!;
      expect(monotonicity).toMatchObject({ printedStartPage: 13, printedEndPage: 33, level: 2 });
      expect(monotonicity.locations[0]).toMatchObject({
        pdfPage: 7,
        position: 'RIGHT',
        verification: 'VERIFIED',
      });
      expect(
        document.anchors.map((anchor) => [anchor.printedPage, anchor.pdfPage, anchor.position])
      ).toEqual([
        [13, 7, 'RIGHT'],
        [29, 15, 'RIGHT'],
        [33, 17, 'RIGHT'],
        [34, 18, 'LEFT'],
      ]);
    });

    it('6–9 maps to an existing Knowledge Tree node, queues once and extracts in the worker', async () => {
      const document = (await getTextbookDocument(documentId))!;
      const entry = document.tocEntries.find((item) => item.originalHeading.startsWith('I.I.'))!;
      await expect(
        queueTextbookExtraction({
          documentId,
          knowledgeNodeId: NODE_ID,
          entryIds: [entry.id],
          printedPages: [13],
        })
      ).rejects.toThrow(/chưa được liên kết/);
      await saveTextbookMapping({
        id: `map-${documentId}-${entry.id}-${NODE_ID}`,
        documentId,
        entryId: entry.id,
        knowledgeNodeId: NODE_ID,
        confidence: 1,
        status: 'CONFIRMED',
        confirmationRequired: false,
        updatedAt: new Date().toISOString(),
      });
      const request = {
        documentId,
        knowledgeNodeId: NODE_ID,
        entryIds: [entry.id],
        printedPages: [13],
      };
      const first = await queueTextbookExtraction(request);
      const second = await queueTextbookExtraction(request);
      expect(first).toMatchObject({ cacheHit: false, existing: false, job: { status: 'QUEUED' } });
      expect(second).toMatchObject({ existing: true, job: { id: first.job.id } });
      await expect(queueTextbookExtraction({ ...request, printedPages: [35] })).rejects.toThrow(
        /ngoài phạm vi/
      );

      const outcome = await processNextTextbookJob(workerA, { provider });
      expect(outcome?.job).toMatchObject({
        id: first.job.id,
        status: 'COMPLETED',
        providerCalls: 1,
      });
      expect(calls.extract).toBe(1);
      const artifacts = await listTextbookArtifacts({ documentId });
      expect(artifacts).toHaveLength(2);
      expect(artifacts.every((artifact) => artifact.reviewStatus === 'NEEDS_REVIEW')).toBe(true);
      expect(artifacts[0]).toMatchObject({ printedPages: [13], pdfPages: [7] });
    });

    it('10–12 survives a restart and answers a repeat request from the cache', async () => {
      await closeSql(); // drop every pooled connection, as a process restart does
      const document = (await getTextbookDocument(documentId))!;
      const entry = document.tocEntries.find((item) => item.originalHeading.startsWith('I.I.'))!;
      expect(await listTextbookArtifacts({ documentId })).toHaveLength(2);
      const repeat = await queueTextbookExtraction({
        documentId,
        knowledgeNodeId: NODE_ID,
        entryIds: [entry.id],
        printedPages: [13],
      });
      expect(repeat).toMatchObject({
        cacheHit: true,
        job: { status: 'COMPLETED', providerCalls: 0 },
      });
      expect(repeat.artifacts).toHaveLength(2);
      expect(calls.extract).toBe(1);
      expect(await processNextTextbookJob(workerB, { provider })).toBeNull();
    });

    it('13 resumes a job whose worker died mid-run, and the dead worker cannot overwrite it', async () => {
      const document = (await getTextbookDocument(documentId))!;
      const entry = document.tocEntries.find((item) => item.originalHeading.startsWith('I.I.'))!;
      const { job } = await queueTextbookExtraction({
        documentId,
        knowledgeNodeId: NODE_ID,
        entryIds: [entry.id],
        printedPages: [29],
      });
      citedPage = 29;
      const claimed = await claimNextTextbookJob(workerA.id); // worker A "crashes" here
      expect(claimed).toMatchObject({ id: job.id, status: 'RUNNING', attempts: 1 });
      expect(await processNextTextbookJob(workerB, { provider })).toBeNull(); // lease still held
      await getSql()`update tutai.textbook_jobs set lease_until = now() - interval '1 second' where id = ${job.id}`;
      const resumed = await processNextTextbookJob(workerB, { provider });
      expect(resumed?.job).toMatchObject({ id: job.id, status: 'COMPLETED', attempts: 2 });
      expect(
        await finishTextbookJob({ ...claimed!, status: 'FAILED', error: 'late' }, workerA.id)
      ).toBe(false);
      const [row] =
        await getSql()`select status, payload from tutai.textbook_jobs where id = ${job.id}`;
      expect(row.status).toBe('COMPLETED');
      expect((row.payload.history as unknown[]).length).toBe(4); // queued, run 1, run 2, completed
    });

    it('14 rejects unauthenticated and non-admin access to documents and artifacts', async () => {
      const { GET, POST } = await import('@/app/api/admin/textbooks/route');
      const post = (body: unknown) =>
        POST(
          new Request('http://localhost/api/admin/textbooks', {
            method: 'POST',
            body: JSON.stringify(body),
          })
        );
      session.user = null;
      expect(
        (await GET(new Request(`http://localhost/api/admin/textbooks?documentId=${documentId}`)))
          .status
      ).toBe(401);
      session.user = {
        id: 'student-1',
        email: 'student@test.local',
        emailVerifiedAt: new Date().toISOString(),
      };
      expect(
        (await GET(new Request(`http://localhost/api/admin/textbooks?nodeId=${NODE_ID}`))).status
      ).toBe(403);
      const [artifact] = await listTextbookArtifacts({ documentId });
      expect(
        (await post({ action: 'review-artifact', artifactId: artifact.id, decision: 'approve' }))
          .status
      ).toBe(403);
      expect(
        (
          await post({
            action: 'upload-init',
            sha256: 'a'.repeat(64),
            byteSize: 10,
            filename: 'x.pdf',
          })
        ).status
      ).toBe(403);
      expect(
        (await listTextbookArtifacts({ documentId })).every(
          (item) => item.reviewStatus === 'NEEDS_REVIEW'
        )
      ).toBe(true);
      session.user = {
        id: 'admin-1',
        email: 'admin@test.local',
        emailVerifiedAt: new Date().toISOString(),
      };
      const allowed = await GET(
        new Request(`http://localhost/api/admin/textbooks?nodeId=${NODE_ID}`)
      );
      expect(allowed.status).toBe(200);
      expect((await allowed.json()).sections).toHaveLength(1);
    });

    it('15–16 approved artifacts reach lesson drafting; unapproved ones never do', async () => {
      expect(await approvedArtifactsForNode(NODE_ID)).toHaveLength(0);
      const theory = (await listTextbookArtifacts({ documentId })).find(
        (item) => item.kind === 'THEORY'
      )!;
      await reviewTextbookArtifact(theory.id, 'APPROVED', 'admin-1');
      const approved = await approvedArtifactsForNode(NODE_ID);
      expect(approved.map((item) => item.id)).toEqual([theory.id]);
      expect(await approvedArtifactsForNode('another-node')).toHaveLength(0);
      const { references, approvedCount } = await lessonReferencesForNode(NODE_ID);
      expect(approvedCount).toBe(1);
      expect(references[0]).toMatchObject({
        artifactId: theory.id,
        documentTitle: 'Công Phá Toán 3',
        printedPages: [13],
      });

      const draft = await requestLessonDraft(NODE_ID, {}, { ...process.env, NODE_ENV: 'test' });
      expect(draft.context.references).toMatchObject({ approved: 1, used: true });
      expect(draft.context.references.items.map((item) => item.artifactId)).toEqual([theory.id]);
      const without = await requestLessonDraft(
        NODE_ID,
        { useReferences: false },
        { ...process.env, NODE_ENV: 'test' }
      );
      expect(without.context.references.used).toBe(false);
      const prompt = buildLessonDraftPrompt({
        subject: 'Toán',
        grade: '12',
        chapterPath: [],
        title: 'Tính đơn điệu của hàm số',
        description: '',
        references: references.map((reference) => ({
          ...reference,
          source: reference.documentTitle,
        })),
      });
      expect(prompt).toContain('Tư liệu tham khảo giáo viên đã duyệt');
      expect(prompt).toContain("f'(x) \\ge 0");
      expect(prompt).not.toContain('Câu 3: Hỏi hàm số'); // the unapproved exercise is not sent

      // Drafting never wrote the curriculum.
      expect(JSON.stringify(await readKnowledgeTree())).toBe(treeBefore);
    });

    it('uploads a new PDF straight to private Storage with a signed token, resuming after interruption', async () => {
      const bytes = paddedPdf(`resume-${Date.now()}`);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const init = await initTextbookUpload(
        { sha256, byteSize: bytes.length, filename: 'resume.pdf' },
        'it-admin'
      );
      if (init.kind !== 'upload') throw new Error(`expected an upload session, got ${init.kind}`);
      expect(JSON.stringify(init)).not.toContain(env.TEST_SUPABASE_SERVICE_ROLE_KEY!);
      // Interrupt after the first chunk.
      const abort = new AbortController();
      let uploadUrl = '';
      await expect(
        tusUpload(init.tus, new Blob([bytes]), {
          signal: abort.signal,
          onUploadUrl: (url) => (uploadUrl = url),
          onProgress: (done) => done > 0 && abort.abort(),
        })
      ).rejects.toThrow();
      await expect(completeTextbookUpload(init.uploadId)).rejects.toThrow(/chưa tải lên xong/);
      // Retrying resumes the same session and continues from Storage's offset.
      const retry = await initTextbookUpload(
        { sha256, byteSize: bytes.length, filename: 'resume.pdf' },
        'it-admin'
      );
      if (retry.kind !== 'upload') throw new Error('expected the pending session');
      expect(retry.uploadId).toBe(init.uploadId);
      const progress: number[] = [];
      await tusUpload(retry.tus, new Blob([bytes]), {
        resumeUrl: uploadUrl,
        onProgress: (done) => progress.push(done),
      });
      expect(progress[0]).toBeGreaterThan(0);
      const { document } = await completeTextbookUpload(init.uploadId);
      expect(document).toMatchObject({ sha256, status: 'VERIFYING' });
      const verified = await processNextTextbookJob(workerA, { provider });
      expect(verified?.job).toMatchObject({ kind: 'VERIFY', status: 'COMPLETED' });
      expect(await getTextbookDocument(document.id)).toMatchObject({
        status: 'REGISTERED',
        pdfPageCount: 1,
      });
    }, 120_000);

    it('reports worker liveness from heartbeats only', async () => {
      const status = await textbookWorkerStatus();
      expect(status.online).toBe(true); // the test workers just reported in
      await getSql()`update tutai.textbook_workers set last_seen_at = now() - interval '10 minutes'`;
      expect((await textbookWorkerStatus()).online).toBe(false);
    });
  }
);
