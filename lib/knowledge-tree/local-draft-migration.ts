/**
 * One-time bridge from the retired browser-only prototype (LocalKnowledgeRepository)
 * to server storage. Only items the admin created locally and their articles are
 * moved; local renames, moves or hides of existing system items are not replayed.
 * The local copy is kept untouched so nothing is lost if the migration fails.
 */

import { childrenOf } from './knowledge-tree';
import type { IKnowledgeRepository } from './knowledge-repository';
import type { KnowledgeArticle, KnowledgeTreeNode } from './knowledge-tree-types';

const NODES_KEY = 'kt_v2';
const ARTICLES_KEY = 'kt_articles_v1';
const DONE_KEY = 'kt_server_migration_v1';

export interface LocalDraftSnapshot {
  nodes: KnowledgeTreeNode[];
  articles: KnowledgeArticle[];
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function readLocalDraftSnapshot(): LocalDraftSnapshot | null {
  if (typeof window === 'undefined') return null;
  if (readJson<string | null>(DONE_KEY, null)) return null;
  const stored = readJson<{ nodes?: KnowledgeTreeNode[] }>(NODES_KEY, {});
  const nodes = (stored.nodes ?? []).filter((node) => node.identitySource !== 'CANONICAL_GRAPH');
  const articles = Object.values(
    readJson<Record<string, KnowledgeArticle>>(ARTICLES_KEY, {})
  ).filter((article) => article.blocks?.some((block) => block.content?.trim()));
  if (!nodes.length && !articles.length) return null;
  return { nodes, articles };
}

export function markLocalDraftsHandled(outcome: 'migrated' | 'dismissed') {
  try {
    window.localStorage.setItem(DONE_KEY, JSON.stringify(`${outcome}:${new Date().toISOString()}`));
  } catch {
    // Storage can be unavailable (private mode); the banner simply shows again.
  }
}

export interface LocalDraftMigrationPlan {
  /** Items that will be created on the server. */
  create: number;
  /** Items matched to an existing server item with the same title under the same parent. */
  merge: number;
  /** Items whose parent no longer exists anywhere. */
  orphaned: number;
  /** Articles that will be copied to the server as drafts. */
  articles: number;
  /** Articles left alone because the server already has an article for that item. */
  articlesKeptOnServer: number;
  /** Articles with no matching knowledge item to attach to. */
  articlesWithoutTarget: number;
}

const sameTitle = (a: string, b: string) =>
  a.trim().toLocaleLowerCase('vi') === b.trim().toLocaleLowerCase('vi');

/** Dry run of migrateLocalDrafts: what would happen, without touching the server. */
export function planLocalDraftMigration(
  serverNodes: KnowledgeTreeNode[],
  snapshot: LocalDraftSnapshot,
  serverArticleNodeIds: ReadonlySet<string>
): LocalDraftMigrationPlan {
  const idMap = new Map<string, string>(serverNodes.map((node) => [node.id, node.id]));
  const known = [...serverNodes];
  const created = new Set<string>();
  let merge = 0;
  let pending = [...snapshot.nodes];
  while (pending.length) {
    const ready = pending.filter((node) => node.parentId === null || idMap.has(node.parentId));
    if (!ready.length) break;
    for (const node of ready) {
      const parentId = node.parentId === null ? null : idMap.get(node.parentId)!;
      const existing = childrenOf(known, parentId).find((item) =>
        sameTitle(item.title, node.title)
      );
      if (existing) {
        idMap.set(node.id, existing.id);
        merge += 1;
        continue;
      }
      const placeholder = { ...node, id: `planned:${node.id}`, parentId };
      idMap.set(node.id, placeholder.id);
      known.push(placeholder);
      created.add(placeholder.id);
    }
    pending = pending.filter((node) => !ready.includes(node));
  }
  let articles = 0;
  let articlesKeptOnServer = 0;
  let articlesWithoutTarget = 0;
  for (const article of snapshot.articles) {
    const target = idMap.get(article.knowledgeNodeId);
    const targetNode = known.find((node) => node.id === target);
    if (!target || targetNode?.kind !== 'KNOWLEDGE') articlesWithoutTarget += 1;
    else if (!created.has(target) && serverArticleNodeIds.has(target)) articlesKeptOnServer += 1;
    else articles += 1;
  }
  return {
    create: created.size,
    merge,
    orphaned: pending.length,
    articles,
    articlesKeptOnServer,
    articlesWithoutTarget,
  };
}

export async function migrateLocalDrafts(
  repo: IKnowledgeRepository,
  serverNodes: KnowledgeTreeNode[],
  snapshot: LocalDraftSnapshot,
  serverArticleNodeIds: ReadonlySet<string>
): Promise<{ nodes: number; articles: number; skipped: number }> {
  const idMap = new Map<string, string>();
  const known = [...serverNodes];
  for (const node of serverNodes) idMap.set(node.id, node.id);
  let pending = [...snapshot.nodes];
  let created = 0;
  // Parents before children: repeat while progress is made.
  while (pending.length) {
    const ready = pending.filter((node) => node.parentId === null || idMap.has(node.parentId));
    if (!ready.length) break;
    for (const node of ready) {
      const parentId = node.parentId === null ? null : idMap.get(node.parentId)!;
      const existing = childrenOf(known, parentId).find(
        (item) =>
          item.title.trim().toLocaleLowerCase('vi') === node.title.trim().toLocaleLowerCase('vi')
      );
      if (existing) {
        idMap.set(node.id, existing.id);
        continue;
      }
      const result = await repo.createNode({
        title: node.title,
        description: node.description,
        parentId,
        kind: node.kind,
        nodeType: node.nodeType,
        hasLearningContent: node.hasLearningContent,
      });
      if (!result.ok) throw result.error;
      idMap.set(node.id, result.data.id);
      known.push(result.data);
      created += 1;
    }
    pending = pending.filter((node) => !ready.includes(node));
  }
  let articles = 0;
  let skipped = pending.length;
  for (const article of snapshot.articles) {
    const target = idMap.get(article.knowledgeNodeId);
    const targetNode = known.find((node) => node.id === target);
    // Never overwrite an article that already exists on the server.
    if (!target || targetNode?.kind !== 'KNOWLEDGE' || serverArticleNodeIds.has(target)) {
      skipped += 1;
      continue;
    }
    // Migrated articles land as drafts so an editor reviews them before students see them.
    const result = await repo.upsertArticle(target, {
      title: article.title,
      blocks: article.blocks,
      publishToLearning: false,
    });
    if (!result.ok) throw result.error;
    articles += 1;
  }
  markLocalDraftsHandled('migrated');
  return { nodes: created, articles, skipped };
}
