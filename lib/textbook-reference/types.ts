export type TextbookProcessingStatus =
  'REGISTERED' | 'INDEXED' | 'EXTRACTING' | 'EXTRACTED' | 'FAILED';

export type PagePosition = 'LEFT' | 'RIGHT' | 'FULL' | 'UNCERTAIN';
export type VerificationStatus = 'OBSERVED' | 'NEEDS_REVIEW' | 'VERIFIED';
export type TocIndexCompleteness = 'PARTIAL' | 'COMPLETE';

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
  pdfPageCount: number;
  storageKey: string;
  status: TextbookProcessingStatus;
  importedAt: string;
  sourceVersion: string;
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
}

export interface TextbookExtractionJob {
  id: string;
  documentId: string;
  knowledgeNodeId: string;
  entryIds: string[];
  printedPages: number[];
  extractionKey: string;
  status: 'QUEUED' | 'RUNNING' | 'PARTIAL' | 'COMPLETED' | 'FAILED';
  attempts: number;
  provider: 'gemini' | 'manual';
  model?: string;
  pagesProcessed: number[];
  tokenUsage?: { input?: number; output?: number };
  estimatedCostUsd?: number;
  cacheHit: boolean;
  durationMs?: number;
  error?: string;
  history?: Array<{
    status: TextbookExtractionJob['status'];
    attempts: number;
    error?: string;
    at: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface TextbookKnowledgeMapping {
  id: string;
  documentId: string;
  knowledgeNodeId: string;
  entryId: string;
  confidence: number;
  status: 'CANDIDATE' | 'CONFIRMED' | 'REJECTED';
  confirmationRequired: boolean;
  updatedAt: string;
}
