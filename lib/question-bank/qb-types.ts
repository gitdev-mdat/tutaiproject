/**
 * Question Bank — canonical domain types.
 *
 * Design principles:
 * - Access tier, editorial status, usage context, special status, and roadmap
 *   eligibility are independent dimensions — never collapsed into one field.
 * - No `any` types.
 * - All string-union enums are exported constants for exhaustive checking.
 */

// ─── Access Tier ──────────────────────────────────────────────────────────────

export const ACCESS_TIER_VALUES = ['OPEN', 'PLUS'] as const;
export type AccessTier = (typeof ACCESS_TIER_VALUES)[number];

// ─── Usage Contexts ───────────────────────────────────────────────────────────

export const USAGE_CONTEXT_VALUES = [
  'OPEN_PRACTICE',
  'PLUS_SPECIAL',
  'ROADMAP',
  'DIAGNOSTIC',
  'CHAPTER_REVIEW',
  'SEMESTER_EXAM',
  'NATIONAL_EXAM_MOCK',
] as const;
export type UsageContext = (typeof USAGE_CONTEXT_VALUES)[number];

// ─── Editorial Status ─────────────────────────────────────────────────────────

export const EDITORIAL_STATUS_VALUES = ['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED'] as const;
export type EditorialStatus = (typeof EDITORIAL_STATUS_VALUES)[number];

// ─── Question Types ───────────────────────────────────────────────────────────

export const QUESTION_TYPE_VALUES = [
  'MULTIPLE_CHOICE_SINGLE',
  'MULTIPLE_CHOICE_MULTIPLE',
  'TRUE_FALSE',
  'SHORT_ANSWER',
  'NUMERIC',
] as const;
export type QuestionType = (typeof QUESTION_TYPE_VALUES)[number];

// ─── Difficulty ───────────────────────────────────────────────────────────────

export const DIFFICULTY_VALUES = [
  'FOUNDATIONAL',
  'INTERMEDIATE',
  'ADVANCED',
  'HIGH_DISCRIMINATION',
] as const;
export type Difficulty = (typeof DIFFICULTY_VALUES)[number];

// ─── Roadmap Purpose ──────────────────────────────────────────────────────────

export const ROADMAP_PURPOSE_VALUES = [
  'FOUNDATION',
  'REINFORCEMENT',
  'MASTERY',
  'REVIEW',
  'DIAGNOSTIC',
] as const;
export type RoadmapPurpose = (typeof ROADMAP_PURPOSE_VALUES)[number];

// ─── Knowledge Classification ─────────────────────────────────────────────────

export const KNOWLEDGE_COVERAGE_VALUES = ['FOCUS', 'BROAD', 'CROSS'] as const;
export type KnowledgeCoverage = (typeof KNOWLEDGE_COVERAGE_VALUES)[number];

export const COGNITIVE_LEVEL_VALUES = [
  'RECOGNITION',
  'COMPREHENSION',
  'APPLICATION',
  'HIGHER_APPLICATION',
] as const;
export type CognitiveLevel = (typeof COGNITIVE_LEVEL_VALUES)[number];

// ─── Source Types ─────────────────────────────────────────────────────────────

export const SOURCE_TYPE_VALUES = [
  'ORIGINAL',
  'TEACHER_CONTRIBUTION',
  'PUBLIC_DOCUMENT',
  'LICENSED_MATERIAL',
  'INTERNAL_EDITORIAL',
  'OTHER',
] as const;
export type SourceType = (typeof SOURCE_TYPE_VALUES)[number];

// ─── Rights Status ────────────────────────────────────────────────────────────

export const RIGHTS_STATUS_VALUES = [
  'OWNED',
  'PERMISSION_GRANTED',
  'PUBLICLY_AVAILABLE',
  'LICENSED',
  'REVIEW_REQUIRED',
] as const;
export type RightsStatus = (typeof RIGHTS_STATUS_VALUES)[number];

// ─── Subject IDs ──────────────────────────────────────────────────────────────

