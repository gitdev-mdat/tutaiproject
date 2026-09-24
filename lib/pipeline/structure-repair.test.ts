import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { KnowledgeItem, PageNumberMapping, PipelineDocument, TocEntry } from './types';
import {
  applyManualStructureOverride,
  buildStructuralIntervalIndex,
  findContainingInterval,
  previewStructuralRepair,
  validateStructuralIntervalIndex,
} from './structure-repair';

const identityMapping: PageNumberMapping = {
  printedToPdfOffset: 0,
  confidence: 1,
  evidence: 'test uses canonical PDF pages',
};

const baseToc: TocEntry[] = [
  {
    type: 'chapter',
    title: 'CHƯƠNG I',
    startPage: 1,
    endPage: 20,
    confidence: 0.95,
  },
  { type: 'lesson', title: 'Bài 1', startPage: 3, endPage: 8, confidence: 0.95 },
  { type: 'lesson', title: 'Bài 2', startPage: 10, endPage: 15, confidence: 0.95 },
  {
    type: 'chapter',
    title: 'CHƯƠNG II',
    startPage: 21,
    endPage: 30,
    confidence: 0.95,
  },
  { type: 'lesson', title: 'Bài 3', startPage: 21, endPage: 25, confidence: 0.95 },
];

function makeItem(id: string, page: number, title = id): KnowledgeItem {
  return {
    id,
    nodeType: 'TOPIC',
    title,
    description: `Description for ${title}`,
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
    pageRange: { start: page, end: page },
    estimatedDifficulty: 'Intermediate',
    estimatedStudyMinutes: 10,
    confidence: 0.82,
    reviewStatus: 'pending',
    kgMappings: [],
  };
}

function makeDocument(
  batchResults: Record<string, KnowledgeItem[]>,
  tocEntries: TocEntry[] = baseToc
): PipelineDocument {
  return {
    id: 'doc-1',
    fileName: 'test.pdf',
    fileSizeBytes: 1,
    storagePath: 'test.pdf',
    state: 'READY_FOR_REVIEW',
    executionStatus: 'COMPLETED',
    tocEntries,
    pageNumberMapping: identityMapping,
    batches: [
      {
        id: 'batch-1',
        batchIndex: 0,
        startPage: 1,
        endPage: 20,
        state: 'DONE',
        retryCount: 0,
        maxRetries: 3,
      },
      {
        id: 'batch-2',
        batchIndex: 1,
        startPage: 21,
        endPage: 30,
        state: 'DONE',
        retryCount: 0,
        maxRetries: 3,
      },
    ],
    batchResults,
    chapters: [],
    duplicateGroups: [],
    createdAt: '2026-07-24T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
  };
}

describe('structural interval construction', () => {
  it('builds continuous, non-overlapping chapter and lesson intervals', () => {
    const index = buildStructuralIntervalIndex(baseToc);
    expect(index.chapters.map((chapter) => [chapter.startPdfPage, chapter.endPdfPage])).toEqual([
      [1, 20],
      [21, 30],
    ]);
    expect(index.lessons.map((lesson) => [lesson.startPdfPage, lesson.endPdfPage])).toEqual([
      [3, 9],
      [10, 20],
      [21, 30],
    ]);
    expect(validateStructuralIntervalIndex(index)).toEqual([]);
  });

  it('resolves first, last, and exact-next-start boundaries with upper-bound lookup', () => {
    const index = buildStructuralIntervalIndex(baseToc);
    expect(findContainingInterval(index.lessons, 3)?.title).toBe('Bài 1');
    expect(findContainingInterval(index.lessons, 9)?.title).toBe('Bài 1');
    expect(findContainingInterval(index.lessons, 10)?.title).toBe('Bài 2');
    expect(findContainingInterval(index.lessons, 30)?.title).toBe('Bài 3');
  });

  it('does not invent a lesson for pages before the first lesson or after the final chapter', () => {
    const index = buildStructuralIntervalIndex(baseToc);
    expect(findContainingInterval(index.lessons, 1)).toBeUndefined();
    expect(findContainingInterval(index.lessons, 31)).toBeUndefined();
  });

  it('rejects overlapping intervals and lessons outside their chapter', () => {
    const index = buildStructuralIntervalIndex(baseToc);
    const overlap = {
      ...index,
      lessons: [{ ...index.lessons[0], endPdfPage: 11 }, index.lessons[1], index.lessons[2]],
    };
    expect(validateStructuralIntervalIndex(overlap)).toContain('Lesson "Bài 1" overlaps "Bài 2"');

    const outside = {
      ...index,
      lessons: [{ ...index.lessons[0], startPdfPage: 0 }, ...index.lessons.slice(1)],
    };
    expect(
      validateStructuralIntervalIndex(outside).some((error) => error.includes('is outside chapter'))
    ).toBe(true);
  });
});

