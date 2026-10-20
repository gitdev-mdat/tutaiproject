// Creates the private textbook bucket if it is missing; never changes an existing
// bucket's visibility. Usage: pnpm textbooks:setup-storage
import { loadEnvFile } from 'node:process';
import { ensurePrivateBucket } from '@/lib/textbook-reference/object-storage';
import { MAX_TEXTBOOK_BYTES } from '@/lib/textbook-reference/document-service';

async function main() {
  try {
    loadEnvFile('.env.local');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const result = await ensurePrivateBucket(MAX_TEXTBOOK_BYTES);
  console.log(
    JSON.stringify({ bucket: process.env.TEXTBOOK_STORAGE_BUCKET, result, public: false })
  );
}

void main().catch((error) => {
  console.error((error as Error).message);
  process.exit(1);
});
