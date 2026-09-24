/**
 * Shared TypeScript types for the AI Content Pipeline (Sprint 01).
 *
 * These types are the single source of truth for:
 *   - Frontend components (read-only import from client components)
 *   - API route handlers (server-side only)
 *   - Pipeline service (server-side only)
 *
 * IMPORTANT:
 *   - Future fields (examFrequency, importanceScore, masteryWeight, etc.)
 *     are intentionally omitted. They come from exam imports, not textbook extraction.
 *   - The textbook NEVER decides importance — exams do.
 *   - Textbook extraction is NOT the canonical curriculum. Extracted items are
 *     linked to canonical KnowledgeUnits via TextbookMapping records.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline State Machine
// ─────────────────────────────────────────────────────────────────────────────

export type TextbookPipelineStage =
  | 'UPLOADED'
  | 'DOCUMENT_ANALYSIS'
  | 'TOC_DETECTION'
  | 'STRUCTURE_DETECTION'
  | 'BATCH_SPLITTING'
  | 'BATCH_EXTRACTION'
  | 'EXTRACTING'
  | 'MERGING'
  | 'STRUCTURE_VALIDATION'
  | 'READY_FOR_REVIEW'
  | 'PUBLISHED'
  | 'FAILED';

export type PipelineExecutionStatus =
  'NOT_STARTED' | 'QUEUED' | 'RUNNING' | 'FAILED' | 'COMPLETED' | 'INTERRUPTED';

export type PipelineEventStatus =
  'STARTED' | 'PROGRESS' | 'COMPLETED' | 'WARNING' | 'FAILED' | 'RETRYING';

export type PipelineEventType =
  | 'PIPELINE_STARTED'
  | 'PIPELINE_COMPLETED'
  | 'PIPELINE_INTERRUPTED'
  | 'STAGE_STARTED'
  | 'STAGE_COMPLETED'
  | 'STAGE_FAILED';

export interface PipelineEvent {
  id: string;
  pipelineDocumentId: string;
  type: PipelineEventType;
  stage: TextbookPipelineStage;
  status: PipelineEventStatus;
  message: string;
  progress?: number;
  batchIndex?: number;
  batchCount?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch Job State Machine
// ─────────────────────────────────────────────────────────────────────────────

export type BatchState = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';

// ─────────────────────────────────────────────────────────────────────────────
// Node Types (Knowledge Graph)
// ─────────────────────────────────────────────────────────────────────────────

export type NodeType =
  | 'SUBJECT'
  | 'CHAPTER'
  | 'LESSON'
  | 'TOPIC'
  | 'DEFINITION'
  | 'FORMULA'
  | 'THEOREM'
  | 'EXAMPLE'
  | 'EXERCISE';

// Only TOPIC+ nodes carry AI metadata; SUBJECT/CHAPTER/LESSON are structural.
// Node status within the admin review flow:
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

// ─────────────────────────────────────────────────────────────────────────────
// Document Metadata (Step 1 & 2 — Document Analysis)
// ─────────────────────────────────────────────────────────────────────────────

export interface DocumentAnalysis {
  title: string;
  subject: string;
  grade: string;
  publisher: string;
  edition: string;
  language: string;
  estimatedChapters: number;
  estimatedLessons: number;
  hasTableOfContents: boolean;
  pageCount: number;
  coverPage: number | null;
  tocPages: number[];
  appendixPages: number[];
  exercisePages: number[];
  confidence: number; // 0–1
}

// ─────────────────────────────────────────────────────────────────────────────
// TOC Entry (Step 3 — TOC Detection)
// ─────────────────────────────────────────────────────────────────────────────

export type TocEntryType =
  'cover' | 'preface' | 'toc' | 'chapter' | 'lesson' | 'exercise' | 'appendix' | 'glossary';

export interface TocEntry {
  type: TocEntryType;
  title: string;
  startPage: number;
  endPage: number;
  confidence: number; // 0–1
}

export interface PageCoordinate {
  /** Canonical, 1-based page position in the physical PDF. */
  pdfPageIndex: number;
  /** Number printed on the textbook page; display metadata only. */
  printedPageNumber?: number;
  /** 0-based source image position when pages were rendered to images. */
  sourceImageIndex?: number;
}

