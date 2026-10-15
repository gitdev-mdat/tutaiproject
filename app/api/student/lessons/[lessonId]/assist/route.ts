import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/session';
import { AssistError, parseAssistRequest } from '@/lib/learning/lesson-assist';
import {
  getAssistAvailability,
  requestLessonAssist,
  type MockFailure,
} from '@/lib/learning/lesson-assist-service';
import { resolveStudentLifecycle } from '@/lib/student/lifecycle';

type Context = { params: Promise<{ lessonId: string }> };

export const dynamic = 'force-dynamic';

const MOCK_FAILURES = new Set<MockFailure>(['quota', 'timeout', 'malformed', 'wrong-math']);

function failure(error: AssistError) {
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: error.status, headers: { 'Cache-Control': 'no-store' } }
  );
}

/**
 * "Chưa hiểu chỗ này?" for one spot of a published lesson. Runs only when a
 * signed-in, active student asks; returns an explanation to show beside the
 * lesson. Nothing is stored, and grading is never touched.
 */
export async function POST(request: Request, { params }: Context) {
  try {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host && new URL(origin).host !== host) throw new AssistError('FORBIDDEN');

    const session = await getAuthSession();
    if (!session) throw new AssistError('UNAUTHORIZED');
    const lifecycle = await resolveStudentLifecycle(session);
    if (lifecycle.state !== 'AUTHENTICATED_ACTIVE_STUDENT') throw new AssistError('FORBIDDEN');

    const length = Number(request.headers.get('content-length') ?? 0);
    if (length > 8_000) throw new AssistError('INVALID_REQUEST');
    const body = await request.json().catch(() => {
      throw new AssistError('INVALID_REQUEST');
    });
    const parsed = parseAssistRequest(body);
    const { lessonId } = await params;

    const mockHeader = request.headers.get('x-tutai-assist-mock') as MockFailure | null;
    const help = await requestLessonAssist(
      session.profile.id,
      decodeURIComponent(lessonId),
      parsed,
      {
        mockFailure:
          getAssistAvailability().provider === 'mock' && mockHeader && MOCK_FAILURES.has(mockHeader)
            ? mockHeader
            : null,
      }
    );
    return NextResponse.json({ help }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AssistError) return failure(error);
    console.error('[lesson-assist] unexpected failure', (error as Error)?.name);
    return failure(new AssistError('PROVIDER'));
  }
}
