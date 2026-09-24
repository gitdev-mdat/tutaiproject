import type {
  ColumnMapping,
  Difficulty,
  Grade,
  ImportDefaults,
  ImportFormat,
  Question,
  QuestionContentBlock,
  NormalizedMediaRegion,
  QuestionType,
  SubjectId,
} from '@/lib/question-bank/qb-types';

export const IMPORT_DOMAINS = ['EXAM', 'QUESTION_BANK'] as const;
export type ImportDomain = (typeof IMPORT_DOMAINS)[number];

export const ASSET_ROLES = [
  'SOURCE_IMAGE',
  'QUESTION_ASSET',
  'ANSWER_EVIDENCE',
  'SOLUTION_EVIDENCE',
] as const;
export type AssetRole = (typeof ASSET_ROLES)[number];

export const PAGE_TYPES = ['EXAM_PAGE', 'ANSWER_KEY', 'SOLUTION', 'UNKNOWN'] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const RIGHTS_STATUSES = [
  'OFFICIAL_SOURCE',
  'PERMISSION_GRANTED',
  'OPEN_LICENSE',
  'INTERNAL_CONTENT',
  'UNVERIFIED',
  'RESTRICTED',
] as const;
export type ImportRightsStatus = (typeof RIGHTS_STATUSES)[number];

export const EXAM_TYPES = [
  'LESSON',
  'CHAPTER',
  'SEMESTER',
  'NATIONAL_EXAM_MOCK',
  'OFFICIAL',
  'OTHER',
] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

export const ANSWER_MATCHING_MODES = ['INCLUDED', 'UPLOAD_LATER', 'UNAVAILABLE'] as const;
export type AnswerMatchingMode = (typeof ANSWER_MATCHING_MODES)[number];

export const IMPORT_SESSION_STATUSES = [
  'DRAFT',
  'READY',
  'PROCESSING',
  'REVIEW_REQUIRED',
  'COMPLETED',
  'FAILED',
] as const;
export type ImportSessionStatus = (typeof IMPORT_SESSION_STATUSES)[number];

export const PIPELINE_STAGE_IDS = [
  'CHECK_IMAGES',
  'RECOGNIZE_LAYOUT',
  'EXTRACT_QUESTIONS',
  'READ_MATH_AND_ASSETS',
  'MERGE_ACROSS_PAGES',
  'READ_ANSWER_KEY',
  'VALIDATE_DATA',
] as const;
export type PipelineStageId = (typeof PIPELINE_STAGE_IDS)[number];
export type PipelineStageStatus = 'WAITING' | 'PROCESSING' | 'COMPLETED' | 'WARNING' | 'FAILED';

export type ReviewStatus = 'UNREVIEWED' | 'WARNING' | 'EDITED' | 'APPROVED' | 'SKIPPED';
export type FieldConfidence = 'HIGH' | 'REVIEW' | 'UNCERTAIN';

