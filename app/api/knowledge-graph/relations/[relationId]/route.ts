import { NextResponse } from 'next/server';
import { deleteConceptRelation } from '@/lib/knowledge-graph/kg-service';
import { adminApiGuard } from '@/lib/auth/admin';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ relationId: string }> }
) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  try {
    const resolvedParams = await params;
    await deleteConceptRelation(resolvedParams.relationId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