export const SUBJECT_ID_VALUES = ['MATH', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY'] as const;
export type SubjectId = (typeof SUBJECT_ID_VALUES)[number];

export const GRADE_VALUES = [10, 11, 12] as const;
export type Grade = (typeof GRADE_VALUES)[number];

// ─── Question Option ──────────────────────────────────────────────────────────

export interface TrueFalseStatement {
  id: string;
  content: string;
  isTrue: boolean;
  hasMedia?: boolean;
}

export interface QuestionOption {
  key: string; // 'A' | 'B' | 'C' | 'D' | 'E'
  content: string;
  hasMedia?: boolean;
}

// ─── Question Source ──────────────────────────────────────────────────────────

export interface QuestionSource {
  sourceType: SourceType;
  sourceName?: string;
  sourceYear?: number;
  sourcePage?: string;
  contributor?: string;
  rightsStatus: RightsStatus;
  sourceNote?: string;
}

export interface NormalizedMediaRegion {
  /** Coordinates relative to the rendered, rotation-corrected source page. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Durable reference only: binary image data is never embedded in question JSON. */
export interface QuestionMediaReference {
  assetId: string;
  alt: string;
  /** Administrative provenance; learner renderers must not expose these fields. */
  sourcePage?: number;
  sourceRegion?: NormalizedMediaRegion;
}

export type QuestionContentBlock =
  | { id: string; type: 'TEXT'; text: string }
  | { id: string; type: 'IMAGE'; media: QuestionMediaReference };

export const QUESTION_ASSET_ROLE_VALUES = [
  'QUESTION_IMAGE',
  'OPTION_IMAGE',
  'SOURCE_EVIDENCE',
  'SOLUTION_IMAGE',
] as const;
export type QuestionAssetRole = (typeof QUESTION_ASSET_ROLE_VALUES)[number];

/** A durable file attached to a committed question. */
export interface QuestionAsset {
  id: string;
  role: QuestionAssetRole;
  storageKey: string;
  mimeType: string;
  originalFileName?: string;
  checksum: string;
  sourceSessionId?: string;
  sourcePageId?: string;
  sourceBounds?: { x: number; y: number; width: number; height: number };
  crop?: { top: number; right: number; bottom: number; left: number };
  createdAt: string;
}

export interface QuestionFingerprints {
  stem: string;
  stemAndOptions: string;
  full: string;
}

// ─── Canonical Question ───────────────────────────────────────────────────────

export interface Question {
  id: string;
  externalId?: string;
  code: string;

  /** Ordered assessment content. When present, TEXT blocks are the canonical stem. */
  content?: QuestionContentBlock[];
  /** Legacy compatibility projection; writers derive this from TEXT content blocks. */
  stem: string;
  questionType: QuestionType;
  options: QuestionOption[];
  /** Statements and their own answers for a grouped true/false question. */
  trueFalseStatements?: TrueFalseStatement[];
  correctAnswer: string; // Option keys or reference answer; legacy summary for TRUE_FALSE
  explanation?: string;
  solutionGuidance?: string;

  // Curriculum mapping (Derived from primaryKnowledgeNodeId)
  subjectId: SubjectId;
  grade: Grade;
  chapterId?: string;
  lessonId?: string;
  topicId?: string;

  // Knowledge graph / tree mapping
  primaryKnowledgeNodeId?: string;
  knowledgeCoverage?: KnowledgeCoverage;
  relatedKnowledgeNodeIds?: string[];
  cognitiveLevel?: CognitiveLevel;

  // Legacy / Graph (To be transitioned)
  conceptCodes: string[];
  skillCodes: string[];

  difficulty: Difficulty;

  // Classification dimensions (independent)
  accessTier: AccessTier;
  usageContexts: UsageContext[];
  editorialStatus: EditorialStatus;

  // Special curated question metadata
  isSpecial: boolean;
  specialReason?: string;

  // Roadmap eligibility
  roadmapEligible: boolean;
  roadmapPurpose?: RoadmapPurpose;
  prerequisiteConceptCodes: string[];
  estimatedTimeSeconds?: number;

  // Source and provenance
  source: QuestionSource;

  // Dedup fingerprint
  contentHash: string;
  fingerprints?: QuestionFingerprints;

  // Durable media copied out of transient import storage on commit.
  assets?: QuestionAsset[];

  // Exam sets that reference this question
  examSetIds: string[];

  // Audit fields
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;

  // Internal import tracking
  importJobId?: string;
  hasMedia?: boolean;
  importOrigin?: QuestionImportOrigin;
}

export const QUESTION_IMPORT_ORIGIN_VALUES = [
  'MANUAL',
  'EXCEL',
  'IMAGE',
  'PDF',
  'WORD',
  'EXAM',
  'API',
] as const;
export type QuestionImportOrigin = (typeof QUESTION_IMPORT_ORIGIN_VALUES)[number];

// ─── Audit Log Entry ──────────────────────────────────────────────────────────

export type AuditAction =
  | 'CREATED'
  | 'IMPORTED'
  | 'UPDATED'
  | 'DUPLICATED'
  | 'SUBMITTED_FOR_REVIEW'
  | 'PUBLISHED'
  | 'ARCHIVED'
  | 'ACCESS_TIER_CHANGED'
  | 'USAGE_CONTEXT_CHANGED'
  | 'ROADMAP_ELIGIBILITY_CHANGED'
  | 'CORRECT_ANSWER_CHANGED'
  | 'SOURCE_RIGHTS_CHANGED';

export interface QuestionAuditEntry {
  id: string;
  questionId: string;
  action: AuditAction;
  actor?: string;
  timestamp: string;
  previousValue?: unknown;
  newValue?: unknown;
  importJobId?: string;
  importOrigin?: QuestionImportOrigin;
  sourcePage?: string;
  note?: string;
}

// ─── Import Job ───────────────────────────────────────────────────────────────

export const IMPORT_JOB_STATUS_VALUES = [
  'PENDING',
  'VALIDATING',
  'READY',
  'IMPORTING',
  'COMPLETED',
  'PARTIAL',
  'FAILED',
  'CANCELLED',
] as const;
export type ImportJobStatus = (typeof IMPORT_JOB_STATUS_VALUES)[number];

export const IMPORT_FORMAT_VALUES = ['XLSX', 'CSV', 'JSON', 'PDF', 'DOCX', 'IMAGE'] as const;
export type ImportFormat = (typeof IMPORT_FORMAT_VALUES)[number];

export interface ImportJob {
  id: string;
  idempotencyKey: string;
  fileName: string;
  format: ImportFormat;
  importedBy?: string;
  createdAt: string;
  completedAt?: string;
  status: ImportJobStatus;
  totalRows: number;
  successRows: number;
  warningRows: number;
  failedRows: number;
  duplicateRows: number;
  errorMessage?: string;
  /** Import-session metadata returned by Question Bank history. */
  domain?: 'QUESTION_BANK';
  resumeSessionId?: string;
}

// ─── Import Row Validation ─────────────────────────────────────────────────────

export type ImportRowStatus = 'VALID' | 'WARNING' | 'ERROR' | 'DUPLICATE';

export interface ImportRowError {
  code: string;
  message: string;
  field?: string;
}

export interface ImportRowWarning {
  code: string;
  message: string;
  field?: string;
}

export interface ImportRowPreview {
  rowIndex: number;
  externalId?: string;
  stemPreview: string;
  status: ImportRowStatus;
  errors: ImportRowError[];
  warnings: ImportRowWarning[];
  proposedAccessTier?: AccessTier;
  proposedUsageContexts: UsageContext[];
  proposedEditorialStatus?: EditorialStatus;
  curriculumLabel?: string;
  sourceLabel?: string;
  conflictAction?: 'SKIP' | 'UPDATE' | 'CREATE_COPY';
  conflictExistingId?: string;
}

// ─── Column Mapping ───────────────────────────────────────────────────────────

export type ImportTargetField =
  | 'external_id'
  | 'subject'
  | 'grade'
  | 'chapter'
  | 'lesson'
  | 'topic'
  | 'concept_codes'
  | 'skill_codes'
  | 'difficulty'
  | 'question_type'
  | 'stem'
  | 'option_a'
  | 'option_b'
  | 'option_c'
  | 'option_d'
  | 'option_e'
  | 'correct_answer'
  | 'explanation'
  | 'access_tier'
  | 'usage_contexts'
  | 'roadmap_eligible'
  | 'roadmap_purpose'
  | 'prerequisite_concept_codes'
  | 'estimated_time_seconds'
  | 'is_special'
  | 'special_reason'
  | 'source_type'
  | 'source_name'
  | 'source_year'
  | 'source_page'
  | 'rights_status'
  | 'editorial_status'
  | 'knowledge_path'
  | 'knowledge_node_id'
  | 'knowledge_coverage'
  | 'related_knowledge'
  | 'cognitive_level';

export interface ColumnMapping {
  sourceColumn: string;
  targetField: ImportTargetField | null;
  sampleValue?: string;
  autoMapped: boolean;
  warning?: string;
}

// ─── Import Defaults ──────────────────────────────────────────────────────────

export interface ImportDefaults {
  subjectId?: SubjectId;
  grade?: Grade;
  chapterId?: string;
  accessTier?: AccessTier;
  usageContexts?: UsageContext[];
  editorialStatus?: EditorialStatus;
  sourceType?: SourceType;
  sourceName?: string;
  rightsStatus?: RightsStatus;
  roadmapEligible?: boolean;
  knowledgeCoverage?: KnowledgeCoverage;
  cognitiveLevel?: CognitiveLevel;
}

// ─── Question List Filter ─────────────────────────────────────────────────────

export interface QuestionFilter {
  search?: string;
  subjectId?: SubjectId;
  grade?: Grade;
  chapterId?: string;
  lessonId?: string;
  /** Stable lowest curriculum target; aliases primaryKnowledgeNodeId at query boundaries. */
  curriculumItemId?: string;
  questionType?: QuestionType;
  difficulty?: Difficulty;
  accessTier?: AccessTier;
  usageContext?: UsageContext;
  editorialStatus?: EditorialStatus;
  roadmapEligible?: boolean;
  isSpecial?: boolean;
  sourceType?: SourceType;
  importOrigin?: QuestionImportOrigin;
  page?: number;
  pageSize?: number;
}

export interface QuestionListResult {
  questions: Question[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export interface QuestionBankMetrics {
  total: number;
  draft: number;
  inReview: number;
  published: number;
  open: number;
  plus: number;
  roadmapEligible: number;
}

// ─── UI Display Labels ────────────────────────────────────────────────────────

export const ACCESS_TIER_LABELS: Record<AccessTier, string> = {
  OPEN: 'Mở',
  PLUS: 'Plus',
};

export const EDITORIAL_STATUS_LABELS: Record<EditorialStatus, string> = {
  DRAFT: 'Nháp',
  IN_REVIEW: 'Chờ phản biện',
  PUBLISHED: 'Đã xuất bản',
  ARCHIVED: 'Đã lưu trữ',
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE_SINGLE: 'Trắc nghiệm 1 đáp án',
  MULTIPLE_CHOICE_MULTIPLE: 'Trắc nghiệm nhiều đáp án',
  TRUE_FALSE: 'Đúng / Sai',
  SHORT_ANSWER: 'Trả lời ngắn',
  NUMERIC: 'Số học',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  FOUNDATIONAL: 'Cơ bản',
  INTERMEDIATE: 'Vận dụng',
  ADVANCED: 'Nâng cao',
  HIGH_DISCRIMINATION: 'Phân hóa cao',
};

export const USAGE_CONTEXT_LABELS: Record<UsageContext, string> = {
  OPEN_PRACTICE: 'Luyện tập mở',
  PLUS_SPECIAL: 'Plus đặc biệt',
  ROADMAP: 'Lộ trình',
  DIAGNOSTIC: 'Chẩn đoán',
  CHAPTER_REVIEW: 'Ôn chương',
  SEMESTER_EXAM: 'Thi học kỳ',
  NATIONAL_EXAM_MOCK: 'Mô phỏng THPT',
};

export const ROADMAP_PURPOSE_LABELS: Record<RoadmapPurpose, string> = {
  FOUNDATION: 'Nền tảng',
  REINFORCEMENT: 'Củng cố',
  MASTERY: 'Thành thạo',
  REVIEW: 'Ôn tập',
  DIAGNOSTIC: 'Chẩn đoán',
};

export const KNOWLEDGE_COVERAGE_LABELS: Record<KnowledgeCoverage, string> = {
  FOCUS: 'Trọng tâm',
  BROAD: 'Bao quát',
  CROSS: 'Liên kiến thức',
};

export const COGNITIVE_LEVEL_LABELS: Record<CognitiveLevel, string> = {
  RECOGNITION: 'Nhận biết',
  COMPREHENSION: 'Thông hiểu',
  APPLICATION: 'Vận dụng',
  HIGHER_APPLICATION: 'Vận dụng cao',
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  ORIGINAL: 'Sáng tác gốc',
  TEACHER_CONTRIBUTION: 'Giáo viên đóng góp',
  PUBLIC_DOCUMENT: 'Tài liệu công khai',
  LICENSED_MATERIAL: 'Tài liệu có bản quyền',
  INTERNAL_EDITORIAL: 'Biên soạn nội bộ',
  OTHER: 'Khác',
};

export const RIGHTS_STATUS_LABELS: Record<RightsStatus, string> = {
  OWNED: 'Sở hữu',
  PERMISSION_GRANTED: 'Được cấp phép',
  PUBLICLY_AVAILABLE: 'Công khai',
  LICENSED: 'Có giấy phép',
  REVIEW_REQUIRED: 'Cần xem xét',
};

export const SUBJECT_LABELS: Record<SubjectId, string> = {
  MATH: 'Toán',
  PHYSICS: 'Vật lý',
  CHEMISTRY: 'Hóa học',
  BIOLOGY: 'Sinh học',
};

export const IMPORT_JOB_STATUS_LABELS: Record<ImportJobStatus, string> = {
  PENDING: 'Đang chờ',
  VALIDATING: 'Đang xác thực',
  READY: 'Sẵn sàng',
  IMPORTING: 'Đang nhập',
  COMPLETED: 'Hoàn thành',
  PARTIAL: 'Một phần',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy',
};

export const QUESTION_IMPORT_ORIGIN_LABELS: Record<QuestionImportOrigin, string> = {
  MANUAL: 'Tạo thủ công',
  EXCEL: 'Excel',
  IMAGE: 'Ảnh',
  PDF: 'PDF',
  WORD: 'Word',
  EXAM: 'Đề thi',
  API: 'API',
};
