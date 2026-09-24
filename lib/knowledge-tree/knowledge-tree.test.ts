import { describe, expect, it } from 'vitest';
import type { KgDocument } from '@/lib/knowledge-graph/kg-types';
import {
  buildKnowledgeTreeFromGraph,
  createKnowledgeTreeNode,
  deleteKnowledgeTreeNode,
  knowledgeBreadcrumb,
  moveKnowledgeTreeNode,
  searchKnowledgeTree,
  updateKnowledgeTreeNode,
} from './knowledge-tree';
import { selectKnowledgeNode, toggleKnowledgeNodeExpanded } from './knowledge-tree-ui-state';
import type { KnowledgeTreeDocument } from './knowledge-tree-types';
import type { KnowledgeTreeUiState } from './knowledge-tree-ui-state';

const NOW = '2026-08-14T00:00:00.000Z';

function emptyTree(): KnowledgeTreeDocument {
  return { schemaVersion: 1, updatedAt: NOW, nodes: [] };
}

function add(
  tree: KnowledgeTreeDocument,
  id: string,
  title: string,
  parentId: string | null = null
) {
  return createKnowledgeTreeNode(
    tree,
    { title, parentId, kind: parentId ? 'KNOWLEDGE' : 'GROUP' },
    { id, now: NOW }
  ).tree;
}

describe('Knowledge Tree canonical foundation', () => {
  it('creates roots and children with caller-provided stable IDs', () => {
    let tree = add(emptyTree(), 'knowledge-root', 'Toán 12');
    tree = add(tree, 'knowledge-child', 'Ứng dụng đạo hàm', 'knowledge-root');
    expect(tree.nodes.map((node) => node.id)).toEqual(['knowledge-root', 'knowledge-child']);
    expect(tree.nodes[1]).toMatchObject({ parentId: 'knowledge-root', order: 1, status: 'DRAFT' });
  });

  it('renames and edits descriptions without changing identity', () => {
    const tree = add(emptyTree(), 'knowledge-1', 'Tên cũ');
    const result = updateKnowledgeTreeNode(
      tree,
      'knowledge-1',
      { title: '  Tên mới  ', description: 'Mô tả chuẩn' },
      '2026-08-14T01:00:00.000Z'
    );
    expect(result.node).toMatchObject({
      id: 'knowledge-1',
      title: 'Tên mới',
      description: 'Mô tả chuẩn',
    });
  });

  it('moves and reorders siblings without creating prerequisite semantics', () => {
    let tree = add(emptyTree(), 'root-a', 'Nhóm A');
    tree = add(tree, 'root-b', 'Nhóm B');
    tree = add(tree, 'child-1', 'Một', 'root-a');
    tree = add(tree, 'child-2', 'Hai', 'root-b');
    const result = moveKnowledgeTreeNode(tree, 'child-1', 'root-b', 1, NOW);
    expect(result.node.parentId).toBe('root-b');
    expect(
      result.tree.nodes
        .filter((node) => node.parentId === 'root-b')
        .sort((a, b) => a.order - b.order)
        .map((node) => node.id)
    ).toEqual(['child-1', 'child-2']);
    expect(result.tree).not.toHaveProperty('conceptRelations');
  });

  it('blocks cycles and unsafe deletion, but deletes an unused draft leaf', () => {
    let tree = add(emptyTree(), 'root', 'Gốc');
    tree = add(tree, 'child', 'Con', 'root');
    expect(() => moveKnowledgeTreeNode(tree, 'root', 'child', 1, NOW)).toThrow(/chính nó/);
    expect(() => deleteKnowledgeTreeNode(tree, 'root', {}, NOW)).toThrow(/kiến thức con/);
    expect(deleteKnowledgeTreeNode(tree, 'child', {}, NOW).nodes.map((node) => node.id)).toEqual([
      'root',
    ]);
  });

  it('supports breadcrumb, search, selection, and expand/collapse deterministically', () => {
    let tree = add(emptyTree(), 'math', 'Toán 12');
    tree = add(tree, 'calculus', 'Giải tích', 'math');
    tree = add(tree, 'mono', 'Tính đơn điệu', 'calculus');
    expect(knowledgeBreadcrumb(tree.nodes, 'mono').map((node) => node.title)).toEqual([
      'Toán 12',
      'Giải tích',
      'Tính đơn điệu',
    ]);
    expect(Array.from(searchKnowledgeTree(tree.nodes, 'đơn điệu'))).toEqual([
      'math',
      'calculus',
      'mono',
    ]);
    let state: KnowledgeTreeUiState = { selectedNodeId: null, expandedNodeIds: new Set<string>() };
    state = selectKnowledgeNode(state, 'mono');
    state = toggleKnowledgeNodeExpanded(state, 'math');
    expect(state.selectedNodeId).toBe('mono');
    expect(state.expandedNodeIds.has('math')).toBe(true);
    state = toggleKnowledgeNodeExpanded(state, 'math');
    expect(state.expandedNodeIds.has('math')).toBe(false);
  });

  it('reuses graph IDs while leaving prerequisite edges outside tree placement', () => {
    const graph: KgDocument = {
      schemaVersion: 3,
      updatedAt: NOW,
      subjects: [
        {
          id: 'subj_math',
          title: 'Toán',
          slug: 'toan',
          order: 1,
          status: 'PUBLISHED',
          type: 'SUBJECT',
          grades: [
            {
              id: 'grade_12',
              title: 'Lớp 12',
              slug: 'lop-12',
              order: 1,
              status: 'PUBLISHED',
              type: 'GRADE',
              subjectId: 'subj_math',
              domains: [
                {
                  id: 'domain_calculus',
                  title: 'Giải tích',
                  slug: 'giai-tich',
                  order: 1,
                  status: 'PUBLISHED',
                  type: 'DOMAIN',
                  subjectId: 'subj_math',
                  gradeId: 'grade_12',
                  concepts: [
                    {
                      id: 'concept_derivative',
                      title: 'Đạo hàm',
                      slug: 'dao-ham',
                      order: 1,
                      status: 'PUBLISHED',
                      type: 'CONCEPT',
                      primaryDomainId: 'domain_calculus',
                      aliases: [],
                      createdAt: NOW,
                      updatedAt: NOW,
                    },
                  ],
                  createdAt: NOW,
                  updatedAt: NOW,
                },
              ],
              createdAt: NOW,
              updatedAt: NOW,
            },
          ],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      learningObjectives: [],
      domainMemberships: [],
      conceptRelations: [
        {
          id: 'rel-1',
          sourceConceptId: 'concept_derivative',
          targetConceptId: 'other-concept',
          type: 'PREREQUISITE',
          status: 'PUBLISHED',
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    };
    const tree = buildKnowledgeTreeFromGraph(graph);
    expect(tree.nodes.map((node) => node.id)).toContain('concept_derivative');
    expect(tree.nodes.find((node) => node.id === 'concept_derivative')).toMatchObject({
      parentId: 'domain_calculus',
      identitySource: 'CANONICAL_GRAPH',
    });
    expect(tree).not.toHaveProperty('conceptRelations');
  });

  it('does not accept textbook chapters as an input to the compatibility adapter', () => {
    expect(buildKnowledgeTreeFromGraph).toHaveLength(1);
  });
});
