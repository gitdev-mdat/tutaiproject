import { NextResponse } from 'next/server';
import {
  getQuestion,
  appendAuditEntry,
  saveQuestion,
  deleteQuestion,
} from '@/lib/question-bank/qb-storage';
import {
  validateForPublishing,
  validateForReview,
  isValidStatusTransition,
} from '@/lib/question-bank/qb-validation';
import { v4 as uuidv4 } from 'uuid';
import type { EditorialStatus } from '@/lib/question-bank/qb-types';

export async function GET(_req: Request, { params }: { params: Promise<{ questionId: string }> }) {
  try {
    const { questionId } = await params;
    const question = await getQuestion(questionId);
    if (!question) {
      return NextResponse.json({ error: 'Không tìm thấy câu hỏi.' }, { status: 404 });
    }
    // Strip answer fields — this is the admin API; student APIs have separate routes
    return NextResponse.json(question);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const { questionId } = await params;
    return (await deleteQuestion(questionId))
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json({ error: 'Không tìm thấy câu hỏi.' }, { status: 404 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ questionId: string }> }) {
  try {
    const { questionId } = await params;
    const existing = await getQuestion(questionId);
    if (!existing) {
      return NextResponse.json({ error: 'Không tìm thấy câu hỏi.' }, { status: 404 });
    }

    const body = (await req.json()) as Partial<typeof existing> & {
      editorialStatus?: EditorialStatus;
    };
    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() };

    // If changing to PUBLISHED, run full validation
    if (body.editorialStatus === 'PUBLISHED' && existing.editorialStatus !== 'PUBLISHED') {
      if (!isValidStatusTransition(existing.editorialStatus, 'PUBLISHED')) {
        return NextResponse.json({ error: 'Chuyển trạng thái không hợp lệ.' }, { status: 422 });
      }
      const result = validateForPublishing(updated);
      if (!result.valid) {
        return NextResponse.json(
          { error: 'Câu hỏi chưa đáp ứng điều kiện xuất bản.', details: result.errors },
          { status: 422 }
        );
      }
    }

    // If changing to IN_REVIEW, run review validation
    if (body.editorialStatus === 'IN_REVIEW' && existing.editorialStatus !== 'IN_REVIEW') {
      if (!isValidStatusTransition(existing.editorialStatus, 'IN_REVIEW')) {
        return NextResponse.json({ error: 'Chuyển trạng thái không hợp lệ.' }, { status: 422 });
      }
      const result = validateForReview(updated);
      if (!result.valid) {
        return NextResponse.json(
          { error: 'Câu hỏi chưa đáp ứng điều kiện phản biện.', details: result.errors },
          { status: 422 }
        );
      }
    }

    await saveQuestion(updated);

    // Audit significant changes
    const auditActions: Array<{
      action: Parameters<typeof appendAuditEntry>[0]['action'];
      prev: unknown;
      next: unknown;
    }> = [];
    if (body.accessTier && body.accessTier !== existing.accessTier) {
      auditActions.push({
        action: 'ACCESS_TIER_CHANGED',
        prev: existing.accessTier,
        next: body.accessTier,
      });
    }
    if (body.correctAnswer && body.correctAnswer !== existing.correctAnswer) {
      auditActions.push({
        action: 'CORRECT_ANSWER_CHANGED',
        prev: existing.correctAnswer,
        next: body.correctAnswer,
      });
    }
    if (body.editorialStatus && body.editorialStatus !== existing.editorialStatus) {
      const actionMap: Record<EditorialStatus, Parameters<typeof appendAuditEntry>[0]['action']> = {
        DRAFT: 'UPDATED',
        IN_REVIEW: 'SUBMITTED_FOR_REVIEW',
        PUBLISHED: 'PUBLISHED',
        ARCHIVED: 'ARCHIVED',
      };
      auditActions.push({
        action: actionMap[body.editorialStatus],
        prev: existing.editorialStatus,
        next: body.editorialStatus,
      });
    }
    if (body.roadmapEligible !== undefined && body.roadmapEligible !== existing.roadmapEligible) {
      auditActions.push({
        action: 'ROADMAP_ELIGIBILITY_CHANGED',
        prev: existing.roadmapEligible,
        next: body.roadmapEligible,
      });
    }
    if (
      JSON.stringify(body.source) !== JSON.stringify(existing.source) &&
      body.source?.rightsStatus
    ) {
      auditActions.push({
        action: 'SOURCE_RIGHTS_CHANGED',
        prev: existing.source,
        next: body.source,
      });
    }

    for (const { action, prev, next } of auditActions) {
      await appendAuditEntry({
        id: uuidv4(),
        questionId: existing.id,
        action,
        actor: 'admin',
        timestamp: new Date().toISOString(),
        previousValue: prev,
        newValue: next,
      });
    }

    return NextResponse.json(updated);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Update failed' },
      { status: 500 }
    );
  }
}