export interface CropRegion {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SourcePage {
  id: string;
  order: number;
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  checksum: string;
  pageType: PageType;
  rotation: 0 | 90 | 180 | 270;
  crop?: CropRegion;
  assetRole: 'SOURCE_IMAGE';
  warnings: string[];
  createdAt: string;
}

export interface ExamMetadata {
  name: string;
  subjectId?: SubjectId;
  grade?: Grade;
  examType?: ExamType;
  year?: number;
  durationMinutes?: number;
  rawExamCode: string;
  normalizedExamCode: string;
  curriculumProgram: string;
  sourceName: string;
  sourceUrl: string;
  publisher: string;
  sourceNote: string;
  rightsStatus: ImportRightsStatus;
  answerMatchingMode: AnswerMatchingMode;
  rawAnswerCode: string;
  normalizedAnswerCode: string;
  answerCodeConfirmed: boolean;
}

export interface PipelineStage {
  id: PipelineStageId;
  status: PipelineStageStatus;
  message?: string;
}

export interface CandidateWarning {
  id: string;
  code:
    | 'MISSING_ANSWER'
    | 'SUSPECT_MATH'
    | 'CONTINUES_NEXT_PAGE'
    | 'DUPLICATE_OPTIONS'
    | 'MISSING_ASSET'
    | 'POSSIBLE_DUPLICATE'
    | 'HANDWRITING_DETECTED';
  message: string;
  actions: Array<
    'EDIT' | 'MERGE_NEXT_PAGE' | 'RESELECT_REGION' | 'NO_ANSWER' | 'CHECK_DUPLICATE' | 'SKIP'
  >;
}

export interface QuestionCandidate {
  id: string;
  number: number;
  sourcePageIds: string[];
  sourcePages?: number[];
  sourceBounds?: { x: number; y: number; width: number; height: number };
  /** Ordered canonical draft content; `content` below is its legacy text projection. */
  orderedContent?: QuestionContentBlock[];
  mediaCandidates?: Array<{
    id: string;
    alt: string;
    sourcePage: number;
    sourceRegion: NormalizedMediaRegion;
    confidence: FieldConfidence;
  }>;
  questionType: QuestionType;
  content: string;
  options: Array<{ key: string; content: string }>;
  statements: Array<{ key: string; content: string; correct?: boolean }>;
  correctAnswer: string;
  detectedSelectedAnswer: string;
  explanation: string;
  sharedContext: string;
  questionAssetDescription: string;
  subjectId?: SubjectId;
  grade?: Grade;
  chapter: string;
  lesson: string;
  concept: string;
  primaryKnowledgeNodeId?: string;
  difficulty: Difficulty;
  status: ReviewStatus;
  fieldConfidence: {
    content: FieldConfidence;
    options: FieldConfidence;
    answer: FieldConfidence;
    asset: FieldConfidence;
    classification: FieldConfidence;
  };
  warnings: CandidateWarning[];
  updatedAt: string;
  questionId?: string;
  /** Canonical fields staged for structured/document imports. */
  stagedQuestion?: Partial<Question>;
  reviewLevel?: 'READY' | 'REVIEW' | 'BLOCKING';
  validationErrors?: Array<{ code: string; message: string; field?: string }>;
}

export interface ImportSessionSummary {
  pageCount: number;
  detectedQuestions: number;
  approvedQuestions: number;
  reviewQuestions: number;
  skippedQuestions: number;
  questionsWithAnswers: number;
  questionsWithoutAnswers: number;
  duplicateCandidates: number;
  failedItems: number;
  lowQualityImages: number;
}

export interface ImportSession {
  id: string;
  domain: ImportDomain;
  sourceFormat: 'IMAGES' | 'IMAGE' | 'XLSX' | 'CSV' | 'JSON' | 'PDF' | 'DOCX';
  status: ImportSessionStatus;
  currentStep: 1 | 2 | 3 | 4 | 5;
  pages: SourcePage[];
  sourceDocument?: {
    originalFileName: string;
    storedFileName: string;
    mimeType: string;
    sizeBytes: number;
    checksum: string;
    pageCount?: number;
  };
  examMetadata?: ExamMetadata;
  singleQuestionSource?: {
    sourceName: string;
    sourceUrl: string;
    rightsStatus: ImportRightsStatus;
  };
  pipelineStages: PipelineStage[];
  candidates: QuestionCandidate[];
  structuredData?: {
    fileName: string;
    format: ImportFormat;
    rawRows: Array<Record<string, unknown>>;
    mappings: ColumnMapping[];
    defaults: ImportDefaults;
  };
  summary: ImportSessionSummary;
  processingError?: { stage: PipelineStageId; reason: string; retryable: boolean };
  warnings?: string[];
  extractionProvider: 'GEMINI' | 'UNAVAILABLE';
  createdAt: string;
  updatedAt: string;
}

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  EXAM_PAGE: 'Trang đề',
  ANSWER_KEY: 'Đáp án',
  SOLUTION: 'Lời giải',
  UNKNOWN: 'Không xác định',
};

export const RIGHTS_STATUS_LABELS: Record<ImportRightsStatus, string> = {
  OFFICIAL_SOURCE: 'Nguồn chính thức',
  PERMISSION_GRANTED: 'Được cho phép sử dụng',
  OPEN_LICENSE: 'Giấy phép mở',
  INTERNAL_CONTENT: 'Nội dung nội bộ',
  UNVERIFIED: 'Chưa xác minh',
  RESTRICTED: 'Hạn chế sử dụng',
};

export const PIPELINE_STAGE_LABELS: Record<PipelineStageId, string> = {
  CHECK_IMAGES: 'Đang kiểm tra ảnh',
  RECOGNIZE_LAYOUT: 'Đang nhận diện bố cục',
  EXTRACT_QUESTIONS: 'Đang tách câu hỏi',
  READ_MATH_AND_ASSETS: 'Đang nhận diện công thức và hình minh họa',
  MERGE_ACROSS_PAGES: 'Đang ghép câu qua nhiều trang',
  READ_ANSWER_KEY: 'Đang đọc đáp án',
  VALIDATE_DATA: 'Đang kiểm tra dữ liệu',
};

export const DEFAULT_PIPELINE_STAGES: PipelineStage[] = PIPELINE_STAGE_IDS.map((id) => ({
  id,
  status: 'WAITING',
}));

export const EMPTY_IMPORT_SUMMARY: ImportSessionSummary = {
  pageCount: 0,
  detectedQuestions: 0,
  approvedQuestions: 0,
  reviewQuestions: 0,
  skippedQuestions: 0,
  questionsWithAnswers: 0,
  questionsWithoutAnswers: 0,
  duplicateCandidates: 0,
  failedItems: 0,
  lowQualityImages: 0,
};
