/**
 * Frontend Knowledge Tree tests — covers the domain, repository, and capability layers.
 *
 * Runs with Vitest (node environment — no DOM required).
 * The LocalKnowledgeRepository tests mock localStorage via a simple in-memory store.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { KnowledgeTreeDocument, KnowledgeTreeNode } from './knowledge-tree-types';
import {
  createKnowledgeTreeNode,
  deleteKnowledgeTreeNode,
  moveKnowledgeTreeNode,
  searchKnowledgeTree,
  updateKnowledgeTreeNode,
} from './knowledge-tree';
import { getNodeCapabilities, getNodeStatusDisplay } from './knowledge-node-capabilities';
import { LocalKnowledgeRepository } from './knowledge-repository';

// ─── localStorage mock ───────────────────────────────────────────────────────

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const key of Object.keys(store)) delete store[key];
  },
};

vi.stubGlobal('localStorage', localStorageMock);

// ─── fetch mock for getReadModel() ───────────────────────────────────────────

const emptyReadModel = {
  tree: {
    schemaVersion: 1,
    updatedAt: '2026-08-15T00:00:00.000Z',
    nodes: [] as KnowledgeTreeNode[],
  },
  relationsByNodeId: {},
};

vi.stubGlobal(
  'fetch',
  vi.fn(async () => ({
    ok: true,
    json: async () => emptyReadModel,
  }))
);

// ─── Fixtures ────────────────────────────────────────────────────────────────

const NOW = '2026-08-15T00:00:00.000Z';

function emptyTree(): KnowledgeTreeDocument {
  return { schemaVersion: 1, updatedAt: NOW, nodes: [] };
}

function addNode(
  tree: KnowledgeTreeDocument,
  id: string,
  title: string,
  parentId: string | null = null,
  identitySource: 'TREE_NATIVE' | 'CANONICAL_GRAPH' = 'TREE_NATIVE'
) {
  const result = createKnowledgeTreeNode(
    tree,
    { title, parentId, kind: parentId ? 'KNOWLEDGE' : 'GROUP' },
    { id, now: NOW }
  );
  // Override identitySource for canonical fixture
  if (identitySource === 'CANONICAL_GRAPH') {
    return {
      ...result.tree,
      nodes: result.tree.nodes.map((n) =>
        n.id === id
          ? { ...n, identitySource: 'CANONICAL_GRAPH' as const, status: 'PUBLISHED' as const }
          : n
      ),
    };
  }
  return result.tree;
}

// ─── Domain layer tests ───────────────────────────────────────────────────────

describe('Knowledge Tree domain — create', () => {
  it('creates a draft root node with TREE_NATIVE identity', () => {
    const tree = addNode(emptyTree(), 'root-1', 'Toán 12');
    const node = tree.nodes.find((n) => n.id === 'root-1')!;
    expect(node.identitySource).toBe('TREE_NATIVE');
    expect(node.status).toBe('DRAFT');
    expect(node.parentId).toBeNull();
    expect(node.order).toBe(1);
  });

  it('creates a child node under an existing parent', () => {
    let tree = addNode(emptyTree(), 'root', 'Toán 12');
    tree = addNode(tree, 'child', 'Giải tích', 'root');
    const child = tree.nodes.find((n) => n.id === 'child')!;
    expect(child.parentId).toBe('root');
    expect(child.status).toBe('DRAFT');
  });

  it('rejects duplicate sibling titles', () => {
    let tree = addNode(emptyTree(), 'root', 'Toán 12');
    tree = addNode(tree, 'child-1', 'Giải tích', 'root');
    expect(() => addNode(tree, 'child-2', 'Giải tích', 'root')).toThrow(/đã tồn tại/);
  });
});

describe('Knowledge Tree domain — edit', () => {
  it('renames a draft node without changing ID or identity', () => {
    const tree = addNode(emptyTree(), 'n1', 'Tên cũ');
    const result = updateKnowledgeTreeNode(
      tree,
      'n1',
      { title: 'Tên mới', description: 'Mô tả' },
      NOW
    );
    expect(result.node.id).toBe('n1');
    expect(result.node.title).toBe('Tên mới');
    expect(result.node.identitySource).toBe('TREE_NATIVE');
  });
});

describe('Knowledge Tree domain — delete', () => {
  it('deletes a draft leaf node', () => {
    let tree = addNode(emptyTree(), 'root', 'Gốc');
    tree = addNode(tree, 'leaf', 'Lá', 'root');
    const next = deleteKnowledgeTreeNode(tree, 'leaf', {}, NOW);
    expect(next.nodes.map((n) => n.id)).not.toContain('leaf');
  });

  it('blocks deletion of a node with children', () => {
    let tree = addNode(emptyTree(), 'root', 'Gốc');
    tree = addNode(tree, 'child', 'Con', 'root');
    expect(() => deleteKnowledgeTreeNode(tree, 'root', {}, NOW)).toThrow(/kiến thức con/);
  });

  it('blocks deletion of a canonical node', () => {
    const tree = addNode(emptyTree(), 'cg-1', 'Canonical', null, 'CANONICAL_GRAPH');
    expect(() => deleteKnowledgeTreeNode(tree, 'cg-1', {}, NOW)).toThrow(/canonical/);
  });
});

describe('Knowledge Tree domain — move & reorder', () => {
  it('moves a node to a new parent', () => {
    let tree = addNode(emptyTree(), 'a', 'Nhóm A');
    tree = addNode(tree, 'b', 'Nhóm B');
    tree = addNode(tree, 'child', 'Con', 'a');
    const result = moveKnowledgeTreeNode(tree, 'child', 'b', 1, NOW);
    expect(result.node.parentId).toBe('b');
  });

  it('prevents moving a node into its own descendant', () => {
    let tree = addNode(emptyTree(), 'parent', 'Cha');
    tree = addNode(tree, 'child', 'Con', 'parent');
    expect(() => moveKnowledgeTreeNode(tree, 'parent', 'child', 1, NOW)).toThrow(/chính nó/);
  });

  it('reorders siblings correctly', () => {
    let tree = addNode(emptyTree(), 'root', 'Gốc');
    tree = addNode(tree, 'c1', 'Một', 'root');
    tree = addNode(tree, 'c2', 'Hai', 'root');
    tree = addNode(tree, 'c3', 'Ba', 'root');
    // Move c3 to position 1 (before c1)
    const result = moveKnowledgeTreeNode(tree, 'c3', 'root', 1, NOW);
    const siblings = result.tree.nodes
      .filter((n) => n.parentId === 'root')
      .sort((a, b) => a.order - b.order)
      .map((n) => n.id);
    expect(siblings[0]).toBe('c3');
  });
});

describe('Knowledge Tree domain — search', () => {
  it('returns matching nodes and their ancestors', () => {
    let tree = addNode(emptyTree(), 'math', 'Toán 12');
    tree = addNode(tree, 'calc', 'Giải tích', 'math');
    tree = addNode(tree, 'deriv', 'Đạo hàm', 'calc');
    const visible = searchKnowledgeTree(tree.nodes, 'Đạo hàm');
    expect(visible.has('deriv')).toBe(true);
    expect(visible.has('calc')).toBe(true);
    expect(visible.has('math')).toBe(true);
  });

  it('clears to show all nodes when query is empty', () => {
    let tree = addNode(emptyTree(), 'n1', 'Alpha');
    tree = addNode(tree, 'n2', 'Beta');
    const visible = searchKnowledgeTree(tree.nodes, '');
    expect(visible.size).toBe(2);
  });
});

// ─── Capability layer tests ───────────────────────────────────────────────────

describe('Node capabilities', () => {
  const mkNode = (
    identitySource: 'TREE_NATIVE' | 'CANONICAL_GRAPH',
    status: 'DRAFT' | 'PUBLISHED' = 'DRAFT'
  ): KnowledgeTreeNode => ({
    id: 'test',
    title: 'Test',
    description: '',
    parentId: null,
    order: 1,
    status,
    kind: 'KNOWLEDGE',
    identitySource,
    createdAt: NOW,
    updatedAt: NOW,
  });

  it('grants all caps to TREE_NATIVE draft', () => {
    const caps = getNodeCapabilities(mkNode('TREE_NATIVE'), []);
    expect(caps.canEdit).toBe(true);
    expect(caps.canDelete).toBe(true);
    expect(caps.canAddChild).toBe(true);
    expect(caps.canMove).toBe(true);
  });

  it('denies edit and delete for CANONICAL_GRAPH node', () => {
    const caps = getNodeCapabilities(mkNode('CANONICAL_GRAPH'), []);
    expect(caps.canEdit).toBe(false);
    expect(caps.canDelete).toBe(false);
    expect(caps.canMove).toBe(true);
    expect(caps.canAddChild).toBe(true);
  });

  it('canMoveUp is false when node is the first sibling', () => {
    const siblings: KnowledgeTreeNode[] = [
      {
        id: 'first',
        title: 'First',
        description: '',
        parentId: 'root',
        order: 1,
        status: 'DRAFT',
        kind: 'KNOWLEDGE',
        identitySource: 'TREE_NATIVE',
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'second',
        title: 'Second',
        description: '',
        parentId: 'root',
        order: 2,
        status: 'DRAFT',
        kind: 'KNOWLEDGE',
        identitySource: 'TREE_NATIVE',
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];
    const firstNode = siblings[0];
    const caps = getNodeCapabilities(firstNode, siblings);
    expect(caps.canMoveUp).toBe(false);
    expect(caps.canMoveDown).toBe(true);
  });

  it('canMoveDown is false when node is the last sibling', () => {
    const siblings: KnowledgeTreeNode[] = [
      {
        id: 'first',
        title: 'First',
        description: '',
        parentId: 'root',
        order: 1,
        status: 'DRAFT',
        kind: 'KNOWLEDGE',
        identitySource: 'TREE_NATIVE',
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'last',
        title: 'Last',
        description: '',
        parentId: 'root',
        order: 2,
        status: 'DRAFT',
        kind: 'KNOWLEDGE',
        identitySource: 'TREE_NATIVE',
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];
    const lastNode = siblings[1];
    const caps = getNodeCapabilities(lastNode, siblings);
    expect(caps.canMoveDown).toBe(false);
    expect(caps.canMoveUp).toBe(true);
  });
});

describe('Node status display', () => {
  const mkNode = (
    identitySource: 'TREE_NATIVE' | 'CANONICAL_GRAPH',
    status: 'DRAFT' | 'PUBLISHED'
  ): KnowledgeTreeNode => ({
    id: 'n',
    title: 'N',
    description: '',
    parentId: null,
    order: 1,
    status,
    kind: 'KNOWLEDGE',
    identitySource,
    createdAt: NOW,
    updatedAt: NOW,
  });

  it('shows "Kiến thức nháp" for TREE_NATIVE nodes', () => {
    const d = getNodeStatusDisplay(mkNode('TREE_NATIVE', 'DRAFT'));
    expect(d.label).toBe('Kiến thức nháp');
    expect(d.variant).toBe('draft-new');
  });

  it('shows "Kiến thức hiện có" for CANONICAL_GRAPH DRAFT nodes', () => {
    const d = getNodeStatusDisplay(mkNode('CANONICAL_GRAPH', 'DRAFT'));
    expect(d.label).toBe('Kiến thức hiện có');
    expect(d.variant).toBe('canonical');
  });

  it('shows "Đang dùng" for CANONICAL_GRAPH PUBLISHED nodes', () => {
    const d = getNodeStatusDisplay(mkNode('CANONICAL_GRAPH', 'PUBLISHED'));
    expect(d.label).toBe('Đang dùng');
    expect(d.variant).toBe('published');
  });
});

// ─── Repository layer tests ───────────────────────────────────────────────────

describe('LocalKnowledgeRepository', () => {
  let repoInstance: LocalKnowledgeRepository;

  beforeEach(() => {
    localStorageMock.clear();
    // Reset fetch mock to return empty model
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => emptyReadModel,
    } as Response);
    repoInstance = new LocalKnowledgeRepository();
  });

  it('loads empty tree from server when localStorage is empty', async () => {
    const result = await repoInstance.getReadModel();
    expect(result.tree.nodes).toHaveLength(0);
  });

  it('creates a draft node and persists it in localStorage', async () => {
    await repoInstance.getReadModel(); // initialize
    const created = await repoInstance.createNode({
      title: 'Kiến thức mới',
      parentId: null,
      kind: 'GROUP',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.identitySource).toBe('TREE_NATIVE');
    expect(created.data.status).toBe('DRAFT');

    // Verify localStorage contains it
    const stored = JSON.parse(localStorageMock.getItem('kt_v2')!);
    expect(stored.nodes.some((n: KnowledgeTreeNode) => n.id === created.data.id)).toBe(true);
  });

  it('persists edit to a draft node', async () => {
    await repoInstance.getReadModel();
    const created = await repoInstance.createNode({ title: 'Gốc', parentId: null, kind: 'GROUP' });
    if (!created.ok) throw created.error;

    const updated = await repoInstance.updateNode(created.data.id, { title: 'Gốc đổi tên' });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.data.title).toBe('Gốc đổi tên');

    const stored = JSON.parse(localStorageMock.getItem('kt_v2')!);
    expect(stored.nodes.find((n: KnowledgeTreeNode) => n.id === created.data.id)?.title).toBe(
      'Gốc đổi tên'
    );
  });

  it('persists editing a CANONICAL_GRAPH node as a local override', async () => {
    // Seed localStorage with a canonical node — simulate scenario
    const canonicalNode: KnowledgeTreeNode = {
      id: 'canonical-1',
      title: 'Canonical',
      description: '',
      parentId: null,
      order: 1,
      status: 'DRAFT',
      kind: 'GROUP',
      identitySource: 'CANONICAL_GRAPH',
      createdAt: NOW,
      updatedAt: NOW,
    };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        ...emptyReadModel,
        tree: { schemaVersion: 1, updatedAt: NOW, nodes: [canonicalNode] },
      }),
    } as Response);
    const r2 = new LocalKnowledgeRepository();
    await r2.getReadModel();

    const result = await r2.updateNode('canonical-1', { title: 'Tên đã sửa' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.title).toBe('Tên đã sửa');

    const refreshed = await new LocalKnowledgeRepository().getReadModel();
    expect(refreshed.tree.nodes.find((node) => node.id === 'canonical-1')?.title).toBe(
      'Tên đã sửa'
    );
  });

  it('deletes a draft leaf node and removes it from localStorage', async () => {
    await repoInstance.getReadModel();
    const created = await repoInstance.createNode({
      title: 'Xóa tôi',
      parentId: null,
      kind: 'KNOWLEDGE',
    });
    if (!created.ok) throw created.error;

    const deleted = await repoInstance.deleteNode(created.data.id);
    expect(deleted.ok).toBe(true);

    const stored = JSON.parse(localStorageMock.getItem('kt_v2')!);
    expect(stored.nodes.some((n: KnowledgeTreeNode) => n.id === created.data.id)).toBe(false);
  });

  it('blocks deleting a node that has children', async () => {
    await repoInstance.getReadModel();
    const parent = await repoInstance.createNode({ title: 'Cha', parentId: null, kind: 'GROUP' });
    if (!parent.ok) throw parent.error;
    const child = await repoInstance.createNode({
      title: 'Con',
      parentId: parent.data.id,
      kind: 'KNOWLEDGE',
    });
    if (!child.ok) throw child.error;

    const result = await repoInstance.deleteNode(parent.data.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('HAS_CHILDREN');
  });

  it('deletes a CANONICAL_GRAPH node through a persisted tombstone', async () => {
    const canonicalNode: KnowledgeTreeNode = {
      id: 'cg-del',
      title: 'Canonical',
      description: '',
      parentId: null,
      order: 1,
      status: 'DRAFT',
      kind: 'KNOWLEDGE',
      identitySource: 'CANONICAL_GRAPH',
      createdAt: NOW,
      updatedAt: NOW,
    };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        ...emptyReadModel,
        tree: { schemaVersion: 1, updatedAt: NOW, nodes: [canonicalNode] },
      }),
    } as Response);
    const r2 = new LocalKnowledgeRepository();
    await r2.getReadModel();

    const result = await r2.deleteNode('cg-del');
    expect(result.ok).toBe(true);

    const refreshed = await new LocalKnowledgeRepository().getReadModel();
    expect(refreshed.tree.nodes.some((node) => node.id === 'cg-del')).toBe(false);
  });

  it('reorders a node up', async () => {
    await repoInstance.getReadModel();
    const root = await repoInstance.createNode({ title: 'Root', parentId: null, kind: 'GROUP' });
    if (!root.ok) throw root.error;
    const c1 = await repoInstance.createNode({
      title: 'Một',
      parentId: root.data.id,
      kind: 'KNOWLEDGE',
    });
    const c2 = await repoInstance.createNode({
      title: 'Hai',
      parentId: root.data.id,
      kind: 'KNOWLEDGE',
    });
    if (!c1.ok || !c2.ok) throw new Error('setup');

    const result = await repoInstance.reorderNode(c2.data.id, 'up');
    expect(result.ok).toBe(true);

    const model = await repoInstance.getReadModel();
    const siblings = model.tree.nodes
      .filter((n) => n.parentId === root.data.id)
      .sort((a, b) => a.order - b.order);
    expect(siblings[0].id).toBe(c2.data.id);
  });

  it('reorderNode returns ALREADY_FIRST at boundary', async () => {
    await repoInstance.getReadModel();
    const root = await repoInstance.createNode({ title: 'Root', parentId: null, kind: 'GROUP' });
    if (!root.ok) throw root.error;
    const c1 = await repoInstance.createNode({
      title: 'Solo',
      parentId: root.data.id,
      kind: 'KNOWLEDGE',
    });
    if (!c1.ok) throw c1.error;

    const result = await repoInstance.reorderNode(c1.data.id, 'up');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ALREADY_FIRST');
  });

  it('reorderNode returns ALREADY_LAST at boundary', async () => {
    await repoInstance.getReadModel();
    const root = await repoInstance.createNode({ title: 'Root', parentId: null, kind: 'GROUP' });
    if (!root.ok) throw root.error;
    const c1 = await repoInstance.createNode({
      title: 'Solo',
      parentId: root.data.id,
      kind: 'KNOWLEDGE',
    });
    if (!c1.ok) throw c1.error;

    const result = await repoInstance.reorderNode(c1.data.id, 'down');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('ALREADY_LAST');
  });

  it('prevents moving a node into its own descendant', async () => {
    await repoInstance.getReadModel();
    const parent = await repoInstance.createNode({ title: 'Cha', parentId: null, kind: 'GROUP' });
    if (!parent.ok) throw parent.error;
    const child = await repoInstance.createNode({
      title: 'Con',
      parentId: parent.data.id,
      kind: 'KNOWLEDGE',
    });
    if (!child.ok) throw child.error;

    const result = await repoInstance.moveNode(parent.data.id, child.data.id, 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CANNOT_MOVE_INTO_DESCENDANT');
  });

  it('draft nodes survive a repo instance restart (simulates page refresh)', async () => {
    // Simulate first session
    await repoInstance.getReadModel();
    const created = await repoInstance.createNode({
      title: 'Persisted',
      parentId: null,
      kind: 'GROUP',
    });
    if (!created.ok) throw created.error;

    // Simulate page refresh — new repo instance, same localStorage
    const freshRepo = new LocalKnowledgeRepository();
    const model = await freshRepo.getReadModel();
    expect(model.tree.nodes.some((n) => n.id === created.data.id)).toBe(true);
  });

  it('deleted draft nodes remain deleted after repo restart', async () => {
    await repoInstance.getReadModel();
    const created = await repoInstance.createNode({
      title: 'Sẽ bị xóa',
      parentId: null,
      kind: 'GROUP',
    });
    if (!created.ok) throw created.error;

    await repoInstance.deleteNode(created.data.id);

    const freshRepo = new LocalKnowledgeRepository();
    const model = await freshRepo.getReadModel();
    expect(model.tree.nodes.some((n) => n.id === created.data.id)).toBe(false);
  });
});
