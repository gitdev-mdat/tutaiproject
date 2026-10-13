import 'server-only';

import { randomUUID } from 'crypto';
import { readKnowledgeGraph } from '@/lib/knowledge-graph/kg-storage';
import { walkKgNodes } from '@/lib/knowledge-graph/kg-utils';
import {
  createKnowledgeTreeNode,
  deleteKnowledgeTreeNode,
  moveKnowledgeTreeNode,
  updateKnowledgeTreeNode,
} from './knowledge-tree';
import { readKnowledgeTree, writeKnowledgeTree } from './knowledge-tree-storage';
import { readKnowledgeArticles, writeKnowledgeArticles } from './knowledge-article-storage';
import { validateArticle } from './knowledge-article';
import { applyImportDraft } from './knowledge-tree-import';
import {
  buildLearningCatalog,
  isOnArchivedPath,
  summarizeArticle,
  type ArticleSummary,
  type LearningSubject,
} from './learning-visibility';
import type {
  KnowledgeArticle,
  KnowledgeArticleBlock,
  KnowledgeNodeType,
  KnowledgeTreeImportDraft,
  KnowledgeTreeNodeKind,
  KnowledgeTreeReadModel,
} from './knowledge-tree-types';

function now() {
  return new Date().toISOString();
}

export async function getKnowledgeTreeReadModel(): Promise<
  KnowledgeTreeReadModel & { articleSummaries: Record<string, ArticleSummary> }
> {
  const [tree, graph, articleDocument] = await Promise.all([
    readKnowledgeTree(),
    readKnowledgeGraph(),
    readKnowledgeArticles(),
  ]);
  const titleById = new Map(Array.from(walkKgNodes(graph), ({ node }) => [node.id, node.title]));
  const relationsByNodeId: KnowledgeTreeReadModel['relationsByNodeId'] = {};
  for (const relation of graph.conceptRelations) {
    (relationsByNodeId[relation.sourceConceptId] ||= []).push({
      id: relation.id,
      type: relation.type,
      direction: 'OUTGOING',
      relatedConceptId: relation.targetConceptId,
      relatedConceptTitle: titleById.get(relation.targetConceptId) || relation.targetConceptId,
    });
    (relationsByNodeId[relation.targetConceptId] ||= []).push({
      id: relation.id,
      type: relation.type,
      direction: 'INCOMING',
      relatedConceptId: relation.sourceConceptId,
      relatedConceptTitle: titleById.get(relation.sourceConceptId) || relation.sourceConceptId,
    });
  }
  const articleSummaries: Record<string, ArticleSummary> = {};
  for (const [nodeId, article] of Object.entries(articleDocument.articles)) {
    articleSummaries[nodeId] = summarizeArticle(article);
  }
  return { tree, relationsByNodeId, articleSummaries };
}

export async function createKnowledge(input: {
  title: string;
  description?: string;
  parentId: string | null;
  kind: KnowledgeTreeNodeKind;
  nodeType?: KnowledgeNodeType;
  hasLearningContent?: boolean;
}) {
  const tree = await readKnowledgeTree();
  const result = createKnowledgeTreeNode(tree, input, {
    id: `knowledge-${randomUUID()}`,
    now: now(),
  });
  const node = {
    ...result.node,
    ...(input.nodeType ? { nodeType: input.nodeType } : {}),
    ...(input.hasLearningContent !== undefined
      ? { hasLearningContent: input.hasLearningContent }
      : {}),
  };
  await writeKnowledgeTree({
    ...result.tree,
    nodes: result.tree.nodes.map((item) => (item.id === node.id ? node : item)),
  });
  return node;
}

export async function updateKnowledge(
  nodeId: string,
  updates: {
    title?: string;
    description?: string;
    kind?: KnowledgeTreeNodeKind;
    nodeType?: KnowledgeNodeType;
  }
) {
  const result = updateKnowledgeTreeNode(await readKnowledgeTree(), nodeId, updates, now());
  const node = updates.nodeType ? { ...result.node, nodeType: updates.nodeType } : result.node;
  await writeKnowledgeTree({
    ...result.tree,
    nodes: result.tree.nodes.map((item) => (item.id === nodeId ? node : item)),
  });
  return node;
}

export async function moveKnowledge(
  nodeId: string,
  input: { parentId: string | null; order: number }
) {
  const result = moveKnowledgeTreeNode(
    await readKnowledgeTree(),
    nodeId,
    input.parentId,
    input.order,
    now()
  );
  await writeKnowledgeTree(result.tree);
  return result.node;
}

/**
 * Deletes a node. With `cascade`, descendants are removed leaf-first and every node
 * is still checked against the domain delete rules; one violation aborts the whole delete.
 */
export async function deleteKnowledge(nodeId: string, options: { cascade?: boolean } = {}) {
  const [tree, graph, articleDocument] = await Promise.all([
    readKnowledgeTree(),
    readKnowledgeGraph(),
    readKnowledgeArticles(),
  ]);
  const graphRelatedIds = new Set<string>();
  for (const relation of graph.conceptRelations) {
    graphRelatedIds.add(relation.sourceConceptId);
    graphRelatedIds.add(relation.targetConceptId);
  }
  const order: string[] = [];
  const collect = (id: string) => {
    if (options.cascade) {
      for (const child of tree.nodes.filter((node) => node.parentId === id)) collect(child.id);
    }
    order.push(id);
  };
  collect(nodeId);
  let next = tree;
  for (const id of order) {
    next = deleteKnowledgeTreeNode(next, id, { graphRelatedIds }, now());
  }
  await writeKnowledgeTree(next);
  const removed = order.filter((id) => articleDocument.articles[id]);
  if (removed.length) {
    for (const id of removed) delete articleDocument.articles[id];
    await writeKnowledgeArticles({ ...articleDocument, updatedAt: now() });
  }
}

