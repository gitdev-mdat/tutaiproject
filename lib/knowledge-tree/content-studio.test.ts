import { describe, expect, it } from 'vitest';
import { createKnowledgeTreeNode } from './knowledge-tree';
import { buildStudioOverview, buildWorkQueue } from './content-studio';
import { planLocalDraftMigration } from './local-draft-migration';
import type { ArticleSummary } from './learning-visibility';
import type {
  KnowledgeArticle,
  KnowledgeTreeDocument,
  KnowledgeTreeNode,
} from './knowledge-tree-types';

const NOW = '2026-10-10T00:00:00.000Z';

function tree(): KnowledgeTreeDocument {
  let doc: KnowledgeTreeDocument = { schemaVersion: 1, updatedAt: NOW, nodes: [] };
  const add = (id: string, title: string, parentId: string | null, kind: 'GROUP' | 'KNOWLEDGE') => {
    doc = createKnowledgeTreeNode(doc, { title, parentId, kind }, { id, now: NOW }).tree;
  };
  add('math', 'Toán', null, 'GROUP');
  add('g12', 'Lớp 12', 'math', 'GROUP');
  add('ch1', 'Đạo hàm', 'g12', 'GROUP');
  add('l1', 'Đơn điệu', 'ch1', 'KNOWLEDGE');
  add('l2', 'Cực trị', 'ch1', 'KNOWLEDGE');
  add('l3', 'Tiệm cận', 'ch1', 'KNOWLEDGE');
  add('ch2', 'Tích phân', 'g12', 'GROUP');
  add('l4', 'Nguyên hàm', 'ch2', 'KNOWLEDGE');
  add('ch3', 'Số phức', 'g12', 'GROUP');
  add('ch4', 'Cũ', 'g12', 'GROUP');
  add('l5', 'Bài cũ', 'ch4', 'KNOWLEDGE');
  return {
    ...doc,
    nodes: doc.nodes.map((node): KnowledgeTreeNode =>
      node.id === 'ch4' ? { ...node, status: 'ARCHIVED' } : node
    ),
  };
}

const summary = (status: ArticleSummary['status'], publishToLearning = false): ArticleSummary => ({
  status,
  publishToLearning,
  updatedAt: NOW,
});

const summaries: Record<string, ArticleSummary> = {
  l1: summary('PUBLISHED', true),
  l2: summary('READY'),
  l3: summary('DRAFT'),
  l4: summary('PUBLISHED', true),
  l5: summary('PUBLISHED', true),
};

describe('content studio overview', () => {
  it('counts real states and excludes archived branches', () => {
    const { nodes } = tree();
    const overview = buildStudioOverview(nodes, summaries, 'g12');
    expect(overview.totals).toEqual({
      lessons: 4,
      PUBLISHED: 2,
      READY: 1,
      DRAFT: 1,
      NO_ARTICLE: 0,
    });
    expect(overview.archivedLessons).toBe(1);
    expect(overview.activeChapters).toBe(3);
    // ch2 is complete; ch1 is not; an empty chapter is never complete.
    expect(overview.chapters.map((chapter) => [chapter.node.id, chapter.complete])).toEqual([
      ['ch1', false],
      ['ch2', true],
      ['ch3', false],
      ['ch4', false],
    ]);
    expect(overview.completeChapters).toBe(1);
  });

  it('derives the work queue from existing states, quickest wins first', () => {
    const { nodes } = tree();
    const withNew = { ...summaries };
    delete withNew.l4;
    const overview = buildStudioOverview(nodes, withNew, 'g12');
    const queue = buildWorkQueue(overview, nodes, withNew);
    expect(queue.map((item) => [item.kind, item.nodeId])).toEqual([
      ['READY', 'l2'],
      ['DRAFT', 'l3'],
      ['NO_ARTICLE', 'l4'],
      ['EMPTY_CHAPTER', 'ch3'],
    ]);
    expect(queue.find((item) => item.nodeId === 'l5')).toBeUndefined();
  });
});

describe('legacy draft migration plan', () => {
  const local = (
    id: string,
    title: string,
    parentId: string | null,
    kind: KnowledgeTreeNode['kind'] = 'KNOWLEDGE'
  ): KnowledgeTreeNode => ({
    id,
    title,
    description: '',
    parentId,
    order: 1,
    status: 'DRAFT',
    kind,
    identitySource: 'TREE_NATIVE',
    createdAt: NOW,
    updatedAt: NOW,
  });
  const article = (nodeId: string) =>
    ({ knowledgeNodeId: nodeId, title: 'x', blocks: [] }) as unknown as KnowledgeArticle;

  it('explains creations, title merges, kept server articles and orphans without writing', () => {
    const { nodes } = tree();
    const plan = planLocalDraftMigration(
      nodes,
      {
        nodes: [
          local('loc-ch', 'Chương mới', 'g12', 'GROUP'),
          local('loc-1', 'Bài mới', 'loc-ch'),
          local('loc-dup', 'cực trị', 'ch1'),
          local('loc-orphan', 'Mồ côi', 'missing-parent'),
        ],
        articles: [article('loc-1'), article('loc-dup'), article('loc-orphan')],
      },
      new Set(['l2'])
    );
    expect(plan).toEqual({
      create: 2,
      merge: 1,
      orphaned: 1,
      articles: 1,
      articlesKeptOnServer: 1,
      articlesWithoutTarget: 1,
    });
  });
});
