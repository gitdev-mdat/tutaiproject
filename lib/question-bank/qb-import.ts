/**
 * Question Bank — Import service.
 *
 * Supports: CSV, JSON.
 * XLSX upload: parsed client-side as CSV (no server-side xlsx library installed).
 *
 * Responsibilities:
 * - Parse raw file content into row records
 * - Map columns to canonical fields
 * - Apply import defaults (row values override defaults)
 * - Validate each row (hard errors + warnings)
 * - Detect exact duplicates via contentHash and externalId
 * - Return ImportRowPreview[] without persisting
 * - Commit approved rows transactionally
 */

import { v4 as uuidv4 } from 'uuid';
import {
  getQuestionByExternalId,
  getQuestionByAnyFingerprint,
  saveManyQuestions,
  saveImportJob,
  appendAuditEntry,
  getImportJobByIdempotencyKey,
} from './qb-storage';
import {
  ACCESS_TIER_VALUES,
  USAGE_CONTEXT_VALUES,
  EDITORIAL_STATUS_VALUES,
  QUESTION_TYPE_VALUES,
  DIFFICULTY_VALUES,
  ROADMAP_PURPOSE_VALUES,
  SOURCE_TYPE_VALUES,
  RIGHTS_STATUS_VALUES,
  SUBJECT_ID_VALUES,
  GRADE_VALUES,
} from './qb-types';
import type {
  Question,
  QuestionOption,
  ImportRowPreview,
  ImportJob,
  ImportDefaults,
  ColumnMapping,
  ImportTargetField,
  AccessTier,
  UsageContext,
  EditorialStatus,
  QuestionType,
  Difficulty,
  RoadmapPurpose,
  SourceType,
  RightsStatus,
  SubjectId,
  Grade,
} from './qb-types';
import { validateForImportCandidate } from './qb-validation';
import { computeContentHash, computeQuestionFingerprints, generateQuestionCode } from './qb-hash';
import { readKnowledgeGraph } from '@/lib/knowledge-graph/kg-storage';
import { walkKgNodes } from '@/lib/knowledge-graph/kg-utils';
import { readKnowledgeTree } from '@/lib/knowledge-tree/knowledge-tree-storage';
import type { KnowledgeTreeDocument } from '@/lib/knowledge-tree/knowledge-tree-types';
import {
  resolveKnowledgePath,
  deriveHierarchyContext,
  isAttachableKnowledgeNode,
} from './qb-knowledge-utils';
import type { KnowledgeCoverage, CognitiveLevel } from './qb-types';

// ─── Canonical target field names (matches template) ─────────────────────────

const TARGET_FIELDS: ImportTargetField[] = [
  'external_id',
  'subject',
  'grade',
  'chapter',
  'lesson',
  'topic',
  'concept_codes',
  'skill_codes',
  'difficulty',
  'question_type',
  'stem',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'option_e',
  'correct_answer',
  'explanation',
  'access_tier',
  'usage_contexts',
  'roadmap_eligible',
  'roadmap_purpose',
  'prerequisite_concept_codes',
  'estimated_time_seconds',
  'is_special',
  'special_reason',
  'source_type',
  'source_name',
  'source_year',
  'source_page',
  'rights_status',
  'editorial_status',
  'knowledge_path',
  'knowledge_node_id',
  'knowledge_coverage',
  'related_knowledge',
  'cognitive_level',
];

// ─── Auto-mapping aliases ─────────────────────────────────────────────────────

