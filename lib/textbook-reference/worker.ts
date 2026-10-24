import 'server-only';

import os from 'node:os';
import { runExtractionJob } from './extraction-service';
import { downloadPrivateTextbook } from './object-storage';
import { describeJobError } from './job-errors';
import { inspectPdf } from './pdf-pages';
import {
  claimNextTextbookJob,
  finishTextbookJob,
  getTextbookDocument,
  recordWorkerHeartbeat,
  replaceTextbookToc,
  updateTextbookDocument,
} from './repository';
import { runTocJob } from './toc-service';
import type { VisionProvider } from './vision-provider';
import type { TextbookDocumentRecord, TextbookExtractionJob } from './types';

export interface WorkerIdentity {
  id: string;
  hostname: string;
  startedAt: string;
}

/** A job interrupted this many times (its worker died each time) is failed instead of looping. */
export const MAX_JOB_ATTEMPTS = 3;

export function newWorkerIdentity(hostname = os.hostname()): WorkerIdentity {
  return {
    id: `worker-${hostname}-${process.pid}-${Date.now().toString(36)}`,
    hostname,
    startedAt: new Date().toISOString(),
  };
}

export interface JobOutcome {
  job: TextbookExtractionJob;
  /** False when another worker took over the lease while this one ran. */
  recorded: boolean;
}

/**
 * Claims and runs one job. Every state change is persisted, so a process that
 * dies mid-job leaves a RUNNING job whose lease expires and is resumed by the
 * next worker. Re-running is safe: stored artifacts short-circuit extraction,
 * and the table of contents is replaced as a whole.
 */
export async function processNextTextbookJob(
  worker: WorkerIdentity,
  options: {
    provider?: VisionProvider;
    onClaim?: (job: TextbookExtractionJob) => void;
    /** Where the PDF bytes come from; private Storage unless a test supplies them. */
    readPdf?: (document: TextbookDocumentRecord) => Promise<Buffer>;
  } = {}
): Promise<JobOutcome | null> {
  const job = await claimNextTextbookJob(worker.id);
  if (!job) return null;
  options.onClaim?.(job);
  await recordWorkerHeartbeat({ ...worker, currentJobId: job.id });
  const start = Date.now();
  let result: TextbookExtractionJob;
  try {
    if (job.attempts > MAX_JOB_ATTEMPTS)
      throw Object.assign(new Error(`Interrupted ${job.attempts - 1} times.`), {
        code: 'INTERRUPTED',
      });
    const document = await getTextbookDocument(job.documentId);
    if (!document) throw new Error('Textbook not found.');
    result = await runJob(job, document, options.provider, options.readPdf);
  } catch (error) {
    const described = describeJobError(error);
    // A failure after the provider answered still records what the call cost and showed.
    const spent = (error as { jobFields?: Partial<TextbookExtractionJob> } | null)?.jobFields;
    result = {
      ...job,
      ...spent,
      status: 'FAILED',
      error: described.message,
      errorCode: described.code,
      errorDetail: described.detail,
      retryable: described.retryable,
      durationMs: Date.now() - start,
    };
    await markDocumentAfterFailure(job, described.message, described.code).catch(() => {});
  }
  result.updatedAt = new Date().toISOString();
  const recorded = await finishTextbookJob(result, worker.id);
  await recordWorkerHeartbeat({ ...worker, currentJobId: null });
  return { job: result, recorded };
}

async function runJob(
  job: TextbookExtractionJob,
  document: TextbookDocumentRecord,
  provider?: VisionProvider,
  readPdf = (doc: TextbookDocumentRecord) => downloadPrivateTextbook(doc.storageKey)
): Promise<TextbookExtractionJob> {
  const start = Date.now();
  if (job.kind === 'VERIFY') {
    const inspected = await inspectPdf(await readPdf(document));
    await updateTextbookDocument(document.id, {
      status: document.tocEntries.length ? 'INDEXED' : 'REGISTERED',
      pdfPageCount: inspected.pdfPageCount,
      scanDetection: inspected.scanDetection,
      processingErrors: [],
    });
    return { ...job, status: 'COMPLETED', durationMs: Date.now() - start };
  }
  if (job.kind === 'INDEX_TOC') {
    // The book is "being read" only from the moment a worker actually starts.
    await updateTextbookDocument(document.id, { status: 'INDEXING', processingErrors: [] });
    const { entries, usage } = await runTocJob(job, document, await readPdf(document), provider);
    await replaceTextbookToc(document.id, entries, 'PARTIAL');
    return {
      ...job,
      status: 'COMPLETED',
      providerCalls: (job.providerCalls ?? 0) + 1,
      tokenUsage: usage,
      pagesProcessed: job.tocPdfPages ?? [],
      durationMs: Date.now() - start,
    };
  }
  const { job: done } = await runExtractionJob(job, { provider, readPdf });
  return done;
}

async function markDocumentAfterFailure(job: TextbookExtractionJob, message: string, code: string) {
  if (job.kind === 'VERIFY') {
    await updateTextbookDocument(job.documentId, {
      status: 'FAILED',
      processingErrors: [code === 'FILE' ? message : `Không mở được PDF: ${message}`],
    });
  } else if (job.kind === 'INDEX_TOC') {
    // An existing outline stays; a failed re-read never removes it.
    const document = await getTextbookDocument(job.documentId);
    await updateTextbookDocument(job.documentId, {
      status: document?.tocEntries.length ? 'INDEXED' : 'REGISTERED',
      processingErrors: [`Đọc mục lục thất bại: ${message}`],
    });
  }
}
