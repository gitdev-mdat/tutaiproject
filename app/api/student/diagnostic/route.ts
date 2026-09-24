import { NextResponse } from 'next/server';
import { requireDemoStudentSession } from '@/lib/auth/demo-session';
import { assignFromDiagnostic, type TopicEvidence } from '@/features/roadmap/lib/roadmap-storage';

export async function POST(request: Request) {
  try {
    const student = await requireDemoStudentSession();
    const body = (await request.json()) as {
      targetScore?: unknown;
      evidence?: unknown;
      submissionId?: unknown;
    };
    if (
      typeof body.targetScore !== 'number' ||
      body.targetScore < 0 ||
      body.targetScore > 10 ||
      !Array.isArray(body.evidence) ||
      (body.submissionId !== undefined && typeof body.submissionId !== 'string')
    )
      return NextResponse.json({ error: 'INVALID_DIAGNOSTIC' }, { status: 422 });
    const evidence = body.evidence as TopicEvidence[];
    if (
      evidence.some(
        (item) =>
          typeof item.topicId !== 'string' ||
          typeof item.correct !== 'number' ||
          typeof item.total !== 'number'
      )
    )
      return NextResponse.json({ error: 'INVALID_DIAGNOSTIC' }, { status: 422 });
    return NextResponse.json(
      await assignFromDiagnostic({
        studentId: student.id,
        targetScore: body.targetScore,
        evidence,
        submissionId: body.submissionId as string | undefined,
      }),
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'INVALID_DIAGNOSTIC';
    return NextResponse.json(
      { error: message },
      { status: message === 'Unauthorized' ? 401 : message === 'ALREADY_ASSIGNED' ? 409 : 422 }
    );
  }
}
