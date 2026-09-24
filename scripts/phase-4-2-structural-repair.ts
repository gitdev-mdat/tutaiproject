import fs from 'node:fs';
import path from 'node:path';
import type { PageNumberMapping, PipelineDocument } from '../lib/pipeline/types.ts';
import { previewStructuralRepair } from '../lib/pipeline/structure-repair.ts';
import { persistStructuralRepairAtomically } from '../lib/pipeline/structural-repair-storage.ts';

function readArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const documentArgument = readArgument('--document');
  const offsetArgument = readArgument('--printed-to-pdf-offset');
  const outputArgument = readArgument('--output');
  const apply = process.argv.includes('--apply');

  if (!documentArgument || offsetArgument === undefined) {
    throw new Error(
      'Usage: --document <document.json> --printed-to-pdf-offset <integer> [--output <preview.json>] [--apply]'
    );
  }
  const printedToPdfOffset = Number(offsetArgument);
  if (!Number.isInteger(printedToPdfOffset)) {
    throw new Error('--printed-to-pdf-offset must be an integer');
  }

  const documentPath = path.resolve(documentArgument);
  const document = JSON.parse(await fs.promises.readFile(documentPath, 'utf8')) as PipelineDocument;
  const mapping: PageNumberMapping = {
    printedToPdfOffset,
    confidence: 1,
    evidence:
      readArgument('--mapping-evidence') ??
      'Operator-verified mapping between a rendered physical PDF page and its printed number',
  };
  const preview = previewStructuralRepair(document, mapping);
  const output = {
    mode: apply ? 'APPLY' : 'PREVIEW',
    documentId: document.id,
    mapping,
    summary: preview.summary,
    validationErrors: preview.validationErrors,
    chapterIntervals: preview.index.chapters,
    lessonIntervals: preview.index.lessons,
    moves: preview.audit.filter((item) => item.changed),
    audit: preview.audit,
  };

  if (outputArgument) {
    const outputPath = path.resolve(outputArgument);
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.promises.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf8');
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

  if (!apply) return;
  if (preview.validationErrors.length > 0) {
    throw new Error('Repair preview is invalid; document was not modified');
  }
  const result = await persistStructuralRepairAtomically({ documentPath, preview });
  process.stdout.write(
    `${JSON.stringify(
      {
        persisted: true,
        backupPath: result.backupPath,
        structuralRepair: result.document.structuralRepair,
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
