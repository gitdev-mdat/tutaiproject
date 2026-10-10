import { NextResponse } from 'next/server';
import { addKgNode } from '@/lib/knowledge-graph/kg-service';
import { adminApiGuard } from '@/lib/auth/admin';

export async function POST(req: Request) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  try {
    const body = await req.json();
    const { parentId, type, title } = body;
    const newNode = await addKgNode(parentId, type, title);
    return NextResponse.json({ success: true, node: newNode });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
