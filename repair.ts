import fs from 'fs';
import path from 'path';
import Module, { createRequire } from 'module';
import type { PipelineDocument } from './lib/pipeline/types';

process.env.GEMINI_API_KEY = 'dummy';

// Bypass server-only error in scripts
const scriptRequire = createRequire(import.meta.url);
const serverOnlyPath = scriptRequire.resolve('server-only');
const serverOnlyModule = new Module(serverOnlyPath);
serverOnlyModule.filename = serverOnlyPath;
serverOnlyModule.loaded = true;
serverOnlyModule.exports = {};
scriptRequire.cache[serverOnlyPath] = serverOnlyModule;

const docId = 'mrybf9oh-z0u4kc8';
const docPath = path.join(process.cwd(), 'tmp/uploads', docId, 'document.json');

async function repair() {
  const { mergeIntoChapters, validateDocument } =
    await import('./lib/pipeline/pipeline-orchestrator');
  const raw = fs.readFileSync(docPath, 'utf-8');
  const doc = JSON.parse(raw) as PipelineDocument;

  if (!doc.batches || !doc.batchResults || !doc.tocEntries) {
    console.error('Missing required pipeline state in document');
    process.exit(1);
  }

  console.log(`Repairing document ${docId}...`);
  console.log(`- Batches: ${doc.batches.length}`);
  console.log(`- TOC Entries: ${doc.tocEntries.length}`);

  // Re-run merge
  doc.chapters = mergeIntoChapters(doc.batchResults, doc.batches, doc.tocEntries);
  console.log(`- Merged Chapters: ${doc.chapters.length}`);

  // Quick manual validation to print structures
  doc.chapters.forEach((c) => {
    console.log(`\n${c.title} (pages ${c.startPage}-${c.endPage})`);
    c.lessons.forEach((l) => {
      console.log(
        `  - ${l.lessonNumber}: ${l.title} (pages ${l.startPage}-${l.endPage}) - topics: ${l.topics.length}`
      );
    });
  });

  // Re-validate
  const errors = validateDocument(doc);
  if (errors.length > 0) {
    console.error(`Validation failed with ${errors.length} errors:`);
    errors.forEach((e) => console.error(`  [${e.code}] Node ${e.nodeId}: ${e.message}`));
  } else {
    console.log(`\n- Validation passed with 0 errors.`);
  }

  // Save back
  fs.writeFileSync(docPath, JSON.stringify(doc, null, 2), 'utf-8');
  console.log(`Successfully saved repaired document to ${docPath}`);
}

repair().catch(console.error);
