import { NextResponse } from 'next/server';
import { deleteKnowledge, updateKnowledge } from '@/lib/knowledge-tree/knowledge-tree-service';

type RouteContext = { params: Promise<{ nodeId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { nodeId } = await context.params;
    const body = await request.json();
    const node = await updateKnowledge(nodeId, {
      title: body.title === undefined ? undefined : String(body.title),
      description: body.description === undefined ? undefined : String(body.description),
      kind: body.kind === undefined ? undefined : body.kind === 'GROUP' ? 'GROUP' : 'KNOWLEDGE',
    });
    return NextResponse.json({ node });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { nodeId } = await context.params;
    await deleteKnowledge(nodeId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
