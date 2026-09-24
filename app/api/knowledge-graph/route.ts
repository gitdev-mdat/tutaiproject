import { NextResponse } from 'next/server';
import { readKnowledgeGraph } from '@/lib/knowledge-graph/kg-storage';

export async function GET() {
  try {
    const doc = await readKnowledgeGraph();
    return NextResponse.json(doc);
  } catch {
    return NextResponse.json({ error: 'Failed to load Knowledge Graph' }, { status: 500 });
  }
}
