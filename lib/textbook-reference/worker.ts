import 'server-only';

import os from 'node:os';
import { runExtractionJob } from './extraction-service';
import { downloadPrivateTextbook, TextbookChecksumError } from './object-storage';
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

export function newWorkerIdentity(): WorkerIdentity {
  return {
    id: `worker-${os.hostname()}-${process.pid}-${Date.now().toString(36)}`,
    hostname: os.hostname(),
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
  options: { provider?: VisionProvider; onClaim?: (job: TextbookExtractionJob) => void } = {}
): Promise<JobOutcome | null> {
  const job = await claimNextTextbookJob(worker.id);
  if (!job) return null;
  options.onClaim?.(job);
  await recordWorkerHeartbeat({ ...worker, currentJobId: job.id });
  const start = Date.now();
  let result: TextbookExtractionJob;
  try {
    const document = await getTextbookDocument(job.documentId);
    if (!document) throw new Error('Textbook not found.');
    result = await runJob(job, document, options.provider);
  } catch (error) {
    const message = readableError(error);
    result = { ...job, status: 'FAILED', error: message, durationMs: Date.now() - start };
    await markDocumentAfterFailure(job, error).catch(() => {});
  }
  result.updatedAt = new Date().toISOString();
  const recorded = await finishTextbookJob(result, worker.id);
  await recordWorkerHeartbeat({ ...worker, currentJobId: null });
  return { job: result, recorded };
}

async function runJob(
  job: TextbookExtractionJob,
  document: TextbookDocumentRecord,
  provider?: VisionProvider
): Promise<TextbookExtractionJob> {
  const start = Date.now();
  const readPdf = (doc: TextbookDocumentRecord) => downloadPrivateTextbook(doc.storageKey);
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
    const { entries, usage } = await runTocJob(job, document, await readPdf(document), provider);
    await replaceTextbookToc(document.id, entries, 'PARTIAL');
    await updateTextbookDocument(document.id, { processingErrors: [] });
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

/** Provider errors arrive as raw JSON; the Admin sees a short reason instead. */
export function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  try {
    const parsed = JSON.parse(message) as { error?: { code?: number; status?: string } };
    if (parsed.error?.code)
      return `Gemini từ chối yêu cầu (HTTP ${parsed.error.code}${parsed.error.status ? `, ${parsed.error.status}` : ''}). Thử lại; nếu lặp lại, kiểm tra cấu hình mô hình.`;
  } catch {}
  if ((error as { code?: string })?.code === 'TIMEOUT')
    return 'Gemini phản hồi quá lâu. Thử lại sau.';
  return message.slice(0, 400);
}

async function markDocumentAfterFailure(job: TextbookExtractionJob, error: unknown) {
  const message = readableError(error);
  if (job.kind === 'VERIFY') {
    await updateTextbookDocument(job.documentId, {
      status: 'FAILED',
      processingErrors: [
        error instanceof TextbookChecksumError
          ? 'Tệp đã lưu không khớp mã kiểm tra. Hãy tải lên lại.'
          : `Không mở được PDF: ${message}`,
      ],
    });
  } else if (job.kind === 'INDEX_TOC') {
    const document = await getTextbookDocument(job.documentId);
    await updateTextbookDocument(job.documentId, {
      status: document?.tocEntries.length ? 'INDEXED' : 'REGISTERED',
      processingErrors: [`Đọc mục lục thất bại: ${message}`],
    });
  }
}
