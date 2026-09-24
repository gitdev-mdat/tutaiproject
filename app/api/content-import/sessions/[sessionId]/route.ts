import { NextResponse } from 'next/server';
import {
  deleteImportSession,
  ImportStorageError,
  requireImportSession,
  saveImportSession,
  updateExamMetadata,
} from '@/lib/content-import/storage';
import type {
  ExamMetadata,
  ImportSession,
  PageType,
  QuestionCandidate,
} from '@/lib/content-import/types';
import { readKnowledgeTree } from '@/lib/knowledge-tree/knowledge-tree-storage';
import { isAttachableKnowledgeNode } from '@/lib/question-bank/qb-knowledge-utils';
import { validateForImportCandidate } from '@/lib/question-bank/qb-validation';
import { computeQuestionFingerprints } from '@/lib/question-bank/qb-hash';
import { getQuestionByAnyFingerprint } from '@/lib/question-bank/qb-storage';

interface SessionPatch {
  pageUpdates?: Array<{
    id: string;
    order?: number;
    pageType?: PageType;
    rotation?: 0 | 90 | 180 | 270;
    crop?: { top: number; right: number; bottom: number; left: number };
  }>;
  examMetadata?: ExamMetadata;
  advanceMetadata?: boolean;
  singleQuestionSource?: ImportSession['singleQuestionSource'];
  candidate?: QuestionCandidate;
  currentStep?: ImportSession['currentStep'];
  status?: ImportSession['status'];
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    await deleteImportSession(sessionId);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    const status = error instanceof ImportStorageError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Không thể hủy phiên nhập.' },
      { status }
    );
  }
}

