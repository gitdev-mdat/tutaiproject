/**
 * Document lifecycle. Each step is a separate, visible state: an indexed book is
 * not extracted, an extracted artifact is not approved, and an approved artifact
 * is only an authoring reference, never student content.
 */
export type TextbookProcessingStatus =
  | 'VERIFYING' // uploaded; the worker still has to check checksum and page count
  | 'REGISTERED' // verified source PDF; no table of contents yet
  | 'INDEXING' // a table-of-contents job is queued or running
  | 'INDEXED' // table of contents available for mapping
  | 'FAILED';

export type PagePosition = 'LEFT' | 'RIGHT' | 'FULL' | 'UNCERTAIN';
export type VerificationStatus = 'OBSERVED' | 'NEEDS_REVIEW' | 'VERIFIED';
export type TocIndexCompleteness = 'PARTIAL' | 'COMPLETE';

/** How printed pages sit on PDF pages: one per PDF page, or two side by side. */
export type PageLayout = 'SINGLE' | 'TWO_UP';

export interface TextbookAnchor {
  printedPage: number;
  pdfPage: number;
  position: PagePosition;
  evidence: string;
}

export interface TextbookPageLocation {
  printedPage: number;
  pdfPage: number;
  position: PagePosition;
  /** Normalized crop rectangle in PDF page coordinates. */
  crop: { x: number; y: number; width: number; height: number };
  verification: VerificationStatus;
}

export interface TextbookTocEntry {
  id: string;
  parentId: string | null;
  originalHeading: string;
  normalizedHeading: string;
  level: number;
  printedStartPage: number | null;
  printedEndPage: number | null;
  locations: TextbookPageLocation[];
  status: VerificationStatus;
}

export interface TextbookDocumentRecord {
  id: string;
  originalFilename: string;
  title: string;
  sha256: string;
  byteSize?: number;
  /** Known once the worker has opened the stored file. */
  pdfPageCount: number | null;
  storageKey: string;
  status: TextbookProcessingStatus;
  importedAt: string;
  sourceVersion: string;
  pageLayout?: PageLayout;
  /** PDF pages that hold the printed table of contents, chosen by the Admin. */
  tocPdfPages?: number[];
  tocIndexCompleteness: TocIndexCompleteness;
  processingErrors: string[];
  scanDetection?: { sampledPdfPages: number[]; textCharacterCounts: number[]; scanned: boolean };
  anchors: TextbookAnchor[];
  tocEntries: TextbookTocEntry[];
}

export type ExtractedArtifactKind =
  'THEORY' | 'METHOD' | 'WORKED_EXAMPLE' | 'EXERCISE' | 'SOLUTION';
export type ArtifactReviewStatus = 'NEEDS_REVIEW' | 'APPROVED' | 'REJECTED';

/** One answer choice of a multiple-choice exercise, as printed. */
export interface ExerciseChoice {
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
}

/**
 * Which printed exercise set a question or solution belongs to, from the table
 * of contents: matching a solution to a question needs the set and problem
 * type, never the question number alone (numbers restart in every set).
 */
export interface ExerciseSetRef {
  /** Outline entry the extraction ran under (e.g. "Bài tập rèn luyện kỹ năng"). */
  entryId: string;
  heading: string;
  /** Level-2 ancestor ("I.I. Tính đơn điệu của hàm số"), the scope solutions are searched in. */
  chapterEntryId: string | null;
  /** Normalized problem type ("dạng 1"), from the outline or the printed solution heading. */
  problemType: string | null;
}

/**
 * Question/solution lifecycle, adapted to the artifact row instead of a separate
 * state machine. Only an Admin's decision is stored:
 * UNRESOLVED: no solution confirmed (the matcher's live suggestions are computed
 *   on read, see `practice-state.ts`: SUGGESTED / NEEDS_CONFIRMATION).
 * MATCHED: an Admin confirmed the printed solution; the answer is the book's.
 * ADMIN_VERIFIED: an Admin solved the question independently; the answer is theirs.
 * Practice eligibility (Question Bank import) is derived, never stored.
 */
