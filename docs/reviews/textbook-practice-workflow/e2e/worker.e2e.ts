import { it } from 'vitest';
// Runs queued textbook jobs on the QA DB with a recorded provider: the real Gemini output for printed
// p. 29 (lib/textbook-reference/fixtures/math-book-3-real.json). Other pages: NO_EDUCATIONAL_CONTENT.
import { closeSql } from '@/lib/db/postgres';
import { processNextTextbookJob } from '@/lib/textbook-reference/worker';
import type { VisionProvider } from '@/lib/textbook-reference/vision-provider';
import fixture from '@/lib/textbook-reference/fixtures/math-book-3-real.json';

const provider: VisionProvider = async ({ prompt }) => {
  const pages = [...(prompt.match(/theo thứ tự: (.*?)\. Mục lục/u)?.[1] ?? '').matchAll(/tr\. (\d+)/gu)].map((m) => Number(m[1]));
  const sent = pages.length ? pages : [29, 30, 31];
  return {
    text: JSON.stringify({
      pages: sent.map((printedPage) => ({ printedPage, status: printedPage === 29 ? 'READ' : 'NO_EDUCATIONAL_CONTENT' })),
      items: sent.includes(29) ? fixture.solutions.map((s) => ({ kind: 'SOLUTION', title: `Câu ${s.questionNumber}`, ...s })) : [],
      unreadable: [],
    }),
    usage: { input: 2900, output: 1700 }, finishReason: 'STOP',
  };
};

it('processes queued jobs', async () => {
  Object.assign(process.env, { DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5432/tb_flow_e2e', SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: 'qa-service-key', TEXTBOOK_STORAGE_BUCKET: 'qa-textbooks' });
  for (;;) {
    const r = await processNextTextbookJob({ id: 'qa-worker', hostname: 'qa', startedAt: new Date().toISOString() }, { provider });
    if (!r) break;
    console.log('JOB', r.job.id, r.job.status, r.job.printedPages, r.job.error ?? '', r.job.outcome ?? '');
  }
  await closeSql();
});