export interface PageNumberMapping {
  /** pdfPageIndex = printedPageNumber + printedToPdfOffset */
  printedToPdfOffset: number;
  confidence: number;
  evidence: string;
}

export interface StructuralBatchContext {
  chapterId: string;
  chapterTitle: string;
  lessonId: string;
  lessonTitle: string;
  pageStart: number;
  pageEnd: number;
}

export type StructureStatus = 'RESOLVED' | 'NEEDS_STRUCTURE_REVIEW' | 'STRUCTURE_CONFLICT';

export interface StructuralReviewHistoryEntry {
  previousParentId?: string;
  newParentId?: string;
  reviewedBy: string;
  reviewedAt: string;
  reason?: string;
  action: 'MANUAL_REPARENT' | 'MANUAL_RESET';
}

export interface ManualStructureOverride {
  lessonId: string;
  reviewedBy: string;
  reviewedAt: string;
  reason?: string;
}

export interface BodyHeadingEvidence {
  heading: string;
  pageCoordinate: PageCoordinate;
  confidence: number;
  suggestedLessonId?: string;
}

export interface StructureConflictEvidence {
  tocEvidence: {
    lessonId: string;
    lessonTitle: string;
    pageStart: number;
    pageEnd: number;
    confidence: number;
  };
  bodyHeadingEvidence: BodyHeadingEvidence;
  pageEvidence: PageCoordinate;
  confidence: number;
}

