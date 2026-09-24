/**
 * Knowledge Tree Frontend Repository Abstraction
 *
 * Current implementation: LocalKnowledgeRepository (localStorage-backed, browser-only)
 * Future implementation:  ApiKnowledgeRepository (replaces this module; UI unchanged)
 *
 * Design contract:
 *   The UI and domain layer depend only on IKnowledgeRepository.
 *   Switching to a backend adapter requires creating ApiKnowledgeRepository
 *   and injecting it — no component changes needed.
 */

import {
  childrenOf,
  createKnowledgeTreeNode,
  knowledgeBreadcrumb,
  moveKnowledgeTreeNode,
  normalizeSiblingOrders,
  searchKnowledgeTree,
  updateKnowledgeTreeNode,
} from './knowledge-tree';
import type {
  KnowledgeTreeDocument,
  KnowledgeTreeNode,
  KnowledgeTreeNodeKind,
  KnowledgeNodeType,
  KnowledgeTreeReadModel,
  KnowledgeArticle,
  KnowledgeSource,
  KnowledgeTreeImportDraft,
} from './knowledge-tree-types';

// ─── Typed error codes ────────────────────────────────────────────────────────

export type KnowledgeRepoErrorCode =
  | 'NODE_NOT_FOUND'
  | 'HAS_CHILDREN'
  | 'INVALID_PARENT'
  | 'CANNOT_MOVE_INTO_DESCENDANT'
  | 'NOT_EDITABLE'
  | 'NOT_DELETABLE'
  | 'ALREADY_FIRST'
  | 'ALREADY_LAST'
  | 'TITLE_CONFLICT'
  | 'UNKNOWN';

export class KnowledgeRepoError extends Error {
  constructor(
    public readonly code: KnowledgeRepoErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'KnowledgeRepoError';
  }
}

// ─── Result type (avoids throw-based control flow in UI) ─────────────────────

export type KnowledgeResult<T> = { ok: true; data: T } | { ok: false; error: KnowledgeRepoError };

function ok<T>(data: T): KnowledgeResult<T> {
  return { ok: true, data };
}

