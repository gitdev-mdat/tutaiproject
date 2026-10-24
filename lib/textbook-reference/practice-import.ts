import { randomUUID } from 'node:crypto';
import {
  computeContentHash,
  computeQuestionFingerprints,
  generateQuestionCode,
} from '@/lib/question-bank/qb-hash';
import type { DerivedHierarchy } from '@/lib/question-bank/qb-knowledge-utils';
import type {
  Question,
  QuestionAuditEntry,
  RightsStatus,
  TextbookQuestionSource,
} from '@/lib/question-bank/qb-types';
import { validateForManualCreation } from '@/lib/question-bank/qb-validation';
import type { ExercisePracticeView } from './practice-state';

/**
 * Verified textbook exercises → DRAFT questions in the existing Question Bank.
 * The bank stays the only store of practice questions and its own review and
 * publishing workflow decides what students get; nothing here publishes.
 *
 * Idempotent: each exercise maps to one question (`externalId`), so importing
 * again updates that question while it is an untouched draft and otherwise
 * leaves it alone. A question already in review, published or archived, or a
 * draft an Admin edited in the bank, is never overwritten, so its id, its
 * students' attempts and its history stay as they are.
 */

export const textbookExternalId = (exerciseArtifactId: string) => `textbook:${exerciseArtifactId}`;

export interface TextbookImportItem {
  view: ExercisePracticeView;
  documentTitle: string;
  solutionPages: number[];
  hierarchy: DerivedHierarchy;
}

export type TextbookImportOutcome = {
  exerciseId: string;
  questionNumber: string | null;
  result: 'CREATED' | 'UPDATED' | 'UNCHANGED' | 'SKIPPED';
  questionId?: string;
  questionCode?: string;
  reason?: string;
};

const STATUS_LABEL: Record<Question['editorialStatus'], string> = {
  DRAFT: 'bản nháp',
  IN_REVIEW: 'đang chờ duyệt',
  PUBLISHED: 'đã xuất bản',
  ARCHIVED: 'đã gỡ',
};

function questionFields(item: TextbookImportItem, rights: RightsStatus, now: string) {
  const { view } = item;
  const options = view.choices.map((choice) => ({
    key: choice.label,
    content: choice.text.trim(),
  }));
  const textbookSource: TextbookQuestionSource = {
    documentId: view.documentId,
    documentTitle: item.documentTitle,
    exerciseArtifactId: view.id,
    solutionArtifactId: view.verification?.solutionArtifactId ?? null,
    exerciseSetEntryId: view.entryId,
    questionNumber: view.questionNumber,
    exercisePages: view.printedPages,
    solutionPages: item.solutionPages,
    verification: view.verification!.method,
    verifiedBy: view.verification!.by,
    verifiedAt: view.verification!.at,
    ...(view.check.status === 'CONFIRMED' || view.check.status === 'AMBIGUOUS'
      ? { answerCheck: view.check.note }
      : {}),
    ...(view.citation ? { citation: view.citation } : {}),
    importedAt: now,
  };
  const pages = [
    `đề tr. ${view.printedPages.join(', ')}`,
    item.solutionPages.length ? `lời giải tr. ${item.solutionPages.join(', ')}` : null,
  ].filter(Boolean);
  return {
    stem: view.stem,
    questionType: 'MULTIPLE_CHOICE_SINGLE' as const,
    options,
    correctAnswer: view.answer!,
    explanation: view.explanation.trim(),
    subjectId: item.hierarchy.subjectId!,
    grade: item.hierarchy.grade!,
    chapterId: item.hierarchy.chapterId,
    lessonId: item.hierarchy.lessonId,
    topicId: item.hierarchy.topicId,
    primaryKnowledgeNodeId: view.lesson!.lessonId,
    source: {
      sourceType: 'LICENSED_MATERIAL' as const,
      sourceName: item.documentTitle,
      sourcePage: pages.join('; '),
      rightsStatus: rights,
    },
    contentHash: computeContentHash(view.stem, options, view.answer!),
    textbookSource,
    importOrigin: 'PDF' as const,
  };
}

/** Same exercise, same import: nothing a student would see differs. */
function sameContent(question: Question, fields: ReturnType<typeof questionFields>) {
  return (
    question.contentHash === fields.contentHash &&
    (question.explanation ?? '') === fields.explanation &&
    question.primaryKnowledgeNodeId === fields.primaryKnowledgeNodeId &&
    question.source.rightsStatus === fields.source.rightsStatus
  );
}

/**
 * Applies an import to the bank's question list (called under its lock).
 * Returns the new list, one outcome per item, and the audit entries to append.
 */
