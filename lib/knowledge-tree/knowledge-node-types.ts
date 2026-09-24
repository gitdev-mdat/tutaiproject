import type { KnowledgeNodeType } from './knowledge-tree-types';

export const KNOWLEDGE_NODE_TYPES: KnowledgeNodeType[] = [
  'MON_HOC',
  'LOP',
  'TAP',
  'CHUONG',
  'CHU_DE',
  'KIEN_THUC',
  'NHOM_KIEN_THUC',
  'KHAC',
  'CHUA_PHAN_LOAI',
];

export const KNOWLEDGE_NODE_TYPE_LABELS: Record<KnowledgeNodeType, string> = {
  MON_HOC: 'Môn học',
  LOP: 'Lớp',
  TAP: 'Tập',
  CHUONG: 'Chương',
  CHU_DE: 'Chủ đề',
  KIEN_THUC: 'Kiến thức',
  NHOM_KIEN_THUC: 'Nhóm kiến thức',
  KHAC: 'Khác',
  CHUA_PHAN_LOAI: 'Chưa phân loại',
};

/**
 * Returns true if the node type is conceptually an organizational folder
 * rather than a leaf/content node.
 */
export function isOrganizationalNodeType(type?: KnowledgeNodeType): boolean {
  if (!type) return true;
  return ['MON_HOC', 'LOP', 'TAP', 'CHUONG', 'NHOM_KIEN_THUC'].includes(type);
}

/**
 * Basic heuristic to suggest a node type based on its title during import.
 * This is ONLY a suggestion, not a strict classification.
 */
export function suggestNodeType(title: string): KnowledgeNodeType {
  const normalized = title.trim().toLowerCase();

  if (normalized.startsWith('môn ')) return 'MON_HOC';
  if (
    normalized.startsWith('toán') ||
    normalized.startsWith('ngữ văn') ||
    normalized.startsWith('tiếng anh') ||
    normalized.startsWith('vật lý') ||
    normalized.startsWith('hóa học') ||
    normalized.startsWith('sinh học')
  )
    return 'MON_HOC';

  if (normalized.startsWith('lớp ')) return 'LOP';
  if (normalized.startsWith('tập ')) return 'TAP';

  if (normalized.startsWith('chương ') || normalized.startsWith('phần ')) return 'CHUONG';

  if (normalized.startsWith('bài ') || normalized.startsWith('chủ đề ')) return 'CHU_DE';

  // If no clear structural prefix, assume it might be a specific knowledge item
  // unless it's very short (then it might just be unclassified).
  if (normalized.length > 30) return 'KIEN_THUC';

  return 'CHUA_PHAN_LOAI';
}
