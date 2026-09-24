/**
 * Node Capabilities — single source of truth for what actions are allowed on a node.
 *
 * Both the tree context menu and the right-panel action bar must consume
 * this function. No scattered `if (node.identitySource === ...)` in UI components.
 */

import type { KnowledgeTreeNode } from './knowledge-tree-types';

export interface NodeCapabilities {
  /** Can a child node be added beneath this node? */
  canAddChild: boolean;
  /** Can title / description / kind be edited? */
  canEdit: boolean;
  /** Can the node be moved to a new parent? */
  canMove: boolean;
  /** Can the node be moved to an earlier sibling position? */
  canMoveUp: boolean;
  /** Can the node be moved to a later sibling position? */
  canMoveDown: boolean;
  /** Can the node be deleted (frontend-draft leaf only)? */
  canDelete: boolean;
}

/**
 * Derive what actions are permitted for a given node.
 *
 * @param node - The node to check.
 * @param siblings - All siblings (same parentId), sorted by order ascending.
 *                   Pass an empty array if the sibling list is unknown —
 *                   canMoveUp/canMoveDown will default to true in that case.
 */
export function getNodeCapabilities(
  node: KnowledgeTreeNode,
  siblings: KnowledgeTreeNode[]
): NodeCapabilities {
  const isFrontendDraft = node.identitySource === 'TREE_NATIVE';

  // Sibling-position boundary detection
  let canMoveUp = true;
  let canMoveDown = true;
  if (siblings.length > 0) {
    const sortedIds = [...siblings].sort((a, b) => a.order - b.order).map((s) => s.id);
    canMoveUp = sortedIds[0] !== node.id;
    canMoveDown = sortedIds[sortedIds.length - 1] !== node.id;
  }

  if (isFrontendDraft) {
    return {
      canAddChild: true,
      canEdit: true,
      canMove: true,
      canMoveUp,
      canMoveDown,
      canDelete: true,
    };
  }

  // CANONICAL_GRAPH node — legacy identity, restricted in this phase.
  // Product rule: only tree placement (move / reorder) is allowed.
  // Rename and delete are blocked.
  return {
    canAddChild: true, // draft children can be added under legacy nodes
    canEdit: false,
    canMove: true,
    canMoveUp,
    canMoveDown,
    canDelete: false,
  };
}

/**
 * Status display model — three distinct concepts mapped to clear Vietnamese labels.
 *
 * Do not collapse these into a single "Nháp" badge.
 */
export type NodeStatusDisplay =
  | {
      label: 'Kiến thức nháp';
      variant: 'draft-new';
      description: 'Vừa được tạo, chưa có trong hệ thống chính';
    }
  | {
      label: 'Kiến thức hiện có';
      variant: 'canonical';
      description: 'Thuộc dữ liệu hệ thống, vị trí đặt thủ công';
    }
  | { label: 'Đang dùng'; variant: 'published'; description: 'Đã được dùng trong hệ thống' };

export function getNodeStatusDisplay(node: KnowledgeTreeNode): NodeStatusDisplay {
  if (node.identitySource === 'TREE_NATIVE') {
    return {
      label: 'Kiến thức nháp',
      variant: 'draft-new',
      description: 'Vừa được tạo, chưa có trong hệ thống chính',
    };
  }
  // CANONICAL_GRAPH — exists in legacy system
  if (node.status === 'DRAFT') {
    return {
      label: 'Kiến thức hiện có',
      variant: 'canonical',
      description: 'Thuộc dữ liệu hệ thống, vị trí đặt thủ công',
    };
  }
  return {
    label: 'Đang dùng',
    variant: 'published',
    description: 'Đã được dùng trong hệ thống',
  };
}
