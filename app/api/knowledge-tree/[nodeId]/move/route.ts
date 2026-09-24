import { NextResponse } from 'next/server';
import { moveKnowledge } from '@/lib/knowledge-tree/knowledge-tree-service';

export async function POST(request: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  try {
    const { nodeId } = await params;
    const body = await request.json();
    const node = await moveKnowledge(nodeId, {
      parentId:
        body.parentId === null || body.parentId === undefined ? null : String(body.parentId),
      order: Number.isFinite(Number(body.order)) ? Number(body.order) : 1,
    });
    return NextResponse.json({ node });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