const COLUMN_ALIASES: Record<string, ImportTargetField> = {
  external_id: 'external_id',
  externalid: 'external_id',
  id: 'external_id',
  question_id: 'external_id',
  subject: 'subject',
  mon: 'subject',
  'môn học': 'subject',
  grade: 'grade',
  lop: 'grade',
  lớp: 'grade',
  chapter: 'chapter',
  chuong: 'chapter',
  chương: 'chapter',
  lesson: 'lesson',
  bai: 'lesson',
  bài: 'lesson',
  topic: 'topic',
  chu_de: 'topic',
  'chủ đề': 'topic',
  concept_codes: 'concept_codes',
  concepts: 'concept_codes',
  knowledge_code: 'concept_codes',
  skill_codes: 'skill_codes',
  skills: 'skill_codes',
  tags: 'skill_codes',
  difficulty: 'difficulty',
  'độ khó': 'difficulty',
  question_type: 'question_type',
  type: 'question_type',
  loai: 'question_type',
  stem: 'stem',
  question: 'stem',
  'câu hỏi': 'stem',
  noi_dung: 'stem',
  option_a: 'option_a',
  a: 'option_a',
  'đáp án a': 'option_a',
  option_b: 'option_b',
  b: 'option_b',
  'đáp án b': 'option_b',
  option_c: 'option_c',
  c: 'option_c',
  'đáp án c': 'option_c',
  option_d: 'option_d',
  d: 'option_d',
  'đáp án d': 'option_d',
  option_e: 'option_e',
  e: 'option_e',
  'đáp án e': 'option_e',
  correct_answer: 'correct_answer',
  answer: 'correct_answer',
  'đáp án đúng': 'correct_answer',
  explanation: 'explanation',
  'giải thích': 'explanation',
  access_tier: 'access_tier',
  tier: 'access_tier',
  usage_contexts: 'usage_contexts',
  contexts: 'usage_contexts',
  roadmap_eligible: 'roadmap_eligible',
  roadmap: 'roadmap_eligible',
  roadmap_purpose: 'roadmap_purpose',
  prerequisite_concept_codes: 'prerequisite_concept_codes',
  prerequisites: 'prerequisite_concept_codes',
  estimated_time_seconds: 'estimated_time_seconds',
  time: 'estimated_time_seconds',
  is_special: 'is_special',
  special: 'is_special',
  special_reason: 'special_reason',
  source_type: 'source_type',
  nguon: 'source_type',
  source_name: 'source_name',
  'ten nguon': 'source_name',
  source: 'source_name',
  source_year: 'source_year',
  nam: 'source_year',
  source_page: 'source_page',
  trang: 'source_page',
  rights_status: 'rights_status',
  rights: 'rights_status',
  editorial_status: 'editorial_status',
  status: 'editorial_status',
  knowledge_path: 'knowledge_path',
  'đường dẫn kiến thức': 'knowledge_path',
  knowledge_node_id: 'knowledge_node_id',
  primaryknowledgenodeid: 'knowledge_node_id',
  primary_knowledge_node_id: 'knowledge_node_id',
  knowledge_coverage: 'knowledge_coverage',
  'mức bao phủ': 'knowledge_coverage',
  related_knowledge: 'related_knowledge',
  'kiến thức liên quan': 'related_knowledge',
  cognitive_level: 'cognitive_level',
  'mức độ tư duy': 'cognitive_level',
};

// ─── CSV parsing ──────────────────────────────────────────────────────────────

export function parseCsv(content: string): Array<Record<string, string>> {
  const records = parseCsvRecords(content);
  if (records.length === 0) return [];
  const headers = records[0].map((header) => header.replace(/^\uFEFF/, '').trim());
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < records.length; i++) {
    const values = records[i];
    if (values.every((v) => v.trim() === '')) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function parseCsvRecords(content: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '"') {
      if (inQuotes && content[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      record.push(current);
      current = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && content[i + 1] === '\n') i++;
      record.push(current);
      records.push(record);
      record = [];
      current = '';
    } else {
      current += ch;
    }
  }
  if (inQuotes) throw new Error('CSV contains an unterminated quoted field.');
  if (current.length > 0 || record.length > 0) {
    record.push(current);
    records.push(record);
  }
  return records;
}

// ─── JSON parsing ─────────────────────────────────────────────────────────────

