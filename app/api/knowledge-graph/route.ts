import { NextResponse } from 'next/server';
import { readKnowledgeGraph } from '@/lib/knowledge-graph/kg-storage';
import { adminApiGuard } from '@/lib/auth/admin';

export async function GET() {
  const denied = await adminApiGuard();
  if (denied) return denied;
  try {
    const doc = await readKnowledgeGraph();
    return NextResponse.json(doc);
  } catch {
    return NextResponse.json({ error: 'Failed to load Knowledge Graph' }, { status: 500 });
  }
}
