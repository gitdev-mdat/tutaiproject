import { NextResponse } from 'next/server';
import { KNOWLEDGE_NODE_TYPES } from '@/lib/knowledge-tree/knowledge-node-types';
import {
  createKnowledge,
  getKnowledgeTreeReadModel,
} from '@/lib/knowledge-tree/knowledge-tree-service';
import type { KnowledgeNodeType } from '@/lib/knowledge-tree/knowledge-tree-types';
import { adminApiGuard } from '@/lib/auth/admin';

export async function GET() {
  const denied = await adminApiGuard();
  if (denied) return denied;
  try {
    return NextResponse.json(await getKnowledgeTreeReadModel());
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  try {
    const body = await request.json();
    const node = await createKnowledge({
      title: String(body.title || ''),
      description: body.description === undefined ? undefined : String(body.description),
      parentId:
        body.parentId === null || body.parentId === undefined ? null : String(body.parentId),
      kind: body.kind === 'GROUP' ? 'GROUP' : 'KNOWLEDGE',
      nodeType: KNOWLEDGE_NODE_TYPES.includes(body.nodeType)
        ? (body.nodeType as KnowledgeNodeType)
        : undefined,
      hasLearningContent:
        typeof body.hasLearningContent === 'boolean' ? body.hasLearningContent : undefined,
    });
    return NextResponse.json({ node }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