export async function importKnowledgeDraft(
  draft: KnowledgeTreeImportDraft,
  destinationNodeId: string | null
) {
  const tree = await readKnowledgeTree();
  const next = applyImportDraft(tree, draft, destinationNodeId, {
    createId: () => `knowledge-${randomUUID()}`,
    now: now(),
  });
  await writeKnowledgeTree(next);
  return next.nodes.length - tree.nodes.length;
}

// ─── Articles ────────────────────────────────────────────────────────────────

const ARTICLE_BLOCK_TYPES: ReadonlySet<KnowledgeArticleBlock['type']> = new Set([
  'TITLE',
  'INTRO',
  'OBJECTIVE',
  'MAIN_CONTENT',
  'EXAMPLE',
  'RECAP',
  'COMMON_MISTAKE',
  'GRAPH',
  'REFERENCES',
]);

export interface ArticleInput {
  title: string;
  blocks: KnowledgeArticleBlock[];
  publishToLearning: boolean;
}

export class ArticleRuleError extends Error {
  constructor(
    message: string,
    public readonly missing: string[] = []
  ) {
    super(message);
    this.name = 'ArticleRuleError';
  }
}

export function sanitizeArticleInput(body: unknown): ArticleInput {
  const value = (body ?? {}) as Record<string, unknown>;
  const blocks = Array.isArray(value.blocks) ? value.blocks : [];
  return {
    title: String(value.title ?? '').trim(),
    publishToLearning: value.publishToLearning === true,
    blocks: blocks
      .map((raw, index) => {
        const block = (raw ?? {}) as Record<string, unknown>;
        return {
          id: String(block.id || `block-${index + 1}`),
          type: block.type as KnowledgeArticleBlock['type'],
          content: String(block.content ?? ''),
        };
      })
      .filter((block) => ARTICLE_BLOCK_TYPES.has(block.type)),
  };
}

export async function getKnowledgeArticle(nodeId: string): Promise<KnowledgeArticle | null> {
  const document = await readKnowledgeArticles();
  return document.articles[nodeId] ?? null;
}

/**
 * Saves the canonical article for a knowledge node.
 * Status follows existing domain fields only: PUBLISHED when shown in the learning
 * program, READY when it passes `validateArticle`, otherwise DRAFT.
 */
export async function saveKnowledgeArticle(
  nodeId: string,
  input: ArticleInput
): Promise<KnowledgeArticle> {
  const [tree, document] = await Promise.all([readKnowledgeTree(), readKnowledgeArticles()]);
  const node = tree.nodes.find((item) => item.id === nodeId);
  if (!node) throw new ArticleRuleError('Không tìm thấy kiến thức.');
  if (node.kind !== 'KNOWLEDGE') {
    throw new ArticleRuleError('Chỉ mục kiến thức mới có bài học.');
  }
  const existing = document.articles[nodeId];
  const timestamp = now();
  const draft: KnowledgeArticle = {
    id: existing?.id ?? `article-${randomUUID()}`,
    knowledgeNodeId: nodeId,
    title: input.title || node.title,
    blocks: input.blocks,
    status: 'DRAFT',
    publishToBlog: existing?.publishToBlog ?? false,
    publishToLearning: input.publishToLearning,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  const validation = validateArticle(draft);
  if (draft.publishToLearning) {
    if (!validation.isValid) {
      throw new ArticleRuleError(
        'Bài học còn thiếu nội dung bắt buộc nên chưa thể hiển thị cho học sinh.',
        validation.missing
      );
    }
    if (isOnArchivedPath(tree.nodes, nodeId)) {
      throw new ArticleRuleError('Mục này đang nằm trong nhánh lưu trữ nên không thể hiển thị.');
    }
  }
  draft.status = draft.publishToLearning ? 'PUBLISHED' : validation.isValid ? 'READY' : 'DRAFT';
  document.articles[nodeId] = draft;
  await writeKnowledgeArticles({ ...document, updatedAt: timestamp });
  if (!node.hasLearningContent) {
    await writeKnowledgeTree({
      ...tree,
      nodes: tree.nodes.map((item) =>
        item.id === nodeId ? { ...item, hasLearningContent: true } : item
      ),
    });
  }
  return draft;
}

// ─── Student read side ──────────────────────────────────────────────────────

export async function getLearningCatalog(): Promise<LearningSubject[]> {
  const [tree, document] = await Promise.all([readKnowledgeTree(), readKnowledgeArticles()]);
  return buildLearningCatalog(tree, document.articles);
}

/** Returns the article only when the lesson is visible to students under the shared rule. */
export async function getVisibleLessonArticle(nodeId: string): Promise<KnowledgeArticle | null> {
  const [catalog, article] = await Promise.all([getLearningCatalog(), getKnowledgeArticle(nodeId)]);
  const visible = catalog.some((subject) =>
    subject.grades.some((grade) =>
      grade.chapters.some((chapter) => chapter.lessons.some((lesson) => lesson.id === nodeId))
    )
  );
  return visible ? article : null;
}