export type SolutionStatus =
  'UNRESOLVED' | 'SUGGESTED' | 'NEEDS_CONFIRMATION' | 'MATCHED' | 'ADMIN_VERIFIED';

/** An exercise's answer is never guessed: it comes from a confirmed solution or an Admin. */
export type ExerciseAnswer =
  | { status: 'UNRESOLVED' }
  | { status: 'FROM_SOLUTION'; choice: string | null; solutionArtifactId: string }
  | { status: 'ADMIN_VERIFIED'; choice: string };

/** How an exercise's answer was verified, as recorded on the Question Bank question too. */
export type PracticeVerificationMethod =
  'TEXTBOOK_SOLUTION' | 'AUTO_VERIFIED_SOLUTION' | 'ADMIN_SOLVED';

/**
 * The Admin's practice decisions on one EXERCISE artifact. The extracted text
 * itself is never changed: corrections live in `draft` and go to the Question Bank.
 */
export interface ExercisePracticeRecord {
  verification?: {
    method: PracticeVerificationMethod;
    answer: string;
    solutionArtifactId: string | null;
    /** Evidence against the pairing that the Admin checked and accepted. */
    acknowledgedConflicts?: string[];
    /** Deterministic evidence recorded when the source match was verified automatically. */
    verificationSummary?: string[];
    by: string;
    at: string;
  };
  /** Solutions the Admin said are not this question's; never suggested again. */
  rejectedSolutionIds?: string[];
  /** Corrected stem, choices and explanation (LaTeX), saved without publishing anything. */
  draft?: { stem: string; choices: ExerciseChoice[]; explanation: string; by: string; at: string };
  /** The lesson the Admin assigned, overriding the suggestion. */
  lesson?: { lessonId: string; by: string; at: string };
  /** Question Bank question created from this exercise (stable mapping). */
  imported?: { questionId: string; lessonId: string; by: string; at: string };
}

export interface TextbookArtifact {
  id: string;
  documentId: string;
  entryId: string;
  kind: ExtractedArtifactKind;
  title: string;
  content: string;
  mathematicalNotation: string[];
  printedPages: number[];
  pdfPages: number[];
  exerciseReference?: string;
  solutionReference?: string;
  pairedArtifactId?: string;
  /** EXERCISE/SOLUTION: printed question number ("3"), as seen on the page. */
  questionNumber?: string;
  /** EXERCISE: printed A–D choices, when the question is multiple choice. */
  choices?: ExerciseChoice[];
  /** The question relies on a figure, graph or table that is not reproduced as text. */
  hasDiagram?: boolean;
  exerciseSet?: ExerciseSetRef;
  /** EXERCISE only. */
  solutionStatus?: SolutionStatus;
  answer?: ExerciseAnswer;
  /** SOLUTION only: the choice the printed solution selects ("Chọn A"), if it states one. */
  answerChoice?: string | null;
  /** EXERCISE only: the Admin's practice decisions (verification, lesson, import mapping). */
  practice?: ExercisePracticeRecord;
  /** Prompt version that produced the artifact. */
  promptVersion?: string;
  reviewStatus: ArtifactReviewStatus;
  verificationNotes: string[];
  extractionKey: string;
  createdAt: string;
  reviewedAt?: string;
}

export type TextbookJobErrorCode =
  | 'BILLING'
  | 'QUOTA'
  | 'AUTH'
  | 'MODEL'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'OUTPUT_LIMIT'
  | 'INTERRUPTED'
  | 'FILE'
  | 'REQUEST' // the provider rejected the request itself (HTTP 400): a defect on our side
  | 'INVALID_RESPONSE' // the provider answered, but not with usable structured data
  | 'UNREADABLE' // the provider could not read the scanned pages
  | 'UNKNOWN';

