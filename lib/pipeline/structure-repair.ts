import { createHash } from 'node:crypto';
import type {
  ExtractedChapter,
  ExtractedLesson,
  KnowledgeItem,
  PageCoordinate,
  PageNumberMapping,
  PipelineDocument,
  StructuralBatchContext,
  TocEntry,
} from './types';

const ITEM_BUCKETS = [
  'topics',
  'definitions',
  'formulas',
  'theorems',
  'examples',
  'exercises',
] as const;

type ItemBucket = (typeof ITEM_BUCKETS)[number];

export interface ChapterInterval {
  id: string;
  title: string;
  startPdfPage: number;
  endPdfPage: number;
  confidence: number;
}

export interface LessonInterval {
  id: string;
  chapterId: string;
  title: string;
  startPdfPage: number;
  endPdfPage: number;
  confidence: number;
}

export interface StructuralIntervalIndex {
  chapters: ChapterInterval[];
  lessons: LessonInterval[];
  chapterById: Map<string, ChapterInterval>;
  lessonById: Map<string, LessonInterval>;
}

export interface StructuralAuditItem {
  id: string;
  title: string;
  nodeType: KnowledgeItem['nodeType'];
  pdfPageIndex: number;
  printedPageNumber?: number;
  batchId: string;
  localOrder: number;
  currentParentId?: string;
  currentParentTitle?: string;
  resolvedParentId?: string;
  resolvedParentTitle?: string;
  changed: boolean;
  structureConfidence: number;
  structureStatus: NonNullable<KnowledgeItem['structureStatus']>;
  warning?: string;
}

export interface StructuralRepairSummary {
  sourceNodeCount: number;
  semanticItemCount: number;
  unchanged: number;
  reparented: number;
  orphaned: number;
  ambiguous: number;
  discarded: number;
}

export interface StructuralRepairPreview {
  projectedDocument: PipelineDocument;
  index: StructuralIntervalIndex;
  audit: StructuralAuditItem[];
  summary: StructuralRepairSummary;
  validationErrors: string[];
}

export interface BuildStructuralIndexOptions {
  existingChapters?: ExtractedChapter[];
  finalRelevantPdfPage?: number;
}

