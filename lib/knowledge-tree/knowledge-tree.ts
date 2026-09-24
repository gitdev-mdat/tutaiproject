import type { KgDocument, KgNode } from '@/lib/knowledge-graph/kg-types';
import type {
  KnowledgeTreeDeleteContext,
  KnowledgeTreeDocument,
  KnowledgeTreeNode,
  KnowledgeTreeNodeKind,
} from './knowledge-tree-types';

function normalizedTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ');
}

function descriptionForGraphNode(node: KgNode): string {
  if (node.type === 'CONCEPT') {
    return node.detailedDescription || node.shortDescription || '';
  }
  return node.description || '';
}

function treeNodeFromGraph(node: KgNode, parentId: string | null): KnowledgeTreeNode {
  return {
    id: node.id,
    title: node.title,
    description: descriptionForGraphNode(node),
    parentId,
    order: node.order,
    status: node.status,
    kind: node.type === 'CONCEPT' ? 'KNOWLEDGE' : 'GROUP',
    identitySource: 'CANONICAL_GRAPH',
    sourceGraphNodeType: node.type,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  };
}

/** Read-only compatibility adapter. It copies graph identities and placement; it never writes graph data. */
export function buildKnowledgeTreeFromGraph(
  graph: KgDocument,
  now = graph.updatedAt
): KnowledgeTreeDocument {
  const nodes: KnowledgeTreeNode[] = [];

  for (const subject of graph.subjects) {
    nodes.push(treeNodeFromGraph(subject, null));
    for (const grade of subject.grades) {
      nodes.push(treeNodeFromGraph(grade, subject.id));
      for (const domain of grade.domains) {
        nodes.push(treeNodeFromGraph(domain, grade.id));
        for (const concept of domain.concepts) {
          nodes.push(treeNodeFromGraph(concept, domain.id));
        }
      }
    }
  }

  return { schemaVersion: 1, updatedAt: now, nodes: normalizeSiblingOrders(nodes) };
}

export function childrenOf(nodes: KnowledgeTreeNode[], parentId: string | null) {
  return nodes
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'vi'));
}

export function normalizeSiblingOrders(nodes: KnowledgeTreeNode[]): KnowledgeTreeNode[] {
  const cloned = nodes.map((node) => ({ ...node }));
  const parentIds = new Set(cloned.map((node) => node.parentId));
  for (const parentId of parentIds) {
    childrenOf(cloned, parentId).forEach((node, index) => {
      node.order = index + 1;
    });
  }
  return cloned;
}

function assertParentExists(nodes: KnowledgeTreeNode[], parentId: string | null) {
  if (parentId !== null && !nodes.some((node) => node.id === parentId)) {
    throw new Error('Không tìm thấy nhóm cha.');
  }
}

function assertUniqueSiblingTitle(
  nodes: KnowledgeTreeNode[],
  parentId: string | null,
  title: string,
  excludedId?: string
) {
  const normalized = normalizedTitle(title).toLocaleLowerCase('vi');
  if (!normalized) throw new Error('Tên kiến thức không được để trống.');
  if (
    nodes.some(
      (node) =>
        node.id !== excludedId &&
        node.parentId === parentId &&
        normalizedTitle(node.title).toLocaleLowerCase('vi') === normalized
    )
  ) {
    throw new Error('Tên kiến thức đã tồn tại trong cùng nhóm.');
  }
}

export function createKnowledgeTreeNode(
  tree: KnowledgeTreeDocument,
  input: {
    title: string;
    description?: string;
    parentId: string | null;
    kind: KnowledgeTreeNodeKind;
  },
  options: { id: string; now: string }
): { tree: KnowledgeTreeDocument; node: KnowledgeTreeNode } {
  assertParentExists(tree.nodes, input.parentId);
  assertUniqueSiblingTitle(tree.nodes, input.parentId, input.title);
  if (tree.nodes.some((node) => node.id === options.id)) {
    throw new Error('Knowledge ID đã tồn tại.');
  }

  const node: KnowledgeTreeNode = {
    id: options.id,
    title: normalizedTitle(input.title),
    description: input.description?.trim() || '',
    parentId: input.parentId,
    order: childrenOf(tree.nodes, input.parentId).length + 1,
    status: 'DRAFT',
    kind: input.kind,
    identitySource: 'TREE_NATIVE',
    createdAt: options.now,
    updatedAt: options.now,
  };
  return {
    node,
    tree: { ...tree, updatedAt: options.now, nodes: [...tree.nodes, node] },
  };
}

