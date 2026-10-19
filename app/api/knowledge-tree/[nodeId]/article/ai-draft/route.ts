import { NextResponse } from 'next/server';
import { LessonDraftError } from '@/lib/knowledge-tree/ai-lesson-draft';
import {
  getLessonDraftAvailability,
  previewLessonDraftContext,
  requestLessonDraft,
} from '@/lib/knowledge-tree/ai-lesson-draft-service';
import { adminApiGuard } from '@/lib/auth/admin';

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
export async function POST(request: Request, context: RouteContext) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin && host && new URL(origin).host !== host) {
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
    // { draft, plan, checks, context }: a proposal for review, never saved here.
    return NextResponse.json(await requestLessonDraft(nodeId, body));
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
