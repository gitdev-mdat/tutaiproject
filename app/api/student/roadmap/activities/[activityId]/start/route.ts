import { NextResponse } from 'next/server';
import { requireDemoStudentSession } from '@/lib/auth/demo-session';
import { transitionOwnedActivity } from '@/features/roadmap/lib/roadmap-storage';

export async function POST(request: Request, context: { params: Promise<{ activityId: string }> }) {
  try {
    const student = await requireDemoStudentSession();
    const { activityId } = await context.params;
    const body = (await request.json()) as { roadmapId?: unknown; requestId?: unknown };
    if (typeof body.roadmapId !== 'string')
      return NextResponse.json({ error: 'ROADMAP_ID_REQUIRED' }, { status: 422 });
    const activity = await transitionOwnedActivity({
      studentId: student.id,
      roadmapId: body.roadmapId,
      activityId,
      action: 'start',
      requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
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
