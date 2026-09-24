import fs from 'node:fs';
import path from 'node:path';
import type { PipelineDocument } from './types';
import type { StructuralRepairPreview } from './structure-repair.ts';
import { buildStructuralIntervalIndex, validateProjectedStructure } from './structure-repair.ts';

export interface AtomicStructuralRepairResult {
  document: PipelineDocument;
  backupPath: string;
}

function backupTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

function validateCandidate(document: PipelineDocument): string[] {
  const chapterEnds = (document.tocEntries ?? [])
    .filter((entry) => entry.type === 'chapter')
    .map((entry) => entry.endPage);
  const index = buildStructuralIntervalIndex(document.tocEntries ?? [], {
    existingChapters: document.chapters,
    finalRelevantPdfPage: Math.max(...chapterEnds),
  });
  return validateProjectedStructure(document, index);
}

/**
 * Persists a previously validated preview using temp-write, re-read validation,
 * backup retention, and same-directory atomic rename.
 */
export async function persistStructuralRepairAtomically(params: {
  documentPath: string;
  preview: StructuralRepairPreview;
  now?: Date;
}): Promise<AtomicStructuralRepairResult> {
  if (params.preview.validationErrors.length > 0) {
    throw new Error(
      `Refusing to persist invalid structural repair: ${params.preview.validationErrors.join('; ')}`
    );
  }

  const now = params.now ?? new Date();
  const absoluteDocumentPath = path.resolve(params.documentPath);
  const directory = path.dirname(absoluteDocumentPath);
  const backupPath = `${absoluteDocumentPath}.backup.phase-4-2.${backupTimestamp(now)}`;
  const tempPath = path.join(
    directory,
    `.document.structure-repair.${process.pid}.${now.getTime()}.tmp`
  );
  const candidate = params.preview.projectedDocument;
  candidate.updatedAt = now.toISOString();
  candidate.structuralRepair = {
    version: 1,
    appliedAt: now.toISOString(),
    canonicalCoordinate: 'pdfPageIndex',
    sourceNodeCount: params.preview.summary.sourceNodeCount,
    semanticItemCount: params.preview.summary.semanticItemCount,
    unchanged: params.preview.summary.unchanged,
    reparented: params.preview.summary.reparented,
    orphaned: params.preview.summary.orphaned,
    ambiguous: params.preview.summary.ambiguous,
    backupFile: path.basename(backupPath),
  };

  await fs.promises.copyFile(absoluteDocumentPath, backupPath, fs.constants.COPYFILE_EXCL);
  try {
    await fs.promises.writeFile(tempPath, JSON.stringify(candidate, null, 2), {
      encoding: 'utf8',
      flag: 'wx',
    });
    const tempDocument = JSON.parse(
      await fs.promises.readFile(tempPath, 'utf8')
    ) as PipelineDocument;
    const tempErrors = validateCandidate(tempDocument);
    if (tempErrors.length > 0) {
      throw new Error(`Temp document failed structural validation: ${tempErrors.join('; ')}`);
    }

    await fs.promises.rename(tempPath, absoluteDocumentPath);

    const persisted = JSON.parse(
      await fs.promises.readFile(absoluteDocumentPath, 'utf8')
    ) as PipelineDocument;
    const persistedErrors = validateCandidate(persisted);
    if (persistedErrors.length > 0) {
      throw new Error(
        `Persisted document failed structural validation: ${persistedErrors.join('; ')}`
      );
    }
    return { document: persisted, backupPath };
  } catch (error) {
    await fs.promises.rm(tempPath, { force: true });
    throw error;
  }
}