export function updateKnowledgeTreeNode(
  tree: KnowledgeTreeDocument,
  nodeId: string,
  updates: { title?: string; description?: string; kind?: KnowledgeTreeNodeKind },
  now: string
): { tree: KnowledgeTreeDocument; node: KnowledgeTreeNode } {
  const current = tree.nodes.find((node) => node.id === nodeId);
  if (!current) throw new Error('Không tìm thấy kiến thức.');
  const title = updates.title === undefined ? current.title : normalizedTitle(updates.title);
  assertUniqueSiblingTitle(tree.nodes, current.parentId, title, nodeId);

  const node: KnowledgeTreeNode = {
    ...current,
    title,
    description:
      updates.description === undefined ? current.description : updates.description.trim(),
    kind: updates.kind ?? current.kind,
    updatedAt: now,
  };
  return {
    node,
    tree: {
      ...tree,
      updatedAt: now,
      nodes: tree.nodes.map((item) => (item.id === nodeId ? node : item)),
    },
  };
}

function descendantIds(nodes: KnowledgeTreeNode[], nodeId: string): Set<string> {
  const ids = new Set<string>();
  const visit = (parentId: string) => {
    for (const child of nodes.filter((node) => node.parentId === parentId)) {
      ids.add(child.id);
      visit(child.id);
    }
  };
  visit(nodeId);
  return ids;
}

export function moveKnowledgeTreeNode(
  tree: KnowledgeTreeDocument,
  nodeId: string,
  parentId: string | null,
  order: number,
  now: string
): { tree: KnowledgeTreeDocument; node: KnowledgeTreeNode } {
  const current = tree.nodes.find((node) => node.id === nodeId);
  if (!current) throw new Error('Không tìm thấy kiến thức.');
  assertParentExists(tree.nodes, parentId);
  if (
    parentId === nodeId ||
    (parentId !== null && descendantIds(tree.nodes, nodeId).has(parentId))
  ) {
    throw new Error('Không thể di chuyển một nhánh vào chính nó.');
  }
  assertUniqueSiblingTitle(tree.nodes, parentId, current.title, nodeId);

  const withoutCurrent = tree.nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => ({ ...node }));
  const targetSiblings = childrenOf(withoutCurrent, parentId);
  const targetIndex = Math.max(0, Math.min(Math.trunc(order) - 1, targetSiblings.length));
  const moved: KnowledgeTreeNode = { ...current, parentId, order: targetIndex + 1, updatedAt: now };
  targetSiblings.splice(targetIndex, 0, moved);

  const targetIds = new Set(targetSiblings.map((node) => node.id));
  const next = withoutCurrent.map((node) => {
    if (!targetIds.has(node.id)) return node;
    return { ...node, order: targetSiblings.findIndex((item) => item.id === node.id) + 1 };
  });
  next.push(moved);

  return {
    node: moved,
    tree: { ...tree, updatedAt: now, nodes: normalizeSiblingOrders(next) },
  };
}

export function deleteKnowledgeTreeNode(
  tree: KnowledgeTreeDocument,
  nodeId: string,
  context: KnowledgeTreeDeleteContext,
  now: string
): KnowledgeTreeDocument {
  const node = tree.nodes.find((item) => item.id === nodeId);
  if (!node) throw new Error('Không tìm thấy kiến thức.');
  if (node.identitySource === 'CANONICAL_GRAPH') {
    throw new Error(
      'Nút đang dùng định danh canonical cũ; chỉ có thể chỉnh vị trí trong giai đoạn này.'
    );
  }
  if (node.status !== 'DRAFT') throw new Error('Chỉ có thể xóa kiến thức đang ở trạng thái nháp.');
  if (tree.nodes.some((item) => item.parentId === nodeId)) {
    throw new Error('Không thể xóa nhánh đang có kiến thức con.');
  }
  if (context.graphRelatedIds?.has(nodeId)) {
    throw new Error('Không thể xóa kiến thức đang có quan hệ học tập.');
  }

  return {
    ...tree,
    updatedAt: now,
    nodes: normalizeSiblingOrders(tree.nodes.filter((item) => item.id !== nodeId)),
  };
}

export function knowledgeBreadcrumb(
  nodes: KnowledgeTreeNode[],
  nodeId: string
): KnowledgeTreeNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const path: KnowledgeTreeNode[] = [];
  const visited = new Set<string>();
  let current = byId.get(nodeId);
  while (current) {
    if (visited.has(current.id)) throw new Error('Cây kiến thức chứa chu trình không hợp lệ.');
    visited.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

export function searchKnowledgeTree(nodes: KnowledgeTreeNode[], query: string): Set<string> {
  const normalized = normalizedTitle(query).toLocaleLowerCase('vi');
  if (!normalized) return new Set(nodes.map((node) => node.id));
  const matches = nodes.filter((node) =>
    `${node.title} ${node.description}`.toLocaleLowerCase('vi').includes(normalized)
  );
  const visible = new Set<string>();
  for (const match of matches) {
    for (const item of knowledgeBreadcrumb(nodes, match.id)) visible.add(item.id);
  }
  return visible;
}
