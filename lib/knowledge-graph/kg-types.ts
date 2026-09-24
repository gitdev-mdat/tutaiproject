export type KnowledgeStatus = 'DRAFT' | 'PROPOSED' | 'PUBLISHED' | 'ARCHIVED';

export type BloomLevel = 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE' | 'EVALUATE' | 'CREATE';

export type ConceptRelationType = 'PREREQUISITE' | 'RELATED' | 'PART_OF' | 'EQUIVALENT';

export type EntityProvenance = {
  sourceType: 'MANUAL' | 'IMPORT' | 'FIXTURE';
  sourceId?: string;
  sourceKey?: string;
  textbookId?: string;
  lessonId?: string;
  mergedProposalId?: string;
  sourceSemanticRecordIds?: string[];
  sourcePageEvidence?: unknown[];
  sourceProposalId?: string;
};

export interface LearningObjective {
  id: string;
  conceptId: string;
  bloomLevel: BloomLevel;
  statement: string;
  order: number;
  status: KnowledgeStatus;
  _isFixture?: boolean;
  provenance?: EntityProvenance;
  createdAt: string;
  updatedAt: string;
}

export interface ConceptRelation {
  id: string;
  sourceConceptId: string;
  targetConceptId: string;
  type: ConceptRelationType;
  strength?: number;
  rationale?: string;
  status: KnowledgeStatus;
  _isFixture?: boolean;
  provenance?: EntityProvenance;
  createdAt: string;
  updatedAt: string;
}

export interface ConceptDomainMembership {
  id: string;
  conceptId: string;
  domainId: string;
  role: 'PRIMARY' | 'SECONDARY';
  _isFixture?: boolean;
  provenance?: EntityProvenance;
  createdAt: string;
}

export interface KgDocument {
  schemaVersion: number;
  updatedAt: string;
  subjects: KgSubject[];
  learningObjectives: LearningObjective[];
  conceptRelations: ConceptRelation[];
  domainMemberships: ConceptDomainMembership[];
}

export interface KgBaseNode {
  id: string;
  title: string;
  slug: string; // Internal metadata only
  order: number;
  status: KnowledgeStatus;
  _isFixture?: boolean;
  provenance?: EntityProvenance;
  createdAt: string;
  updatedAt: string;
}

export interface KgSubject extends KgBaseNode {
  type: 'SUBJECT';
  description?: string;
  grades: KgGrade[];
}

export interface KgGrade extends KgBaseNode {
  type: 'GRADE';
  subjectId: string;
  description?: string;
  domains: KgDomain[];
}

export interface KgDomain extends KgBaseNode {
  type: 'DOMAIN';
  subjectId: string;
  gradeId?: string;
  description?: string;
  concepts: KgConcept[];
}

export interface KgConcept extends KgBaseNode {
  type: 'CONCEPT';
  primaryDomainId: string;
  shortDescription?: string;
  detailedDescription?: string;
  aliases: string[];
}

export type KgNode = KgSubject | KgGrade | KgDomain | KgConcept;