/**
 * What a finished extraction found. COMPLETE: every page read, every item valid.
 * PARTIAL: valid items were stored, but some item was rejected, cut off or a page
 * region was unreadable. EMPTY: the pages were read and hold nothing to extract.
 */
export type ExtractionOutcome = 'COMPLETE' | 'PARTIAL' | 'EMPTY';

export interface ExtractionPageReport {
  printedPage: number;
  status: 'READ' | 'PARTLY_READABLE' | 'UNREADABLE' | 'NO_EDUCATIONAL_CONTENT';
  note?: string;
}

/** Facts about one provider round trip, kept on the job for the diagnostics view. */
export interface ExtractionDiagnostics {
  promptVersion: string;
  images: Array<{
    printedPage: number;
    pdfPage: number;
    position: PagePosition;
    width: number;
    height: number;
  }>;
  finishReason?: string;
  responseChars: number;
  itemsReturned: number;
  itemsAccepted: number;
  rejectedItems: Array<{ reference: string; reason: string }>;
  unreadable: Array<{ printedPage: number; reference: string; reason: string }>;
  pageReports: ExtractionPageReport[];
  truncated: boolean;
  questions: number;
  solutionsMatched: number;
}

export type TextbookJobKind = 'VERIFY' | 'INDEX_TOC' | 'EXTRACT';
export type TextbookJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface TextbookExtractionJob {
  id: string;
  kind: TextbookJobKind;
  documentId: string;
  /** EXTRACT only. */
  knowledgeNodeId: string;
  entryIds: string[];
  printedPages: number[];
  /** INDEX_TOC only. */
  tocPdfPages?: number[];
  extractionKey: string;
  status: TextbookJobStatus;
  attempts: number;
  provider: 'gemini' | 'manual' | 'none';
  model?: string;
  /** Number of provider calls this job made; a cache hit makes none. */
  providerCalls?: number;
  pagesProcessed: number[];
  tokenUsage?: { input?: number; output?: number };
  cacheHit: boolean;
  durationMs?: number;
  /** Plain-language reason shown to the Admin. */
  error?: string;
  /** Machine-readable failure class (see job-errors.ts). */
  errorCode?: TextbookJobErrorCode;
  /** Technical detail for the diagnostics section (provider status, no secrets). */
  errorDetail?: string;
  /** False when retrying cannot help until someone fixes the cause (billing, key, model). */
  retryable?: boolean;
  /** EXTRACT: prompt version the job was planned with; a retry with a newer one reads differently. */
  promptVersion?: string;
  /** EXTRACT, COMPLETED: what the pages yielded. */
  outcome?: ExtractionOutcome;
  diagnostics?: ExtractionDiagnostics;
  /** When the current or last attempt started (RUNNING jobs). */
  startedAt?: string;
  /** Lease expiry of a RUNNING job; past it the job counts as interrupted. */
  leaseUntil?: string | null;
  history?: Array<{ status: TextbookJobStatus; attempts: number; error?: string; at: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface TextbookKnowledgeMapping {
  id: string;
  documentId: string;
  knowledgeNodeId: string;
  entryId: string;
  confidence: number;
  status: 'CONFIRMED' | 'REJECTED';
  confirmationRequired: boolean;
  /**
   * Printed pages of the section this lesson uses, when the Admin narrowed them
   * (P1/P2 can split a section). Absent: the whole section, as the outline says.
   */
  printedStartPage?: number | null;
  printedEndPage?: number | null;
  updatedAt: string;
}

export interface TextbookUploadSession {
  id: string;
  sha256: string;
  byteSize: number;
  originalFilename: string;
  title: string;
  storageKey: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  documentId: string | null;
  expiresAt: string;
}

export interface TextbookWorkerStatus {
  online: boolean;
  lastSeenAt: string | null;
  currentJobId: string | null;
}
