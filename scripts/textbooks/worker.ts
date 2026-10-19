import { loadEnvFile } from 'node:process';
import { open, readFile, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  readTextbookStore,
  textbookStoreRoot,
  writeTextbookStore,
} from '@/lib/textbook-reference/repository';
import { extractTextbookPages } from '@/lib/textbook-reference/extraction-service';

async function main() {
  try {
    loadEnvFile('.env.local');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const lockPath = path.join(textbookStoreRoot(), 'worker.lock');
  await mkdir(path.dirname(lockPath), { recursive: true });
  let lock: Awaited<ReturnType<typeof open>>;
  try {
    lock = await open(lockPath, 'wx');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    let stale = true;
    try {
      const { pid } = JSON.parse(await readFile(lockPath, 'utf8')) as { pid: number };
      if (Number.isInteger(pid)) {
        try {
          process.kill(pid, 0);
          stale = false;
        } catch (probeError) {
          stale = (probeError as NodeJS.ErrnoException).code === 'ESRCH';
        }
      }
    } catch {
      stale = true;
    }
    if (!stale) throw new Error('Another textbook worker is already running.');
    await unlink(lockPath);
    lock = await open(lockPath, 'wx');
  }
  await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  try {
    await runOneJob();
  } finally {
    await lock.close();
    await unlink(lockPath).catch(() => {});
  }
}

async function runOneJob() {
  const once = process.argv.includes('--once');
  const store = await readTextbookStore();
  const jobs = store.jobs.filter((job) => job.status === 'QUEUED' || job.status === 'RUNNING');
  if (!jobs.length) {
    console.log(JSON.stringify({ processed: 0, message: 'No queued textbook extraction jobs.' }));
    return;
  }
  const job = jobs[0];
  // Recover a process interrupted after queue persistence but before a terminal state.
  if (job.status === 'RUNNING') {
    job.status = 'QUEUED';
    await writeTextbookStore(store);
  }
  try {
    const result = await extractTextbookPages({
      documentId: job.documentId,
      knowledgeNodeId: job.knowledgeNodeId,
      entryIds: job.entryIds,
      printedPages: job.printedPages,
      jobId: job.id,
    });
    console.log(
      JSON.stringify({
        jobId: job.id,
        status: result.job.status,
        artifacts: result.artifacts.length,
        cacheHit: result.cacheHit,
      })
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        jobId: job.id,
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error),
      })
    );
    process.exitCode = 1;
  }
  if (!once && jobs.length > 1)
    console.log(`Remaining queued jobs: ${jobs.length - 1}; run the worker again to continue.`);
}

void main();
