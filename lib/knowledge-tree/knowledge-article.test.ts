import { describe, it, expect } from 'vitest';
import { createEmptyArticle, validateArticle } from './knowledge-article';

describe('Knowledge Article Domain', () => {
  it('creates empty article with default blocks', () => {
    const article = createEmptyArticle('node-1', 'Test Title');
    expect(article.knowledgeNodeId).toBe('node-1');
    expect(article.title).toBe('Test Title');
    expect(article.blocks?.length).toBeGreaterThan(0);
    expect(article.blocks?.[0].type).toBe('TITLE');
    expect(article.status).toBe('DRAFT');
  });

  it('validates incomplete article', () => {
    const article = createEmptyArticle('node-1', 'Test Title');
    // We didn't fill anything except title
    const result = validateArticle({
      ...article,
      id: 'article-1',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    } as ReturnType<typeof createEmptyArticle> & Parameters<typeof validateArticle>[0]);
    expect(result.isValid).toBe(false);
    expect(result.missing).toContain('MAIN_CONTENT');
    expect(result.missing).toContain('OBJECTIVE');
    expect(result.missing).toContain('EXAMPLE');
  });
});
