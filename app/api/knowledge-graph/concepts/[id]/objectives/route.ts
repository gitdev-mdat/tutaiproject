import { NextResponse } from 'next/server';
import { addLearningObjective } from '@/lib/knowledge-graph/kg-service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const body = await req.json();
    const newObjective = await addLearningObjective({
      ...body,
      conceptId: resolvedParams.id,
    });
    return NextResponse.json({ success: true, objective: newObjective });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
