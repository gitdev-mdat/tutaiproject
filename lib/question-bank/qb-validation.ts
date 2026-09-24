/**
 * Question Bank — Centralized validation.
 *
 * Used by: import pipeline, manual creation, editing, publishing, bulk actions.
 * Never duplicated in UI components.
 */

import type {
  Question,
  QuestionOption,
  QuestionType,
  AccessTier,
  UsageContext,
  EditorialStatus,
  RightsStatus,
} from './qb-types';
import {
  COGNITIVE_LEVEL_VALUES,
  DIFFICULTY_VALUES,
  KNOWLEDGE_COVERAGE_VALUES,
  QUESTION_TYPE_VALUES,
} from './qb-types';

// ─── Validation result ────────────────────────────────────────────────────────

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/** Runtime-facing input accepted by the manual creation boundary. */
export interface ManualQuestionInput {
  stem?: unknown;
  questionType?: unknown;
  options?: unknown;
  trueFalseStatements?: unknown;
  correctAnswer?: unknown;
  explanation?: unknown;
  solutionGuidance?: unknown;
  primaryKnowledgeNodeId?: unknown;
  knowledgeCoverage?: unknown;
  cognitiveLevel?: unknown;
  difficulty?: unknown;
}

export interface ImportCandidateValidationInput extends Partial<Question> {
  /** Resolved by the ingestion boundary against the current Knowledge Tree. */
  primaryKnowledgeNodeActive?: boolean;
}

const MANUAL_OPTION_KEYS = ['A', 'B', 'C', 'D', 'E'] as const;

function isOneOf<T extends readonly unknown[]>(values: T, value: unknown): value is T[number] {
  return values.includes(value);
}

function isManualOption(value: unknown): value is QuestionOption {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const option = value as Record<string, unknown>;
  return typeof option.key === 'string' && typeof option.content === 'string';
}

function isValidNumericValue(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string') return false;

  const normalized = value.trim();
  if (!normalized) return false;
  return (
    /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(normalized) &&
    Number.isFinite(Number(normalized.replace(',', '.')))
  );
}

/**
 * Strict validation for the manual authoring API. Unlike draft validation,
 * this validates every field needed to save a structurally usable question.
 */
