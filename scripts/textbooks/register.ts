// Registers a local PDF without the browser (same private storage, dedup and
// verification as an Admin upload). Usage: pnpm textbooks:register -- <pdf> [title]
import { loadEnvFile } from 'node:process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { closeSql } from '@/lib/db/postgres';
import { registerLocalTextbook } from '@/lib/textbook-reference/document-service';

async function main() {
  try {
    loadEnvFile('.env.local');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const source = process.argv[2];
  if (!source) throw new Error('Usage: pnpm textbooks:register -- <pdf-path> [title]');
  try {
    const { document, duplicate } = await registerLocalTextbook(
      await readFile(source),
      path.basename(source),
      process.argv[3]
    );
    console.log(
      JSON.stringify({
        duplicate,
        id: document.id,
        sha256: document.sha256,
        status: document.status,
      })
    );
  } finally {
    await closeSql();
  }
}

void main().catch((error) => {
  console.error((error as Error).message);
  process.exit(1);
});
