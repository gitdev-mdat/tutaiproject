import type { KnowledgeArticle } from './knowledge-tree-types';

export function createEmptyArticle(nodeId: string, title: string): Partial<KnowledgeArticle> {
  return {
    knowledgeNodeId: nodeId,
    title,
    blocks: [
      { id: `block-${Date.now()}-1`, type: 'TITLE', content: title },
      { id: `block-${Date.now()}-2`, type: 'INTRO', content: '' },
      { id: `block-${Date.now()}-3`, type: 'OBJECTIVE', content: '' },
      { id: `block-${Date.now()}-4`, type: 'MAIN_CONTENT', content: '' },
      { id: `block-${Date.now()}-5`, type: 'EXAMPLE', content: '' },
      { id: `block-${Date.now()}-6`, type: 'RECAP', content: '' },
    ],
    status: 'DRAFT',
    publishToBlog: false,
    publishToLearning: false,
  };
}

export function validateArticle(article: KnowledgeArticle): {
  isValid: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  if (!article.title.trim()) missing.push('TITLE');

  const hasContent = article.blocks.some(
    (b) => b.type === 'MAIN_CONTENT' && b.content.trim().length > 10
  );
  if (!hasContent) missing.push('MAIN_CONTENT');

  const hasObjective = article.blocks.some(
    (b) => b.type === 'OBJECTIVE' && b.content.trim().length > 10
  );
  if (!hasObjective) missing.push('OBJECTIVE');

  const hasExample = article.blocks.some(
    (b) => b.type === 'EXAMPLE' && b.content.trim().length > 10
  );
  if (!hasExample) missing.push('EXAMPLE');

  return {
    isValid: missing.length === 0,
    missing,
  };
}
