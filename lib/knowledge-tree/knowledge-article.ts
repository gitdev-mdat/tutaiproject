import type { KnowledgeArticle } from './knowledge-tree-types';

export function createEmptyArticle(nodeId: string, title: string): Partial<KnowledgeArticle> {
  return {
    knowledgeNodeId: nodeId,
    title,
    blocks: [
      { id: `block-${Date.now()}-1`, type: 'TITLE', content: title },
      { id: `block-${Date.now()}-2`, type: 'INTRO', content: '' },
      { id: `block-${Date.now()}-3`, type: 'OBJECTIVE', content: '' },
      { id: `block-${Date.now()}-4`, type: 'MAIN_CONTENT', content: '' },
      { id: `block-${Date.now()}-5`, type: 'EXAMPLE', content: '' },
      { id: `block-${Date.now()}-6`, type: 'RECAP', content: '' },
    ],
    status: 'DRAFT',
    publishToBlog: false,
    publishToLearning: false,
  };
}

export function validateArticle(article: KnowledgeArticle): {
  isValid: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  if (!article.title.trim()) missing.push('TITLE');

  const hasContent = article.blocks.some(
    (b) => b.type === 'MAIN_CONTENT' && b.content.trim().length > 10
  );
  if (!hasContent) missing.push('MAIN_CONTENT');

  const hasObjective = article.blocks.some(
    (b) => b.type === 'OBJECTIVE' && b.content.trim().length > 10
  );
  if (!hasObjective) missing.push('OBJECTIVE');

  const hasExample = article.blocks.some(
    (b) => b.type === 'EXAMPLE' && b.content.trim().length > 10
  );
  if (!hasExample) missing.push('EXAMPLE');

  return {
    isValid: missing.length === 0,
    missing,
  };
}

type BodyBlockType = Exclude<KnowledgeArticle['blocks'][number]['type'], 'TITLE'>;

/** Editing order and labels for article blocks, shared by the admin editor and student reader. */
export const ARTICLE_BODY_BLOCKS: Array<{
  type: BodyBlockType;
  editorLabel: string;
  editorHint: string;
  readerHeading: string;
  required: boolean;
}> = [
  {
    type: 'INTRO',
    editorLabel: 'Mở đầu',
    editorHint: 'Kiến thức này là gì, vì sao cần học.',
    readerHeading: 'Mở đầu',
    required: false,
  },
  {
    type: 'OBJECTIVE',
    editorLabel: 'Mục tiêu',
    editorHint: 'Học sinh cần hiểu hoặc làm được gì sau bài này.',
    readerHeading: 'Sau bài này em sẽ',
    required: true,
  },
  {
    type: 'MAIN_CONTENT',
    editorLabel: 'Nội dung chính',
    editorHint: 'Định nghĩa, tính chất, công thức. Viết công thức trong $...$, ví dụ $x^2$.',
    readerHeading: 'Nội dung chính',
    required: true,
  },
  {
    type: 'EXAMPLE',
    editorLabel: 'Ví dụ',
    editorHint: 'Ít nhất một ví dụ có lời giải.',
    readerHeading: 'Ví dụ',
    required: true,
  },
  {
    type: 'RECAP',
    editorLabel: 'Ghi nhớ nhanh',
    editorHint: 'Những ý cần nhớ, mỗi ý một dòng.',
    readerHeading: 'Ghi nhớ',
    required: false,
  },
  {
    type: 'COMMON_MISTAKE',
    editorLabel: 'Lỗi hay gặp',
    editorHint: 'Sai lầm học sinh thường mắc và cách tránh.',
    readerHeading: 'Lỗi hay gặp',
    required: false,
  },
  {
    type: 'REFERENCES',
    editorLabel: 'Nguồn tham khảo',
    editorHint: 'Sách giáo khoa, trang, tài liệu.',
    readerHeading: 'Tham khảo',
    required: false,
  },
];

/** Returns one block per body type in editing order, keeping existing ids and content. */
export function normalizeArticleBlocks(
  blocks: KnowledgeArticle['blocks']
): KnowledgeArticle['blocks'] {
  return ARTICLE_BODY_BLOCKS.map(({ type }, index) => {
    const existing = blocks.filter((block) => block.type === type);
    return {
      id: existing[0]?.id ?? `block-${type.toLowerCase()}-${index + 1}`,
      type,
      content: existing.map((block) => block.content).join('\n\n'),
    };
  });
}
