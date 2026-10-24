import { NextResponse } from 'next/server';
import { AI_DRAFT_BLOCK_TYPES, LessonDraftError } from '@/lib/knowledge-tree/ai-lesson-draft';
import {
  advanceDraftGeneration,
  draftProvenanceAvailable,
} from '@/lib/knowledge-tree/draft-provenance';
import {
  getLessonDraftAvailability,
  previewLessonDraftContext,
  requestLessonDraft,
} from '@/lib/knowledge-tree/ai-lesson-draft-service';
import { adminApiGuard, getAdminAccess } from '@/lib/auth/admin';

type RouteContext = { params: Promise<{ nodeId: string }> };

export const dynamic = 'force-dynamic';

/**
 * Whether AI drafting can run here, and why not, plus the curriculum context the
 * draft would be written from. Never reveals configuration values.
 */
export async function GET(_request: Request, context: RouteContext) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  const availability = getLessonDraftAvailability();
  const { nodeId } = await context.params;
  const preview = await previewLessonDraftContext(nodeId).catch(() => null);
  return NextResponse.json({ ...availability, context: preview });
}

/**
 * Returns a proposed draft for review. Nothing is saved: the editor applies the
 * accepted parts locally and the admin saves through the normal article route.
 */
function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  return !(origin && host && new URL(origin).host !== host);
}

/**
 * Records what the admin did with a draft: applied parts to the editor
 * (`APPLIED`) or saved the lesson afterwards (`SAVED`). Provenance only; the
 * lesson itself is saved through the article route.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  if (!sameOrigin(request))
    return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 403 });
  if (!draftProvenanceAvailable()) return NextResponse.json({ recorded: false });
  const { nodeId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    generationId?: unknown;
    status?: unknown;
    blocks?: unknown;
  } | null;
  if (
    !body ||
    typeof body.generationId !== 'string' ||
    (body.status !== 'APPLIED' && body.status !== 'SAVED')
  )
    return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 400 });
  const blocks = Array.isArray(body.blocks)
    ? AI_DRAFT_BLOCK_TYPES.filter((type) => (body.blocks as unknown[]).includes(type))
    : undefined;
  try {
    const generation = await advanceDraftGeneration(nodeId, body.generationId, body.status, blocks);
    return NextResponse.json({ recorded: !!generation, generation });
  } catch (error) {
    console.warn('[ai-draft] provenance update failed', (error as Error)?.name);
    return NextResponse.json({ recorded: false });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  if (!sameOrigin(request)) {
    return NextResponse.json(
      { error: 'Yêu cầu không hợp lệ.', code: 'INVALID_REQUEST' },
      { status: 403 }
    );
  }
  try {
    const { nodeId } = await context.params;
    const body = await request.json().catch(() => {
      throw new LessonDraftError('INVALID_REQUEST');
    });
    const access = await getAdminAccess();
    // { draft, plan, checks, context, provenance }: a proposal for review, never saved here.
    return NextResponse.json(
      await requestLessonDraft(nodeId, body, process.env, {
        actor: access.allowed ? access.adminId : 'unknown',
      })
    );
  } catch (error: unknown) {
    if (error instanceof LessonDraftError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error('[ai-draft] unexpected failure', (error as Error)?.name);
    return NextResponse.json(
      { error: 'Không tạo được bản nháp. Thử lại sau.', code: 'PROVIDER' },
      { status: 500 }
    );
  }
}
