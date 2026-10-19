import { queueTextbookExtraction } from '@/lib/textbook-reference/extraction-service';

async function main() {
  const documentId = process.argv[2];
  const knowledgeNodeId = process.argv[3];
  const entryId = process.argv[4];
  if (!documentId || !knowledgeNodeId || !entryId)
    throw new Error(
      'Usage: pnpm exec tsx --conditions=react-server scripts/textbooks/request-pilot-extraction.ts <document-id> <knowledge-node-id> <toc-entry-id>'
    );
  const result = await queueTextbookExtraction({
    documentId,
    knowledgeNodeId,
    entryIds: [entryId],
    printedPages: [13, 16, 19, 29],
  });
  console.log(
    JSON.stringify(
      {
        jobId: result.job.id,
        status: result.job.status,
        cacheHit: result.cacheHit,
        artifacts: result.artifacts.length,
        pages: result.job.printedPages,
      },
      null,
      2
    )
  );
}

void main();
