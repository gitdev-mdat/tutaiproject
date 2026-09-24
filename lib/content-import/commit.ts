import 'server-only';

import { randomUUID } from 'crypto';
import {
  computeContentHash,
  computeQuestionFingerprints,
  generateQuestionCode,
} from '@/lib/question-bank/qb-hash';
import {
  appendAuditEntry,
  getQuestion,
  getQuestionByAnyFingerprint,
  saveQuestion,
} from '@/lib/question-bank/qb-storage';
import type { Question, RightsStatus, SourceType } from '@/lib/question-bank/qb-types';
import { validateForImportCandidate } from '@/lib/question-bank/qb-validation';
import { readKnowledgeTree } from '@/lib/knowledge-tree/knowledge-tree-storage';
import {
  deriveHierarchyContext,
  isAttachableKnowledgeNode,
} from '@/lib/question-bank/qb-knowledge-utils';
import { materializeQuestionAssets, requireImportSession, saveImportSession } from './storage';
import type { ImportRightsStatus, QuestionCandidate } from './types';
import { candidateContent, recomputeMediaReadiness } from './media-readiness';

function canonicalRights(value: ImportRightsStatus): RightsStatus {
  const mapping: Record<ImportRightsStatus, RightsStatus> = {
    OFFICIAL_SOURCE: 'PUBLICLY_AVAILABLE',
    PERMISSION_GRANTED: 'PERMISSION_GRANTED',
    OPEN_LICENSE: 'LICENSED',
    INTERNAL_CONTENT: 'OWNED',
    UNVERIFIED: 'REVIEW_REQUIRED',
    RESTRICTED: 'REVIEW_REQUIRED',
  };
  return mapping[value];
}

function canonicalSourceType(value: ImportRightsStatus): SourceType {
  if (value === 'INTERNAL_CONTENT') return 'INTERNAL_EDITORIAL';
  if (value === 'PERMISSION_GRANTED') return 'TEACHER_CONTRIBUTION';
  if (value === 'OPEN_LICENSE') return 'LICENSED_MATERIAL';
  return 'PUBLIC_DOCUMENT';
}

