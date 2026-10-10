import { NextResponse } from 'next/server';
import { importKnowledgeDraft } from '@/lib/knowledge-tree/knowledge-tree-service';
import type { KnowledgeTreeImportDraft } from '@/lib/knowledge-tree/knowledge-tree-types';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      draft?: KnowledgeTreeImportDraft;
      destinationNodeId?: string | null;
    };
    if (!body.draft || !Array.isArray(body.draft.nodes)) {
      return NextResponse.json({ error: 'Thiếu dữ liệu nhập.' }, { status: 400 });
    }
    const created = await importKnowledgeDraft(body.draft, body.destinationNodeId ?? null);
    return NextResponse.json({ created }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
