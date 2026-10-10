import { NextResponse } from 'next/server';
import { KNOWLEDGE_NODE_TYPES } from '@/lib/knowledge-tree/knowledge-node-types';
import { deleteKnowledge, updateKnowledge } from '@/lib/knowledge-tree/knowledge-tree-service';
import type { KnowledgeNodeType } from '@/lib/knowledge-tree/knowledge-tree-types';

type RouteContext = { params: Promise<{ nodeId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { nodeId } = await context.params;
    const body = await request.json();
    const node = await updateKnowledge(nodeId, {
      title: body.title === undefined ? undefined : String(body.title),
      description: body.description === undefined ? undefined : String(body.description),
      kind: body.kind === undefined ? undefined : body.kind === 'GROUP' ? 'GROUP' : 'KNOWLEDGE',
      nodeType: KNOWLEDGE_NODE_TYPES.includes(body.nodeType)
        ? (body.nodeType as KnowledgeNodeType)
        : undefined,
    });
    return NextResponse.json({ node });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { nodeId } = await context.params;
    const cascade = new URL(request.url).searchParams.get('cascade') === '1';
    await deleteKnowledge(nodeId, { cascade });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
