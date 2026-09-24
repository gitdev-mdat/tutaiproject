import { NextResponse } from 'next/server';
import { requireDemoStudentSession } from '@/lib/auth/demo-session';
import { transitionOwnedActivity } from '@/features/roadmap/lib/roadmap-storage';

export async function POST(request: Request, context: { params: Promise<{ activityId: string }> }) {
  try {
    const student = await requireDemoStudentSession();
    const { activityId } = await context.params;
    const body = (await request.json()) as {
      roadmapId?: unknown;
      requestId?: unknown;
      score?: unknown;
      accuracy?: unknown;
    };
    if (typeof body.roadmapId !== 'string')
      return NextResponse.json({ error: 'ROADMAP_ID_REQUIRED' }, { status: 422 });
    for (const value of [body.score, body.accuracy])
      if (value !== undefined && (typeof value !== 'number' || value < 0 || value > 1))
        return NextResponse.json({ error: 'INVALID_RESULT' }, { status: 422 });
    const activity = await transitionOwnedActivity({
      studentId: student.id,
      roadmapId: body.roadmapId,
      activityId,
      action: 'complete',
      requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
      result: {
        score: body.score as number | undefined,
        accuracy: body.accuracy as number | undefined,
      },
    });
    return NextResponse.json(activity);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'INVALID_TRANSITION';
    return NextResponse.json(
      { error: message },
      { status: message === 'Unauthorized' ? 401 : 409 }
    );
  }
}