function stableStructuralId(prefix: 'chapter' | 'lesson', title: string, start: number): string {
  return `${prefix}-${createHash('sha256')
    .update(`${prefix}\u0000${title.normalize('NFC')}\u0000${start}`)
    .digest('hex')
    .slice(0, 20)}`;
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive, 1-based PDF page index`);
  }
}

function findExistingChapter(
  entry: TocEntry,
  existing: ExtractedChapter[]
): ExtractedChapter | undefined {
  return existing.find(
    (chapter) => chapter.title === entry.title || chapter.startPage === entry.startPage
  );
}

function findExistingLesson(
  entry: TocEntry,
  existing: ExtractedChapter[]
): ExtractedLesson | undefined {
  for (const chapter of existing) {
    const lesson = chapter.lessons.find(
      (candidate) => candidate.title === entry.title || candidate.startPage === entry.startPage
    );
    if (lesson && lesson.lessonNumber !== 'Orphan' && lesson.title !== 'Các nội dung khác') {
      return lesson;
    }
  }
  return undefined;
}

/**
 * Builds continuous ownership intervals from TOC start anchors. TOC end values
 * are not used as lesson ownership boundaries because exercise pages belong to
 * the preceding lesson until the next lesson begins.
 */
export function buildStructuralIntervalIndex(
  tocEntries: TocEntry[],
  options: BuildStructuralIndexOptions = {}
): StructuralIntervalIndex {
  const existing = options.existingChapters ?? [];
  const chapterEntries = tocEntries
    .filter((entry) => entry.type === 'chapter')
    .sort((a, b) => a.startPage - b.startPage);

  if (chapterEntries.length === 0) {
    throw new Error('Cannot build structural intervals without chapter TOC anchors');
  }

  const lastChapterEntry = chapterEntries[chapterEntries.length - 1];
  const finalRelevantPage = options.finalRelevantPdfPage ?? lastChapterEntry.endPage;
  assertPositiveInteger(finalRelevantPage, 'finalRelevantPdfPage');

  const chapters = chapterEntries.map<ChapterInterval>((entry, index) => {
    assertPositiveInteger(entry.startPage, `chapter "${entry.title}" startPage`);
    const next = chapterEntries[index + 1];
    const endPdfPage = next ? next.startPage - 1 : finalRelevantPage;
    const previous = findExistingChapter(entry, existing);
    return {
      id: previous?.id ?? stableStructuralId('chapter', entry.title, entry.startPage),
      title: entry.title,
      startPdfPage: entry.startPage,
      endPdfPage,
      confidence: entry.confidence,
    };
  });

  const lessonEntries = tocEntries
    .filter((entry) => entry.type === 'lesson')
    .sort((a, b) => a.startPage - b.startPage);
  const lessons: LessonInterval[] = [];
  let lessonCursor = 0;

  for (const chapter of chapters) {
    while (
      lessonCursor < lessonEntries.length &&
      lessonEntries[lessonCursor].startPage < chapter.startPdfPage
    ) {
      lessonCursor++;
    }
    const chapterLessons: TocEntry[] = [];
    while (
      lessonCursor < lessonEntries.length &&
      lessonEntries[lessonCursor].startPage <= chapter.endPdfPage
    ) {
      chapterLessons.push(lessonEntries[lessonCursor]);
      lessonCursor++;
    }
    for (let index = 0; index < chapterLessons.length; index++) {
      const entry = chapterLessons[index];
      const next = chapterLessons[index + 1];
      const endPdfPage = next ? next.startPage - 1 : chapter.endPdfPage;
      const previous = findExistingLesson(entry, existing);
      lessons.push({
        id: previous?.id ?? stableStructuralId('lesson', entry.title, entry.startPage),
        chapterId: chapter.id,
        title: entry.title,
        startPdfPage: entry.startPage,
        endPdfPage,
        confidence: Math.min(chapter.confidence, entry.confidence),
      });
    }
  }

  const index: StructuralIntervalIndex = {
    chapters,
    lessons,
    chapterById: new Map(chapters.map((chapter) => [chapter.id, chapter])),
    lessonById: new Map(lessons.map((lesson) => [lesson.id, lesson])),
  };
  const errors = validateStructuralIntervalIndex(index);
  if (errors.length > 0) {
    throw new Error(`Invalid structural intervals: ${errors.join('; ')}`);
  }
  return index;
}

export function validateStructuralIntervalIndex(index: StructuralIntervalIndex): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  const validateSiblings = (
    intervals: Array<{ id: string; title: string; startPdfPage: number; endPdfPage: number }>,
    label: string
  ) => {
    for (let i = 0; i < intervals.length; i++) {
      const interval = intervals[i];
      if (ids.has(interval.id)) errors.push(`Duplicate structural ID ${interval.id}`);
      ids.add(interval.id);
      if (interval.startPdfPage > interval.endPdfPage) {
        errors.push(`${label} "${interval.title}" has start after end`);
      }
      const next = intervals[i + 1];
      if (next && interval.endPdfPage >= next.startPdfPage) {
        errors.push(`${label} "${interval.title}" overlaps "${next.title}"`);
      }
    }
  };

  validateSiblings(index.chapters, 'Chapter');
  for (const chapter of index.chapters) {
    const chapterLessons = index.lessons.filter((lesson) => lesson.chapterId === chapter.id);
    validateSiblings(chapterLessons, 'Lesson');
    for (const lesson of chapterLessons) {
      if (lesson.startPdfPage < chapter.startPdfPage || lesson.endPdfPage > chapter.endPdfPage) {
        errors.push(`Lesson "${lesson.title}" is outside chapter "${chapter.title}"`);
      }
    }
  }

  return errors;
}

/** Upper-bound lookup: greatest interval start that is <= page, then end verification. */
export function findContainingInterval<T extends { startPdfPage: number; endPdfPage: number }>(
  intervals: readonly T[],
  pdfPageIndex: number
): T | undefined {
  let low = 0;
  let high = intervals.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (intervals[middle].startPdfPage <= pdfPageIndex) low = middle + 1;
    else high = middle;
  }
  const candidate = intervals[low - 1];
  return candidate && pdfPageIndex <= candidate.endPdfPage ? candidate : undefined;
}

function coordinateFromLegacyPage(
  printedPageNumber: number,
  mapping: PageNumberMapping
): PageCoordinate {
  const pdfPageIndex = printedPageNumber + mapping.printedToPdfOffset;
  assertPositiveInteger(pdfPageIndex, 'mapped pdfPageIndex');
  return {
    pdfPageIndex,
    printedPageNumber,
    sourceImageIndex: pdfPageIndex - 1,
  };
}

function existingParentLookup(doc: PipelineDocument): Map<string, { id: string; title: string }> {
  const lookup = new Map<string, { id: string; title: string }>();
  for (const chapter of doc.chapters) {
    for (const item of chapter.rawItems ?? []) {
      if (!lookup.has(item.id)) lookup.set(item.id, { id: chapter.id, title: chapter.title });
    }
    for (const lesson of chapter.lessons) {
      for (const bucket of ITEM_BUCKETS) {
        for (const item of lesson[bucket]) {
          lookup.set(item.id, { id: lesson.id, title: lesson.title });
        }
      }
    }
  }
  return lookup;
}

function bucketFor(item: KnowledgeItem): ItemBucket | undefined {
  switch (item.nodeType) {
    case 'TOPIC':
    case 'LESSON':
      return 'topics';
    case 'DEFINITION':
      return 'definitions';
    case 'FORMULA':
      return 'formulas';
    case 'THEOREM':
      return 'theorems';
    case 'EXAMPLE':
      return 'examples';
    case 'EXERCISE':
      return 'exercises';
    default:
      return undefined;
  }
}

function lessonNumberFromTitle(title: string, fallback: number): string {
  const match = title.match(/\bBài\s+(\d+)\b/i);
  return match ? `Bài ${match[1]}` : `Bài ${fallback}`;
}

function chapterNumberFromTitle(title: string, fallback: number): string {
  const match = title.match(/\bCHƯƠNG\s+([IVXLCDM]+|\d+)\b/i);
  return match ? match[1].toUpperCase() : String(fallback);
}

function emptyLessonBuckets(): Pick<
  ExtractedLesson,
  'topics' | 'definitions' | 'formulas' | 'theorems' | 'examples' | 'exercises'
> {
  return {
    topics: [],
    definitions: [],
    formulas: [],
    theorems: [],
    examples: [],
    exercises: [],
  };
}

function compareItems(a: KnowledgeItem, b: KnowledgeItem): number {
  return (
    (a.pageCoordinate?.pdfPageIndex ?? Number.MAX_SAFE_INTEGER) -
      (b.pageCoordinate?.pdfPageIndex ?? Number.MAX_SAFE_INTEGER) ||
    (a.localOrder ?? Number.MAX_SAFE_INTEGER) - (b.localOrder ?? Number.MAX_SAFE_INTEGER) ||
    a.id.localeCompare(b.id)
  );
}

function cloneDocument(doc: PipelineDocument): PipelineDocument {
  return JSON.parse(JSON.stringify(doc)) as PipelineDocument;
}

export function previewStructuralRepair(
  source: PipelineDocument,
  mapping: PageNumberMapping = source.pageNumberMapping ?? {
    printedToPdfOffset: 0,
    confidence: 0.5,
    evidence: 'Legacy identity mapping; verify before persistence',
  }
): StructuralRepairPreview {
  const projected = cloneDocument(source);
  projected.pageNumberMapping = { ...mapping };

  const lastChapterEnd = Math.max(
    ...(projected.tocEntries ?? [])
      .filter((entry) => entry.type === 'chapter')
      .map((entry) => entry.endPage)
  );
  const index = buildStructuralIntervalIndex(projected.tocEntries ?? [], {
    existingChapters: projected.chapters,
    finalRelevantPdfPage: lastChapterEnd,
  });
  const oldParents = existingParentLookup(source);
  const batchById = new Map(projected.batches.map((batch) => [batch.id, batch]));
  const audit: StructuralAuditItem[] = [];
  const resolvedItems: KnowledgeItem[] = [];

  const sortedBatchResults = Object.entries(projected.batchResults).sort(
    ([leftId], [rightId]) =>
      (batchById.get(leftId)?.batchIndex ?? Number.MAX_SAFE_INTEGER) -
        (batchById.get(rightId)?.batchIndex ?? Number.MAX_SAFE_INTEGER) ||
      leftId.localeCompare(rightId)
  );

  for (const [batchId, items] of sortedBatchResults) {
    for (let localOrder = 0; localOrder < items.length; localOrder++) {
      const item = items[localOrder];
      const pageCoordinate =
        item.pageCoordinate ?? coordinateFromLegacyPage(item.pageRange.start, mapping);
      const endPageCoordinate =
        item.endPageCoordinate ?? coordinateFromLegacyPage(item.pageRange.end, mapping);
      const chapter = findContainingInterval(index.chapters, pageCoordinate.pdfPageIndex);
      const automaticLesson = findContainingInterval(index.lessons, pageCoordinate.pdfPageIndex);
      const manualLesson = item.manualStructureOverride
        ? index.lessonById.get(item.manualStructureOverride.lessonId)
        : undefined;
      const isChapterLevel = item.nodeType === 'SUBJECT' || item.nodeType === 'CHAPTER';
      const lesson = isChapterLevel ? undefined : (manualLesson ?? automaticLesson);
      const resolvedChapter = lesson ? index.chapterById.get(lesson.chapterId) : chapter;
      const invalidManualOverride = Boolean(item.manualStructureOverride && !manualLesson);
      const conflictingBodyHeading = Boolean(
        !manualLesson &&
        automaticLesson &&
        item.bodyHeadingEvidence?.suggestedLessonId &&
        item.bodyHeadingEvidence.suggestedLessonId !== automaticLesson.id
      );
      const resolvedParent = lesson ?? resolvedChapter;
      const structureStatus = invalidManualOverride
        ? 'NEEDS_STRUCTURE_REVIEW'
        : conflictingBodyHeading
          ? 'STRUCTURE_CONFLICT'
          : resolvedParent
            ? 'RESOLVED'
            : 'NEEDS_STRUCTURE_REVIEW';
      const warning = invalidManualOverride
        ? 'MANUAL_OVERRIDE_TARGET_MISSING'
        : conflictingBodyHeading
          ? 'TOC_BODY_HEADING_DISAGREEMENT'
          : !resolvedParent
            ? 'NO_CONTAINING_STRUCTURAL_INTERVAL'
            : manualLesson &&
                !(
                  pageCoordinate.pdfPageIndex >= manualLesson.startPdfPage &&
                  pageCoordinate.pdfPageIndex <= manualLesson.endPdfPage
                )
              ? 'MANUAL_OVERRIDE_OUTSIDE_AUTOMATIC_INTERVAL'
              : undefined;
      const structureConfidence = manualLesson
        ? 1
        : Math.round(
            Math.min(mapping.confidence, lesson?.confidence ?? resolvedChapter?.confidence ?? 0) *
              100
          ) / 100;

      item.pageCoordinate = pageCoordinate;
      item.endPageCoordinate = endPageCoordinate;
      item.batchId = batchId;
      item.localOrder = item.localOrder ?? localOrder;
      item.semanticConfidence = item.semanticConfidence ?? item.confidence;
      item.structureConfidence = structureConfidence;
      item.structureStatus = structureStatus;
      item.structureWarning = warning;
      item.structureConflictEvidence =
        conflictingBodyHeading && automaticLesson && item.bodyHeadingEvidence
          ? {
              tocEvidence: {
                lessonId: automaticLesson.id,
                lessonTitle: automaticLesson.title,
                pageStart: automaticLesson.startPdfPage,
                pageEnd: automaticLesson.endPdfPage,
                confidence: automaticLesson.confidence,
              },
              bodyHeadingEvidence: item.bodyHeadingEvidence,
              pageEvidence: pageCoordinate,
              confidence: Math.min(automaticLesson.confidence, item.bodyHeadingEvidence.confidence),
            }
          : undefined;
      item.chapterId = resolvedChapter?.id;
      item.lessonId = lesson?.id;
      item.parentId = resolvedParent?.id;
      resolvedItems.push(item);

      const currentParent = oldParents.get(item.id);
      audit.push({
        id: item.id,
        title: item.title,
        nodeType: item.nodeType,
        pdfPageIndex: pageCoordinate.pdfPageIndex,
        printedPageNumber: pageCoordinate.printedPageNumber,
        batchId,
        localOrder: item.localOrder,
        currentParentId: currentParent?.id,
        currentParentTitle: currentParent?.title,
        resolvedParentId: resolvedParent?.id,
        resolvedParentTitle: resolvedParent?.title,
        changed: currentParent?.id !== resolvedParent?.id,
        structureConfidence,
        structureStatus,
        warning,
      });
    }
  }

  resolvedItems.sort(compareItems);
  const existingChapterById = new Map(projected.chapters.map((chapter) => [chapter.id, chapter]));
  const existingLessonById = new Map(
    projected.chapters.flatMap((chapter) =>
      chapter.lessons.map((lesson) => [lesson.id, lesson] as const)
    )
  );
  const itemsByLesson = new Map<string, KnowledgeItem[]>();
  const itemsByChapter = new Map<string, KnowledgeItem[]>();

  for (const item of resolvedItems) {
    if (item.chapterId) {
      const chapterItems = itemsByChapter.get(item.chapterId) ?? [];
      chapterItems.push(item);
      itemsByChapter.set(item.chapterId, chapterItems);
    }
    if (item.lessonId) {
      const lessonItems = itemsByLesson.get(item.lessonId) ?? [];
      lessonItems.push(item);
      itemsByLesson.set(item.lessonId, lessonItems);
    }
  }

  projected.chapters = index.chapters.map<ExtractedChapter>((chapter, chapterIndex) => {
    const previous = existingChapterById.get(chapter.id);
    const lessonIntervals = index.lessons.filter((lesson) => lesson.chapterId === chapter.id);
    const lessons = lessonIntervals.map<ExtractedLesson>((lesson, lessonIndex) => {
      const oldLesson = existingLessonById.get(lesson.id);
      const result: ExtractedLesson = {
        id: lesson.id,
        title: lesson.title,
        lessonNumber: lessonNumberFromTitle(lesson.title, lessonIndex + 1),
        startPage: lesson.startPdfPage,
        endPage: lesson.endPdfPage,
        confidence: oldLesson?.confidence ?? lesson.confidence,
        structureConfidence: lesson.confidence,
        reviewStatus: oldLesson?.reviewStatus ?? 'pending',
        chapterId: chapter.id,
        ...emptyLessonBuckets(),
        prerequisites: oldLesson?.prerequisites ?? [],
      };
      for (const item of itemsByLesson.get(lesson.id) ?? []) {
        const bucket = bucketFor(item);
        if (bucket) result[bucket].push(item);
      }
      for (const bucket of ITEM_BUCKETS) result[bucket].sort(compareItems);
      return result;
    });

    return {
      id: chapter.id,
      title: chapter.title,
      chapterNumber: chapterNumberFromTitle(chapter.title, chapterIndex + 1),
      startPage: chapter.startPdfPage,
      endPage: chapter.endPdfPage,
      confidence: previous?.confidence ?? chapter.confidence,
      structureConfidence: chapter.confidence,
      reviewStatus: previous?.reviewStatus ?? 'pending',
      lessons,
      rawItems: (itemsByChapter.get(chapter.id) ?? []).sort(compareItems),
    };
  });

  const summary: StructuralRepairSummary = {
    sourceNodeCount: index.chapters.length + index.lessons.length + audit.length,
    semanticItemCount: audit.length,
    unchanged: audit.filter((item) => !item.changed).length,
    reparented: audit.filter((item) => item.changed && item.structureStatus === 'RESOLVED').length,
    orphaned: audit.filter((item) => item.structureStatus === 'NEEDS_STRUCTURE_REVIEW').length,
    ambiguous: audit.filter((item) => item.structureStatus === 'STRUCTURE_CONFLICT').length,
    discarded: 0,
  };
  const validationErrors = validateProjectedStructure(projected, index);
  return { projectedDocument: projected, index, audit, summary, validationErrors };
}

export function validateProjectedStructure(
  doc: PipelineDocument,
  index: StructuralIntervalIndex
): string[] {
  const errors = [...validateStructuralIntervalIndex(index)];
  const chapterIds = new Set(doc.chapters.map((chapter) => chapter.id));
  const lessonIds = new Set(
    doc.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => lesson.id))
  );
  const seenItemIds = new Set<string>();

  for (const chapter of doc.chapters) {
    if (chapter.title === 'Các nội dung khác') {
      errors.push('Synthetic orphan chapter is forbidden');
    }
    for (const lesson of chapter.lessons) {
      if (lesson.title === 'Các nội dung khác' || lesson.lessonNumber === 'Orphan') {
        errors.push('Synthetic orphan lesson is forbidden');
      }
      if (lesson.chapterId !== chapter.id) {
        errors.push(`Lesson ${lesson.id} has a dangling chapterId`);
      }
      for (const bucket of ITEM_BUCKETS) {
        for (const item of lesson[bucket]) {
          if (seenItemIds.has(item.id)) errors.push(`Item ${item.id} belongs to multiple lessons`);
          seenItemIds.add(item.id);
          if (item.lessonId !== lesson.id || item.parentId !== lesson.id) {
            errors.push(`Item ${item.id} has inconsistent lesson ownership`);
          }
          if (!item.chapterId || !chapterIds.has(item.chapterId)) {
            errors.push(`Item ${item.id} has a dangling chapterId`);
          }
          const interval = index.lessonById.get(lesson.id);
          const page = item.pageCoordinate?.pdfPageIndex;
          const manual = item.manualStructureOverride?.lessonId === lesson.id;
          if (
            !manual &&
            interval &&
            page !== undefined &&
            (page < interval.startPdfPage || page > interval.endPdfPage)
          ) {
            errors.push(`Item ${item.id} page is outside lesson interval`);
          }
        }
      }
    }
  }

  for (const items of Object.values(doc.batchResults)) {
    for (const item of items) {
      if (item.chapterId && !chapterIds.has(item.chapterId)) {
        errors.push(`Item ${item.id} references missing chapter ${item.chapterId}`);
      }
      if (item.lessonId && !lessonIds.has(item.lessonId)) {
        errors.push(`Item ${item.id} references missing lesson ${item.lessonId}`);
      }
      if (
        bucketFor(item) &&
        item.structureStatus === 'RESOLVED' &&
        item.lessonId &&
        !seenItemIds.has(item.id)
      ) {
        errors.push(`Resolved item ${item.id} is missing from its lesson`);
      }
    }
  }

  return [...new Set(errors)];
}

export function buildBatchStructuralContext(
  batch: Pick<{ startPage: number; endPage: number }, 'startPage' | 'endPage'>,
  index: StructuralIntervalIndex
): readonly StructuralBatchContext[] {
  return Object.freeze(
    index.lessons
      .filter(
        (lesson) => lesson.startPdfPage <= batch.endPage && lesson.endPdfPage >= batch.startPage
      )
      .map((lesson) => {
        const chapter = index.chapterById.get(lesson.chapterId);
        if (!chapter) throw new Error(`Missing chapter ${lesson.chapterId}`);
        return Object.freeze({
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          pageStart: Math.max(batch.startPage, lesson.startPdfPage),
          pageEnd: Math.min(batch.endPage, lesson.endPdfPage),
        });
      })
  );
}

export function applyManualStructureOverride(params: {
  source: PipelineDocument;
  itemId: string;
  newLessonId?: string;
  reviewedBy: string;
  reviewedAt?: string;
  reason?: string;
}): StructuralRepairPreview {
  const source = cloneDocument(params.source);
  const index = buildStructuralIntervalIndex(source.tocEntries ?? [], {
    existingChapters: source.chapters,
    finalRelevantPdfPage: Math.max(
      ...(source.tocEntries ?? [])
        .filter((entry) => entry.type === 'chapter')
        .map((entry) => entry.endPage)
    ),
  });
  if (params.newLessonId && !index.lessonById.has(params.newLessonId)) {
    throw new Error('The selected lesson does not belong to this textbook');
  }

  const oldParents = existingParentLookup(source);
  const item = Object.values(source.batchResults)
    .flat()
    .find((candidate) => candidate.id === params.itemId);
  if (!item) throw new Error(`Item ${params.itemId} not found`);

  const reviewedAt = params.reviewedAt ?? new Date().toISOString();
  const previousParentId = item.manualStructureOverride?.lessonId ?? oldParents.get(item.id)?.id;
  item.structuralReviewHistory = [
    ...(item.structuralReviewHistory ?? []),
    {
      previousParentId,
      newParentId: params.newLessonId,
      reviewedBy: params.reviewedBy,
      reviewedAt,
      reason: params.reason,
      action: params.newLessonId ? 'MANUAL_REPARENT' : 'MANUAL_RESET',
    },
  ];
  item.manualStructureOverride = params.newLessonId
    ? {
        lessonId: params.newLessonId,
        reviewedBy: params.reviewedBy,
        reviewedAt,
        reason: params.reason,
      }
    : undefined;

  return previewStructuralRepair(source);
}
