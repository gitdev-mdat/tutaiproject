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
  | 'UNKNOWN';

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
