import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { KnowledgeItem, PipelineDocument } from './types';
import { previewStructuralRepair } from './structure-repair';
import { persistStructuralRepairAtomically } from './structural-repair-storage';

const createdDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdDirectories
      .splice(0)
      .map((directory) => fs.promises.rm(directory, { recursive: true, force: true }))
  );
});

function item(): KnowledgeItem {
  return {
    id: 'item',
    nodeType: 'TOPIC',
    title: 'Topic',
    description: 'Description',
    topics: [],
    definitions: [],
    concepts: [],
    learningObjectives: [],
    examples: [],
    theorems: [],
    formulas: [],
    skills: [],
    realWorldApplications: [],
    prerequisites: [],
    pageRange: { start: 1, end: 1 },
    estimatedDifficulty: 'Beginner',
    estimatedStudyMinutes: 5,
    confidence: 0.9,
    reviewStatus: 'pending',
    kgMappings: [],
  };
}

function document(): PipelineDocument {
  return {
    id: 'atomic',
    fileName: 'atomic.pdf',
    fileSizeBytes: 1,
    storagePath: 'atomic.pdf',
    state: 'READY_FOR_REVIEW',
    tocEntries: [
      { type: 'chapter', title: 'CHƯƠNG I', startPage: 1, endPage: 2, confidence: 1 },
      { type: 'lesson', title: 'Bài 1', startPage: 1, endPage: 2, confidence: 1 },
    ],
    pageNumberMapping: {
      printedToPdfOffset: 0,
      confidence: 1,
      evidence: 'test',
    },
    batches: [
      {
        id: 'batch',
        batchIndex: 0,
        startPage: 1,
        endPage: 2,
        state: 'DONE',
        retryCount: 0,
        maxRetries: 3,
      },
    ],
    batchResults: { batch: [item()] },
    chapters: [],
    duplicateGroups: [],
    createdAt: '2026-07-24T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
  };
}

describe('atomic structural repair persistence', () => {
  it('validates a temp file, retains a backup, atomically replaces, and revalidates', async () => {
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tutai-structure-'));
    createdDirectories.push(directory);
    const documentPath = path.join(directory, 'document.json');
    await fs.promises.writeFile(documentPath, JSON.stringify(document()), 'utf8');
    const preview = previewStructuralRepair(document());

    const result = await persistStructuralRepairAtomically({
      documentPath,
      preview,
      now: new Date('2026-07-24T02:00:00.000Z'),
    });

    expect(fs.existsSync(result.backupPath)).toBe(true);
    expect(result.document.structuralRepair).toMatchObject({
      version: 1,
      canonicalCoordinate: 'pdfPageIndex',
      semanticItemCount: 1,
    });
    expect(fs.readdirSync(directory).some((name) => name.endsWith('.tmp'))).toBe(false);
  });

  it('refuses an invalid preview before touching the document', async () => {
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tutai-structure-'));
    createdDirectories.push(directory);
    const documentPath = path.join(directory, 'document.json');
    await fs.promises.writeFile(documentPath, JSON.stringify(document()), 'utf8');
    const preview = previewStructuralRepair(document());
    preview.validationErrors.push('forced test error');

    await expect(persistStructuralRepairAtomically({ documentPath, preview })).rejects.toThrow(
      'Refusing to persist invalid structural repair'
    );
    expect(fs.readdirSync(directory)).toEqual(['document.json']);
  });
});
