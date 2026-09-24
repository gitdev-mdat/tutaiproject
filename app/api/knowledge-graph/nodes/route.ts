import { NextResponse } from 'next/server';
import { addKgNode } from '@/lib/knowledge-graph/kg-service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { parentId, type, title } = body;
    const newNode = await addKgNode(parentId, type, title);
    return NextResponse.json({ success: true, node: newNode });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
