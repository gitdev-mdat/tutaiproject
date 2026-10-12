import { NextResponse } from 'next/server';
import { reorderKgNodes } from '@/lib/knowledge-graph/kg-service';
import { adminApiGuard } from '@/lib/auth/admin';

export async function PUT(req: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  try {
    const resolvedParams = await params;
    const { newOrder } = await req.json();
    await reorderKgNodes(resolvedParams.nodeId, newOrder);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
