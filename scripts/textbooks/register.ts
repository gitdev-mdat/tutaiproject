import { loadEnvFile } from 'node:process';
import { registerTextbook } from '@/lib/textbook-reference/repository';

async function main() {
  try {
    loadEnvFile('.env.local');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const source = process.argv[2];
  const title = process.argv[3];
  if (!source) throw new Error('Usage: pnpm textbooks:register -- <pdf-path> [title]');
  const result = await registerTextbook(source, title);
  console.log(
    JSON.stringify(
      {
        duplicate: result.duplicate,
        document: {
          id: result.document.id,
          originalFilename: result.document.originalFilename,
          title: result.document.title,
          sha256: result.document.sha256,
          pdfPageCount: result.document.pdfPageCount,
          status: result.document.status,
          importedAt: result.document.importedAt,
          scanDetection: result.scanDetection,
        },
      },
      null,
      2
    )
  );
}

void main();
