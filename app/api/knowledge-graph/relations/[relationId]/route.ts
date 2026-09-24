import { NextResponse } from 'next/server';
import { deleteConceptRelation } from '@/lib/knowledge-graph/kg-service';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ relationId: string }> }
) {
  try {
    const resolvedParams = await params;
    await deleteConceptRelation(resolvedParams.relationId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
