import { describe, expect, it } from 'vitest';
import { createKnowledgeTreeNode } from './knowledge-tree';
import { applyImportDraft } from './knowledge-tree-import';
import { normalizeArticleBlocks } from './knowledge-article';
import {
  buildLearningCatalog,
  findLessonInCatalog,
  getLessonPublicationState,
} from './learning-visibility';
import type { KnowledgeTreeDocument, KnowledgeTreeNode } from './knowledge-tree-types';

const NOW = '2026-10-10T00:00:00.000Z';

function tree(): KnowledgeTreeDocument {
  let doc: KnowledgeTreeDocument = { schemaVersion: 1, updatedAt: NOW, nodes: [] };
  const add = (id: string, title: string, parentId: string | null, kind: 'GROUP' | 'KNOWLEDGE') => {
    doc = createKnowledgeTreeNode(doc, { title, parentId, kind }, { id, now: NOW }).tree;
  };
  add('math', 'Toán', null, 'GROUP');
  add('g12', 'Lớp 12', 'math', 'GROUP');
  add('ch1', 'Đạo hàm', 'g12', 'GROUP');
  add('l1', 'Đơn điệu', 'ch1', 'KNOWLEDGE');
  add('l2', 'Cực trị', 'ch1', 'KNOWLEDGE');
  add('ch2', 'Tích phân', 'g12', 'GROUP');
  add('l3', 'Nguyên hàm', 'ch2', 'KNOWLEDGE');
  return doc;
}

const published = { status: 'PUBLISHED' as const, publishToLearning: true };
const draft = { status: 'DRAFT' as const, publishToLearning: false };

function archive(doc: KnowledgeTreeDocument, id: string): KnowledgeTreeDocument {
  return {
    ...doc,
    nodes: doc.nodes.map((node): KnowledgeTreeNode =>
      node.id === id ? { ...node, status: 'ARCHIVED' } : node
    ),
  };
}

describe('learning visibility rule', () => {
  it('shows only published learning articles and drops empty chapters', () => {
    const catalog = buildLearningCatalog(tree(), { l1: published, l2: draft });
    expect(catalog).toHaveLength(1);
    expect(catalog[0].grades[0].chapters.map((chapter) => chapter.id)).toEqual(['ch1']);
    expect(catalog[0].grades[0].chapters[0].lessons.map((lesson) => lesson.id)).toEqual(['l1']);
  });

  it('requires both PUBLISHED status and the learning flag', () => {
    const catalog = buildLearningCatalog(tree(), {
      l1: { status: 'PUBLISHED', publishToLearning: false },
      l2: { status: 'READY', publishToLearning: true },
    });
    expect(catalog).toEqual([]);
  });

  it('hides everything under an archived ancestor', () => {
    const doc = archive(tree(), 'ch1');
    const catalog = buildLearningCatalog(doc, { l1: published, l3: published });
    expect(findLessonInCatalog(catalog, 'l1')).toBeNull();
    expect(findLessonInCatalog(catalog, 'l3')?.lesson.chapterTitle).toBe('Tích phân');
    expect(getLessonPublicationState(doc.nodes, 'l1', published)).toBe('ARCHIVED');
  });

  it('maps admin badges from existing article fields', () => {
    const nodes = tree().nodes;
    expect(getLessonPublicationState(nodes, 'l1', null)).toBe('NO_ARTICLE');
    expect(getLessonPublicationState(nodes, 'l1', draft)).toBe('DRAFT');
    expect(
      getLessonPublicationState(nodes, 'l1', { status: 'READY', publishToLearning: false })
    ).toBe('READY');
    expect(getLessonPublicationState(nodes, 'l1', published)).toBe('PUBLISHED');
  });

  it('orders lessons across chapters for previous / next navigation', () => {
    const catalog = buildLearningCatalog(tree(), { l1: published, l2: published, l3: published });
    const found = findLessonInCatalog(catalog, 'l2');
    expect(found?.index).toBe(1);
    expect(found?.lessons.map((lesson) => lesson.id)).toEqual(['l1', 'l2', 'l3']);
  });
});

describe('article blocks and server import', () => {
  it('normalizes blocks to one per body type without losing content', () => {
    const blocks = normalizeArticleBlocks([
      { id: 'a', type: 'MAIN_CONTENT', content: 'Một' },
      { id: 'b', type: 'MAIN_CONTENT', content: 'Hai' },
      { id: 't', type: 'TITLE', content: 'Tiêu đề' },
    ]);
    expect(blocks.map((block) => block.type)).toEqual([
      'INTRO',
      'OBJECTIVE',
      'MAIN_CONTENT',
      'EXAMPLE',
      'RECAP',
      'COMMON_MISTAKE',
      'GRAPH',
      'REFERENCES',
    ]);
    expect(blocks.find((block) => block.type === 'MAIN_CONTENT')).toMatchObject({
      id: 'a',
      content: 'Một\n\nHai',
    });
  });

  it('applies a reviewed import draft atomically under the destination', () => {
    let counter = 0;
    const next = applyImportDraft(
      tree(),
      {
        id: 'd',
        format: 'MARKDOWN',
        status: 'REVIEWED',
        createdAt: NOW,
        nodes: [
          { temporaryId: 't1', title: 'Số phức', parentTemporaryId: null, order: 1, kind: 'GROUP' },
          {
            temporaryId: 't2',
            title: 'Dạng đại số',
            parentTemporaryId: 't1',
            order: 1,
            kind: 'KNOWLEDGE',
          },
        ],
      },
      'g12',
      { createId: () => `new-${++counter}`, now: NOW }
    );
    expect(next.nodes.find((node) => node.id === 'new-2')).toMatchObject({
      parentId: 'new-1',
      identitySource: 'TREE_IMPORT',
      hasLearningContent: true,
    });
    expect(() =>
      applyImportDraft(
        next,
        {
          id: 'd2',
          format: 'MARKDOWN',
          status: 'REVIEWED',
          createdAt: NOW,
          nodes: [
            {
              temporaryId: 'x',
              title: 'Số phức',
              parentTemporaryId: null,
              order: 1,
              kind: 'GROUP',
            },
          ],
        },
        'g12',
        { createId: () => 'dup', now: NOW }
      )
    ).toThrow('đã tồn tại');
  });
});
