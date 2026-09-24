export interface KnowledgeTreeUiState {
  selectedNodeId: string | null;
  expandedNodeIds: Set<string>;
}

export function selectKnowledgeNode(
  state: KnowledgeTreeUiState,
  nodeId: string
): KnowledgeTreeUiState {
  return { ...state, selectedNodeId: nodeId };
}

export function toggleKnowledgeNodeExpanded(
  state: KnowledgeTreeUiState,
  nodeId: string
): KnowledgeTreeUiState {
  const expandedNodeIds = new Set(state.expandedNodeIds);
  if (expandedNodeIds.has(nodeId)) expandedNodeIds.delete(nodeId);
  else expandedNodeIds.add(nodeId);
  return { ...state, expandedNodeIds };
}