function fail<T>(code: KnowledgeRepoErrorCode, message: string): KnowledgeResult<T> {
  return { ok: false, error: new KnowledgeRepoError(code, message) };
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface CreateNodeInput {
  title: string;
  description?: string;
  parentId: string | null;
  kind: KnowledgeTreeNodeKind;
  nodeType?: KnowledgeNodeType;
  hasLearningContent?: boolean;
}

export interface UpdateNodeInput {
  title?: string;
  description?: string;
  kind?: KnowledgeTreeNodeKind;
  nodeType?: KnowledgeNodeType;
  hasLearningContent?: boolean;
}

export interface IKnowledgeRepository {
  /** Load the full read model (tree + source links). */
  getReadModel(): Promise<KnowledgeReadModelResult>;

  /** Create a new draft node under the given parent. */
  createNode(input: CreateNodeInput): Promise<KnowledgeResult<KnowledgeTreeNode>>;

  /** Update title / description / kind of an editable node. */
  updateNode(id: string, patch: UpdateNodeInput): Promise<KnowledgeResult<KnowledgeTreeNode>>;

  /** Move a node to a new parent. Prevents cycles. */
  moveNode(
    id: string,
    newParentId: string | null,
    order: number
  ): Promise<KnowledgeResult<KnowledgeTreeNode>>;

  /** Swap a node one position earlier among its siblings. */
  reorderNode(id: string, direction: 'up' | 'down'): Promise<KnowledgeResult<void>>;

  /** Delete a node. Pass cascade to remove its complete subtree. */
  deleteNode(id: string, options?: { cascade?: boolean }): Promise<KnowledgeResult<void>>;

  /** Get the canonical article for a node */
  getArticle(nodeId: string): Promise<KnowledgeResult<KnowledgeArticle | null>>;

  /** Create or update an article for a node */
  upsertArticle(
    nodeId: string,
    article: Partial<KnowledgeArticle>
  ): Promise<KnowledgeResult<KnowledgeArticle>>;

  /** Get all sources attached to a subtree scope root */
  getSources(nodeId: string): Promise<KnowledgeResult<KnowledgeSource[]>>;

  /** Attach a new source material to a node (defining an AI scope) */
  attachSource(
    nodeId: string,
    input: Omit<KnowledgeSource, 'id' | 'scopeNodeId' | 'createdAt'>
  ): Promise<KnowledgeResult<KnowledgeSource>>;

  /** Remove an attached source */
  removeSource(sourceId: string): Promise<KnowledgeResult<void>>;

  /** Apply a reviewed import draft to the tree */
  importTree(
    draft: KnowledgeTreeImportDraft,
    destinationNodeId: string | null
  ): Promise<KnowledgeResult<void>>;
}

export interface KnowledgeReadModelResult {
  tree: KnowledgeTreeDocument;
}

// ─── LocalKnowledgeRepository ─────────────────────────────────────────────────

/**
 * localStorage-backed repository for the browser prototype.
 *
 * Storage key: `kt_v1`
 *
 * The legacy canonical data (CANONICAL_GRAPH nodes) is loaded once from the
 * server API and then merged with locally-stored draft nodes. Draft nodes
 * (identitySource: TREE_NATIVE) are persisted in localStorage so they survive
 * page refresh.
 *
 * When the backend is ready, replace this class with ApiKnowledgeRepository
 * that calls the real API. The interface contract remains identical.
 */
export class LocalKnowledgeRepository implements IKnowledgeRepository {
  private static readonly STORAGE_KEY = 'kt_v2';
  private static readonly DELETED_STORAGE_KEY = 'kt_deleted_v2';
  private static readonly ARTICLE_STORAGE_KEY = 'kt_articles_v1';
  private static readonly SOURCE_STORAGE_KEY = 'kt_sources_v1';
  private static readonly SCHEMA_VERSION = 1 as const;

  private memoryTree: KnowledgeTreeDocument | null = null;
  private memoryArticles: Record<string, KnowledgeArticle> = {};
  private memorySources: KnowledgeSource[] = [];

  // ── Persistence helpers ──────────────────────────────────────────────────

  private loadDraftNodes(): KnowledgeTreeNode[] {
    try {
      const raw = localStorage.getItem(LocalKnowledgeRepository.STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as {
        schemaVersion: number;
        nodes: KnowledgeTreeNode[];
      };
      if (parsed.schemaVersion !== LocalKnowledgeRepository.SCHEMA_VERSION) return [];
      return parsed.nodes || [];
    } catch {
      return [];
    }
  }

  private loadDeletedIds(): Set<string> {
    try {
      return new Set(
        JSON.parse(localStorage.getItem(LocalKnowledgeRepository.DELETED_STORAGE_KEY) || '[]')
      );
    } catch {
      return new Set();
    }
  }

  private saveDraftNodes(nodes: KnowledgeTreeNode[]): void {
    // Persist imported nodes and local overrides of canonical nodes as well as native nodes.
    const draftNodes = nodes.filter(
      (n) => n.identitySource !== 'CANONICAL_GRAPH' || n.updatedAt !== n.createdAt
    );
    localStorage.setItem(
      LocalKnowledgeRepository.STORAGE_KEY,
      JSON.stringify({ schemaVersion: LocalKnowledgeRepository.SCHEMA_VERSION, nodes: draftNodes })
    );
  }

  private mergeWithDrafts(serverNodes: KnowledgeTreeNode[]): KnowledgeTreeNode[] {
    const drafts = this.loadDraftNodes();
    // Remove server nodes whose IDs were overridden by local drafts (not expected
    // in normal usage, but defensive). Then append locally-created drafts.
    const draftIds = new Set(drafts.map((d) => d.id));
    const deleted = this.loadDeletedIds();
    const merged = serverNodes
      .filter((n) => !draftIds.has(n.id) && !deleted.has(n.id))
      .concat(drafts);
    return normalizeSiblingOrders(merged);
  }

  private loadArticles(): void {
    try {
      const raw = localStorage.getItem(LocalKnowledgeRepository.ARTICLE_STORAGE_KEY);
      if (raw) this.memoryArticles = JSON.parse(raw);
    } catch {
      this.memoryArticles = {};
    }
  }

  private saveArticles(): void {
    localStorage.setItem(
      LocalKnowledgeRepository.ARTICLE_STORAGE_KEY,
      JSON.stringify(this.memoryArticles)
    );
  }

  private loadSources(): void {
    try {
      const raw = localStorage.getItem(LocalKnowledgeRepository.SOURCE_STORAGE_KEY);
      if (raw) this.memorySources = JSON.parse(raw);
    } catch {
      this.memorySources = [];
    }
  }

  private saveSources(): void {
    localStorage.setItem(
      LocalKnowledgeRepository.SOURCE_STORAGE_KEY,
      JSON.stringify(this.memorySources)
    );
  }

  // ── IKnowledgeRepository ─────────────────────────────────────────────────

  async getReadModel(): Promise<KnowledgeReadModelResult> {
    this.loadArticles();
    this.loadSources();

    if (this.memoryTree) {
      // Refresh draft nodes from localStorage (handles multi-tab edits)
      const merged = this.mergeWithDrafts(
        this.memoryTree.nodes.filter((n) => n.identitySource !== 'TREE_NATIVE')
      );
      const tree: KnowledgeTreeDocument = { ...this.memoryTree, nodes: merged };
      return { tree };
    }

    // Fetch canonical data from the existing server API (read-only).
    const res = await fetch('/api/knowledge-tree');
    const body = (await res.json()) as KnowledgeTreeReadModel;

    const serverNodes = body.tree.nodes;
    const merged = this.mergeWithDrafts(serverNodes);

    this.memoryTree = { ...body.tree, nodes: merged };
    return { tree: this.memoryTree };
  }

  private currentNodes(): KnowledgeTreeNode[] {
    return this.memoryTree?.nodes ?? [];
  }

  private commitNodes(nodes: KnowledgeTreeNode[]): void {
    if (!this.memoryTree) return;
    this.memoryTree = {
      ...this.memoryTree,
      updatedAt: new Date().toISOString(),
      nodes,
    };
    this.saveDraftNodes(nodes);
  }

  async createNode(input: CreateNodeInput): Promise<KnowledgeResult<KnowledgeTreeNode>> {
    try {
      const doc = this.memoryTree ?? {
        schemaVersion: LocalKnowledgeRepository.SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        nodes: [],
      };
      const id = `kt-draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const result = createKnowledgeTreeNode(doc, input, { id, now: new Date().toISOString() });
      if (input.nodeType) result.node.nodeType = input.nodeType;
      if (input.hasLearningContent !== undefined)
        result.node.hasLearningContent = input.hasLearningContent;

      this.commitNodes(result.tree.nodes);
      this.memoryTree = result.tree;
      return ok(result.node);
    } catch (err: unknown) {
      return mapDomainError(err);
    }
  }

  async updateNode(
    id: string,
    patch: UpdateNodeInput
  ): Promise<KnowledgeResult<KnowledgeTreeNode>> {
    const nodes = this.currentNodes();
    const node = nodes.find((n) => n.id === id);
    if (!node) return fail('NODE_NOT_FOUND', 'Không tìm thấy kiến thức.');
    try {
      const result = updateKnowledgeTreeNode(this.memoryTree!, id, patch, new Date().toISOString());
      if (patch.nodeType !== undefined) result.node.nodeType = patch.nodeType;
      if (patch.hasLearningContent !== undefined)
        result.node.hasLearningContent = patch.hasLearningContent;

      this.commitNodes(result.tree.nodes);
      this.memoryTree = result.tree;
      return ok(result.node);
    } catch (err: unknown) {
      return mapDomainError(err);
    }
  }

  async moveNode(
    id: string,
    newParentId: string | null,
    order: number
  ): Promise<KnowledgeResult<KnowledgeTreeNode>> {
    const nodes = this.currentNodes();
    const node = nodes.find((n) => n.id === id);
    if (!node) return fail('NODE_NOT_FOUND', 'Không tìm thấy kiến thức.');
    try {
      const result = moveKnowledgeTreeNode(
        this.memoryTree!,
        id,
        newParentId,
        order,
        new Date().toISOString()
      );
      this.commitNodes(result.tree.nodes);
      this.memoryTree = result.tree;
      return ok(result.node);
    } catch (err: unknown) {
      return mapDomainError(err);
    }
  }

  async reorderNode(id: string, direction: 'up' | 'down'): Promise<KnowledgeResult<void>> {
    const nodes = this.currentNodes();
    const node = nodes.find((n) => n.id === id);
    if (!node) return fail('NODE_NOT_FOUND', 'Không tìm thấy kiến thức.');

    const siblings = childrenOf(nodes, node.parentId);
    const currentIndex = siblings.findIndex((s) => s.id === id);

    if (direction === 'up') {
      if (currentIndex === 0) return fail('ALREADY_FIRST', 'Kiến thức đã ở vị trí đầu tiên.');
    } else {
      if (currentIndex === siblings.length - 1) {
        return fail('ALREADY_LAST', 'Kiến thức đã ở vị trí cuối cùng.');
      }
    }

    const targetOrder = direction === 'up' ? node.order - 1 : node.order + 1;
    const moved = await this.moveNode(id, node.parentId, targetOrder);
    if (!moved.ok) return moved;
    return ok(undefined);
  }

  async deleteNode(
    id: string,
    options: { cascade?: boolean } = {}
  ): Promise<KnowledgeResult<void>> {
    const nodes = this.currentNodes();
    const node = nodes.find((n) => n.id === id);
    if (!node) return fail('NODE_NOT_FOUND', 'Không tìm thấy kiến thức.');
    const childIds = new Set<string>();
    const collect = (parentId: string) => {
      nodes
        .filter((n) => n.parentId === parentId)
        .forEach((child) => {
          childIds.add(child.id);
          collect(child.id);
        });
    };
    collect(id);
    if (childIds.size && !options.cascade) {
      return fail('HAS_CHILDREN', 'Mục này vẫn còn nội dung con.');
    }
    const removedIds = new Set([id, ...childIds]);
    const deleted = this.loadDeletedIds();
    nodes
      .filter((n) => removedIds.has(n.id) && n.identitySource === 'CANONICAL_GRAPH')
      .forEach((n) => deleted.add(n.id));
    localStorage.setItem(
      LocalKnowledgeRepository.DELETED_STORAGE_KEY,
      JSON.stringify([...deleted])
    );
    this.commitNodes(normalizeSiblingOrders(nodes.filter((n) => !removedIds.has(n.id))));
    Object.keys(this.memoryArticles).forEach((nodeId) => {
      if (removedIds.has(nodeId)) delete this.memoryArticles[nodeId];
    });
    this.memorySources = this.memorySources.filter((source) => !removedIds.has(source.scopeNodeId));
    this.saveArticles();
    this.saveSources();
    return ok(undefined);
  }

  // ── Articles ─────────────────────────────────────────────────────────────

  async getArticle(nodeId: string): Promise<KnowledgeResult<KnowledgeArticle | null>> {
    this.loadArticles();
    return ok(this.memoryArticles[nodeId] || null);
  }

  async upsertArticle(
    nodeId: string,
    patch: Partial<KnowledgeArticle>
  ): Promise<KnowledgeResult<KnowledgeArticle>> {
    this.loadArticles();
    const existing = this.memoryArticles[nodeId];
    const now = new Date().toISOString();

    if (existing) {
      this.memoryArticles[nodeId] = { ...existing, ...patch, updatedAt: now };
    } else {
      this.memoryArticles[nodeId] = {
        id: `article-${Date.now()}`,
        knowledgeNodeId: nodeId,
        title: patch.title || '',
        blocks: patch.blocks || [],
        status: patch.status || 'DRAFT',
        publishToBlog: patch.publishToBlog || false,
        publishToLearning: patch.publishToLearning || false,
        createdAt: now,
        updatedAt: now,
        ...patch,
      };
    }
    this.saveArticles();
    return ok(this.memoryArticles[nodeId]);
  }

  // ── Sources ──────────────────────────────────────────────────────────────

  async getSources(nodeId: string): Promise<KnowledgeResult<KnowledgeSource[]>> {
    this.loadSources();
    return ok(this.memorySources.filter((s) => s.scopeNodeId === nodeId));
  }

  async attachSource(
    nodeId: string,
    input: Omit<KnowledgeSource, 'id' | 'scopeNodeId' | 'createdAt'>
  ): Promise<KnowledgeResult<KnowledgeSource>> {
    this.loadSources();
    const source: KnowledgeSource = {
      ...input,
      id: `source-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      scopeNodeId: nodeId,
      createdAt: new Date().toISOString(),
    };
    this.memorySources.push(source);
    this.saveSources();
    return ok(source);
  }

  async removeSource(sourceId: string): Promise<KnowledgeResult<void>> {
    this.loadSources();
    this.memorySources = this.memorySources.filter((s) => s.id !== sourceId);
    this.saveSources();
    return ok(undefined);
  }

  // ── Import ───────────────────────────────────────────────────────────────

  async importTree(
    draft: KnowledgeTreeImportDraft,
    destinationNodeId: string | null
  ): Promise<KnowledgeResult<void>> {
    if (draft.status !== 'REVIEWED') {
      return fail('UNKNOWN', 'Không thể áp dụng dữ liệu chưa được xác nhận (REVIEWED).');
    }

    try {
      const now = new Date().toISOString();
      const idMap = new Map<string, string>(); // tempId -> new real id

      // Sort nodes so parents are processed before children
      const sortedDraftNodes = [...draft.nodes].sort((a, b) => {
        if (a.parentTemporaryId === null && b.parentTemporaryId !== null) return -1;
        if (a.parentTemporaryId !== null && b.parentTemporaryId === null) return 1;
        return 0; // Assume top-down list for now
      });

      let currentTree = this.memoryTree || {
        schemaVersion: LocalKnowledgeRepository.SCHEMA_VERSION,
        updatedAt: now,
        nodes: [],
      };

      for (const draftNode of sortedDraftNodes) {
        const parentId = draftNode.parentTemporaryId
          ? idMap.get(draftNode.parentTemporaryId)!
          : destinationNodeId;

        const realId = `kt-import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        idMap.set(draftNode.temporaryId, realId);

        const input: CreateNodeInput = {
          title: draftNode.title,
          description: draftNode.description,
          parentId,
          kind: draftNode.kind,
          nodeType: draftNode.nodeType,
        };

        const result = createKnowledgeTreeNode(currentTree, input, { id: realId, now });
        if (draftNode.nodeType) result.node.nodeType = draftNode.nodeType;
        result.node.identitySource = 'TREE_IMPORT'; // override to import

        currentTree = result.tree;
      }

      this.commitNodes(currentTree.nodes);
      this.memoryTree = currentTree;
      return ok(undefined);
    } catch (err: unknown) {
      return mapDomainError(err);
    }
  }
}

// ── Error mapping ──────────────────────────────────────────────────────────

function mapDomainError<T>(err: unknown): KnowledgeResult<T> {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('canonical')) return fail('NOT_DELETABLE', msg);
  if (msg.includes('kiến thức con')) return fail('HAS_CHILDREN', msg);
  if (msg.includes('đã tồn tại')) return fail('TITLE_CONFLICT', msg);
  if (msg.includes('chính nó') || msg.includes('descendant') || msg.includes('vào')) {
    return fail('CANNOT_MOVE_INTO_DESCENDANT', msg);
  }
  if (msg.includes('Không tìm thấy')) return fail('NODE_NOT_FOUND', msg);
  return fail('UNKNOWN', msg);
}

// ── Re-export search helpers so the UI doesn't need to know about the source ──
export { childrenOf, knowledgeBreadcrumb, searchKnowledgeTree };