export function parseJsonRows(content: string): Array<Record<string, unknown>> {
  const parsed = JSON.parse(content) as unknown;
  if (Array.isArray(parsed)) return parsed as Array<Record<string, unknown>>;
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'questions' in parsed &&
    Array.isArray((parsed as { questions: unknown[] }).questions)
  ) {
    return (parsed as { questions: Array<Record<string, unknown>> }).questions;
  }
  throw new Error('JSON phải là mảng câu hỏi hoặc object có trường "questions".');
}

// ─── Column auto-mapping ──────────────────────────────────────────────────────

export function buildColumnMappings(
  headers: string[],
  sampleRow?: Record<string, string>
): ColumnMapping[] {
  return headers.map((h) => {
    const key = h.toLowerCase().trim().replace(/\s+/g, '_');
    const autoTarget = COLUMN_ALIASES[key] ?? null;
    const isRequired: ImportTargetField[] = [
      'stem',
      'question_type',
      'correct_answer',
      'subject',
      'grade',
    ];
    return {
      sourceColumn: h,
      targetField: autoTarget,
      sampleValue: sampleRow?.[h] ?? '',
      autoMapped: autoTarget !== null,
      warning:
        autoTarget === null
          ? 'Không nhận dạng được cột này. Hãy chọn trường phù hợp thủ công.'
          : !TARGET_FIELDS.includes(autoTarget)
            ? 'Cột này không có trường đích hợp lệ.'
            : isRequired.includes(autoTarget)
              ? undefined
              : undefined,
    };
  });
}

// ─── Row → Partial<Question> ──────────────────────────────────────────────────

function coerceString(val: unknown): string {
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  return '';
}

function coerceBool(val: unknown): boolean | undefined {
  if (typeof val === 'boolean') return val;
  const s = coerceString(val).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes' || s === 'có') return true;
  if (s === 'false' || s === '0' || s === 'no' || s === 'không') return false;
  return undefined;
}

function coerceMultiValue<T extends string>(val: unknown, validValues: readonly T[]): T[] {
  const s = coerceString(val);
  if (!s) return [];
  return s
    .split(/[,;|]/)
    .map((v) => v.trim().toUpperCase() as T)
    .filter((v) => validValues.includes(v));
}

function buildOptions(mapped: Record<ImportTargetField, string>): QuestionOption[] {
  const opts: QuestionOption[] = [];
  const keys = ['A', 'B', 'C', 'D', 'E'] as const;
  const fields = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e'] as const;
  for (let i = 0; i < keys.length; i++) {
    const content = mapped[fields[i]] ?? '';
    if (content.trim()) {
      opts.push({ key: keys[i], content });
    }
  }
  return opts;
}

