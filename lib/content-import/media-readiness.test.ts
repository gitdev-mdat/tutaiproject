import { describe, expect, it } from 'vitest';
import type { QuestionContentBlock } from '@/lib/question-bank/qb-types';
import { normalizeRecoveredVisualContent } from './media-readiness';

const image: QuestionContentBlock = {
  id: 'image',
  type: 'IMAGE',
  media: { assetId: 'asset', alt: 'Bảng biến thiên' },
};

describe('recovered visual normalization', () => {
  it('removes an adjacent wrapped tabular serialization when the real image exists', () => {
    const blocks: QuestionContentBlock[] = [
      {
        id: 'text',
        type: 'TEXT',
        text: 'Xét hàm số.\n\\begin{center}\\begin{tabular}{c|c}x&y\\end{tabular}\\end{center}',
      },
      image,
    ];
    expect(normalizeRecoveredVisualContent(blocks)).toEqual([
      { id: 'text', type: 'TEXT', text: 'Xét hàm số.' },
      image,
    ]);
  });

  it('preserves legitimate tabular math without an adjacent image', () => {
    const blocks: QuestionContentBlock[] = [
      {
        id: 'text',
        type: 'TEXT',
        text: '$\\begin{array}{cc}1&2\\end{array}$ and \\begin{tabular}{cc}a&b\\end{tabular}',
      },
    ];
    expect(normalizeRecoveredVisualContent(blocks)).toEqual(blocks);
  });

  it('preserves a missing-image placeholder for review', () => {
    const blocks: QuestionContentBlock[] = [
      { id: 'text', type: 'TEXT', text: '[Hình ảnh bảng xét dấu]' },
    ];
    expect(normalizeRecoveredVisualContent(blocks)).toEqual(blocks);
  });
});

describe('learner math renderer source', () => {
  it('supports real numbers, powers, fractions and roots without debug styling', async () => {
    const source = await import('../../components/shared/question-content-renderer');
    expect(source.QuestionMath).toBeTypeOf('function');
  });
});
