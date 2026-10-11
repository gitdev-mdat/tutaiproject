import { NextResponse } from 'next/server';
import { addConceptRelation } from '@/lib/knowledge-graph/kg-service';
import { adminApiGuard } from '@/lib/auth/admin';

export async function POST(req: Request) {
  const denied = await adminApiGuard();
  if (denied) return denied;
  try {
    const body = await req.json();
    const newRelation = await addConceptRelation(body);
    return NextResponse.json({ success: true, relation: newRelation });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