export function applyTextbookImport(
  questions: Question[],
  items: TextbookImportItem[],
  options: { rights: RightsStatus; actor: string; now: string }
): { questions: Question[]; outcomes: TextbookImportOutcome[]; audits: QuestionAuditEntry[] } {
  const next = [...questions];
  const outcomes: TextbookImportOutcome[] = [];
  const audits: QuestionAuditEntry[] = [];
  for (const item of items) {
    const { view } = item;
    const base = { exerciseId: view.id, questionNumber: view.questionNumber };
    if (view.blockers.length) {
      outcomes.push({ ...base, result: 'SKIPPED', reason: view.blockers[0] });
      continue;
    }
    if (!item.hierarchy.subjectId || !item.hierarchy.grade) {
      outcomes.push({
        ...base,
        result: 'SKIPPED',
        reason: 'Không xác định được môn và lớp của bài đã chọn.',
      });
      continue;
    }
    const externalId = textbookExternalId(view.id);
    const index = next.findIndex(
      (question) =>
        question.externalId === externalId ||
        (!!view.imported && question.id === view.imported.questionId)
    );
    const fields = questionFields(item, options.rights, options.now);
    const check = validateForManualCreation({
      ...fields,
      knowledgeCoverage: 'FOCUS',
      cognitiveLevel: 'COMPREHENSION',
      difficulty: 'FOUNDATIONAL',
    });
    if (!check.valid) {
      outcomes.push({
        ...base,
        result: 'SKIPPED',
        reason: check.errors.map((e) => e.message).join(' '),
      });
      continue;
    }
    // The same question entered another way (manual entry, another book, a file import).
    const fingerprint = computeQuestionFingerprints(
      fields.stem,
      fields.options,
      fields.correctAnswer
    );
    const duplicate = next.find((question, i) => {
      if (i === index) return false;
      const own =
        question.fingerprints ??
        computeQuestionFingerprints(question.stem, question.options, question.correctAnswer);
      return own.stemAndOptions === fingerprint.stemAndOptions;
    });
    if (duplicate) {
      outcomes.push({
        ...base,
        result: 'SKIPPED',
        questionId: duplicate.id,
        questionCode: duplicate.code,
        reason: `Trùng câu ${duplicate.code} đã có trong Ngân hàng câu hỏi.`,
      });
      continue;
    }
    if (index >= 0) {
      const existing = next[index];
      const found = { questionId: existing.id, questionCode: existing.code };
      if (existing.editorialStatus !== 'DRAFT') {
        outcomes.push({
          ...base,
          ...found,
          result: 'UNCHANGED',
          reason: `Câu đã ${STATUS_LABEL[existing.editorialStatus]} trong Ngân hàng: không ghi đè. Sửa trực tiếp trong Ngân hàng câu hỏi nếu cần.`,
        });
        continue;
      }
      if (sameContent(existing, fields)) {
        outcomes.push({
          ...base,
          ...found,
          result: 'UNCHANGED',
          reason: 'Đã có trong Ngân hàng, không có gì mới.',
        });
        continue;
      }
      if (existing.updatedAt !== existing.textbookSource?.importedAt) {
        outcomes.push({
          ...base,
          ...found,
          result: 'UNCHANGED',
          reason: 'Bản nháp đã được sửa trong Ngân hàng câu hỏi: không ghi đè.',
        });
        continue;
      }
      next[index] = {
        ...existing,
        ...fields,
        fingerprints: fingerprint,
        updatedAt: options.now,
        updatedBy: options.actor,
      };
      audits.push({
        id: `audit-${randomUUID()}`,
        questionId: existing.id,
        action: 'UPDATED',
        actor: options.actor,
        timestamp: options.now,
        importOrigin: 'PDF',
        sourcePage: fields.source.sourcePage,
        note: `Cập nhật bản nháp từ bài tập sách “${item.documentTitle}” (Câu ${view.questionNumber ?? '?'})`,
      });
      outcomes.push({ ...base, ...found, result: 'UPDATED' });
      continue;
    }
    const question: Question = {
      id: `q-${randomUUID()}`,
      externalId,
      code: generateQuestionCode(fields.subjectId),
      ...fields,
      fingerprints: fingerprint,
      knowledgeCoverage: 'FOCUS',
      relatedKnowledgeNodeIds: [],
      cognitiveLevel: 'COMPREHENSION',
      conceptCodes: [],
      skillCodes: [],
      difficulty: 'FOUNDATIONAL',
      accessTier: 'OPEN',
      usageContexts: [],
      editorialStatus: 'DRAFT',
      isSpecial: false,
      roadmapEligible: false,
      prerequisiteConceptCodes: [],
      examSetIds: [],
      createdAt: options.now,
      updatedAt: options.now,
      createdBy: options.actor,
    };
    next.push(question);
    audits.push({
      id: `audit-${randomUUID()}`,
      questionId: question.id,
      action: 'IMPORTED',
      actor: options.actor,
      timestamp: options.now,
      importOrigin: 'PDF',
      sourcePage: fields.source.sourcePage,
      note: `Nhập từ bài tập sách “${item.documentTitle}” (Câu ${view.questionNumber ?? '?'}); đáp án ${
        view.verification!.method === 'ADMIN_SOLVED'
          ? 'do Admin tự giải'
          : 'theo lời giải in trong sách, Admin xác nhận'
      }`,
    });
    outcomes.push({
      ...base,
      result: 'CREATED',
      questionId: question.id,
      questionCode: question.code,
    });
  }
  return { questions: next, outcomes, audits };
}
