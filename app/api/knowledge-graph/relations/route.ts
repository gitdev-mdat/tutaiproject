import { NextResponse } from 'next/server';
import { addConceptRelation } from '@/lib/knowledge-graph/kg-service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const newRelation = await addConceptRelation(body);
    return NextResponse.json({ success: true, relation: newRelation });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
