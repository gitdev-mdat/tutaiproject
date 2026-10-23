import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminApiGuard, getAdminAccess } from '@/lib/auth/admin';
import { readKnowledgeTree } from '@/lib/knowledge-tree/knowledge-tree-storage';
import {
  cancelTextbookUpload,
  completeTextbookUpload,
  initTextbookUpload,
  correctTextbookToc,
  requestTocIndex,
  saveTextbookPageSetup,
} from '@/lib/textbook-reference/document-service';
import {
  queueTextbookExtraction,
  TextbookRequestError,
} from '@/lib/textbook-reference/extraction-service';
import {
  processTextbookQueueAfterResponse,
  resumeStalledQueue,
} from '@/lib/textbook-reference/inline-runner';
import { normalizedHeading } from '@/lib/textbook-reference/page-mapping';
import {
  approvedArtifactsForNode,
  cancelTextbookJob,
  editTextbookArtifact,
  getTextbookDocument,
  listTextbookArtifacts,
  listTextbookDocuments,
  listTextbookJobs,
  listTextbookMappings,
  missingTextbookSettings,
  reviewTextbookArtifact,
  saveTextbookMapping,
  TextbookBackendUnavailableError,
  textbookWorkerStatus,
} from '@/lib/textbook-reference/repository';
import type { TextbookDocumentRecord, TextbookExtractionJob } from '@/lib/textbook-reference/types';

export const dynamic = 'force-dynamic';
// Queued jobs run in this function after the response (inline-runner.ts).
export const maxDuration = 300;

const anchor = z.object({
  printedPage: z.number().int().positive().max(5000),
  pdfPage: z.number().int().positive().max(5000),
  position: z.enum(['LEFT', 'RIGHT', 'FULL']),
  evidence: z.string().max(300).optional().default(''),
});

const mutation = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('upload-init'),
    sha256: z.string(),
    byteSize: z.number().int(),
    filename: z.string().max(260),
    title: z.string().max(200).optional(),
  }),
  z.object({ action: z.literal('upload-complete'), uploadId: z.string().uuid() }),
  z.object({ action: z.literal('upload-cancel'), uploadId: z.string().uuid() }),
  z.object({
    action: z.literal('page-setup'),
    documentId: z.string(),
    layout: z.enum(['SINGLE', 'TWO_UP']),
    anchors: z.array(anchor).min(2).max(20),
    tocPdfPages: z.array(z.number().int().positive()).min(1).max(4),
  }),
  z.object({
    action: z.literal('index-toc'),
    documentId: z.string(),
    replace: z.boolean().optional().default(false),
  }),
  z.object({
    action: z.literal('correct-toc'),
    documentId: z.string(),
    changes: z
      .array(
        z.object({
          entryId: z.string(),
          heading: z.string().max(400),
          printedStartPage: z.number().int().positive().max(5000).nullable(),
        })
      )
      .max(400),
    confirmComplete: z.boolean().default(false),
  }),
  z.object({
    action: z.literal('confirm-mapping'),
    documentId: z.string(),
    entryId: z.string(),
    knowledgeNodeId: z.string(),
  }),
  z.object({
    action: z.literal('remove-mapping'),
    documentId: z.string(),
    entryId: z.string(),
    knowledgeNodeId: z.string(),
  }),
  z.object({
    action: z.literal('extract'),
    documentId: z.string(),
    entryIds: z.array(z.string()).min(1).max(10),
    knowledgeNodeId: z.string(),
    printedPages: z.array(z.number().int().positive()).min(1).max(6),
  }),
  z.object({ action: z.literal('cancel-job'), jobId: z.string() }),
  z.object({
    action: z.literal('review-artifact'),
    artifactId: z.string(),
    decision: z.enum(['approve', 'reject', 'reopen']),
  }),
  z.object({
    action: z.literal('edit-artifact'),
    artifactId: z.string(),
    title: z.string().trim().min(1).max(300),
    content: z.string().trim().min(1).max(8000),
  }),
]);

function unavailable(missing: string[]) {
  return NextResponse.json(
    {
      error: 'Kho sách tham chiếu chưa được cấu hình trên máy chủ.',
      code: 'BACKEND_UNAVAILABLE',
      missing,
    },
    { status: 503 }
  );
}

function failure(error: unknown) {
  if (error instanceof TextbookRequestError)
    return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof TextbookBackendUnavailableError) return unavailable(error.missing);
  console.error('[textbooks] operation failed', (error as Error)?.message);
  return NextResponse.json(
    { error: 'Thao tác chưa thực hiện được. Thử lại sau.' },
    { status: 500 }
  );
}