describe('deterministic structural repair', () => {
  it('maps printed pages to canonical PDF indexes without comparing the coordinates directly', () => {
    const document = makeDocument({ 'batch-1': [makeItem('offset', 1)] }, [
      {
        type: 'chapter',
        title: 'CHƯƠNG I',
        startPage: 3,
        endPage: 10,
        confidence: 1,
      },
      { type: 'lesson', title: 'Bài 1', startPage: 3, endPage: 10, confidence: 1 },
    ]);
    const preview = previewStructuralRepair(document, {
      printedToPdfOffset: 2,
      confidence: 0.99,
      evidence: 'PDF page 3 displays printed page 1',
    });
    const repaired = preview.projectedDocument.batchResults['batch-1'][0];
    expect(repaired.pageRange.start).toBe(1);
    expect(repaired.pageCoordinate).toEqual({
      pdfPageIndex: 3,
      printedPageNumber: 1,
      sourceImageIndex: 2,
    });
  });

  it('uses stable (pdfPageIndex, localOrder) ordering independent of batch completion order', () => {
    const document = makeDocument({
      'batch-2': [makeItem('later', 22)],
      'batch-1': [makeItem('same-b', 5), makeItem('same-a', 5), makeItem('early', 3)],
    });
    const preview = previewStructuralRepair(document);
    const all = preview.projectedDocument.chapters.flatMap((chapter) =>
      chapter.lessons.flatMap((lesson) => lesson.topics)
    );
    expect(all.map((item) => item.id)).toEqual(['early', 'same-b', 'same-a', 'later']);
  });

  it('reparents deterministically, keeps confidence meanings separate, and is idempotent', () => {
    const document = makeDocument({ 'batch-1': [makeItem('item', 10)] });
    const first = previewStructuralRepair(document);
    const item = first.projectedDocument.batchResults['batch-1'][0];
    expect(item.lessonId).toBe(first.index.lessons[1].id);
    expect(item.semanticConfidence).toBe(0.82);
    expect(item.structureConfidence).toBe(0.95);

    const second = previewStructuralRepair(first.projectedDocument);
    expect(second.summary.reparented).toBe(0);
    expect(second.projectedDocument.batchResults).toEqual(first.projectedDocument.batchResults);
    expect(second.projectedDocument.chapters).toEqual(first.projectedDocument.chapters);
  });

  it('preserves a manual override and appends immutable review history until reset', () => {
    const automatic = previewStructuralRepair(makeDocument({ 'batch-1': [makeItem('manual', 3)] }));
    const targetLesson = automatic.index.lessons[1];
    const manual = applyManualStructureOverride({
      source: automatic.projectedDocument,
      itemId: 'manual',
      newLessonId: targetLesson.id,
      reviewedBy: 'tester',
      reviewedAt: '2026-07-24T01:00:00.000Z',
      reason: 'Body heading verified',
    });
    const item = manual.projectedDocument.batchResults['batch-1'][0];
    expect(item.lessonId).toBe(targetLesson.id);
    expect(item.structureConfidence).toBe(1);
    expect(item.structuralReviewHistory).toHaveLength(1);

    const repeated = previewStructuralRepair(manual.projectedDocument);
    expect(repeated.projectedDocument.batchResults['batch-1'][0].lessonId).toBe(targetLesson.id);
  });

  it('records TOC versus body-heading disagreement as STRUCTURE_CONFLICT evidence', () => {
    const index = buildStructuralIntervalIndex(baseToc);
    const conflicting = makeItem('conflict', 3);
    conflicting.bodyHeadingEvidence = {
      heading: 'Body says the next lesson',
      pageCoordinate: { pdfPageIndex: 3, sourceImageIndex: 2 },
      confidence: 0.9,
      suggestedLessonId: index.lessons[1].id,
    };
    const preview = previewStructuralRepair(makeDocument({ 'batch-1': [conflicting] }));
    const item = preview.projectedDocument.batchResults['batch-1'][0];
    expect(item.structureStatus).toBe('STRUCTURE_CONFLICT');
    expect(item.structureConflictEvidence).toMatchObject({
      tocEvidence: { lessonId: index.lessons[0].id },
      bodyHeadingEvidence: { suggestedLessonId: index.lessons[1].id },
    });
    expect(preview.summary.ambiguous).toBe(1);
  });
});

describe('real textbook regression', () => {
  const documentPath = path.join(
    process.cwd(),
    'tmp',
    'uploads',
    'mryei32t-0fybu39',
    'document.json'
  );

  it.skipIf(!fs.existsSync(documentPath))(
    'repairs all real source nodes from page intervals without a synthetic orphan lesson',
    () => {
      const document = JSON.parse(fs.readFileSync(documentPath, 'utf8')) as PipelineDocument;
      const preview = previewStructuralRepair(document, {
        printedToPdfOffset: 2,
        confidence: 1,
        evidence: 'Physical PDF page 6 displays printed page 4',
      });
      expect(preview.validationErrors).toEqual([]);
      expect(preview.summary).toMatchObject({
        sourceNodeCount: 51,
        semanticItemCount: 38,
        orphaned: 0,
        ambiguous: 0,
        discarded: 0,
      });
      expect(
        preview.projectedDocument.chapters.flatMap((chapter) =>
          chapter.lessons.map((lesson) => lesson.title)
        )
      ).not.toContain('Các nội dung khác');

      const horizontal = preview.audit.find((item) => item.title === 'Đường tiệm cận ngang');
      expect(horizontal?.resolvedParentTitle).toContain('Bài 3');
      expect(horizontal?.resolvedParentTitle).not.toContain('Bài 2');
      expect(horizontal?.pdfPageIndex).toBe(22);

      const lessonNumbers = preview.projectedDocument.chapters.map((chapter) =>
        chapter.lessons.map((lesson) => Number(lesson.lessonNumber.replace(/\D/g, '')))
      );
      expect(lessonNumbers).toEqual([
        [1, 2, 3, 4, 5],
        [6, 7, 8],
        [9, 10],
      ]);

      const chapterTwo = preview.index.chapters[1];
      const chapterThree = preview.index.chapters[2];
      expect(findContainingInterval(preview.index.lessons, 48)?.chapterId).toBe(chapterTwo.id);
      expect(findContainingInterval(preview.index.lessons, 77)?.chapterId).toBe(chapterThree.id);
    }
  );
});