function clampCrop(value: number): number {
  return Math.min(45, Math.max(0, Math.round(value)));
}

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await context.params;
    return NextResponse.json(await requireImportSession(sessionId));
  } catch (error: unknown) {
    const status = error instanceof ImportStorageError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Không thể tải phiên nhập.' },
      { status }
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await context.params;
    const body = (await request.json()) as SessionPatch;
    if (body.examMetadata) {
      return NextResponse.json(
        await updateExamMetadata(sessionId, body.examMetadata, body.advanceMetadata ?? true)
      );
    }
    const session = await requireImportSession(sessionId);
    if (body.pageUpdates) {
      const updates = new Map(body.pageUpdates.map((update) => [update.id, update]));
      session.pages = session.pages
        .map((page) => {
          const update = updates.get(page.id);
          if (!update) return page;
          return {
            ...page,
            order: update.order ?? page.order,
            pageType: update.pageType ?? page.pageType,
            rotation: update.rotation ?? page.rotation,
            crop: update.crop
              ? {
                  top: clampCrop(update.crop.top),
                  right: clampCrop(update.crop.right),
                  bottom: clampCrop(update.crop.bottom),
                  left: clampCrop(update.crop.left),
                }
              : page.crop,
          };
        })
        .sort((a, b) => a.order - b.order)
        .map((page, index) => ({ ...page, order: index + 1 }));
    }
    if (body.singleQuestionSource) {
      session.singleQuestionSource = body.singleQuestionSource;
      if (session.structuredData) {
        const rightsStatus =
          body.singleQuestionSource.rightsStatus === 'INTERNAL_CONTENT'
            ? 'OWNED'
            : body.singleQuestionSource.rightsStatus === 'PERMISSION_GRANTED'
              ? 'PERMISSION_GRANTED'
              : body.singleQuestionSource.rightsStatus === 'OPEN_LICENSE'
                ? 'LICENSED'
                : body.singleQuestionSource.rightsStatus === 'OFFICIAL_SOURCE'
                  ? 'PUBLICLY_AVAILABLE'
                  : 'REVIEW_REQUIRED';
        session.candidates = session.candidates.map((candidate) => ({
          ...candidate,
          stagedQuestion: {
            ...candidate.stagedQuestion,
            source: {
              sourceType: candidate.stagedQuestion?.source?.sourceType ?? 'PUBLIC_DOCUMENT',
              ...candidate.stagedQuestion?.source,
              rightsStatus,
            },
          },
        }));
      }
    }
    if (body.candidate) {
      const index = session.candidates.findIndex(
        (candidate) => candidate.id === body.candidate?.id
      );
      if (index < 0) throw new ImportStorageError('Không tìm thấy ứng viên câu hỏi.', 404);
      const tree = await readKnowledgeTree();
      const selectedNode = tree.nodes.find(
        (node) => node.id === body.candidate?.primaryKnowledgeNodeId
      );
      const rightsConfirmed = !['UNVERIFIED', 'RESTRICTED'].includes(
        session.singleQuestionSource?.rightsStatus ??
          session.examMetadata?.rightsStatus ??
          'UNVERIFIED'
      );
      const validation = validateForImportCandidate({
        stem: body.candidate.content,
        questionType: body.candidate.questionType,
        options: body.candidate.options,
        correctAnswer: body.candidate.correctAnswer,
        primaryKnowledgeNodeId: body.candidate.primaryKnowledgeNodeId,
        primaryKnowledgeNodeActive: body.candidate.primaryKnowledgeNodeId
          ? isAttachableKnowledgeNode(selectedNode)
          : undefined,
        source: {
          sourceType: 'PUBLIC_DOCUMENT',
          rightsStatus: rightsConfirmed ? 'PERMISSION_GRANTED' : 'REVIEW_REQUIRED',
        },
      });
      let candidateWarnings = body.candidate.warnings.filter(
        (warning) => warning.code !== 'POSSIBLE_DUPLICATE'
      );
      if (body.candidate.content && body.candidate.correctAnswer) {
        const duplicate = await getQuestionByAnyFingerprint(
          computeQuestionFingerprints(
            body.candidate.content,
            body.candidate.options,
            body.candidate.correctAnswer
          )
        );
        if (duplicate) {
          candidateWarnings = [
            ...candidateWarnings,
            {
              id: `duplicate-${duplicate.id}`,
              code: 'POSSIBLE_DUPLICATE',
              message: `Exact duplicate of ${duplicate.code}.`,
              actions: ['CHECK_DUPLICATE', 'SKIP'],
            },
          ];
        }
      }
      session.candidates[index] = {
        ...body.candidate,
        stagedQuestion: {
          ...body.candidate.stagedQuestion,
          stem: body.candidate.content,
          questionType: body.candidate.questionType,
          options: body.candidate.options,
          correctAnswer: body.candidate.correctAnswer,
          explanation: body.candidate.explanation || undefined,
          subjectId: body.candidate.subjectId,
          grade: body.candidate.grade,
          chapterId: body.candidate.chapter || undefined,
          lessonId: body.candidate.lesson || undefined,
          primaryKnowledgeNodeId: body.candidate.primaryKnowledgeNodeId,
          difficulty: body.candidate.difficulty,
          editorialStatus: 'DRAFT',
        },
        warnings: candidateWarnings,
        validationErrors: validation.errors,
        reviewLevel:
          validation.errors.length > 0 ||
          candidateWarnings.some((warning) => warning.code === 'POSSIBLE_DUPLICATE')
            ? 'BLOCKING'
            : validation.warnings.length > 0 || candidateWarnings.length > 0
              ? 'REVIEW'
              : 'READY',
        status: body.candidate.status === 'APPROVED' ? 'EDITED' : body.candidate.status,
      };
    }
    if (body.currentStep) session.currentStep = body.currentStep;
    if (body.status) session.status = body.status;
    await saveImportSession(session);
    return NextResponse.json(await requireImportSession(sessionId));
  } catch (error: unknown) {
    const status = error instanceof ImportStorageError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Không thể cập nhật phiên nhập.' },
      { status }
    );
  }
}
