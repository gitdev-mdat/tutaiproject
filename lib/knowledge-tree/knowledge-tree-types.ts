import type { ConceptRelationType, KnowledgeStatus, KgNode } from '@/lib/knowledge-graph/kg-types';

export type KnowledgeTreeNodeKind = 'GROUP' | 'KNOWLEDGE';
export type KnowledgeTreeIdentitySource = 'CANONICAL_GRAPH' | 'TREE_NATIVE' | 'TREE_IMPORT';

export type KnowledgeNodeType =
  | 'MON_HOC'
  | 'LOP'
  | 'TAP'
  | 'CHUONG'
  | 'CHU_DE'
  | 'KIEN_THUC'
  | 'NHOM_KIEN_THUC'
  | 'KHAC'
  | 'CHUA_PHAN_LOAI';

export interface KnowledgeTreeNode {
  id: string;
  title: string;
  description: string;
  parentId: string | null;
  order: number;
  status: KnowledgeStatus;
  kind: KnowledgeTreeNodeKind; // Kept for backward compatibility
  nodeType?: KnowledgeNodeType; // New free-form type
  hasLearningContent?: boolean; // New opt-in flag
  identitySource: KnowledgeTreeIdentitySource;
  sourceGraphNodeType?: KgNode['type'];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeTreeDocument {
  schemaVersion: 1;
  updatedAt: string;
  nodes: KnowledgeTreeNode[];
}

export interface KnowledgeArticleBlock {
  id: string;
  type:
    | 'TITLE'
    | 'INTRO'
    | 'OBJECTIVE'
    | 'MAIN_CONTENT'
    | 'EXAMPLE'
    | 'RECAP'
    | 'COMMON_MISTAKE'
    | 'REFERENCES';
  content: string;
}

export interface KnowledgeArticle {
  id: string;
  knowledgeNodeId: string;
  title: string;
  blocks: KnowledgeArticleBlock[];
  status: 'DRAFT' | 'READY' | 'PUBLISHED';
  publishToBlog: boolean;
  publishToLearning: boolean;
  createdAt: string;
  updatedAt: string;
}

export type KnowledgeSourceStatus = 'ATTACHED' | 'PENDING_ANALYSIS' | 'ANALYZED';

export interface KnowledgeSource {
  id: string;
  scopeNodeId: string;
  name: string;
  sourceType: 'PDF' | 'DOCX' | 'NOTE' | 'URL';
  status: KnowledgeSourceStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface KnowledgeTreeRelationSummary {
  id: string;
  type: ConceptRelationType;
  direction: 'INCOMING' | 'OUTGOING';
  relatedConceptId: string;
  relatedConceptTitle: string;
}

export interface KnowledgeTreeReadModel {
  tree: KnowledgeTreeDocument;
  relationsByNodeId: Record<string, KnowledgeTreeRelationSummary[]>;
}

export interface KnowledgeTreeDeleteContext {
  graphRelatedIds?: ReadonlySet<string>;
}

/**
 * Future import seam. Parsers must produce a draft and preview it before any
 * node is applied to the canonical tree.
 */
export interface KnowledgeTreeImportDraft {
  id: string;
  format: 'MARKDOWN' | 'JSON' | 'CURRICULUM_DOCUMENT';
  status: 'DRAFT' | 'REVIEWED';
  nodes: Array<{
    temporaryId: string;
    title: string;
    description?: string;
    parentTemporaryId: string | null;
    order: number;
    kind: KnowledgeTreeNodeKind;
    nodeType?: KnowledgeNodeType;
  }>;
  createdAt: string;
}
