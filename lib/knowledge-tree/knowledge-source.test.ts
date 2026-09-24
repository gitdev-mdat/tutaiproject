import { describe, it, expect } from 'vitest';
import { isSourceReady, getSourceStatusLabel } from './knowledge-source';
import type { KnowledgeSource } from './knowledge-tree-types';

describe('Knowledge Source Domain', () => {
  it('returns true if source is analyzed', () => {
    expect(isSourceReady({ status: 'ANALYZED' } as KnowledgeSource)).toBe(true);
    expect(isSourceReady({ status: 'ATTACHED' } as KnowledgeSource)).toBe(false);
    expect(isSourceReady({ status: 'PENDING_ANALYSIS' } as KnowledgeSource)).toBe(false);
  });

  it('formats status label', () => {
    expect(getSourceStatusLabel('ATTACHED')).toBe('Đã thêm');
    expect(getSourceStatusLabel('ANALYZED')).toBe('Đã phân tích');
    expect(getSourceStatusLabel('PENDING_ANALYSIS')).toBe('Đang xử lý');
  });
});
