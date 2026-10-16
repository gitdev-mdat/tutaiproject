import { describe, expect, it } from 'vitest';
import type { KnowledgeTreeNode } from '@/lib/knowledge-tree/knowledge-tree-types';
import type { Question } from '@/lib/question-bank/qb-types';
import { coverageSummary, examCoverage } from './exam-coverage';

const node = (id: string, parentId: string | null, order = 1): KnowledgeTreeNode => ({
  id,
  title: `T-${id}`,
  description: '',
  parentId,
  order,
  status: 'PUBLISHED',
  kind: parentId && id.startsWith('l') ? 'KNOWLEDGE' : 'GROUP',
  identitySource: 'TREE_NATIVE',
  createdAt: '',
  updatedAt: '',
});
const nodes = [
  node('s', null),
  node('g', 's'),
  node('c1', 'g', 1),
  node('c2', 'g', 2),
  node('l1', 'c1'),
  node('l2', 'c1'),
  node('l3', 'c2'),
];
const q = (id: string, nodeId?: string) =>
  ({ id, primaryKnowledgeNodeId: nodeId }) as unknown as Question;

describe('examCoverage', () => {
  it('groups an exam spanning several chapters by chapter on the live tree', () => {
    const coverage = examCoverage([q('a', 'l3'), q('b', 'l1'), q('c', 'l2'), q('d', 'l1')], nodes);
    expect(coverage).toEqual({
      chapters: [
        { id: 'c1', title: 'T-c1', lessonCount: 2, questionCount: 3 },
        { id: 'c2', title: 'T-c2', lessonCount: 1, questionCount: 1 },
      ],
      lessonCount: 3,
      unmappedCount: 0,
    });
    expect(coverageSummary(coverage)).toBe('2 chương · 3 bài');
  });

  it('counts questions whose node is missing instead of guessing a chapter', () => {
    const coverage = examCoverage([q('a', 'l1'), q('b', 'deleted'), q('c')], nodes);
    expect(coverage.unmappedCount).toBe(2);
    expect(coverageSummary(coverage)).toBe('1 chương · 1 bài · 2 câu chưa gắn bài');
    expect(coverageSummary(examCoverage([], nodes))).toBe('Chưa có câu');
  });
});