const summary = ({ tocEntries, ...document }: TextbookDocumentRecord) => ({
  ...document,
  tocEntryCount: tocEntries.length,
});

/** The newest file-check or table-of-contents job of a book, which decides its status line. */
function latestSetupJob(jobs: TextbookExtractionJob[], documentId: string) {
  return jobs.find((job) => job.documentId === documentId && job.kind !== 'EXTRACT') ?? null;
}

/** Section suggestions for a lesson: TOC headings that share words with its title. */
function suggestionsFor(title: string, documents: TextbookDocumentRecord[]) {
  const words = (value: string) =>
    new Set(
      normalizedHeading(value)
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length > 2)
    );
  const wanted = words(title.replace(/\(P\d+\)/i, ''));
  if (!wanted.size) return [];
  return documents
    .flatMap((document) =>
      document.tocEntries.map((entry) => {
        const have = words(entry.originalHeading);
        const overlap = [...wanted].filter((word) => have.has(word)).length;
        return {
          documentId: document.id,
          documentTitle: document.title,
          entry,
          score: overlap / wanted.size,
        };
      })
    )
    .filter((item) => item.score >= 0.75)
    .sort((a, b) => b.score - a.score || a.entry.level - b.entry.level)
    .slice(0, 5);
}

/**
 * GET                    library: documents, worker liveness, backend readiness
 * GET ?documentId=…      one book: table of contents, mappings, jobs, artifacts
 * GET ?nodeId=…          one lesson: linked sections, their artifacts, suggestions
 */
