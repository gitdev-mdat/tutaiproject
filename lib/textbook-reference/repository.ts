import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';
import { getSql } from '@/lib/db/postgres';
import { artifactsCoveredByMappings } from './lesson-coverage';
import type {
  ArtifactReviewStatus,
  ExercisePracticeRecord,
  TextbookAnchor,
  TextbookArtifact,
  TextbookDocumentRecord,
  TextbookExtractionJob,
  TextbookKnowledgeMapping,
  TextbookProcessingStatus,
  TextbookTocEntry,
  TextbookUploadSession,
  TextbookWorkerStatus,
} from './types';

/**
 * PostgreSQL persistence for textbook references. Every write is a targeted
 * statement on the rows it changes, so concurrent Admin actions and the worker
 * never overwrite each other's state. PDF bytes live in private Storage
 * (`object-storage.ts`), never here.
 */

const REQUIRED_SETTINGS = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TEXTBOOK_STORAGE_BUCKET',
] as const;

export class TextbookBackendUnavailableError extends Error {
  constructor(readonly missing: string[]) {
    super('Durable textbook storage is not configured (PostgreSQL and private Supabase Storage).');
    this.name = 'TextbookBackendUnavailableError';
  }
}

/** Names (never values) of the server settings the textbook backend still needs. */
export function missingTextbookSettings(env: Record<string, string | undefined> = process.env) {
  return REQUIRED_SETTINGS.filter((name) => !env[name]);
}

export function durableTextbookBackendConfigured(env = process.env): boolean {
  return missingTextbookSettings(env).length === 0;
}

export function assertTextbookBackend(): void {
  const missing = missingTextbookSettings();
  if (missing.length) throw new TextbookBackendUnavailableError(missing);
}

function sql() {
  assertTextbookBackend();
  return getSql();
}

type Row = Record<string, unknown>;
const json = (value: unknown) => value as never;

// ─── Documents ───────────────────────────────────────────────────────────────

type DocumentMetadata = Omit<TextbookDocumentRecord, 'anchors' | 'tocEntries' | 'status'>;

function toDocument(row: Row, anchors: TextbookAnchor[], tocEntries: TextbookTocEntry[]) {
  return {
    ...(row.metadata as DocumentMetadata),
    status: row.status as TextbookProcessingStatus,
    anchors,
    tocEntries,
  } satisfies TextbookDocumentRecord;
}

/** Documents with their page anchors; table-of-contents entries only when asked for. */
export async function listTextbookDocuments({
  withToc = false,
}: { withToc?: boolean } = {}): Promise<TextbookDocumentRecord[]> {
  const db = sql();
  const documents =
    await db`select id, status, metadata from tutai.textbook_documents order by created_at`;
  if (!documents.length) return [];
  const ids = documents.map((row) => row.id as string);
  const anchors = await db`
    select document_id, payload from tutai.textbook_page_anchors
    where document_id = any(${ids}) order by printed_page`;
  const entries = withToc
    ? await db`
        select document_id, payload from tutai.textbook_toc_entries
        where document_id = any(${ids}) order by document_id, position, id`
    : [];
  const group = <T>(rows: Row[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows)
      map.set(row.document_id as string, [
        ...(map.get(row.document_id as string) ?? []),
        row.payload as T,
      ]);
    return map;
  };
  const anchorsBy = group<TextbookAnchor>(anchors);
  const entriesBy = group<TextbookTocEntry>(entries);
  return documents.map((row) =>
    toDocument(row, anchorsBy.get(row.id as string) ?? [], entriesBy.get(row.id as string) ?? [])
  );
}

export async function getTextbookDocument(id: string): Promise<TextbookDocumentRecord | null> {
  const db = sql();
  const [row] =
    await db`select id, status, metadata from tutai.textbook_documents where id = ${id}`;
  if (!row) return null;
  const anchors = await db`
    select payload from tutai.textbook_page_anchors where document_id = ${id} order by printed_page`;
  const entries = await db`
    select payload from tutai.textbook_toc_entries where document_id = ${id} order by position, id`;
  return toDocument(
    row,
    anchors.map((item) => item.payload as TextbookAnchor),
    entries.map((item) => item.payload as TextbookTocEntry)
  );
}