export function rowToPartialQuestion(
  mapped: Record<ImportTargetField, string>,
  defaults: ImportDefaults,
  tree?: KnowledgeTreeDocument
): Partial<Question> {
  // Merge: row values take precedence over defaults
  const subjectRaw = mapped.subject || '';
  const subjectId: SubjectId | undefined =
    ((SUBJECT_ID_VALUES.includes(subjectRaw.toUpperCase() as SubjectId)
      ? subjectRaw.toUpperCase()
      : SUBJECT_ID_VALUES.find((s) => s.startsWith(subjectRaw.toUpperCase().substring(0, 3)))) as
      SubjectId | undefined) ?? defaults.subjectId;

  const gradeRaw = Number(mapped.grade);
  const grade: Grade | undefined = GRADE_VALUES.includes(gradeRaw as Grade)
    ? (gradeRaw as Grade)
    : defaults.grade;

  const questionTypeRaw = mapped.question_type?.toUpperCase() as QuestionType;
  const questionType: QuestionType | undefined = QUESTION_TYPE_VALUES.includes(questionTypeRaw)
    ? questionTypeRaw
    : undefined;

  const difficultyRaw = mapped.difficulty?.toUpperCase() as Difficulty;
  const difficulty: Difficulty | undefined = DIFFICULTY_VALUES.includes(difficultyRaw)
    ? difficultyRaw
    : 'INTERMEDIATE';

  const accessTierRaw = mapped.access_tier?.toUpperCase() as AccessTier;
  const accessTier: AccessTier = ACCESS_TIER_VALUES.includes(accessTierRaw)
    ? accessTierRaw
    : (defaults.accessTier ?? 'OPEN');

  const usageContextsRow = coerceMultiValue<UsageContext>(
    mapped.usage_contexts,
    USAGE_CONTEXT_VALUES
  );
  const usageContexts: UsageContext[] =
    usageContextsRow.length > 0 ? usageContextsRow : (defaults.usageContexts ?? []);

  const editorialStatusRaw = mapped.editorial_status?.toUpperCase() as EditorialStatus;
  const editorialStatus: EditorialStatus = EDITORIAL_STATUS_VALUES.includes(editorialStatusRaw)
    ? editorialStatusRaw
    : (defaults.editorialStatus ?? 'DRAFT');

  const roadmapEligibleRow = coerceBool(mapped.roadmap_eligible);
  const roadmapEligible: boolean =
    roadmapEligibleRow !== undefined ? roadmapEligibleRow : (defaults.roadmapEligible ?? false);

  const roadmapPurposeRaw = mapped.roadmap_purpose?.toUpperCase() as RoadmapPurpose;
  const roadmapPurpose: RoadmapPurpose | undefined = ROADMAP_PURPOSE_VALUES.includes(
    roadmapPurposeRaw
  )
    ? roadmapPurposeRaw
    : undefined;

  const isSpecialRow = coerceBool(mapped.is_special);
  const isSpecial = isSpecialRow ?? false;

  const sourceTypeRaw = mapped.source_type?.toUpperCase() as SourceType;
  const sourceType: SourceType = SOURCE_TYPE_VALUES.includes(sourceTypeRaw)
    ? sourceTypeRaw
    : (defaults.sourceType ?? 'PUBLIC_DOCUMENT');

  const rightsStatusRaw = mapped.rights_status?.toUpperCase() as RightsStatus;
  const rightsStatus: RightsStatus = RIGHTS_STATUS_VALUES.includes(rightsStatusRaw)
    ? rightsStatusRaw
    : (defaults.rightsStatus ?? 'REVIEW_REQUIRED');

  const estTimeRaw = Number(mapped.estimated_time_seconds);
  const estimatedTimeSeconds = isNaN(estTimeRaw) || estTimeRaw <= 0 ? undefined : estTimeRaw;

  const options = buildOptions(mapped);
  const conceptCodes = coerceString(mapped.concept_codes)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const skillCodes = coerceString(mapped.skill_codes)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const prereqs = coerceString(mapped.prerequisite_concept_codes)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const sourceYearRaw = Number(mapped.source_year);
  const sourceYear = isNaN(sourceYearRaw) ? undefined : sourceYearRaw;

  const knowledgeCoverageRaw = mapped.knowledge_coverage?.toUpperCase() as KnowledgeCoverage;
  const knowledgeCoverage: KnowledgeCoverage | undefined = ['FOCUS', 'BROAD', 'CROSS'].includes(
    knowledgeCoverageRaw
  )
    ? knowledgeCoverageRaw
    : mapped.knowledge_coverage?.includes('Trọng tâm')
      ? 'FOCUS'
      : mapped.knowledge_coverage?.includes('Bao quát')
        ? 'BROAD'
        : mapped.knowledge_coverage?.includes('Liên kiến thức')
          ? 'CROSS'
          : undefined;

  const cognitiveLevelRaw = mapped.cognitive_level?.toUpperCase() as CognitiveLevel;
  const cognitiveLevel: CognitiveLevel | undefined = [
    'RECOGNITION',
    'COMPREHENSION',
    'APPLICATION',
    'HIGHER_APPLICATION',
  ].includes(cognitiveLevelRaw)
    ? cognitiveLevelRaw
    : mapped.cognitive_level?.includes('Nhận biết')
      ? 'RECOGNITION'
      : mapped.cognitive_level?.includes('Thông hiểu')
        ? 'COMPREHENSION'
        : mapped.cognitive_level?.includes('Vận dụng cao')
          ? 'HIGHER_APPLICATION'
          : mapped.cognitive_level?.includes('Vận dụng')
            ? 'APPLICATION'
            : undefined;

  let primaryKnowledgeNodeId = mapped.knowledge_node_id || undefined;
  if (!primaryKnowledgeNodeId && mapped.knowledge_path && tree) {
    primaryKnowledgeNodeId = resolveKnowledgePath(mapped.knowledge_path, tree) || undefined;
  }

  let finalSubjectId = subjectId;
  let finalGrade = grade;
  let finalChapterId = mapped.chapter || defaults.chapterId || undefined;
  let finalLessonId = mapped.lesson || undefined;
  let finalTopicId = mapped.topic || undefined;

  if (primaryKnowledgeNodeId && tree) {
    const hierarchy = deriveHierarchyContext(primaryKnowledgeNodeId, tree);
    if (hierarchy.subjectId) finalSubjectId = hierarchy.subjectId;
    if (hierarchy.grade) finalGrade = hierarchy.grade;
    if (hierarchy.chapterId) finalChapterId = hierarchy.chapterId;
    if (hierarchy.lessonId) finalLessonId = hierarchy.lessonId;
    if (hierarchy.topicId) finalTopicId = hierarchy.topicId;
  }

  const relatedKnowledgeNodeIds = coerceString(mapped.related_knowledge)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    externalId: mapped.external_id || undefined,
    stem: mapped.stem || '',
    questionType,
    options,
    correctAnswer: mapped.correct_answer || '',
    explanation: mapped.explanation || undefined,
    subjectId: finalSubjectId,
    grade: finalGrade,
    chapterId: finalChapterId,
    lessonId: finalLessonId,
    topicId: finalTopicId,
    primaryKnowledgeNodeId,
    knowledgeCoverage,
    relatedKnowledgeNodeIds,
    cognitiveLevel,
    conceptCodes,
    skillCodes,
    difficulty,
    accessTier,
    usageContexts,
    editorialStatus,
    isSpecial,
    specialReason: mapped.special_reason || undefined,
    roadmapEligible,
    roadmapPurpose,
    prerequisiteConceptCodes: prereqs,
    estimatedTimeSeconds,
    source: {
      sourceType,
      sourceName: mapped.source_name || defaults.sourceName || undefined,
      sourceYear,
      sourcePage: mapped.source_page || undefined,
      rightsStatus,
    },
    examSetIds: [],
  };
}

