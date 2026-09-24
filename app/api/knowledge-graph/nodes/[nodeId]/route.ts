import { NextResponse } from 'next/server';
import { updateKgNode, archiveKgNode, deleteKgNode } from '@/lib/knowledge-graph/kg-service';

export async function PUT(req: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  try {
    const resolvedParams = await params;
    const body = await req.json();
    const updated = await updateKgNode(resolvedParams.nodeId, body);
    return NextResponse.json({ success: true, node: updated });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  try {
    const resolvedParams = await params;
    const url = new URL(req.url);
    const force = url.searchParams.get('force') === 'true';

    if (force) {
      await deleteKgNode(resolvedParams.nodeId);
    } else {
      await archiveKgNode(resolvedParams.nodeId);
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
