import { NextResponse } from 'next/server';
import {
  ArticleRuleError,
  getKnowledgeArticle,
  sanitizeArticleInput,
  saveKnowledgeArticle,
} from '@/lib/knowledge-tree/knowledge-tree-service';

type RouteContext = { params: Promise<{ nodeId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { nodeId } = await context.params;
    return NextResponse.json({ article: await getKnowledgeArticle(nodeId) });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { nodeId } = await context.params;
    const article = await saveKnowledgeArticle(nodeId, sanitizeArticleInput(await request.json()));
    return NextResponse.json({ article });
  } catch (error: unknown) {
    if (error instanceof ArticleRuleError) {
      return NextResponse.json({ error: error.message, missing: error.missing }, { status: 422 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