export function validateForManualCreation(input: ManualQuestionInput): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (typeof input.stem !== 'string' || input.stem.trim().length === 0) {
    errors.push({ code: 'MISSING_STEM', message: 'Câu hỏi không được để trống.', field: 'stem' });
  }

  if (!isOneOf(QUESTION_TYPE_VALUES, input.questionType)) {
    errors.push({
      code: 'INVALID_QUESTION_TYPE',
      message: 'Loại câu hỏi không hợp lệ.',
      field: 'questionType',
    });
  }

  if (!isOneOf(DIFFICULTY_VALUES, input.difficulty)) {
    errors.push({
      code: 'INVALID_DIFFICULTY',
      message: 'Độ khó không hợp lệ.',
      field: 'difficulty',
    });
  }

  if (!isOneOf(KNOWLEDGE_COVERAGE_VALUES, input.knowledgeCoverage)) {
    errors.push({
      code: 'INVALID_KNOWLEDGE_COVERAGE',
      message: 'Mức bao phủ kiến thức không hợp lệ.',
      field: 'knowledgeCoverage',
    });
  }

  if (!isOneOf(COGNITIVE_LEVEL_VALUES, input.cognitiveLevel)) {
    errors.push({
      code: 'INVALID_COGNITIVE_LEVEL',
      message: 'Mức độ tư duy không hợp lệ.',
      field: 'cognitiveLevel',
    });
  }

  if (
    typeof input.primaryKnowledgeNodeId !== 'string' ||
    input.primaryKnowledgeNodeId.trim().length === 0
  ) {
    errors.push({
      code: 'MISSING_PRIMARY_KNOWLEDGE_NODE',
      message: 'Cần chọn mục kiến thức chính.',
      field: 'primaryKnowledgeNodeId',
    });
  }

  if (input.explanation !== undefined && typeof input.explanation !== 'string') {
    errors.push({
      code: 'INVALID_EXPLANATION',
      message: 'Lời giải phải là văn bản.',
      field: 'explanation',
    });
  }

  if (input.solutionGuidance !== undefined && typeof input.solutionGuidance !== 'string') {
    errors.push({
      code: 'INVALID_SOLUTION_GUIDANCE',
      message: 'Hướng dẫn giải phải là văn bản.',
      field: 'solutionGuidance',
    });
  }

  if (!isOneOf(QUESTION_TYPE_VALUES, input.questionType)) {
    return { valid: errors.length === 0, errors, warnings };
  }

  const choiceQuestion =
    input.questionType === 'MULTIPLE_CHOICE_SINGLE' ||
    input.questionType === 'MULTIPLE_CHOICE_MULTIPLE';

  let options: QuestionOption[] = [];
  if (choiceQuestion) {
    if (!Array.isArray(input.options)) {
      errors.push({
        code: 'INVALID_OPTIONS',
        message: 'Danh sách phương án không hợp lệ.',
        field: 'options',
      });
    } else if (input.options.length < 2 || input.options.length > 5) {
      errors.push({
        code: input.options.length < 2 ? 'TOO_FEW_OPTIONS' : 'TOO_MANY_OPTIONS',
        message: 'Câu trắc nghiệm phải có từ 2 đến 5 phương án.',
        field: 'options',
      });
    } else if (!input.options.every(isManualOption)) {
      errors.push({
        code: 'INVALID_OPTIONS',
        message: 'Mỗi phương án phải có mã và nội dung dạng văn bản.',
        field: 'options',
      });
    } else {
      options = input.options;
      options.forEach((option, index) => {
        if (option.key !== MANUAL_OPTION_KEYS[index]) {
          errors.push({
            code: 'NON_SEQUENTIAL_OPTION_KEYS',
            message: 'Mã phương án phải liên tiếp từ A đến E.',
            field: `options.${index}.key`,
          });
        }
        if (option.content.trim().length === 0) {
          errors.push({
            code: 'EMPTY_OPTION_CONTENT',
            message: `Phương án ${MANUAL_OPTION_KEYS[index]} không được để trống.`,
            field: `options.${index}.content`,
          });
        }
      });
    }
  } else if (
    input.options !== undefined &&
    (!Array.isArray(input.options) || input.options.length > 0)
  ) {
    errors.push({
      code: 'OPTIONS_NOT_ALLOWED',
      message: 'Loại câu hỏi này không sử dụng danh sách phương án.',
      field: 'options',
    });
  }

  switch (input.questionType) {
    case 'MULTIPLE_CHOICE_SINGLE': {
      if (typeof input.correctAnswer !== 'string' || !/^[A-E]$/.test(input.correctAnswer)) {
        errors.push({
          code: 'INVALID_SINGLE_ANSWER',
          message: 'Câu một đáp án phải có đúng một mã đáp án từ A đến E.',
          field: 'correctAnswer',
        });
      } else if (
        options.length > 0 &&
        !options.some((option) => option.key === input.correctAnswer)
      ) {
        errors.push({
          code: 'ANSWER_NOT_IN_OPTIONS',
          message: 'Đáp án đúng không khớp với phương án nào.',
          field: 'correctAnswer',
        });
      }
      break;
    }

    case 'MULTIPLE_CHOICE_MULTIPLE': {
      if (typeof input.correctAnswer !== 'string' || input.correctAnswer.length === 0) {
        errors.push({
          code: 'MISSING_CORRECT_ANSWER',
          message: 'Cần chọn ít nhất một đáp án đúng.',
          field: 'correctAnswer',
        });
        break;
      }

      const answerKeys = input.correctAnswer.split(',').map((key) => key.trim().toUpperCase());
      const uniqueAnswerKeys = new Set(answerKeys);
      if (
        answerKeys.some((key) => !/^[A-E]$/.test(key)) ||
        uniqueAnswerKeys.size !== answerKeys.length
      ) {
        errors.push({
          code: 'INVALID_MULTIPLE_ANSWER',
          message: 'Đáp án phải là các mã A–E duy nhất và ngăn cách bằng dấu phẩy.',
          field: 'correctAnswer',
        });
      } else if (
        options.length > 0 &&
        answerKeys.some((key) => !options.some((option) => option.key === key))
      ) {
        errors.push({
          code: 'ANSWER_NOT_IN_OPTIONS',
          message: 'Có đáp án đúng không khớp với phương án nào.',
          field: 'correctAnswer',
        });
      }
      break;
    }

    case 'TRUE_FALSE': {
      // Accept the legacy scalar shape at the boundary so existing stored/imported
      // questions remain editable; all new authoring emits grouped statements.
      if (
        !Array.isArray(input.trueFalseStatements) &&
        (input.correctAnswer === 'TRUE' || input.correctAnswer === 'FALSE')
      ) {
        break;
      }
      if (!Array.isArray(input.trueFalseStatements) || input.trueFalseStatements.length < 2) {
        errors.push({
          code: 'TOO_FEW_TRUE_FALSE_STATEMENTS',
          message: 'Câu Đúng/Sai phải có ít nhất hai mệnh đề.',
          field: 'trueFalseStatements',
        });
      } else {
        input.trueFalseStatements.forEach((value, index) => {
          const statement = value as Record<string, unknown>;
          if (
            !value ||
            typeof value !== 'object' ||
            typeof statement.content !== 'string' ||
            !statement.content.trim()
          ) {
            errors.push({
              code: 'INVALID_TRUE_FALSE_STATEMENT',
              message: `Mệnh đề ${index + 1} không được để trống.`,
              field: `trueFalseStatements.${index}.content`,
            });
          }
          if (typeof statement.isTrue !== 'boolean') {
            errors.push({
              code: 'MISSING_TRUE_FALSE_ANSWER',
              message: `Mệnh đề ${index + 1} cần có đáp án Đúng hoặc Sai.`,
              field: `trueFalseStatements.${index}.isTrue`,
            });
          }
        });
      }
      break;
    }

    case 'SHORT_ANSWER':
      if (typeof input.correctAnswer !== 'string' || input.correctAnswer.trim().length === 0) {
        errors.push({
          code: 'MISSING_SHORT_ANSWER',
          message: 'Đáp án tham khảo không được để trống.',
          field: 'correctAnswer',
        });
      }
      break;

    case 'NUMERIC':
      if (!isValidNumericValue(input.correctAnswer)) {
        errors.push({
          code: 'INVALID_NUMERIC_ANSWER',
          message: 'Đáp án phải là một số hợp lệ.',
          field: 'correctAnswer',
        });
      }
      break;
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Publishing rules ─────────────────────────────────────────────────────────

/**
 * Full validation required before a question can be PUBLISHED.
 * Returns hard errors (must not publish if any) and warnings (visible but not blocking).
 */
/** Strict structural gate shared by every import format before commit. */
export function validateForImportCandidate(
  input: ImportCandidateValidationInput
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!input.stem?.trim()) {
    errors.push({ code: 'MISSING_STEM', message: 'Câu hỏi không được để trống.', field: 'stem' });
  }
  if (!input.questionType || !QUESTION_TYPE_VALUES.includes(input.questionType)) {
    errors.push({
      code: 'INVALID_QUESTION_TYPE',
      message: 'Loại câu hỏi không hợp lệ.',
      field: 'questionType',
    });
  } else {
    errors.push(...validateAnswer(input.questionType, input.options ?? [], input.correctAnswer));
    if (
      input.questionType === 'MULTIPLE_CHOICE_SINGLE' ||
      input.questionType === 'MULTIPLE_CHOICE_MULTIPLE'
    ) {
      const options = input.options ?? [];
      const keys = options.map((option) => option.key.trim().toUpperCase());
      if (new Set(keys).size !== keys.length) {
        errors.push({
          code: 'DUPLICATE_OPTION_KEYS',
          message: 'Mã các phương án trắc nghiệm không được trùng nhau.',
          field: 'options',
        });
      }
      options.forEach((option, index) => {
        if (!option.content.trim()) {
          errors.push({
            code: 'EMPTY_OPTION_CONTENT',
            message: `Phương án ${option.key || index + 1} không được để trống.`,
            field: `options.${index}.content`,
          });
        }
      });
    }
  }

  if (!input.primaryKnowledgeNodeId?.trim()) {
    errors.push({
      code: 'MISSING_PRIMARY_KNOWLEDGE_NODE',
      message: 'Chưa xác định kiến thức. Hãy chọn mục kiến thức trước khi duyệt câu hỏi.',
      field: 'primaryKnowledgeNodeId',
    });
  } else if (input.primaryKnowledgeNodeActive === false) {
    errors.push({
      code: 'INACTIVE_PRIMARY_KNOWLEDGE_NODE',
      message: 'Mục kiến thức đã chọn không hoạt động hoặc không thể gắn câu hỏi.',
      field: 'primaryKnowledgeNodeId',
    });
  }

  if (!input.source?.rightsStatus || input.source.rightsStatus === 'REVIEW_REQUIRED') {
    warnings.push({
      code: 'RIGHTS_REVIEW_REQUIRED',
      message: 'Cần xem xét trạng thái bản quyền trước khi xuất bản.',
      field: 'source.rightsStatus',
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateForPublishing(question: Partial<Question>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Stem
  if (!question.stem || question.stem.trim().length === 0) {
    errors.push({ code: 'MISSING_STEM', message: 'Câu hỏi không được để trống.', field: 'stem' });
  }

  // Question type
  if (!question.questionType) {
    errors.push({
      code: 'MISSING_QUESTION_TYPE',
      message: 'Loại câu hỏi là bắt buộc.',
      field: 'questionType',
    });
  }

  // Answer validation by type
  if (question.questionType && question.options !== undefined) {
    const answerErrors = validateAnswer(
      question.questionType,
      question.options,
      question.correctAnswer
    );
    errors.push(...answerErrors);
  }

  // Subject & grade
  if (!question.subjectId) {
    errors.push({
      code: 'MISSING_SUBJECT',
      message: 'Môn học là bắt buộc.',
      field: 'subjectId',
    });
  }
  if (!question.grade) {
    errors.push({ code: 'MISSING_GRADE', message: 'Lớp là bắt buộc.', field: 'grade' });
  }

  // At least one curriculum/concept/skill mapping
  const hasCurriculumMapping = question.chapterId || question.lessonId || question.topicId;
  const hasConceptMapping =
    (question.conceptCodes ?? []).length > 0 || (question.skillCodes ?? []).length > 0;
  if (!hasCurriculumMapping && !hasConceptMapping) {
    errors.push({
      code: 'MISSING_MAPPING',
      message: 'Câu hỏi phải được gắn với ít nhất một chương, bài, chủ đề, khái niệm hoặc kỹ năng.',
    });
  }

  // Access tier
  if (!question.accessTier) {
    errors.push({
      code: 'MISSING_ACCESS_TIER',
      message: 'Phân cấp truy cập là bắt buộc.',
      field: 'accessTier',
    });
  }

  // Usage context
  if (!question.usageContexts || question.usageContexts.length === 0) {
    errors.push({
      code: 'MISSING_USAGE_CONTEXT',
      message: 'Ít nhất một ngữ cảnh sử dụng là bắt buộc.',
      field: 'usageContexts',
    });
  }

  // Source & rights
  if (!question.source?.rightsStatus) {
    errors.push({
      code: 'MISSING_RIGHTS_STATUS',
      message: 'Trạng thái bản quyền là bắt buộc.',
      field: 'source.rightsStatus',
    });
  }
  if (question.source?.rightsStatus === 'REVIEW_REQUIRED') {
    errors.push({
      code: 'RIGHTS_REVIEW_REQUIRED',
      message:
        'Câu hỏi có trạng thái bản quyền "Cần xem xét" không thể xuất bản. Hãy giải quyết trước.',
      field: 'source.rightsStatus',
    });
  }

  // Special curated rules
  if (question.isSpecial) {
    if (question.accessTier !== 'PLUS') {
      errors.push({
        code: 'SPECIAL_REQUIRES_PLUS',
        message: 'Câu hỏi đặc biệt phải có phân cấp truy cập PLUS.',
        field: 'accessTier',
      });
    }
    if (!question.usageContexts?.includes('PLUS_SPECIAL')) {
      errors.push({
        code: 'SPECIAL_REQUIRES_PLUS_SPECIAL_CONTEXT',
        message: 'Câu hỏi đặc biệt phải có ngữ cảnh PLUS_SPECIAL.',
        field: 'usageContexts',
      });
    }
    if (!question.specialReason || question.specialReason.trim().length === 0) {
      errors.push({
        code: 'SPECIAL_REQUIRES_REASON',
        message: 'Lý do đặc biệt là bắt buộc cho câu hỏi đặc biệt.',
        field: 'specialReason',
      });
    }
  }

  // Roadmap eligibility rules
  if (question.roadmapEligible) {
    if (!hasConceptMapping) {
      errors.push({
        code: 'ROADMAP_REQUIRES_CONCEPT',
        message: 'Câu hỏi lộ trình phải được gắn với ít nhất một khái niệm hoặc kỹ năng.',
      });
    }
    if (!question.estimatedTimeSeconds || question.estimatedTimeSeconds <= 0) {
      errors.push({
        code: 'ROADMAP_REQUIRES_TIME',
        message: 'Thời gian ước tính phải là số dương cho câu hỏi lộ trình.',
        field: 'estimatedTimeSeconds',
      });
    }
    if (!question.usageContexts?.includes('ROADMAP')) {
      errors.push({
        code: 'ROADMAP_REQUIRES_ROADMAP_CONTEXT',
        message: 'Câu hỏi lộ trình phải có ngữ cảnh ROADMAP.',
        field: 'usageContexts',
      });
    }

    // Warnings for roadmap
    if (!question.prerequisiteConceptCodes || question.prerequisiteConceptCodes.length === 0) {
      warnings.push({
        code: 'ROADMAP_NO_PREREQUISITES',
        message: 'Câu hỏi lộ trình chưa có khái niệm tiên quyết.',
        field: 'prerequisiteConceptCodes',
      });
    }
  }

  // Explanation
  if (!question.explanation || question.explanation.trim().length === 0) {
    warnings.push({
      code: 'MISSING_EXPLANATION',
      message: 'Chưa có giải thích. Khuyến nghị thêm giải thích trước khi xuất bản.',
      field: 'explanation',
    });
  }

  // Source year
  if (!question.source?.sourceYear) {
    warnings.push({
      code: 'MISSING_SOURCE_YEAR',
      message: 'Năm nguồn chưa được cung cấp.',
      field: 'source.sourceYear',
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Lighter validation for DRAFT status — only requires a stem.
 */
export function validateForDraft(question: Partial<Question>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!question.stem || question.stem.trim().length === 0) {
    errors.push({ code: 'MISSING_STEM', message: 'Câu hỏi không được để trống.', field: 'stem' });
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validation required before moving to IN_REVIEW.
 */
export function validateForReview(question: Partial<Question>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!question.stem || question.stem.trim().length === 0) {
    errors.push({ code: 'MISSING_STEM', message: 'Câu hỏi không được để trống.', field: 'stem' });
  }

  if (!question.questionType) {
    errors.push({
      code: 'MISSING_QUESTION_TYPE',
      message: 'Loại câu hỏi là bắt buộc.',
      field: 'questionType',
    });
  }

  if (question.questionType && question.options !== undefined) {
    const answerErrors = validateAnswer(
      question.questionType,
      question.options,
      question.correctAnswer
    );
    errors.push(...answerErrors);
  }

  if (!question.subjectId) {
    errors.push({
      code: 'MISSING_SUBJECT',
      message: 'Môn học là bắt buộc.',
      field: 'subjectId',
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Answer validation by type ────────────────────────────────────────────────

export function validateAnswer(
  questionType: QuestionType,
  options: QuestionOption[],
  correctAnswer: string | undefined
): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (questionType) {
    case 'MULTIPLE_CHOICE_SINGLE': {
      if (options.length < 2) {
        errors.push({
          code: 'TOO_FEW_OPTIONS',
          message: 'Câu trắc nghiệm cần ít nhất 2 lựa chọn.',
          field: 'options',
        });
      }
      if (!correctAnswer || correctAnswer.trim().length === 0) {
        errors.push({
          code: 'MISSING_CORRECT_ANSWER',
          message: 'Đáp án đúng là bắt buộc.',
          field: 'correctAnswer',
        });
      } else {
        const parts = correctAnswer.split(',').map((s) => s.trim());
        if (parts.length !== 1) {
          errors.push({
            code: 'SINGLE_CHOICE_MULTIPLE_ANSWERS',
            message: 'Câu trắc nghiệm 1 đáp án chỉ được có 1 đáp án đúng.',
            field: 'correctAnswer',
          });
        } else {
          const optionKeys = options.map((o) => o.key.toUpperCase());
          if (!optionKeys.includes(parts[0].toUpperCase())) {
            errors.push({
              code: 'ANSWER_NOT_IN_OPTIONS',
              message: `Đáp án "${parts[0]}" không khớp với lựa chọn nào.`,
              field: 'correctAnswer',
            });
          }
        }
      }
      break;
    }

    case 'MULTIPLE_CHOICE_MULTIPLE': {
      if (options.length < 2) {
        errors.push({
          code: 'TOO_FEW_OPTIONS',
          message: 'Câu trắc nghiệm cần ít nhất 2 lựa chọn.',
          field: 'options',
        });
      }
      if (!correctAnswer || correctAnswer.trim().length === 0) {
        errors.push({
          code: 'MISSING_CORRECT_ANSWER',
          message: 'Ít nhất một đáp án đúng là bắt buộc.',
          field: 'correctAnswer',
        });
      } else {
        const parts = correctAnswer.split(',').map((s) => s.trim().toUpperCase());
        const optionKeys = options.map((o) => o.key.toUpperCase());
        for (const part of parts) {
          if (!optionKeys.includes(part)) {
            errors.push({
              code: 'ANSWER_NOT_IN_OPTIONS',
              message: `Đáp án "${part}" không khớp với lựa chọn nào.`,
              field: 'correctAnswer',
            });
          }
        }
      }
      break;
    }

    case 'TRUE_FALSE': {
      if (
        !correctAnswer ||
        !['TRUE', 'FALSE', 'ĐÚNG', 'SAI'].includes(correctAnswer.trim().toUpperCase())
      ) {
        errors.push({
          code: 'INVALID_TRUE_FALSE_ANSWER',
          message: 'Đáp án Đúng/Sai phải là TRUE hoặc FALSE.',
          field: 'correctAnswer',
        });
      }
      break;
    }

    case 'SHORT_ANSWER': {
      if (!correctAnswer || correctAnswer.trim().length === 0) {
        errors.push({
          code: 'MISSING_SHORT_ANSWER',
          message: 'Ít nhất một đáp án chấp nhận được là bắt buộc.',
          field: 'correctAnswer',
        });
      }
      break;
    }

    case 'NUMERIC': {
      if (!correctAnswer || correctAnswer.trim().length === 0) {
        errors.push({
          code: 'MISSING_NUMERIC_ANSWER',
          message: 'Đáp án số là bắt buộc.',
          field: 'correctAnswer',
        });
      } else if (isNaN(Number(correctAnswer.trim().replace(',', '.')))) {
        errors.push({
          code: 'INVALID_NUMERIC_ANSWER',
          message: 'Đáp án phải là số.',
          field: 'correctAnswer',
        });
      }
      break;
    }
  }

  return errors;
}

// ─── Special-question rules ───────────────────────────────────────────────────

export function validateSpecialQuestion(
  isSpecial: boolean,
  accessTier: AccessTier | undefined,
  usageContexts: UsageContext[],
  specialReason: string | undefined
): ValidationError[] {
  if (!isSpecial) return [];
  const errors: ValidationError[] = [];

  if (accessTier !== 'PLUS') {
    errors.push({
      code: 'SPECIAL_REQUIRES_PLUS',
      message: 'Câu hỏi đặc biệt phải có phân cấp truy cập PLUS.',
      field: 'accessTier',
    });
  }
  if (!usageContexts.includes('PLUS_SPECIAL')) {
    errors.push({
      code: 'SPECIAL_REQUIRES_PLUS_SPECIAL_CONTEXT',
      message: 'Câu hỏi đặc biệt phải có ngữ cảnh PLUS_SPECIAL.',
      field: 'usageContexts',
    });
  }
  if (!specialReason || specialReason.trim().length === 0) {
    errors.push({
      code: 'SPECIAL_REQUIRES_REASON',
      message: 'Lý do đặc biệt là bắt buộc.',
      field: 'specialReason',
    });
  }

  return errors;
}

// ─── Rights block ─────────────────────────────────────────────────────────────

export function rightsBlocksPublish(rightsStatus: RightsStatus | undefined): boolean {
  return rightsStatus === 'REVIEW_REQUIRED';
}

// ─── Editorial status transitions ─────────────────────────────────────────────

export function isValidStatusTransition(current: EditorialStatus, next: EditorialStatus): boolean {
  const transitions: Record<EditorialStatus, EditorialStatus[]> = {
    DRAFT: ['IN_REVIEW', 'ARCHIVED'],
    IN_REVIEW: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
    PUBLISHED: ['ARCHIVED'],
    ARCHIVED: ['DRAFT'],
  };
  return transitions[current]?.includes(next) ?? false;
}
