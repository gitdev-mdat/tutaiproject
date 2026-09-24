/**
 * Exam Sets — domain types.
 *
 * Architecture notes:
 * - Designed to be backend-agnostic: same types work with mock data, REST, or GraphQL.
 * - accessTier, examType, sourceType, subject, grade are all explicit string unions —
 *   no magic strings scattered across UI code.
 * - Fields without data are optional so UI can conditionally render badges/metadata.
 */

// ─── Enumerations ─────────────────────────────────────────────────────────────

export type SubjectId = 'MATH' | 'PHYSICS' | 'CHEMISTRY' | 'BIOLOGY';

export type Grade = 10 | 11 | 12;

export type AccessTier = 'FREE' | 'PLUS';

export type ExamSetScope = 'LESSON' | 'CHAPTER' | 'SEMESTER' | 'NATIONAL';

export type ExamSetTier = 'STANDARD' | 'SPECIAL';

export type ExamSetStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export type ExamSessionMode = 'PRACTICE' | 'EXAM_SIMULATION';

/**
 * Exam types — extensible.
 * PRACTICE: topic/skill practice sets.
 * TOPIC: single-chapter focused exam.
 * MIDTERM: mid-semester exam format.
 * FINAL: end-of-semester exam format.
 * MOCK_EXAM: full mock exam under timed conditions.
 * THPT_NATIONAL: official or THPT-format national exam.
 * CUSTOM: teacher/editorial curated.
 */
export type ExamType =
  'PRACTICE' | 'TOPIC' | 'MIDTERM' | 'FINAL' | 'MOCK_EXAM' | 'THPT_NATIONAL' | 'CUSTOM';

export type Difficulty = 'FOUNDATIONAL' | 'INTERMEDIATE' | 'ADVANCED' | 'HIGH_DISCRIMINATION';

/**
 * Source type — only render source badges when actual sourceType data exists.
 * OFFICIAL: from Ministry of Education or official exam bodies.
 * PARTNER_TEACHER: verified partner teacher.
 * TUTAI_EDITORIAL: curated by Tú Tài editorial team.
 * CURATED: curated from public sources (properly attributed).
 */
export type SourceType = 'OFFICIAL' | 'PARTNER_TEACHER' | 'TUTAI_EDITORIAL' | 'CURATED';

export type SpecialReason =
  | 'REAL_EXAM_SIMULATION'
  | 'UNCOMMON_QUESTION_PATTERNS'
  | 'CURATED_SOURCE'
  | 'MULTI_CONCEPT_COMBINATION'
  | 'UNFAMILIAR_CONTEXT';

export type Level = 'LOW' | 'MEDIUM' | 'HIGH';

// ─── Core domain model ────────────────────────────────────────────────────────

export interface ExamSetExamPreview {
  id: string;
  title: string;
  order: number;
  difficulty: Difficulty;
  duration: string;
  questionCount?: number;
  previewAvailable?: boolean;
}

export interface ExamSet {
  id: string;
  slug: string;
  title: string;
  description: string;

  subjectId: SubjectId;
  grade: Grade;

  examType: ExamType;
  difficulty: Difficulty;
  accessTier: AccessTier;

  /** Only render source badge when this is defined */
  sourceType?: SourceType;
  sourceName?: string;
  authorName?: string;
  authorRole?: string;
  schoolName?: string;
  verifiedSource?: boolean;

  /** Publication year of the exam set */
  year?: number;

  examCount: number;
  questionCount?: number;
  /** e.g. "90 phút", "120 phút" */
  estimatedDuration?: string;

  tags?: string[];

  features?: { title: string; description: string }[];
  intendedFor?: string[];
  exams?: ExamSetExamPreview[];
  sampleExamId?: string;
  previewEnabled?: boolean;

  isSpecial?: boolean;
  specialReason?: SpecialReason;
  simulationLevel?: Level;
  uncommonPatternLevel?: Level;
  examRealism?: Level;
  specialTags?: string[];

  editionLabel?: string;
  selectionSourceCount?: number;
  selectedExamCount?: number;
  uncommonPatternCount?: number;

  featured?: boolean;
  published: boolean;
}

/**
 * A single practice experience placed inside the curriculum hierarchy.
 *
 * Group identity is derived from:
 * - lessonId for LESSON
 * - chapterId for CHAPTER
 * - semester for SEMESTER
 * - nationalGroupId within subjectId + grade for NATIONAL
 */
export interface CurriculumExamSet {
  id: string;
  slug: string;
  subjectId: SubjectId;
  grade: Grade;

  scope: ExamSetScope;
  tier: ExamSetTier;

  chapterId?: string;
  lessonId?: string;
  semester?: 1 | 2;
  nationalGroupId?: string;

  sequence: number;
  /** ISO-8601 release time used for deterministic browse ordering. */
  publishedAt?: string;
  isPinned?: boolean;
  /** Editorial emphasis only; this does not create a new access tier. */
  isFeatured?: boolean;
  title: string;
  description: string;

  questionCount: number;
  durationMinutes: number;
  difficultyLabel?: string;
  formatLabel?: string;
  teacherOrSource?: string;
  access: AccessTier;
  status?: ExamSetStatus;
  resumeQuestion?: number;
}

export interface CurriculumLesson {
  id: string;
  number: number;
  title: string;
}

export interface CurriculumChapter {
  id: string;
  subjectId: SubjectId;
  grade: Grade;
  number: number;
  title: string;
  shortTitle: string;
  lessons: CurriculumLesson[];
}

export interface SemesterCollection {
  semester: 1 | 2;
  subjectId: SubjectId;
  grade: Grade;
  title: string;
  description: string;
  chapterIds: string[];
}

export interface NationalCollection {
  id: string;
  subjectId: SubjectId;
  grade: Grade;
  title: string;
  description: string;
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

export const SUBJECT_LABELS: Record<SubjectId, string> = {
  MATH: 'Toán',
  PHYSICS: 'Vật lý',
  CHEMISTRY: 'Hóa học',
  BIOLOGY: 'Sinh học',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  FOUNDATIONAL: 'Cơ bản',
  INTERMEDIATE: 'Vận dụng',
  ADVANCED: 'Nâng cao',
  HIGH_DISCRIMINATION: 'Phân hóa cao',
};

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  PRACTICE: 'Luyện nền tảng',
  TOPIC: 'Theo chuyên đề',
  MIDTERM: 'Giữa kỳ',
  FINAL: 'Cuối kỳ',
  MOCK_EXAM: 'Thi thử',
  THPT_NATIONAL: 'THPT Quốc Gia',
  CUSTOM: 'Đặc biệt',
};

/** Subject IDs in display order */
export const ALL_SUBJECTS: SubjectId[] = ['MATH', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY'];