// ─── Preview row ──────────────────────────────────────────────────────────────

export async function previewRow(
  mapped: Record<ImportTargetField, string>,
  defaults: ImportDefaults,
  rowIndex: number,
  tree?: KnowledgeTreeDocument
): Promise<ImportRowPreview> {
  const partial = rowToPartialQuestion(mapped, defaults, tree);

  // Duplicate detection
  let conflictExistingId: string | undefined;
  const conflictAction: 'SKIP' | 'UPDATE' | 'CREATE_COPY' = 'SKIP';

  if (partial.externalId) {
    const existing = await getQuestionByExternalId(partial.externalId);
    if (existing) {
      conflictExistingId = existing.id;
    }
  }

  if (!conflictExistingId && partial.stem && partial.options && partial.correctAnswer) {
    const fingerprints = computeQuestionFingerprints(
      partial.stem,
      partial.options,
      partial.correctAnswer
    );
    const existing = await getQuestionByAnyFingerprint(fingerprints);
    if (existing) {
      conflictExistingId = existing.id;
    }
  }

  // All formats share the same strict pre-commit structural gate.
  const selectedNode = tree?.nodes.find((node) => node.id === partial.primaryKnowledgeNodeId);
  const result = validateForImportCandidate({
    ...partial,
    primaryKnowledgeNodeActive: partial.primaryKnowledgeNodeId
      ? isAttachableKnowledgeNode(selectedNode)
      : undefined,
  });

  const warnings = result.warnings.map((w) => ({
    code: w.code,
    message: w.message,
    field: w.field,
  }));
  const errors = result.errors.map((e) => ({ code: e.code, message: e.message, field: e.field }));
  if (partial.primaryKnowledgeNodeId && tree) {
    const hierarchy = deriveHierarchyContext(partial.primaryKnowledgeNodeId, tree);
    if (!hierarchy.subjectId || !hierarchy.grade) {
      errors.push({
        code: 'UNRESOLVABLE_KNOWLEDGE_ANCESTRY',
        message: 'Không thể xác định môn học và lớp từ node kiến thức đã chọn.',
        field: 'knowledge_node_id',
      });
    }
  }

  // Knowledge Graph Validation
  if (partial.conceptCodes && partial.conceptCodes.length > 0) {
    const graph = await readKnowledgeGraph();
    const validCodes = new Set(Array.from(walkKgNodes(graph), ({ node }) => node.id));
    for (const code of partial.conceptCodes) {
      if (!validCodes.has(code)) {
        errors.push({
          code: 'INVALID_KNOWLEDGE_CODE',
          message: 'Mã kiến thức không tồn tại trong Knowledge Tree.',
          field: 'knowledge_code',
        });
      }
    }
  }

  // Extra import-specific warnings
  if (!partial.explanation || partial.explanation.trim().length === 0) {
    if ((partial.editorialStatus ?? 'DRAFT') !== 'DRAFT') {
      warnings.push({
        code: 'MISSING_EXPLANATION',
        message: 'Câu hỏi chưa có giải thích.',
        field: undefined,
      });
    }
  }

  // Tree validation
  if (mapped.knowledge_path && !partial.primaryKnowledgeNodeId) {
    errors.push({
      code: 'INVALID_KNOWLEDGE_PATH',
      message: 'Không tìm thấy node trong Knowledge Tree với đường dẫn đã cho.',
      field: 'knowledge_path',
    });
  }

  // Curriculum label
  const parts: string[] = [];
  if (partial.subjectId) parts.push(partial.subjectId);
  if (partial.grade) parts.push(`Lớp ${partial.grade}`);
  if (partial.chapterId) parts.push(partial.chapterId);
  if (partial.lessonId) parts.push(partial.lessonId);
  const curriculumLabel = parts.join(' · ') || undefined;

  const status: ImportRowPreview['status'] = conflictExistingId
    ? 'DUPLICATE'
    : errors.length > 0
      ? 'ERROR'
      : warnings.length > 0
        ? 'WARNING'
        : 'VALID';

  return {
    rowIndex,
    externalId: partial.externalId,
    stemPreview: (partial.stem ?? '').substring(0, 120),
    status,
    errors,
    warnings,
    proposedAccessTier: partial.accessTier,
    proposedUsageContexts: partial.usageContexts ?? [],
    proposedEditorialStatus: 'DRAFT',
    curriculumLabel,
    sourceLabel: partial.source?.sourceName,
    conflictAction: conflictExistingId ? conflictAction : undefined,
    conflictExistingId,
  };
}

