import 'server-only';

import { randomUUID } from 'crypto';
import { readKnowledgeGraph } from '@/lib/knowledge-graph/kg-storage';
import { walkKgNodes } from '@/lib/knowledge-graph/kg-utils';
import {
  createKnowledgeTreeNode,
  deleteKnowledgeTreeNode,
  moveKnowledgeTreeNode,
  updateKnowledgeTreeNode,
} from './knowledge-tree';
import { readKnowledgeTree, writeKnowledgeTree } from './knowledge-tree-storage';
import type { KnowledgeTreeNodeKind, KnowledgeTreeReadModel } from './knowledge-tree-types';

function now() {
  return new Date().toISOString();
}

export async function getKnowledgeTreeReadModel(): Promise<KnowledgeTreeReadModel> {
  const [tree, graph] = await Promise.all([readKnowledgeTree(), readKnowledgeGraph()]);
  const titleById = new Map(Array.from(walkKgNodes(graph), ({ node }) => [node.id, node.title]));
  const relationsByNodeId: KnowledgeTreeReadModel['relationsByNodeId'] = {};
  for (const relation of graph.conceptRelations) {
    (relationsByNodeId[relation.sourceConceptId] ||= []).push({
      id: relation.id,
      type: relation.type,
      direction: 'OUTGOING',
      relatedConceptId: relation.targetConceptId,
      relatedConceptTitle: titleById.get(relation.targetConceptId) || relation.targetConceptId,
    });
    (relationsByNodeId[relation.targetConceptId] ||= []).push({
      id: relation.id,
      type: relation.type,
      direction: 'INCOMING',
      relatedConceptId: relation.sourceConceptId,
      relatedConceptTitle: titleById.get(relation.sourceConceptId) || relation.sourceConceptId,
    });
  }
  return { tree, relationsByNodeId };
}

export async function createKnowledge(input: {
  title: string;
  description?: string;
  parentId: string | null;
  kind: KnowledgeTreeNodeKind;
}) {
  const tree = await readKnowledgeTree();
  const result = createKnowledgeTreeNode(tree, input, {
    id: `knowledge-${randomUUID()}`,
    now: now(),
  });
  await writeKnowledgeTree(result.tree);
  return result.node;
}

export async function updateKnowledge(
  nodeId: string,
  updates: { title?: string; description?: string; kind?: KnowledgeTreeNodeKind }
) {
  const result = updateKnowledgeTreeNode(await readKnowledgeTree(), nodeId, updates, now());
  await writeKnowledgeTree(result.tree);
  return result.node;
}

export async function moveKnowledge(
  nodeId: string,
  input: { parentId: string | null; order: number }
) {
  const result = moveKnowledgeTreeNode(
    await readKnowledgeTree(),
    nodeId,
    input.parentId,
    input.order,
    now()
  );
  await writeKnowledgeTree(result.tree);
  return result.node;
}

export async function deleteKnowledge(nodeId: string) {
  const [tree, graph] = await Promise.all([readKnowledgeTree(), readKnowledgeGraph()]);
  const graphRelatedIds = new Set<string>();
  for (const relation of graph.conceptRelations) {
    graphRelatedIds.add(relation.sourceConceptId);
    graphRelatedIds.add(relation.targetConceptId);
  }
  const next = deleteKnowledgeTreeNode(
    tree,
    nodeId,
    {
      graphRelatedIds,
    },
    now()
  );
  await writeKnowledgeTree(next);
}