export async function findTextbookBySha(sha256: string): Promise<TextbookDocumentRecord | null> {
  const [row] = await sql()`select id from tutai.textbook_documents where sha256 = ${sha256}`;
  return row ? getTextbookDocument(row.id as string) : null;
}

/** Inserts a document unless one with the same SHA-256 exists; returns the stored one. */
export async function insertTextbookDocument(
  document: TextbookDocumentRecord
): Promise<{ document: TextbookDocumentRecord; duplicate: boolean }> {
  // Anchors and outline live in their own tables; status has its own column.
  const metadata: Partial<TextbookDocumentRecord> = { ...document };
  delete metadata.anchors;
  delete metadata.tocEntries;
  delete metadata.status;
  const { status } = document;
  const inserted = await sql()`
    insert into tutai.textbook_documents (id, sha256, status, metadata)
    values (${document.id}, ${document.sha256}, ${status}, ${json(metadata)})
    on conflict (sha256) do nothing
    returning id`;
  const stored = await findTextbookBySha(document.sha256);
  if (!stored) throw new Error('Textbook registration did not persist.');
  return { document: stored, duplicate: inserted.length === 0 };
}

export async function updateTextbookDocument(
  id: string,
  patch: Partial<Omit<DocumentMetadata, 'id' | 'sha256'>> & { status?: TextbookProcessingStatus }
): Promise<void> {
  const { status, ...metadata } = patch;
  await sql()`
    update tutai.textbook_documents set
      status = coalesce(${status ?? null}, status),
      metadata = metadata || ${json(metadata)},
      updated_at = now()
    where id = ${id}`;
}

export async function replaceTextbookAnchors(documentId: string, anchors: TextbookAnchor[]) {
  await sql().begin(async (tx) => {
    await tx`delete from tutai.textbook_page_anchors where document_id = ${documentId}`;
    for (const anchor of anchors) {
      await tx`
        insert into tutai.textbook_page_anchors (document_id, printed_page, pdf_page, payload)
        values (${documentId}, ${anchor.printedPage}, ${anchor.pdfPage}, ${tx.json(anchor as never)})`;
    }
    await tx`update tutai.textbook_documents set updated_at = now() where id = ${documentId}`;
  });
}

/**
 * Replaces the table of contents. Refused once a section is linked to the
 * Knowledge Tree or has extracted artifacts, so reviewed work never loses its
 * section; such a book keeps its index.
 */
/** Rewrites entry payloads in place (same ids and parents), e.g. after an Admin correction. */
export async function updateTextbookTocEntries(
  documentId: string,
  entries: TextbookTocEntry[],
  completeness?: TextbookDocumentRecord['tocIndexCompleteness']
): Promise<void> {
  await sql().begin(async (tx) => {
    for (const entry of entries) {
      await tx`
        update tutai.textbook_toc_entries set payload = ${tx.json(entry as never)}
        where document_id = ${documentId} and id = ${entry.id}`;
    }
    await tx`
      update tutai.textbook_documents set
        metadata = metadata || ${tx.json((completeness ? { tocIndexCompleteness: completeness } : {}) as never)},
        updated_at = now()
      where id = ${documentId}`;
  });
}

export async function replaceTextbookToc(
  documentId: string,
  entries: TextbookTocEntry[],
  completeness: TextbookDocumentRecord['tocIndexCompleteness']
): Promise<void> {
  await sql().begin(async (tx) => {
    const [used] = await tx`
      select
        (select count(*) from tutai.textbook_knowledge_mappings where document_id = ${documentId})::int as mappings,
        (select count(*) from tutai.textbook_artifacts where document_id = ${documentId})::int as artifacts`;
    if ((used.mappings as number) > 0 || (used.artifacts as number) > 0)
      throw new Error('This book already has linked sections; its table of contents is kept.');
    await tx`delete from tutai.textbook_toc_entries where document_id = ${documentId}`;
    for (const [position, entry] of entries.entries()) {
      await tx`
        insert into tutai.textbook_toc_entries (document_id, id, parent_id, position, payload)
        values (${documentId}, ${entry.id}, ${entry.parentId}, ${position}, ${tx.json(entry as never)})`;
    }
    await tx`
      update tutai.textbook_documents set
        status = 'INDEXED',
        metadata = metadata || ${tx.json({ tocIndexCompleteness: completeness } as never)},
        updated_at = now()
      where id = ${documentId}`;
  });
}