export interface StructuralRepairMetadata {
  version: 1;
  appliedAt: string;
  canonicalCoordinate: 'pdfPageIndex';
  sourceNodeCount: number;
  semanticItemCount: number;
  unchanged: number;
  reparented: number;
  orphaned: number;
  ambiguous: number;
  backupFile?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch Definition (Step 4 — Split Document)
// ─────────────────────────────────────────────────────────────────────────────

export interface Batch {
  id: string;
  batchIndex: number; // 0-based
  startPage: number;
  endPage: number;
  state: BatchState;
  retryCount: number;
  maxRetries: number; // 3
  errorMessage?: string;
  /** Immutable ownership supplied before semantic extraction. */
  structureContext?: readonly StructuralBatchContext[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge Item (Step 6 — Knowledge Extraction, per batch)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Curriculum Mapping Types
// Textbook items are linked to canonical curriculum KnowledgeUnits.
// The canonical curriculum is NEVER modified by textbook extraction.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Status of a single mapping between an extracted textbook item
 * and a canonical curriculum KnowledgeUnit.
 */
export type MappingStatus =
  | 'UNMAPPED' // No mapping exists yet
  | 'SUGGESTED' // AI/algorithm suggestion, not yet reviewed (confidence >= 0.9)
  | 'NEEDS_REVIEW' // Low-confidence suggestion (0.7–0.89), admin must decide
  | 'APPROVED' // Admin explicitly approved this mapping
  | 'REJECTED' // Admin explicitly rejected this mapping
  | 'CREATE_NEW'; // Admin decided to create a new canonical knowledge unit

/**
 * The semantic relationship between an extracted textbook item
 * and a canonical curriculum knowledge unit.
 */
export type MappingRelationType =
  | 'EXPLAINS' // The textbook item explains this curriculum concept
  | 'DEFINES' // The textbook item defines a term in the curriculum
  | 'EXAMPLE_OF' // The textbook item is an example of this concept
  | 'FORMULA_FOR' // The textbook item provides a formula for this concept
  | 'EXERCISE_FOR' // The textbook item is an exercise for this concept
  | 'EXTENDS' // The textbook item extends/deepens this concept
  | 'RELATED_TO'; // The textbook item is related but not directly mapping

/**
 * Algorithm used to generate a mapping suggestion.
 * Deterministic methods are preferred over AI fallback.
 */
export type MappingMatchMethod = 'EXACT' | 'ALIAS' | 'FUZZY' | 'CONTEXT' | 'AI' | 'MANUAL';

/**
 * A single mapping record linking one extracted KnowledgeItem
 * to one canonical curriculum KnowledgeUnit.
 * One item may have multiple mappings (join table semantics).
 */
export interface TextbookMapping {
  id: string;
  /** References a KgConcept.id in the canonical Knowledge Graph */
  kgConceptId: string;
  kgConceptTitleSnapshot: string;
  kgBreadcrumbSnapshot: string;
  relationType: MappingRelationType;
  /** 0–1 confidence score from the matching algorithm */
  confidence: number;
  status: MappingStatus;
  /** How this mapping was generated */
  matchMethod?: MappingMatchMethod;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

/**
 * A suggestion returned by the mapping algorithm before the admin reviews it.
 * Includes enough context for the admin to make a decision without leaving the page.
 */
export interface MappingSuggestion {
  kgConceptId: string;
  kgTitle: string;
  /** Human-readable breadcrumb: "Toán học / Lớp 12 / Giải tích / Đạo hàm" */
  breadcrumb: string;
  confidence: number;
  relationType: MappingRelationType;
  matchMethod: MappingMatchMethod;
}

/** Aggregate mapping progress for a full document. */
export interface MappingProgress {
  total: number;
  mapped: number; // SUGGESTED + NEEDS_REVIEW + APPROVED + CREATE_NEW
  approved: number;
  needsReview: number;
  unmapped: number;
  completionPct: number; // approved / total * 100
}

/** Codes for publish pre-flight validation errors. */
export type MappingValidationErrorCode =
  | 'UNMAPPED_REQUIRED' // A topic-level item has no mapping at all
  | 'INVALID_KG_REF' // Mapping references a non-existent curriculum unit
  | 'DUPLICATE_MAPPING' // Two items map to the same curriculum unit with the same type
  | 'REJECTED_MAPPING'; // All mappings for a required item are rejected

export interface MappingValidationError {
  nodeId: string;
  nodeTitle: string;
  code: MappingValidationErrorCode;
  message: string;
}

export interface MappingValidationResult {
  valid: boolean;
  errors: MappingValidationError[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge Item (Step 6 — Knowledge Extraction, per batch)
// ─────────────────────────────────────────────────────────────────────────────

export type MappingDisposition = 'REQUIRED' | 'IRRELEVANT';

export interface KnowledgeItem {
  id: string;
  nodeType: NodeType;
  title: string;
  description: string;

  // AI-extracted fields (only for TOPIC+ nodes)
  topics: string[];
  definitions: string[];
  concepts: string[];
  learningObjectives: string[];
  examples: string[];
  theorems: string[];
  formulas: string[];
  skills: string[];
  realWorldApplications: string[];

  // Prerequisite references (other extracted node IDs, resolved after merge)
  prerequisites: string[];
  pageRange: { start: number; end: number };
  pageCoordinate?: PageCoordinate;
  endPageCoordinate?: PageCoordinate;
  batchId?: string;
  localOrder?: number;
  estimatedDifficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedStudyMinutes: number;
  confidence: number; // 0–1
  /** Semantic classification confidence. Kept separate from ownership confidence. */
  semanticConfidence?: number;
  structureConfidence?: number;
  structureStatus?: StructureStatus;
  structureWarning?: string;
  chapterId?: string;
  lessonId?: string;
  parentId?: string;
  manualStructureOverride?: ManualStructureOverride;
  structuralReviewHistory?: StructuralReviewHistoryEntry[];
  bodyHeadingEvidence?: BodyHeadingEvidence;
  structureConflictEvidence?: StructureConflictEvidence;

  // Review metadata
  reviewStatus: ReviewStatus;
  reviewNote?: string;

  /**
   * Indicates if this extracted item actually needs a curriculum mapping.
   * By default, all extracted knowledge is considered REQUIRED.
   * If marked IRRELEVANT, it won't block publishing if unmapped.
   */
  mappingDisposition?: MappingDisposition;

  /**
   * Curriculum mappings for this extracted item.
   * Empty by default. Populated during the mapping/review workflow.
   * The canonical curriculum is NEVER modified — only these references are stored.
   */
  kgMappings: TextbookMapping[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Extracted Chapter (result of merging one batch's knowledge items)
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractedChapter {
  id: string;
  title: string;
  chapterNumber: string;
  startPage: number;
  endPage: number;
  confidence: number;
  reviewStatus: ReviewStatus;
  lessons: ExtractedLesson[];
  rawItems: KnowledgeItem[]; // all items from batch
  structureConfidence?: number;
}

export interface ExtractedLesson {
  id: string;
  title: string;
  lessonNumber: string;
  startPage: number;
  endPage: number;
  confidence: number;
  reviewStatus: ReviewStatus;
  topics: KnowledgeItem[]; // items of type TOPIC
  definitions: KnowledgeItem[];
  formulas: KnowledgeItem[];
  theorems: KnowledgeItem[];
  examples: KnowledgeItem[];
  exercises: KnowledgeItem[];
  // Prerequisite edges (nodeId → nodeId)
  prerequisites: Array<{ fromId: string; toId: string }>;
  chapterId?: string;
  structureConfidence?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Pipeline Document (stored in DB / file system)
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelineDocument {
  id: string; // UUID, stable identifier
  fileName: string;
  fileSizeBytes: number;
  storagePath: string; // relative path in uploads/

  // Pipeline state
  state: TextbookPipelineStage;
  executionStatus?: PipelineExecutionStatus;
  errorMessage?: string;
  errorCode?: string;

  // Step 2 output
  analysis?: DocumentAnalysis;

  // Step 3 output
  tocEntries?: TocEntry[];
  pageNumberMapping?: PageNumberMapping;
  structuralRepair?: StructuralRepairMetadata;

  // Step 4 output
  batches: Batch[];

  // Step 6 output (per-batch extraction results, keyed by batchId)
  batchResults: Record<string, KnowledgeItem[]>;

  // Step 8–10 output (merged graph)
  chapters: ExtractedChapter[];

  // Duplicate suggestions (Step 10)
  duplicateGroups: DuplicateGroup[];

  // Timestamps
  createdAt: string; // ISO 8601
  updatedAt: string;
  startedAt?: string;
  stageStartedAt?: string;
  heartbeatAt?: string;
  completedAt?: string;
  publishedAt?: string;
  failedStage?: TextbookPipelineStage;
  failureAt?: string;
  attempt?: number;
}

export interface DuplicateGroup {
  ids: string[]; // 2+ node IDs that are likely duplicates
  suggestedAction: 'MERGE' | 'REVIEW';
  reason: string;
  confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Response Shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface UploadResponse {
  documentId: string;
  fileName: string;
  state: TextbookPipelineStage;
}

export interface PipelineTriggerResponse {
  documentId: string;
  pipelineDocumentId: string;
  status: 'STARTED' | 'ALREADY_RUNNING';
  executionStatus: PipelineExecutionStatus;
  stage: TextbookPipelineStage;
  alreadyRunning: boolean;
}

export interface DocumentStatusResponse {
  documentId: string;
  fileName: string;
  state: TextbookPipelineStage;
  progress: PipelineProgress;
  analysis?: DocumentAnalysis;
  chapters?: ExtractedChapter[];
  duplicateGroups?: DuplicateGroup[];
  errorMessage?: string;
  errorCode?: string;
  updatedAt: string;
}

/** Fractional progress per stage (0–100). */
export interface PipelineProgress {
  upload: number; // 0–100
  analysis: number; // 0–100
  extraction: number; // 0–100 (% of batches DONE / total batches)
  merge: number; // 0–100
  validation: number; // 0–100
  overall: number; // weighted average
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline Validation Errors (Step 12)
// ─────────────────────────────────────────────────────────────────────────────

export type ValidationErrorCode =
  | 'EMPTY_TITLE'
  | 'DUPLICATE_UUID'
  | 'CIRCULAR_PREREQUISITE'
  | 'INVALID_PAGE_RANGE'
  | 'LESSON_WITHOUT_CHAPTER'
  | 'TOPIC_WITHOUT_LESSON'
  | 'FORMULA_WITHOUT_TOPIC';

export interface ValidationError {
  code: ValidationErrorCode;
  nodeId: string;
  message: string;
}
