import { NextResponse } from 'next/server';
import {
  createKnowledge,
  getKnowledgeTreeReadModel,
} from '@/lib/knowledge-tree/knowledge-tree-service';

export async function GET() {
  try {
    return NextResponse.json(await getKnowledgeTreeReadModel());
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const node = await createKnowledge({
      title: String(body.title || ''),
      description: body.description === undefined ? undefined : String(body.description),
      parentId:
        body.parentId === null || body.parentId === undefined ? null : String(body.parentId),
      kind: body.kind === 'GROUP' ? 'GROUP' : 'KNOWLEDGE',
    });
    return NextResponse.json({ node }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
