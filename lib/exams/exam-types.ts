import type { ExamType, ImportRightsStatus } from '@/lib/content-import/types';
import type {
  CognitiveLevel,
  Difficulty,
  Grade,
  Question,
  QuestionType,
  SubjectId,
  UsageContext,
} from '@/lib/question-bank/qb-types';

export type ExamImportMethod = 'MANUAL' | 'PDF' | 'WORD' | 'IMAGES' | 'QUESTION_BANK';
export type ExamImportStatus =
  'PROCESSING' | 'REVIEW_REQUIRED' | 'IN_REVIEW' | 'COMPLETED' | 'FAILED';
export type ExamPublishStatus = 'DRAFT' | 'APPROVED' | 'PUBLISHED' | 'HIDDEN';

export interface ExamQuestionCriteria {
  search?: string;
  subjectId?: SubjectId;
  grade?: Grade;
  chapterId?: string;
  lessonId?: string;
  topicId?: string;
  /** Matches the canonical primary or related knowledge-tree placement. */
  knowledgeNodeId?: string;
  questionType?: QuestionType;
  difficulty?: Difficulty;
  cognitiveLevel?: CognitiveLevel;
  usageContext?: UsageContext;
}

export interface ExamSelectionRule extends ExamQuestionCriteria {
  count: number;
}

export interface ExamSelectionAllocation {
  ruleIndex: number;
  criteria: ExamQuestionCriteria;
  requested: number;
  available: number;
  questionIds: string[];
}

export interface ExamSelectionShortfall {
  ruleIndex: number;
  criteria: ExamQuestionCriteria;
  requested: number;
  available: number;
  selected: number;
  shortage: number;
}

export interface ExamSelectionSuccess {
  ok: true;
  questionIds: string[];
  allocations: ExamSelectionAllocation[];
}

export interface ExamSelectionFailure {
  ok: false;
  error: 'INSUFFICIENT_QUESTIONS';
  message: string;
  /** Always empty so a caller cannot accidentally apply a partial allocation. */
  questionIds: string[];
  allocations: ExamSelectionAllocation[];
  shortfalls: ExamSelectionShortfall[];
}

export type ExamSelectionResult = ExamSelectionSuccess | ExamSelectionFailure;

export interface PublishedExamMetadataSnapshot {
  name: string;
  subjectId?: SubjectId;
  grade?: Grade;
  examType?: ExamType;
  durationMinutes?: number;
  questionIds: string[];
  rawExamCode: string;
  normalizedExamCode: string;
}

/** A self-contained copy for rendering a historical, published exam. */
export interface PublishedExamSnapshot {
  version: 1;
  publishedAt: string;
  metadata: PublishedExamMetadataSnapshot;
  /** Includes answer keys, explanations and durable media descriptors. */
  questions: Question[];
}

export interface ExamRecord {
  id: string;
  name: string;
  subjectId?: SubjectId;
  grade?: Grade;
  examType?: ExamType;
  questionIds: string[];
  durationMinutes?: number;
  sourceName: string;
  sourceUrl: string;
  rightsStatus: ImportRightsStatus;
  importMethod: ExamImportMethod;
  importStatus: ExamImportStatus;
  publishStatus: ExamPublishStatus;
  importSessionId?: string;
  importJobId?: string;
  rawExamCode: string;
  normalizedExamCode: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  publishedAt?: string;
  publishedSnapshot?: PublishedExamSnapshot;
}

export interface ExamDraftInput {
  name: string;
  subjectId?: SubjectId;
  grade?: Grade;
  examType?: ExamType;
  durationMinutes?: number;
  questionIds: string[];
  rawExamCode?: string;
  normalizedExamCode?: string;
}

export const EXAM_IMPORT_STATUS_LABELS: Record<ExamImportStatus, string> = {
  PROCESSING: 'Đang xử lý',
  REVIEW_REQUIRED: 'Cần kiểm tra',
  IN_REVIEW: 'Đang kiểm duyệt',
  COMPLETED: 'Đã kiểm duyệt',
  FAILED: 'Xử lý lỗi',
};

export const EXAM_PUBLISH_STATUS_LABELS: Record<ExamPublishStatus, string> = {
  DRAFT: 'Bản nháp',
  APPROVED: 'Đã duyệt',
  PUBLISHED: 'Đã xuất bản',
  HIDDEN: 'Đã ẩn',
};

export const EXAM_IMPORT_METHOD_LABELS: Record<ExamImportMethod, string> = {
  MANUAL: 'Tạo thủ công',
  PDF: 'PDF',
  WORD: 'Word',
  IMAGES: 'Ảnh đề chính thức',
  QUESTION_BANK: 'Ngân hàng câu hỏi',
};
