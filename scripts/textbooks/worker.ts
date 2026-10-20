// Textbook worker. Usage:
//   pnpm textbooks:worker            keep running: poll the queue, report liveness
//   pnpm textbooks:worker -- --once  run at most one job, then exit
// Needs DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// TEXTBOOK_STORAGE_BUCKET and GEMINI_API_KEY in the environment or .env.local.
import { loadEnvFile } from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import { closeSql } from '@/lib/db/postgres';
import {
  assertTextbookBackend,
  recordWorkerHeartbeat,
  removeWorker,
} from '@/lib/textbook-reference/repository';
import { newWorkerIdentity, processNextTextbookJob } from '@/lib/textbook-reference/worker';

const POLL_MS = 5_000;
const HEARTBEAT_MS = 30_000;

async function main() {
  try {
    loadEnvFile('.env.local');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  assertTextbookBackend();
  const once = process.argv.includes('--once');
  const worker = newWorkerIdentity();
  let stopping = false;
  let currentJobId: string | null = null;
  const stop = () => {
    stopping = true;
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  await recordWorkerHeartbeat({ ...worker, currentJobId: null });
  const heartbeat = setInterval(() => {
    void recordWorkerHeartbeat({ ...worker, currentJobId }).catch((error) =>
      console.error('[textbook-worker] heartbeat failed:', (error as Error).message)
    );
  }, HEARTBEAT_MS);
  console.log(JSON.stringify({ worker: worker.id, mode: once ? 'once' : 'watch' }));
  try {
    do {
      const outcome = await processNextTextbookJob(worker, {
        onClaim: (job) => {
          currentJobId = job.id;
        },
      });
      if (!outcome) {
        if (once) {
          console.log(JSON.stringify({ processed: 0, message: 'No queued textbook jobs.' }));
          break;
        }
        await sleep(POLL_MS);
        continue;
      }
      currentJobId = null;
      const { job, recorded } = outcome;
      console.log(
        JSON.stringify({
          jobId: job.id,
          kind: job.kind,
          status: job.status,
          attempts: job.attempts,
          providerCalls: job.providerCalls ?? 0,
          cacheHit: job.cacheHit,
          durationMs: job.durationMs,
          ...(job.error ? { error: job.error } : {}),
          ...(recorded ? {} : { note: 'lease lost; outcome not recorded' }),
        })
      );
      if (job.status === 'FAILED') process.exitCode = 1;
    } while (!once && !stopping);
  } finally {
    clearInterval(heartbeat);
    await removeWorker(worker.id).catch(() => {});
    await closeSql();
  }
}

void main().catch((error) => {
  console.error((error as Error).message);
  process.exit(1);
});
