import { NextResponse } from 'next/server';
import { adminApiGuard } from '@/lib/auth/admin';
import { LessonDraftError } from '@/lib/knowledge-tree/ai-lesson-draft';
import {
  getSuggestionAvailability,
  suggestLessonQuestions,
} from '@/lib/practice/ai-question-suggest-service';

type RouteContext = { params: Promise<{ lessonId: string }> };

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await adminApiGuard();
  if (denied) return denied;
  return NextResponse.json(getSuggestionAvailability());
}

/** Returns suggestions for the admin to review. Nothing is saved. */
export async function POST(request: Request, context: RouteContext) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 403 });
  }
  try {
    const { lessonId } = await context.params;
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ suggestions: await suggestLessonQuestions(lessonId, body) });
  } catch (error) {
    if (error instanceof LessonDraftError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error('[practice-suggestions] unexpected failure', (error as Error)?.name);
    return NextResponse.json({ error: 'Không tạo được gợi ý. Thử lại sau.' }, { status: 500 });
  }
}
