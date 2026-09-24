import { NextResponse } from 'next/server';
import { updateLearningObjective, deleteLearningObjective } from '@/lib/knowledge-graph/kg-service';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  try {
    const resolvedParams = await params;
    const body = await req.json();
    const updated = await updateLearningObjective(resolvedParams.objectiveId, body);
    return NextResponse.json({ success: true, objective: updated });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  try {
    const resolvedParams = await params;
    await deleteLearningObjective(resolvedParams.objectiveId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
