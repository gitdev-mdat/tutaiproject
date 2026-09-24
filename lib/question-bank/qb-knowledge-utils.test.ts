import { describe, expect, it } from 'vitest';
import type {
  KnowledgeTreeDocument,
  KnowledgeTreeNode,
} from '@/lib/knowledge-tree/knowledge-tree-types';
import { deriveHierarchyContext, isAttachableKnowledgeNode } from './qb-knowledge-utils';

function node(
  id: string,
  title: string,
  parentId: string | null,
  overrides: Partial<KnowledgeTreeNode> = {}
): KnowledgeTreeNode {
  return {
    id,
    title,
    description: '',
    parentId,
    order: 0,
    status: 'PUBLISHED',
    kind: 'GROUP',
    identitySource: 'TREE_NATIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function tree(nodes: KnowledgeTreeNode[]): KnowledgeTreeDocument {
  return { schemaVersion: 1, updatedAt: '2026-01-01T00:00:00.000Z', nodes };
}

describe('deriveHierarchyContext', () => {
  it('resolves canonical graph node types through intermediate ancestors', () => {
    const document = tree([
      node('subject-math', 'Toán học', null, { sourceGraphNodeType: 'SUBJECT' }),
      node('grade-12', 'Lớp 12', 'subject-math', { sourceGraphNodeType: 'GRADE' }),
      node('domain-calculus', 'Giải tích', 'grade-12', { sourceGraphNodeType: 'DOMAIN' }),
      node('concept-integral', 'Tích phân', 'domain-calculus', {
        kind: 'KNOWLEDGE',
        sourceGraphNodeType: 'CONCEPT',
      }),
    ]);

    expect(deriveHierarchyContext('concept-integral', document)).toEqual({
      subjectId: 'MATH',
      grade: 12,
      chapterId: 'domain-calculus',
      topicId: 'concept-integral',
    });
  });

  it('resolves legacy node types including lesson and topic', () => {
    const document = tree([
      node('physics', 'Vật lý', null, { nodeType: 'MON_HOC' }),
      node('class-11', 'Lớp 11', 'physics', { nodeType: 'LOP' }),
      node('chapter', 'Chương 1', 'class-11', { nodeType: 'CHUONG' }),
      node('lesson', 'Chủ đề', 'chapter', { nodeType: 'CHU_DE' }),
      node('knowledge', 'Khái niệm', 'lesson', {
        nodeType: 'KIEN_THUC',
        kind: 'KNOWLEDGE',
      }),
    ]);

    expect(deriveHierarchyContext('knowledge', document)).toEqual({
      subjectId: 'PHYSICS',
      grade: 11,
      chapterId: 'chapter',
      lessonId: 'lesson',
      topicId: 'knowledge',
    });
  });

  it('does not invent subject or grade when ancestry is incomplete', () => {
    const document = tree([
      node('domain', 'Miền kiến thức', null, { sourceGraphNodeType: 'DOMAIN' }),
      node('concept', 'Khái niệm', 'domain', {
        kind: 'KNOWLEDGE',
        sourceGraphNodeType: 'CONCEPT',
      }),
    ]);

    expect(deriveHierarchyContext('concept', document)).toEqual({
      chapterId: 'domain',
      topicId: 'concept',
    });
  });
});

describe('isAttachableKnowledgeNode', () => {
  it('only accepts non-archived knowledge nodes', () => {
    expect(isAttachableKnowledgeNode(node('active', 'Active', null, { kind: 'KNOWLEDGE' }))).toBe(
      true
    );
    expect(isAttachableKnowledgeNode(node('group', 'Group', null))).toBe(false);
    expect(
      isAttachableKnowledgeNode(
        node('archived', 'Archived', null, { kind: 'KNOWLEDGE', status: 'ARCHIVED' })
      )
    ).toBe(false);
  });
});
