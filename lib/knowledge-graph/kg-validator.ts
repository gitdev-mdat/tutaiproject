import { KgDocument } from './kg-types';
import { walkKgNodes } from './kg-utils';

export interface KgValidationResult {
  valid: boolean;
  errors: KgValidationError[];
}

export interface KgValidationError {
  nodeId: string;
  nodeTitle: string;
  code:
    | 'MISSING_TITLE'
    | 'MISSING_SLUG'
    | 'DUPLICATE_SLUG'
    | 'INVALID_STATUS'
    | 'INVALID_HIERARCHY'
    | 'ORPHANED_NODE';
  message: string;
}

export function validateKnowledgeGraph(doc: KgDocument): KgValidationResult {
  const errors: KgValidationError[] = [];
  const slugsByLevel = {
    SUBJECT: new Set<string>(),
    GRADE: new Set<string>(),
    DOMAIN: new Set<string>(),
    CONCEPT: new Set<string>(),
  };

  const allNodes = Array.from(walkKgNodes(doc));

  for (const { node, parent, level } of allNodes) {
    if (!node.title || node.title.trim() === '') {
      errors.push({
        nodeId: node.id,
        nodeTitle: node.title,
        code: 'MISSING_TITLE',
        message: 'Tên không được để trống.',
      });
    }

    if (!node.slug || node.slug.trim() === '') {
      errors.push({
        nodeId: node.id,
        nodeTitle: node.title,
        code: 'MISSING_SLUG',
        message: 'Mã (slug) không được để trống.',
      });
    } else {
      const slugSet = slugsByLevel[node.type];
      if (slugSet) {
        if (slugSet.has(node.slug)) {
          errors.push({
            nodeId: node.id,
            nodeTitle: node.title,
            code: 'DUPLICATE_SLUG',
            message: `Mã (slug) '${node.slug}' bị trùng lặp ở cấp độ ${node.type}.`,
          });
        } else {
          slugSet.add(node.slug);
        }
      }
    }

    if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(node.status)) {
      errors.push({
        nodeId: node.id,
        nodeTitle: node.title,
        code: 'INVALID_STATUS',
        message: `Trạng thái '${node.status}' không hợp lệ.`,
      });
    }

    // Check hierarchy validity
    if (level === 0 && node.type !== 'SUBJECT') {
      errors.push({
        nodeId: node.id,
        nodeTitle: node.title,
        code: 'INVALID_HIERARCHY',
        message: `Root node must be SUBJECT.`,
      });
    } else if (level === 1 && (node.type !== 'GRADE' || parent?.type !== 'SUBJECT')) {
      errors.push({
        nodeId: node.id,
        nodeTitle: node.title,
        code: 'INVALID_HIERARCHY',
        message: `Level 1 node must be GRADE under SUBJECT.`,
      });
    } else if (level === 2 && (node.type !== 'DOMAIN' || parent?.type !== 'GRADE')) {
      errors.push({
        nodeId: node.id,
        nodeTitle: node.title,
        code: 'INVALID_HIERARCHY',
        message: `Level 2 node must be DOMAIN under GRADE.`,
      });
    } else if (level === 3 && (node.type !== 'CONCEPT' || parent?.type !== 'DOMAIN')) {
      errors.push({
        nodeId: node.id,
        nodeTitle: node.title,
        code: 'INVALID_HIERARCHY',
        message: `Level 3 node must be CONCEPT under DOMAIN.`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
