export type ImportSessionStatus =
  | 'UPLOADED'
  | 'PARSING'
  | 'REVIEW_REQUIRED'
  | 'READY_TO_COMMIT'
  | 'COMMITTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type ImportSourceType = 'JSON_FILE' | 'JSON_PASTE' | 'FUTURE_PDF' | 'FUTURE_AI';

export interface KnowledgeImportSession {
  id: string;
  sourceKey?: string;
  title: string;
  sourceType: ImportSourceType;
  sourceName?: string;
  sourceChecksum: string;

  status: ImportSessionStatus;

  rawPayloadLocation?: string;
  parserVersion: string;
  targetGraphVersion: string;

  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  committedAt?: string;

  summary: {
    totalCandidates: number;
    approved: number;
    rejected: number;
    unresolved: number;
    warnings: number;
    errors: number;
  };

  errorMessage?: string;
  navigationPath?: string;
  provenance?: Record<string, unknown>;
}

export type ImportCandidateEntity =
  'SUBJECT' | 'GRADE' | 'DOMAIN' | 'CONCEPT' | 'LEARNING_OBJECTIVE' | 'CONCEPT_RELATION';

export type ImportCandidateStatus =
  | 'PENDING'
  | 'AUTO_MATCHED'
  | 'NEEDS_REVIEW'
  | 'APPROVED_CREATE'
  | 'APPROVED_UPDATE'
  | 'APPROVED_LINK'
  | 'REJECTED'
  | 'CONVERT_TO_OBJECTIVE'
  | 'BLOCKED';

export interface ImportCandidate {
  id: string;
  sessionId: string;
  entityType: ImportCandidateEntity;

  sourceKey: string;
  sourceData: Record<string, unknown>;
  normalizedData: Record<string, unknown>;

  status: ImportCandidateStatus;

  matchedCanonicalId?: string;
  matchConfidence?: number;
  matchReasons: string[];

  validationErrors: string[];
  validationWarnings: string[];

  adminNote?: string;

  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeImportAuditEntry {
  id: string;
  sessionId: string;
  candidateId: string;
  action: 'CREATE' | 'UPDATE' | 'LINK' | 'REJECT' | 'CONVERT_TO_OBJECTIVE';

  entityType: ImportCandidateEntity;
  canonicalEntityId?: string;

  before?: unknown;
  after?: unknown;

  createdAt: string;
}

// JSON Schema Contract

export interface JsonImportSubject {
  sourceKey: string;
  title: string;
  grades: JsonImportGrade[];
}

export interface JsonImportGrade {
  sourceKey: string;
  title: string;
  gradeNumber: number;
  domains: JsonImportDomain[];
}

export interface JsonImportDomain {
  sourceKey: string;
  title: string;
  description?: string;
}

export interface JsonImportLearningObjective {
  sourceKey: string;
  bloomLevel: string;
  statement: string;
  order?: number;
}

export interface JsonImportConcept {
  sourceKey: string;
  title: string;
  aliases?: string[];
  primaryDomainSourceKey: string;
  shortDescription?: string;
  detailedDescription?: string;
  learningObjectives?: JsonImportLearningObjective[];
  provenance?: Record<string, unknown>;
}

export interface JsonImportRelation {
  sourceKey: string;
  type: string;
  sourceConceptSourceKey: string;
  targetConceptSourceKey: string;
  rationale?: string;
  strength?: number;
}

export interface KnowledgeImportFile {
  schemaVersion: string;
  source: {
    title: string;
    organization: string;
    version: string;
  };
  subjects: JsonImportSubject[];
  concepts: JsonImportConcept[];
  relations: JsonImportRelation[];
}