// ─── Commit import ────────────────────────────────────────────────────────────

export interface CommitImportInput {
  jobId: string;
  idempotencyKey: string;
  fileName: string;
  format: 'XLSX' | 'CSV' | 'JSON';
  rows: Array<{
    mapped: Record<ImportTargetField, string>;
    conflictAction?: 'SKIP' | 'UPDATE' | 'CREATE_COPY';
  }>;
  defaults: ImportDefaults;
  allowPartial: boolean;
  actor?: string;
}

export interface CommitResult {
  jobId: string;
  successCount: number;
  warningCount: number;
  failedCount: number;
  duplicateCount: number;
  failedRows: Array<{ rowIndex: number; errors: string[] }>;
}

export async function commitImport(input: CommitImportInput): Promise<CommitResult> {
  // Idempotency check — do not re-import if job already completed
  const existing = await getImportJobByIdempotencyKey(input.idempotencyKey);
  if (existing && (existing.status === 'COMPLETED' || existing.status === 'PARTIAL')) {
    return {
      jobId: existing.id,
      successCount: existing.successRows,
      warningCount: existing.warningRows,
      failedCount: existing.failedRows,
      duplicateCount: existing.duplicateRows,
      failedRows: [],
    };
  }

  // Start job record
  const job: ImportJob = {
    id: input.jobId,
    idempotencyKey: input.idempotencyKey,
    fileName: input.fileName,
    format: input.format,
    importedBy: input.actor,
    createdAt: new Date().toISOString(),
    status: 'IMPORTING',
    totalRows: input.rows.length,
    successRows: 0,
    warningRows: 0,
    failedRows: 0,
    duplicateRows: 0,
  };
  await saveImportJob(job);

  const toSave: Question[] = [];
  const failedRows: Array<{ rowIndex: number; errors: string[] }> = [];
  let successCount = 0;
  let warningCount = 0;
  let duplicateCount = 0;
  const batchFingerprints = new Set<string>();

  const tree = await readKnowledgeTree();
  for (let i = 0; i < input.rows.length; i++) {
    const { mapped, conflictAction = 'SKIP' } = input.rows[i];
    const partial = rowToPartialQuestion(mapped, input.defaults, tree);

    // Duplicate check
    let conflictId: string | undefined;
    if (partial.externalId) {
      const ex = await getQuestionByExternalId(partial.externalId);
      if (ex) conflictId = ex.id;
    }
    if (!conflictId && partial.stem && partial.options && partial.correctAnswer) {
      const fingerprints = computeQuestionFingerprints(
        partial.stem,
        partial.options,
        partial.correctAnswer
      );
      const ex = await getQuestionByAnyFingerprint(fingerprints);
      if (ex) conflictId = ex.id;
      if (
        batchFingerprints.has(fingerprints.stem) ||
        batchFingerprints.has(fingerprints.stemAndOptions) ||
        batchFingerprints.has(fingerprints.full)
      ) {
        duplicateCount++;
        continue;
      }
    }

    if (conflictId && conflictAction === 'SKIP') {
      duplicateCount++;
      continue;
    }

    // Validate
    const selectedNode = tree.nodes.find((node) => node.id === partial.primaryKnowledgeNodeId);
    const valResult = validateForImportCandidate({
      ...partial,
      primaryKnowledgeNodeActive: partial.primaryKnowledgeNodeId
        ? isAttachableKnowledgeNode(selectedNode)
        : undefined,
    });

    const rowErrors = valResult.errors.map((e) => e.message);
    const hierarchy = partial.primaryKnowledgeNodeId
      ? deriveHierarchyContext(partial.primaryKnowledgeNodeId, tree)
      : undefined;
    if (!hierarchy?.subjectId || !hierarchy?.grade) {
      rowErrors.push('Không thể xác định môn học và lớp từ node kiến thức đã chọn.');
    }

    if (partial.conceptCodes && partial.conceptCodes.length > 0) {
      const graph = await readKnowledgeGraph();
      const validCodes = new Set(Array.from(walkKgNodes(graph), ({ node }) => node.id));
      for (const code of partial.conceptCodes) {
        if (!validCodes.has(code)) {
          rowErrors.push('Mã kiến thức không tồn tại trong Knowledge Tree.');
        }
      }
    }

    if (mapped.knowledge_path && !partial.primaryKnowledgeNodeId) {
      rowErrors.push(
        `Không tìm thấy node trong Knowledge Tree với đường dẫn: ${mapped.knowledge_path}`
      );
    }

    if (rowErrors.length > 0 && !input.allowPartial) {
      failedRows.push({ rowIndex: i + 2, errors: rowErrors });
      continue;
    }
    if (rowErrors.length > 0) {
      failedRows.push({ rowIndex: i + 2, errors: rowErrors });
      continue;
    }

    const now = new Date().toISOString();
    const id = conflictId && conflictAction === 'UPDATE' ? conflictId : uuidv4();
    const options = partial.options ?? [];
    const stem = partial.stem ?? '';
    const correctAnswer = partial.correctAnswer ?? '';
    const contentHash = computeContentHash(stem, options, correctAnswer);
    const fingerprints = computeQuestionFingerprints(stem, options, correctAnswer);
    if (!hierarchy?.subjectId || !hierarchy?.grade) continue;
    const code = generateQuestionCode(hierarchy.subjectId);

    const question: Question = {
      id,
      externalId: partial.externalId,
      code,
      stem,
      questionType: partial.questionType ?? 'MULTIPLE_CHOICE_SINGLE',
      options,
      correctAnswer,
      explanation: partial.explanation,
      subjectId: hierarchy.subjectId,
      grade: hierarchy.grade,
      chapterId: hierarchy.chapterId,
      lessonId: hierarchy.lessonId,
      topicId: hierarchy.topicId,
      conceptCodes: partial.conceptCodes ?? [],
      skillCodes: partial.skillCodes ?? [],
      difficulty: partial.difficulty ?? 'INTERMEDIATE',
      accessTier: partial.accessTier ?? 'OPEN',
      usageContexts: partial.usageContexts ?? [],
      editorialStatus: 'DRAFT',
      isSpecial: partial.isSpecial ?? false,
      specialReason: partial.specialReason,
      roadmapEligible: partial.roadmapEligible ?? false,
      roadmapPurpose: partial.roadmapPurpose,
      prerequisiteConceptCodes: partial.prerequisiteConceptCodes ?? [],
      estimatedTimeSeconds: partial.estimatedTimeSeconds,
      source: partial.source ?? {
        sourceType: 'PUBLIC_DOCUMENT',
        rightsStatus: 'REVIEW_REQUIRED',
      },
      contentHash,
      fingerprints,
      examSetIds: [],
      createdAt: conflictId
        ? ((await getQuestionByExternalId(partial.externalId ?? ''))?.createdAt ?? now)
        : now,
      updatedAt: now,
      createdBy: input.actor,
      updatedBy: input.actor,
      importJobId: input.jobId,
      importOrigin: input.format === 'JSON' ? 'API' : 'EXCEL',
    };

    toSave.push(question);
    batchFingerprints.add(fingerprints.stem);
    batchFingerprints.add(fingerprints.stemAndOptions);
    batchFingerprints.add(fingerprints.full);

    const hasWarnings = valResult.warnings.length > 0;
    if (hasWarnings) warningCount++;
    successCount++;
  }

  // Strict mode is import-atomic: one blocking candidate prevents every write.
  if (failedRows.length > 0 && !input.allowPartial) {
    toSave.length = 0;
    successCount = 0;
    warningCount = 0;
  }

  // Persist in one write
  if (toSave.length > 0) {
    await saveManyQuestions(toSave);
    // Record audit entries
    for (const q of toSave) {
      await appendAuditEntry({
        id: uuidv4(),
        questionId: q.id,
        action: 'IMPORTED',
        actor: input.actor,
        timestamp: q.createdAt,
        importJobId: input.jobId,
        importOrigin: q.importOrigin,
        sourcePage: q.source.sourcePage,
      });
    }
  }

  const finalStatus: ImportJob['status'] =
    failedRows.length === 0 ? 'COMPLETED' : input.allowPartial ? 'PARTIAL' : 'FAILED';

  const updatedJob: ImportJob = {
    ...job,
    status: finalStatus,
    completedAt: new Date().toISOString(),
    successRows: successCount,
    warningRows: warningCount,
    failedRows: failedRows.length,
    duplicateRows: duplicateCount,
  };
  await saveImportJob(updatedJob);

  return {
    jobId: input.jobId,
    successCount,
    warningCount,
    failedCount: failedRows.length,
    duplicateCount,
    failedRows,
  };
}
