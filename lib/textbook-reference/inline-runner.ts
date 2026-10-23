import 'server-only';

import { after } from 'next/server';
import { recordWorkerHeartbeat, removeWorker, textbookWorkerStatus } from './repository';
import { newWorkerIdentity, processNextTextbookJob } from './worker';

/**
 * Runs queued textbook jobs inside the Vercel function that queued them, after
 * the response is sent, so the Admin does not need a separate worker process.
 * Every job makes at most one Gemini call (120 s timeout), so a new job is only
 * started early in the invocation and finishes well inside the route's
 * `maxDuration`. Claims use the same lease as `pnpm textbooks:worker`, which
 * still works alongside and picks up anything left over.
 */
const START_NEW_JOBS_FOR_MS = 60_000;
const HEARTBEAT_MS = 30_000;

export function inlineProcessingEnabled() {
  return process.env.TEXTBOOK_INLINE_PROCESSING !== 'off';
}

export async function drainTextbookQueue(): Promise<number> {
  const worker = newWorkerIdentity(process.env.VERCEL ? 'vercel' : undefined);
  let currentJobId: string | null = null;
  await recordWorkerHeartbeat({ ...worker, currentJobId });
  const heartbeat = setInterval(() => {
    void recordWorkerHeartbeat({ ...worker, currentJobId }).catch(() => {});
  }, HEARTBEAT_MS);
  const deadline = Date.now() + START_NEW_JOBS_FOR_MS;
  let processed = 0;
  try {
    while (Date.now() < deadline) {
      const outcome = await processNextTextbookJob(worker, {
        onClaim: (job) => {
          currentJobId = job.id;
        },
      });
      currentJobId = null;
      if (!outcome) break;
      processed += 1;
      console.log(
        '[textbooks] job',
        JSON.stringify({
          jobId: outcome.job.id,
          kind: outcome.job.kind,
          status: outcome.job.status,
          attempts: outcome.job.attempts,
          durationMs: outcome.job.durationMs,
          errorCode: outcome.job.errorCode,
          recorded: outcome.recorded,
        })
      );
    }
  } catch (error) {
    console.error('[textbooks] inline processing stopped:', (error as Error)?.message);
  } finally {
    clearInterval(heartbeat);
    await removeWorker(worker.id).catch(() => {});
  }
  return processed;
}

/** Schedules a queue drain after the current response. */
export function processTextbookQueueAfterResponse() {
  if (!inlineProcessingEnabled()) return;
  after(() => drainTextbookQueue());
}

/**
 * A job that sits queued with no live worker, or whose worker died mid-run
 * (its lease expired), is picked up again when an Admin looks at the book.
 */
export async function resumeStalledQueue(
  jobs: Array<{ status: string; updatedAt: string; leaseUntil?: string | null }>
) {
  if (!inlineProcessingEnabled()) return;
  const now = Date.now();
  const stalled = jobs.some(
    (job) =>
      (job.status === 'QUEUED' && now - new Date(job.updatedAt).getTime() > 15_000) ||
      (job.status === 'RUNNING' && !!job.leaseUntil && new Date(job.leaseUntil).getTime() < now)
  );
  if (!stalled) return;
  if ((await textbookWorkerStatus()).online) return;
  processTextbookQueueAfterResponse();
}