export async function GET(request: Request) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  const missing = missingTextbookSettings();
  if (missing.length) return unavailable(missing);
  try {
    const url = new URL(request.url);
    const documentId = url.searchParams.get('documentId');
    const nodeId = url.searchParams.get('nodeId');
    const worker = await textbookWorkerStatus();
    if (documentId) {
      const document = await getTextbookDocument(documentId);
      if (!document) return NextResponse.json({ error: 'Không tìm thấy sách.' }, { status: 404 });
      const [mappings, jobs, artifacts, tree] = await Promise.all([
        listTextbookMappings({ documentId }),
        listTextbookJobs({ documentId, limit: 20 }),
        listTextbookArtifacts({ documentId }),
        readKnowledgeTree(),
      ]);
      await resumeStalledQueue(jobs);
      const titles = new Map(tree.nodes.map((node) => [node.id, node.title]));
      return NextResponse.json({
        worker,
        document,
        jobs,
        artifacts,
        mappings: mappings.map((mapping) => ({
          ...mapping,
          knowledgeNodeTitle: titles.get(mapping.knowledgeNodeId) ?? null,
        })),
      });
    }
    if (nodeId) {
      const tree = await readKnowledgeTree();
      const node = tree.nodes.find((item) => item.id === nodeId);
      if (!node) return NextResponse.json({ error: 'Không tìm thấy bài học.' }, { status: 404 });
      const [documents, mappings] = await Promise.all([
        listTextbookDocuments({ withToc: true }),
        listTextbookMappings({ knowledgeNodeId: nodeId }),
      ]);
      const confirmed = mappings.filter((mapping) => mapping.status === 'CONFIRMED');
      const linkedDocumentIds = new Set(confirmed.map((mapping) => mapping.documentId));
      const [artifacts, jobs, approved] = await Promise.all([
        Promise.all(
          [...linkedDocumentIds].map((id) => listTextbookArtifacts({ documentId: id }))
        ).then((lists) => lists.flat()),
        Promise.all(
          [...linkedDocumentIds].map((id) => listTextbookJobs({ documentId: id, limit: 20 }))
        ).then((lists) => lists.flat().filter((job) => job.knowledgeNodeId === nodeId)),
        approvedArtifactsForNode(nodeId),
      ]);
      await resumeStalledQueue(jobs);
      const byDocument = new Map(documents.map((document) => [document.id, document]));
      const sections = confirmed.flatMap((mapping) => {
        const document = byDocument.get(mapping.documentId);
        const entry = document?.tocEntries.find((item) => item.id === mapping.entryId);
        if (!document || !entry) return [];
        const covered = new Set([entry.id]);
        for (const candidate of document.tocEntries)
          if (candidate.parentId && covered.has(candidate.parentId)) covered.add(candidate.id);
        return [
          {
            mapping,
            document: summary(document),
            entry,
            subsections: document.tocEntries.filter(
              (item) => item.id !== entry.id && covered.has(item.id)
            ),
            artifacts: artifacts.filter(
              (artifact) => artifact.documentId === document.id && covered.has(artifact.entryId)
            ),
          },
        ];
      });
      return NextResponse.json({
        worker,
        node: { id: node.id, title: node.title },
        sections,
        jobs,
        approvedCount: approved.length,
        // Indexed books with their outline, for linking another section to this lesson.
        documents: documents
          .filter((document) => document.status === 'INDEXED')
          .map((document) => ({ ...summary(document), tocEntries: document.tocEntries })),
        suggestions: suggestionsFor(
          node.title,
          documents.filter((document) => document.status === 'INDEXED')
        ).filter(
          (item) =>
            !confirmed.some(
              (mapping) =>
                mapping.documentId === item.documentId && mapping.entryId === item.entry.id
            )
        ),
      });
    }
    const [documents, jobs] = await Promise.all([
      listTextbookDocuments(),
      listTextbookJobs({ limit: 100 }),
    ]);
    await resumeStalledQueue(jobs);
    return NextResponse.json({
      worker,
      documents: documents.map((document) => ({
        ...summary(document),
        setupJob: latestSetupJob(jobs, document.id),
      })),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin && host && new URL(origin).host !== host)
    return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 403 });
  const missing = missingTextbookSettings();
  if (missing.length) return unavailable(missing);
  const parsed = mutation.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 400 });
  const input = parsed.data;
  const access = await getAdminAccess();
  const adminId = access.allowed ? access.adminId : 'unknown';
  try {
    switch (input.action) {
      case 'upload-init':
        return NextResponse.json(await initTextbookUpload(input, adminId));
      case 'upload-complete': {
        const completed = await completeTextbookUpload(input.uploadId);
        processTextbookQueueAfterResponse();
        return NextResponse.json(completed);
      }
      case 'upload-cancel':
        await cancelTextbookUpload(input.uploadId);
        return NextResponse.json({ cancelled: true });
      case 'page-setup':
        return NextResponse.json({
          document: await saveTextbookPageSetup(input.documentId, input),
        });
      case 'correct-toc':
        return NextResponse.json({
          document: await correctTextbookToc(
            input.documentId,
            input.changes,
            input.confirmComplete
          ),
        });
      case 'index-toc': {
        const queued = await requestTocIndex(input.documentId, { replace: input.replace });
        processTextbookQueueAfterResponse();
        return NextResponse.json(queued, { status: 202 });
      }
      case 'confirm-mapping':
      case 'remove-mapping': {
        const document = await getTextbookDocument(input.documentId);
        if (!document?.tocEntries.some((entry) => entry.id === input.entryId))
          throw new TextbookRequestError('Không tìm thấy mục trong mục lục.', 404);
        const tree = await readKnowledgeTree();
        const node = tree.nodes.find((item) => item.id === input.knowledgeNodeId);
        if (!node)
          throw new TextbookRequestError('Không tìm thấy bài học trong Cây kiến thức.', 404);
        const mapping = {
          id: `map-${input.documentId}-${input.entryId}-${input.knowledgeNodeId}`,
          documentId: input.documentId,
          entryId: input.entryId,
          knowledgeNodeId: input.knowledgeNodeId,
          confidence: 1,
          status:
            input.action === 'confirm-mapping' ? ('CONFIRMED' as const) : ('REJECTED' as const),
          confirmationRequired: false,
          updatedAt: new Date().toISOString(),
        };
        await saveTextbookMapping(mapping);
        return NextResponse.json({ mapping, knowledgeNodeTitle: node.title });
      }
      case 'extract': {
        const result = await queueTextbookExtraction(input);
        if (!result.cacheHit) processTextbookQueueAfterResponse();
        return NextResponse.json(
          { ...result, worker: await textbookWorkerStatus() },
          { status: result.cacheHit ? 200 : 202 }
        );
      }
      case 'cancel-job':
        if (!(await cancelTextbookJob(input.jobId)))
          throw new TextbookRequestError('Chỉ hủy được việc đang chờ.', 409);
        return NextResponse.json({ cancelled: true });
      case 'review-artifact': {
        const status =
          input.decision === 'approve'
            ? 'APPROVED'
            : input.decision === 'reject'
              ? 'REJECTED'
              : 'NEEDS_REVIEW';
        const artifact = await reviewTextbookArtifact(input.artifactId, status, adminId);
        if (!artifact) throw new TextbookRequestError('Không tìm thấy trích đoạn.', 404);
        return NextResponse.json({ artifact });
      }
      case 'edit-artifact': {
        const artifact = await editTextbookArtifact(input.artifactId, input);
        if (!artifact)
          throw new TextbookRequestError('Chỉ sửa được trích đoạn đang chờ duyệt.', 409);
        return NextResponse.json({ artifact });
      }
    }
  } catch (error) {
    return failure(error);
  }
}
