import { NextResponse } from 'next/server';
import {
  getQuestion,
  appendAuditEntry,
  saveQuestion,
  deleteQuestion,
} from '@/lib/question-bank/qb-storage';
import {
  validateForManualCreation,
  validateForPublishing,
  validateForReview,
  isValidStatusTransition,
} from '@/lib/question-bank/qb-validation';
import { v4 as uuidv4 } from 'uuid';
import { isAiAssisted, type EditorialStatus } from '@/lib/question-bank/qb-types';
import { computeContentHash } from '@/lib/question-bank/qb-hash';
import { adminApiGuard } from '@/lib/auth/admin';
import type { CalculatorGuideReview } from '@/lib/calculator-tutor/types';

const GUIDE_REVIEW_STATUSES = ['ACCEPTED', 'DISABLED', 'ORIGINAL_ONLY'] as const;

/** Admin's decision on a generated calculator guide: null clears it. Corrections are plain text. */
function parseGuideReview(value: unknown): CalculatorGuideReview | null | 'invalid' {
  if (value === null) return null;
  if (typeof value !== 'object') return 'invalid';
  const input = value as Record<string, unknown>;
  if (!GUIDE_REVIEW_STATUSES.includes(input.status as (typeof GUIDE_REVIEW_STATUSES)[number]))
    return 'invalid';
  if (typeof input.sourceHash !== 'string' || !/^[0-9a-f]{8}$/.test(input.sourceHash))
    return 'invalid';
  const corrections: Record<string, string> = {};
  if (input.corrections !== undefined) {
    if (typeof input.corrections !== 'object' || input.corrections === null) return 'invalid';
    for (const [id, text] of Object.entries(input.corrections)) {
      if (typeof text !== 'string' || text.length > 1000 || !/^[\w-]{1,40}$/.test(id))
        return 'invalid';
      if (text.trim()) corrections[id] = text.trim();
    }
  }
  return {
    status: input.status as CalculatorGuideReview['status'],
    sourceHash: input.sourceHash,
    ...(Object.keys(corrections).length ? { corrections } : {}),
    by: 'admin',
    at: new Date().toISOString(),
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ questionId: string }> }) {
  const denied = await adminApiGuard();
  if (denied) return denied;
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
  const denied = await adminApiGuard();
  if (denied) return denied;
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
  const denied = await adminApiGuard();
  if (denied) return denied;
  try {
    const { questionId } = await params;
    const existing = await getQuestion(questionId);
    if (!existing) {
      return NextResponse.json({ error: 'Không tìm thấy câu hỏi.' }, { status: 404 });
    }

    const { answerVerified, ...body } = (await req.json()) as Partial<typeof existing> & {
      editorialStatus?: EditorialStatus;
      answerVerified?: boolean;
    };
    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() };
    if (body.calculatorGuideReview !== undefined) {
      const review = parseGuideReview(body.calculatorGuideReview);
      if (review === 'invalid') {
        return NextResponse.json(
          { error: 'Quyết định về hướng dẫn máy tính không hợp lệ.' },
          { status: 422 }
        );
      }
      if (review) updated.calculatorGuideReview = review;
      else delete updated.calculatorGuideReview;
    }
    const contentChanged = (
      [
        'stem',
        'questionType',
        'options',
        'trueFalseStatements',
        'correctAnswer',
        'explanation',
      ] as const
    ).some((field) => body[field] !== undefined);
    if (contentChanged) {
      // Edited content must still have a well-formed answer for its type.
      const check = validateForManualCreation({
        ...updated,
        knowledgeCoverage: updated.knowledgeCoverage ?? 'FOCUS',
        cognitiveLevel: updated.cognitiveLevel ?? 'COMPREHENSION',
      });
      if (!check.valid) {
        return NextResponse.json(
          { error: 'Câu hỏi chưa hợp lệ.', details: check.errors },
          { status: 422 }
        );
      }
    }
    if (body.stem !== undefined || body.options !== undefined || body.correctAnswer !== undefined) {
      updated.contentHash = computeContentHash(
        updated.stem,
        updated.options,
        updated.correctAnswer
      );
      delete updated.fingerprints;
    }

    // An AI-suggested answer is not a reliable source: a person has to check it.
    if (
      body.editorialStatus === 'IN_REVIEW' &&
      existing.editorialStatus !== 'IN_REVIEW' &&
      isAiAssisted(existing) &&
      answerVerified !== true
    ) {
      return NextResponse.json(
        {
          error: 'Câu hỏi do AI gợi ý: hãy xác nhận bạn đã tự kiểm tra đáp án và lời giải.',
          code: 'ANSWER_NOT_VERIFIED',
        },
        { status: 422 }
      );
    }

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

    if (
      body.calculatorGuideReview !== undefined &&
      JSON.stringify(updated.calculatorGuideReview ?? null) !==
        JSON.stringify(existing.calculatorGuideReview ?? null)
    ) {
      auditActions.push({
        action: 'UPDATED',
        prev: existing.calculatorGuideReview ?? null,
        next: updated.calculatorGuideReview ?? null,
      });
    }

    if (answerVerified === true && isAiAssisted(existing)) {
      auditActions.push({ action: 'UPDATED', prev: null, next: 'Đã kiểm tra đáp án do AI gợi ý' });
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
