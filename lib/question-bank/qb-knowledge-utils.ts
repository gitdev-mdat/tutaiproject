import type {
  KnowledgeTreeDocument,
  KnowledgeTreeNode,
} from '@/lib/knowledge-tree/knowledge-tree-types';
import type { Grade, SubjectId } from './qb-types';

export interface DerivedHierarchy {
  subjectId?: SubjectId;
  grade?: Grade;
  chapterId?: string;
  lessonId?: string;
  topicId?: string;
}

/** A question can only be attached to an active knowledge-bearing node. */
export function isAttachableKnowledgeNode(
  node: KnowledgeTreeNode | undefined
): node is KnowledgeTreeNode {
  return node?.kind === 'KNOWLEDGE' && node.status !== 'ARCHIVED';
}

function normalizeNodeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function resolveSubjectId(node: KnowledgeTreeNode): SubjectId | undefined {
  const identity = normalizeNodeTitle(`${node.id} ${node.title}`).replace(/đ/g, 'd');
  if (/\b(math|toan)\b/.test(identity)) return 'MATH';
  if (/\b(physics|vat ly|vat li)\b/.test(identity)) return 'PHYSICS';
  if (/\b(chemistry|hoa hoc|hoa)\b/.test(identity)) return 'CHEMISTRY';
  if (/\b(biology|sinh hoc|sinh)\b/.test(identity)) return 'BIOLOGY';
  return undefined;
}

function resolveGrade(title: string, id: string): Grade | undefined {
  const match = `${title} ${id}`.match(/(?:^|\D)(10|11|12)(?:\D|$)/);
  return match ? (Number(match[1]) as Grade) : undefined;
}

function effectiveNodeType(node: KnowledgeTreeNode): string | undefined {
  return (node.sourceGraphNodeType as string | undefined) ?? node.nodeType;
}

/**
 * Resolves a human-readable path to a knowledge node ID. Exact normalized
 * matches are preferred and callers may omit leading ancestors.
 */
export function resolveKnowledgePath(
  pathString: string,
  tree: KnowledgeTreeDocument
): string | null {
  if (!pathString || !pathString.trim()) return null;

  const segments = pathString
    .split(/[>|]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;

  const childrenMap = new Map<string | null, KnowledgeTreeNode[]>();
  tree.nodes.forEach((node) => {
    const siblings = childrenMap.get(node.parentId) ?? [];
    siblings.push(node);
    childrenMap.set(node.parentId, siblings);
  });

  let currentParentId: string | null = null;
  let currentNode: KnowledgeTreeNode | null = null;

  for (let index = 0; index < segments.length; index += 1) {
    const normalizedSegment = normalizeNodeTitle(segments[index]);
    const siblings: KnowledgeTreeNode[] = childrenMap.get(currentParentId) ?? [];
    let match: KnowledgeTreeNode | undefined = siblings.find(
      (node: KnowledgeTreeNode) => normalizeNodeTitle(node.title) === normalizedSegment
    );

    if (!match && index === 0) {
      match = tree.nodes.find(
        (node: KnowledgeTreeNode) => normalizeNodeTitle(node.title) === normalizedSegment
      );
    }
    if (!match) return null;

    currentNode = match;
    currentParentId = match.id;
  }

  return currentNode?.id ?? null;
}

/** Walks all ancestors and derives canonical question-bank hierarchy fields. */
export function deriveHierarchyContext(
  nodeId: string,
  tree: KnowledgeTreeDocument
): DerivedHierarchy {
  const nodeMap = new Map<string, KnowledgeTreeNode>(tree.nodes.map((node) => [node.id, node]));
  const hierarchy: DerivedHierarchy = {};
  const visited = new Set<string>();
  let currentId: string | null = nodeId;

  while (currentId && nodeMap.has(currentId) && !visited.has(currentId)) {
    visited.add(currentId);
    const node: KnowledgeTreeNode = nodeMap.get(currentId)!;
    const nodeType = effectiveNodeType(node);

    if ((nodeType === 'MON_HOC' || nodeType === 'SUBJECT') && !hierarchy.subjectId) {
      hierarchy.subjectId = resolveSubjectId(node);
    } else if ((nodeType === 'LOP' || nodeType === 'GRADE') && !hierarchy.grade) {
      hierarchy.grade = resolveGrade(node.title, node.id);
    } else if ((nodeType === 'CHUONG' || nodeType === 'DOMAIN') && !hierarchy.chapterId) {
      hierarchy.chapterId = node.id;
    } else if ((nodeType === 'CHU_DE' || nodeType === 'LESSON') && !hierarchy.lessonId) {
      hierarchy.lessonId = node.id;
    } else if ((nodeType === 'KIEN_THUC' || nodeType === 'CONCEPT') && !hierarchy.topicId) {
      hierarchy.topicId = node.id;
    }

    currentId = node.parentId;
  }

  return hierarchy;
}

/** Returns node titles from root to leaf. Cycles are truncated safely. */
export function buildKnowledgeBreadcrumb(nodeId: string, tree: KnowledgeTreeDocument): string[] {
  const nodeMap = new Map<string, KnowledgeTreeNode>(tree.nodes.map((node) => [node.id, node]));
  const breadcrumb: string[] = [];
  const visited = new Set<string>();
  let currentId: string | null = nodeId;

  while (currentId && nodeMap.has(currentId) && !visited.has(currentId)) {
    visited.add(currentId);
    const node: KnowledgeTreeNode = nodeMap.get(currentId)!;
    breadcrumb.unshift(node.title);
    currentId = node.parentId;
  }

  return breadcrumb;
}
