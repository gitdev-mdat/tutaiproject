import type { KnowledgeSource, KnowledgeSourceStatus } from './knowledge-tree-types';

export function isSourceReady(source: KnowledgeSource): boolean {
  return source.status === 'ANALYZED';
}

export function getSourceStatusLabel(status: KnowledgeSourceStatus): string {
  switch (status) {
    case 'ATTACHED':
      return 'Đã thêm';
    case 'PENDING_ANALYSIS':
      return 'Đang xử lý';
    case 'ANALYZED':
      return 'Đã phân tích';
    default:
      return 'Không xác định';
  }
}