// ─── Knowledge Tree mappings ─────────────────────────────────────────────────

export async function listTextbookMappings(
  filter: { documentId?: string; knowledgeNodeId?: string } = {}
): Promise<TextbookKnowledgeMapping[]> {
  const rows = await sql()`
    select payload from tutai.textbook_knowledge_mappings
    where (${filter.documentId ?? null}::text is null or document_id = ${filter.documentId ?? null})
      and (${filter.knowledgeNodeId ?? null}::text is null or knowledge_node_id = ${filter.knowledgeNodeId ?? null})
    order by updated_at`;
  return rows.map((row) => row.payload as TextbookKnowledgeMapping);
}

export async function saveTextbookMapping(mapping: TextbookKnowledgeMapping): Promise<void> {
  await sql()`
    insert into tutai.textbook_knowledge_mappings
      (id, document_id, entry_id, knowledge_node_id, status, payload, updated_at)
    values (${mapping.id}, ${mapping.documentId}, ${mapping.entryId}, ${mapping.knowledgeNodeId},
      ${mapping.status}, ${json(mapping)}, now())
    on conflict (document_id, entry_id, knowledge_node_id) do update set
      status = excluded.status, payload = excluded.payload, updated_at = now()`;
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

function toJob(row: Row): TextbookExtractionJob {
  const payload = row.payload as TextbookExtractionJob;
  const status = row.status as TextbookExtractionJob['status'];
  // Claiming a job updates the columns, not the payload: read live state from the row.
  const started = [...(payload.history ?? [])]
    .reverse()
    .find((entry) => entry.status === 'RUNNING');
  return {
    ...payload,
    status,
    attempts: row.attempts as number,
    updatedAt: row.updated_at
      ? new Date(row.updated_at as string).toISOString()
      : payload.updatedAt,
    ...(started ? { startedAt: started.at } : {}),
    leaseUntil:
      status === 'RUNNING' && row.lease_until
        ? new Date(row.lease_until as string).toISOString()
        : null,
  };
}

/** Queues a job unless an equivalent one is already queued or running; returns the active one. */
export async function enqueueTextbookJob(
  job: TextbookExtractionJob
): Promise<{ job: TextbookExtractionJob; existing: boolean }> {
  const db = sql();
  const inserted = await db`
    insert into tutai.textbook_jobs (id, document_id, kind, job_key, status, attempts, payload, created_at, updated_at)
    values (${job.id}, ${job.documentId}, ${job.kind}, ${job.extractionKey}, ${job.status},
      ${job.attempts}, ${json({ ...job, history: [{ status: job.status, attempts: job.attempts, at: job.createdAt }] })},
      ${job.createdAt}, ${job.updatedAt})
    on conflict (job_key) where status in ('QUEUED', 'RUNNING') do nothing
    returning *`;
  if (inserted.length) return { job: toJob(inserted[0]), existing: false };
  const [active] = await db`
    select * from tutai.textbook_jobs
    where job_key = ${job.extractionKey} and status in ('QUEUED', 'RUNNING')`;
  if (!active) return enqueueTextbookJob(job);
  return { job: toJob(active), existing: true };
}

export async function recordFinishedTextbookJob(job: TextbookExtractionJob): Promise<void> {
  await sql()`
    insert into tutai.textbook_jobs (id, document_id, kind, job_key, status, attempts, payload, created_at, updated_at)
    values (${job.id}, ${job.documentId}, ${job.kind}, ${job.extractionKey}, ${job.status},
      ${job.attempts}, ${json(job)}, ${job.createdAt}, ${job.updatedAt})`;
}

export async function getTextbookJob(id: string): Promise<TextbookExtractionJob | null> {
  const [row] = await sql()`select * from tutai.textbook_jobs where id = ${id}`;
  return row ? toJob(row) : null;
}

export async function listTextbookJobs(
  filter: { documentId?: string; jobKey?: string; limit?: number } = {}
): Promise<TextbookExtractionJob[]> {
  const rows = await sql()`
    select * from tutai.textbook_jobs
    where (${filter.documentId ?? null}::text is null or document_id = ${filter.documentId ?? null})
      and (${filter.jobKey ?? null}::text is null or job_key = ${filter.jobKey ?? null})
    order by created_at desc
    limit ${filter.limit ?? 50}`;
  return rows.map(toJob);
}

/**
 * Longest a job may run before another worker may take it over. A job is one
 * PDF download, a few page renders and one Gemini call (120 s timeout).
 */
export const JOB_LEASE_SECONDS = 360;

/**
 * Leases the oldest runnable job with `FOR UPDATE SKIP LOCKED`, so independent
 * worker processes never run the same job. A RUNNING job whose lease expired
 * (its worker died) is picked up again and resumes.
 */
export async function claimNextTextbookJob(
  workerId: string
): Promise<TextbookExtractionJob | null> {
  return sql().begin(async (tx) => {
    const [row] = await tx`
      select * from tutai.textbook_jobs
      where status = 'QUEUED' or (status = 'RUNNING' and (lease_until is null or lease_until < now()))
      order by created_at
      limit 1
      for update skip locked`;
    if (!row) return null;
    const at = new Date().toISOString();
    const attempts = (row.attempts as number) + 1;
    const [claimed] = await tx`
      update tutai.textbook_jobs set
        status = 'RUNNING', attempts = ${attempts}, lease_owner = ${workerId},
        lease_until = now() + make_interval(secs => ${JOB_LEASE_SECONDS}),
        updated_at = now(),
        payload = jsonb_set(payload, '{history}',
          coalesce(payload->'history', '[]'::jsonb) ||
          jsonb_build_array(jsonb_build_object('status', 'RUNNING', 'attempts', ${attempts}::int, 'at', ${at}::text)))
      where id = ${row.id as string}
      returning *`;
    return toJob(claimed);
  }) as Promise<TextbookExtractionJob | null>;
}

/** Writes a job's outcome. Only the worker that holds the lease may finish it. */
export async function finishTextbookJob(
  job: TextbookExtractionJob,
  workerId: string | null
): Promise<boolean> {
  const at = new Date().toISOString();
  const entry = { status: job.status, attempts: job.attempts, error: job.error, at };
  const rows = await sql()`
    update tutai.textbook_jobs set
      status = ${job.status}, updated_at = now(), lease_until = null,
      payload = ${json({ ...job, history: undefined })}::jsonb ||
        jsonb_build_object('history', coalesce(payload->'history', '[]'::jsonb) || jsonb_build_array(${json(entry)}::jsonb))
    where id = ${job.id} and status = 'RUNNING'
      and (${workerId}::text is null or lease_owner = ${workerId})
    returning id`;
  return rows.length > 0;
}

export async function cancelTextbookJob(id: string): Promise<boolean> {
  const rows = await sql()`
    update tutai.textbook_jobs set status = 'CANCELLED', updated_at = now(), lease_until = null
    where id = ${id} and status = 'QUEUED'
    returning id`;
  return rows.length > 0;
}

export async function extendTextbookJobLease(id: string, workerId: string): Promise<void> {
  await sql()`
    update tutai.textbook_jobs
    set lease_until = now() + make_interval(secs => ${JOB_LEASE_SECONDS})
    where id = ${id} and lease_owner = ${workerId} and status = 'RUNNING'`;
}

// ─── Artifacts ───────────────────────────────────────────────────────────────

function toArtifact(row: Row): TextbookArtifact {
  return {
    ...(row.payload as TextbookArtifact),
    reviewStatus: row.review_status as ArtifactReviewStatus,
    ...(row.reviewed_at ? { reviewedAt: new Date(row.reviewed_at as string).toISOString() } : {}),
  };
}

export async function listTextbookArtifacts(
  filter: { documentId?: string; extractionKey?: string; approvedOnly?: boolean } = {}
): Promise<TextbookArtifact[]> {
  const rows = await sql()`
    select * from tutai.textbook_artifacts
    where (${filter.documentId ?? null}::text is null or document_id = ${filter.documentId ?? null})
      and (${filter.extractionKey ?? null}::text is null or extraction_key = ${filter.extractionKey ?? null})
      and (${filter.approvedOnly ?? false} = false or review_status = 'APPROVED')
    order by created_at, id`;
  return rows.map(toArtifact);
}

/**
 * Approved artifacts reachable from a Knowledge Tree node through a confirmed
 * mapping: the mapped section itself or any section below it, limited to the
 * pages the mapping covers (`lesson-coverage.ts`).
 */
export async function approvedArtifactsForNode(
  knowledgeNodeId: string
): Promise<TextbookArtifact[]> {
  const mappings = (await listTextbookMappings({ knowledgeNodeId })).filter(
    (mapping) => mapping.status === 'CONFIRMED'
  );
  if (!mappings.length) return [];
  const documentIds = [...new Set(mappings.map((mapping) => mapping.documentId))];
  const [entryRows, artifactRows] = await Promise.all([
    sql()`
      select document_id, payload from tutai.textbook_toc_entries
      where document_id in ${sql()(documentIds)}
      order by document_id, position`,
    sql()`
      select * from tutai.textbook_artifacts
      where document_id in ${sql()(documentIds)} and review_status = 'APPROVED'
      order by created_at, id`,
  ]);
  const tocByDocument = new Map<string, TextbookTocEntry[]>();
  for (const row of entryRows) {
    const id = row.document_id as string;
    tocByDocument.set(id, [...(tocByDocument.get(id) ?? []), row.payload as TextbookTocEntry]);
  }
  return artifactsCoveredByMappings(artifactRows.map(toArtifact), mappings, tocByDocument);
}

export async function insertTextbookArtifacts(artifacts: TextbookArtifact[]): Promise<void> {
  if (!artifacts.length) return;
  await sql().begin(async (tx) => {
    for (const artifact of artifacts) {
      await tx`
        insert into tutai.textbook_artifacts (id, document_id, entry_id, extraction_key, review_status, payload, created_at)
        values (${artifact.id}, ${artifact.documentId}, ${artifact.entryId}, ${artifact.extractionKey},
          ${artifact.reviewStatus}, ${tx.json(artifact as never)}, ${artifact.createdAt})
        on conflict (id) do nothing`;
    }
  });
}

/**
 * Records a question/solution pair on both artifacts, only if neither was paired
 * meanwhile. Writes pairing fields only: text and review decisions stay as they are.
 */
export async function pairTextbookArtifacts(
  exercise: TextbookArtifact,
  solution: TextbookArtifact
): Promise<boolean> {
  const fields = (artifact: TextbookArtifact) => ({
    pairedArtifactId: artifact.pairedArtifactId,
    exerciseReference: artifact.exerciseReference,
    solutionReference: artifact.solutionReference,
    solutionStatus: artifact.solutionStatus,
    answer: artifact.answer,
    verificationNotes: artifact.verificationNotes,
  });
  return sql().begin(async (tx) => {
    const rows = await tx`
      select id from tutai.textbook_artifacts
      where id in ${tx([exercise.id, solution.id])} and payload->>'pairedArtifactId' is null
      for update`;
    if (rows.length !== 2) return false;
    for (const artifact of [exercise, solution])
      await tx`
        update tutai.textbook_artifacts
        set payload = payload || ${tx.json(JSON.parse(JSON.stringify(fields(artifact))) as never)}
        where id = ${artifact.id}`;
    return true;
  });
}

export async function getTextbookArtifact(id: string): Promise<TextbookArtifact | null> {
  const [row] = await sql()`select * from tutai.textbook_artifacts where id = ${id}`;
  return row ? toArtifact(row) : null;
}

export type ExercisePracticeChange =
  | {
      practice: ExercisePracticeRecord;
      /** Compatibility fields the reference view reads (solutionStatus, answer, pairing). */
      fields?: Partial<
        Pick<
          TextbookArtifact,
          'solutionStatus' | 'answer' | 'pairedArtifactId' | 'solutionReference'
        >
      >;
      /** Solution to mark as this exercise's, or to release (null). */
      solution?: { id: string; paired: boolean };
    }
  | { error: string };

/**
 * Changes one exercise's practice decisions under a row lock. `change` sees the
 * current row and may ask whether a solution is already confirmed for another
 * exercise, so one printed solution can never be confirmed for two questions.
 * The extracted text and the review decision are never written here.
 */
export async function updateExercisePractice(
  id: string,
  change: (
    exercise: TextbookArtifact,
    confirmedElsewhere: (solutionId: string) => Promise<boolean>
  ) => Promise<ExercisePracticeChange> | ExercisePracticeChange
): Promise<{ artifact: TextbookArtifact } | { error: string; status: 404 | 409 | 422 }> {
  return sql().begin(async (tx) => {
    const [row] = await tx`
      select * from tutai.textbook_artifacts where id = ${id} and payload->>'kind' = 'EXERCISE' for update`;
    if (!row) return { error: 'Không tìm thấy câu hỏi.', status: 404 as const };
    const exercise = toArtifact(row);
    const decided = await change(exercise, async (solutionId) => {
      const available = await tx`
        select id from tutai.textbook_artifacts
        where id = ${solutionId} and payload->>'kind' = 'SOLUTION'
          and (payload->>'pairedArtifactId' is null or payload->>'pairedArtifactId' = ${id})
        for update`;
      if (!available.length) return true;
      const rows = await tx`
        select id from tutai.textbook_artifacts
        where document_id = ${exercise.documentId} and id <> ${id}
          and payload->'practice'->'verification'->>'solutionArtifactId' = ${solutionId}`;
      return rows.length > 0;
    });
    if ('error' in decided) return { error: decided.error, status: 409 as const };
    const patch = JSON.parse(JSON.stringify({ ...decided.fields, practice: decided.practice }));
    for (const key of ['pairedArtifactId', 'solutionReference'] as const)
      if (decided.fields && key in decided.fields && decided.fields[key] === undefined)
        patch[key] = null;
    const [updated] = await tx`
      update tutai.textbook_artifacts set payload = payload || ${tx.json(patch)}
      where id = ${id} returning *`;
    if (decided.solution) {
      const { id: solutionId, paired } = decided.solution;
      await tx`
        update tutai.textbook_artifacts set payload = payload || ${tx.json(
          paired
            ? {
                pairedArtifactId: id,
                exerciseReference: `${exercise.title} (tr. ${exercise.printedPages.join(', ')})`,
              }
            : { pairedArtifactId: null, exerciseReference: null }
        )}
        where id = ${solutionId} and payload->>'kind' = 'SOLUTION'
          and (payload->>'pairedArtifactId' is null or payload->>'pairedArtifactId' = ${id})`;
    }
    return { artifact: toArtifact(updated) };
  });
}

export async function reviewTextbookArtifact(
  id: string,
  decision: ArtifactReviewStatus,
  reviewer: string
): Promise<TextbookArtifact | null> {
  const [row] = await sql()`
    update tutai.textbook_artifacts set
      review_status = ${decision}, reviewed_at = now(), reviewed_by = ${reviewer},
      payload = payload || jsonb_build_object('reviewStatus', ${decision}::text)
    where id = ${id}
    returning *`;
  return row ? toArtifact(row) : null;
}

/** Corrects an artifact's text before approval; approved or rejected text is fixed. */
export async function editTextbookArtifact(
  id: string,
  patch: { title: string; content: string }
): Promise<TextbookArtifact | null> {
  const [row] = await sql()`
    update tutai.textbook_artifacts set
      payload = payload || ${json({ ...patch, editedByAdmin: true })}
    where id = ${id} and review_status = 'NEEDS_REVIEW'
    returning *`;
  return row ? toArtifact(row) : null;
}

// ─── Uploads ─────────────────────────────────────────────────────────────────

function toUpload(row: Row): TextbookUploadSession {
  return {
    id: row.id as string,
    sha256: row.sha256 as string,
    byteSize: Number(row.byte_size),
    originalFilename: row.original_filename as string,
    title: row.title as string,
    storageKey: row.storage_key as string,
    status: row.status as TextbookUploadSession['status'],
    documentId: (row.document_id as string | null) ?? null,
    expiresAt: new Date(row.expires_at as string).toISOString(),
  };
}

/** One pending upload per file hash: a retry resumes the same session and object. */
export async function openTextbookUpload(
  upload: Omit<TextbookUploadSession, 'status' | 'documentId'> & { createdBy: string }
): Promise<TextbookUploadSession> {
  const db = sql();
  return db.begin(async (tx) => {
    await tx`
      update tutai.textbook_uploads set status = 'CANCELLED', updated_at = now()
      where sha256 = ${upload.sha256} and status = 'PENDING' and expires_at < now()`;
    const [existing] = await tx`
      select * from tutai.textbook_uploads where sha256 = ${upload.sha256} and status = 'PENDING'`;
    if (existing) {
      const [renewed] = await tx`
        update tutai.textbook_uploads set expires_at = ${upload.expiresAt}, updated_at = now()
        where id = ${existing.id as string} returning *`;
      return toUpload(renewed);
    }
    const [row] = await tx`
      insert into tutai.textbook_uploads
        (id, sha256, byte_size, original_filename, title, storage_key, status, created_by, expires_at)
      values (${upload.id}, ${upload.sha256}, ${upload.byteSize}, ${upload.originalFilename},
        ${upload.title}, ${upload.storageKey}, 'PENDING', ${upload.createdBy}, ${upload.expiresAt})
      returning *`;
    return toUpload(row);
  }) as Promise<TextbookUploadSession>;
}

export async function getTextbookUpload(id: string): Promise<TextbookUploadSession | null> {
  const [row] = await sql()`select * from tutai.textbook_uploads where id = ${id}`;
  return row ? toUpload(row) : null;
}

export async function closeTextbookUpload(
  id: string,
  status: 'COMPLETED' | 'CANCELLED',
  documentId: string | null = null
): Promise<void> {
  await sql()`
    update tutai.textbook_uploads set status = ${status}, document_id = ${documentId}, updated_at = now()
    where id = ${id} and status = 'PENDING'`;
}

// ─── Worker liveness ─────────────────────────────────────────────────────────

export const WORKER_ONLINE_SECONDS = 90;

export async function recordWorkerHeartbeat(worker: {
  id: string;
  hostname: string;
  startedAt: string;
  currentJobId: string | null;
}): Promise<void> {
  await sql()`
    insert into tutai.textbook_workers (id, hostname, started_at, last_seen_at, current_job_id)
    values (${worker.id}, ${worker.hostname}, ${worker.startedAt}, now(), ${worker.currentJobId})
    on conflict (id) do update set last_seen_at = now(), current_job_id = excluded.current_job_id`;
}

export async function removeWorker(id: string): Promise<void> {
  await sql()`delete from tutai.textbook_workers where id = ${id}`;
}

export async function textbookWorkerStatus(): Promise<TextbookWorkerStatus> {
  const [row] = await sql()`
    select last_seen_at, current_job_id,
      last_seen_at > now() - make_interval(secs => ${WORKER_ONLINE_SECONDS}) as online
    from tutai.textbook_workers order by last_seen_at desc limit 1`;
  if (!row) return { online: false, lastSeenAt: null, currentJobId: null };
  return {
    online: Boolean(row.online),
    lastSeenAt: new Date(row.last_seen_at as string).toISOString(),
    currentJobId: row.online ? ((row.current_job_id as string | null) ?? null) : null,
  };
}

// ─── Legacy local pilot (read-only import source) ────────────────────────────

const LOCAL_STORE = path.join(process.cwd(), 'tmp', 'textbook-reference', 'index', 'store.json');

export interface LocalTextbookPilotStore {
  documents: Array<Omit<TextbookDocumentRecord, 'status'> & { status: string }>;
  jobs: TextbookExtractionJob[];
  artifacts: TextbookArtifact[];
  mappings: Array<Omit<TextbookKnowledgeMapping, 'status'> & { status: string }>;
}

/** The pre-database pilot index under tmp/, kept only so it can be imported. */
export async function readLocalTextbookPilot(): Promise<LocalTextbookPilotStore> {
  try {
    return JSON.parse(await fs.readFile(LOCAL_STORE, 'utf8')) as LocalTextbookPilotStore;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { documents: [], jobs: [], artifacts: [], mappings: [] };
  }
}