export async function commitCandidateToQuestion(
  sessionId: string,
  candidateId: string,
  candidatePatch?: Partial<QuestionCandidate>
): Promise<{ candidate: QuestionCandidate; question: Question }> {
  const session = await requireImportSession(sessionId);
  const index = session.candidates.findIndex((candidate) => candidate.id === candidateId);
  if (index < 0) throw new Error('Question candidate was not found.');
  const candidate = recomputeMediaReadiness({ ...session.candidates[index], ...candidatePatch });
  if (candidate.reviewLevel === 'BLOCKING') {
    throw new Error(
      'Câu hỏi còn thiếu nội dung hoặc hình minh họa bắt buộc; không thể duyệt ngầm.'
    );
  }
  if (candidate.questionId) {
    const existing = await getQuestion(candidate.questionId);
    if (existing) return { candidate, question: existing };
  }

  const metadata = session.examMetadata;
  const singleSource = session.singleQuestionSource;
  const importedRights = metadata?.rightsStatus ?? singleSource?.rightsStatus ?? 'UNVERIFIED';
  const tree = await readKnowledgeTree();
  const selectedNode = tree.nodes.find((node) => node.id === candidate.primaryKnowledgeNodeId);
  const validation = validateForImportCandidate({
    stem: candidate.content,
    questionType: candidate.questionType,
    options: candidate.options,
    correctAnswer: candidate.correctAnswer,
    primaryKnowledgeNodeId: candidate.primaryKnowledgeNodeId,
    primaryKnowledgeNodeActive: candidate.primaryKnowledgeNodeId
      ? isAttachableKnowledgeNode(selectedNode)
      : undefined,
    source: {
      sourceType: canonicalSourceType(importedRights),
      rightsStatus: canonicalRights(importedRights),
    },
  });
  if (!validation.valid) {
    throw new Error(validation.errors.map((error) => error.message).join(' '));
  }
  if (!candidate.primaryKnowledgeNodeId) {
    throw new Error('A primary Knowledge Tree node is required before commit.');
  }
  const hierarchy = deriveHierarchyContext(candidate.primaryKnowledgeNodeId, tree);
  if (!hierarchy.subjectId || !hierarchy.grade) {
    throw new Error(
      'The selected Knowledge Tree node does not resolve to a canonical subject and grade.'
    );
  }

  const fingerprints = computeQuestionFingerprints(
    candidate.content,
    candidate.options,
    candidate.correctAnswer
  );
  const duplicate = await getQuestionByAnyFingerprint(fingerprints);
  if (duplicate) throw new Error(`Duplicate question already exists: ${duplicate.code}.`);

  const now = new Date().toISOString();
  const id = randomUUID();
  const assets = await materializeQuestionAssets(session, candidate, id);
  const sourcePage = candidate.sourcePageIds
    .map((pageId) => session.pages.find((page) => page.id === pageId)?.order)
    .filter((order): order is number => typeof order === 'number')
    .join(', ');
  const sourcePageLabel = sourcePage || candidate.sourcePages?.join(', ');
  const sourceNotes: string[] = [];
  if (
    candidate.detectedSelectedAnswer ||
    candidate.warnings.some((warning) => warning.code === 'HANDWRITING_DETECTED')
  ) {
    sourceNotes.push(
      `Source annotation selected ${candidate.detectedSelectedAnswer || 'an unknown answer'}; it was not treated as the answer key.`
    );
  }
  if (candidate.sourceBounds) {
    const { x, y, width, height } = candidate.sourceBounds;
    sourceNotes.push(`Source bounds: x=${x}, y=${y}, width=${width}, height=${height}.`);
  }
  const question: Question = {
    id,
    code: generateQuestionCode(hierarchy.subjectId),
    stem: candidateContent(candidate)
      .filter((block) => block.type === 'TEXT')
      .map((block) => block.text)
      .join('\n'),
    content: candidateContent(candidate),
    questionType: candidate.questionType,
    options: candidate.options,
    correctAnswer: candidate.correctAnswer,
    explanation: candidate.explanation || undefined,
    subjectId: hierarchy.subjectId,
    grade: hierarchy.grade,
    chapterId: hierarchy.chapterId,
    lessonId: hierarchy.lessonId,
    topicId: hierarchy.topicId,
    primaryKnowledgeNodeId: candidate.primaryKnowledgeNodeId,
    conceptCodes: candidate.concept ? [candidate.concept] : [],
    skillCodes: [],
    difficulty: candidate.difficulty,
    accessTier: 'OPEN',
    usageContexts: [],
    editorialStatus: 'DRAFT',
    isSpecial: false,
    roadmapEligible: false,
    prerequisiteConceptCodes: [],
    source: {
      sourceType: canonicalSourceType(importedRights),
      sourceName:
        session.sourceDocument?.originalFileName ||
        metadata?.sourceName ||
        singleSource?.sourceName ||
        undefined,
      sourcePage: sourcePageLabel || undefined,
      rightsStatus: canonicalRights(importedRights),
      sourceNote: sourceNotes.length > 0 ? sourceNotes.join(' ') : undefined,
    },
    contentHash: computeContentHash(candidate.content, candidate.options, candidate.correctAnswer),
    fingerprints,
    assets,
    examSetIds: [],
    createdAt: now,
    updatedAt: now,
    createdBy: 'admin',
    updatedBy: 'admin',
    importJobId: session.id,
    hasMedia: assets.length > 0,
    importOrigin:
      session.domain === 'EXAM'
        ? 'EXAM'
        : session.sourceFormat === 'PDF'
          ? 'PDF'
          : session.sourceFormat === 'DOCX'
            ? 'WORD'
            : 'IMAGE',
  };
  await saveQuestion(question);
  await appendAuditEntry({
    id: randomUUID(),
    questionId: id,
    action: 'IMPORTED',
    actor: 'admin',
    timestamp: now,
    importJobId: session.id,
    importOrigin: question.importOrigin,
    sourcePage: question.source.sourcePage,
    note: `Approved from import session ${session.id}; ${assets.length} durable asset(s) attached.`,
  });
  const approved: QuestionCandidate = {
    ...candidate,
    subjectId: hierarchy.subjectId,
    grade: hierarchy.grade,
    chapter: hierarchy.chapterId ?? '',
    lesson: hierarchy.lessonId ?? '',
    status: 'APPROVED',
    questionId: id,
    updatedAt: now,
  };
  session.candidates[index] = approved;
  session.status = session.candidates.every((item) => item.status === 'APPROVED')
    ? 'COMPLETED'
    : session.status;
  await saveImportSession(session);
  return { candidate: approved, question };
}
