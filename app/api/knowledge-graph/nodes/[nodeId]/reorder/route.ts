import { NextResponse } from 'next/server';
import { reorderKgNodes } from '@/lib/knowledge-graph/kg-service';

export async function PUT(req: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  try {
    const resolvedParams = await params;
    const { newOrder } = await req.json();
    await reorderKgNodes(resolvedParams.nodeId, newOrder);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
