import type { ConceptRelationType, KgConcept, KgDocument, KgDomain } from './kg-types';

export interface GraphOrientationSourceMapping {
  sourceId: string;
  sourceItemId: string;
  conceptId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export type GraphOrientationPlacement = 'MAPPED' | 'UNMAPPED_WITH_NEARBY_CONTEXT' | 'UNMAPPED';

export interface OrientationConceptNode {
  id: string;
  title: string;
  status: KgConcept['status'];
  domainId: string;
  mappedToSelectedSourceItem: boolean;
  mappedToSameSource: boolean;
  learningObjectiveCount: number;
}

export interface OrientationRelationship {
  id: string;
  type: ConceptRelationType;
  sourceConceptId: string;
  targetConceptId: string;
  label: string;
}

export interface GraphOrientationModel {
  canonicalNodeTypes: Array<'SUBJECT' | 'GRADE' | 'DOMAIN' | 'CONCEPT'>;
  supportedRelationshipTypes: ConceptRelationType[];
  persistedRelationshipTypes: ConceptRelationType[];
  subject: { id: string; title: string } | null;
  grade: { id: string; title: string } | null;
  domain: { id: string; title: string } | null;
  placement: GraphOrientationPlacement;
  placementTitle: string;
  placementExplanation: string;
  canonicalConcepts: OrientationConceptNode[];
  relationships: OrientationRelationship[];
  selectedSourceConceptIds: string[];
  contextSourceItemIds: string[];
  graphShape: 'MIXED';
}

const SUPPORTED_RELATIONSHIPS: ConceptRelationType[] = [
  'PREREQUISITE',
  'RELATED',
  'PART_OF',
  'EQUIVALENT',
];

export function relationshipLabel(type: ConceptRelationType): string {
  if (type === 'PREREQUISITE') return 'Cần học trước';
  if (type === 'RELATED') return 'Liên quan';
  if (type === 'PART_OF') return 'Là một phần của';
  return 'Tương đương';
}

function graphConcepts(graph: KgDocument): KgConcept[] {
  return graph.subjects.flatMap((subject) =>
    subject.grades.flatMap((grade) => grade.domains.flatMap((domain) => domain.concepts))
  );
}

function graphDomains(graph: KgDocument): KgDomain[] {
  return graph.subjects.flatMap((subject) => subject.grades.flatMap((grade) => grade.domains));
}

export function buildGraphOrientationModel(input: {
  graph: KgDocument;
  mappings?: GraphOrientationSourceMapping[];
  sourceId?: string;
  sourceItemId?: string;
  subjectId?: string;
  gradeId?: string;
}): GraphOrientationModel {
  const mappings = input.mappings ?? [];
  const concepts = graphConcepts(input.graph);
  const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));
  const selectedMappings = mappings.filter(
    (mapping) =>
      (!input.sourceId || mapping.sourceId === input.sourceId) &&
      (!input.sourceItemId || mapping.sourceItemId === input.sourceItemId) &&
      mapping.status === 'APPROVED'
  );
  const sameSourceMappings = mappings.filter(
    (mapping) =>
      (!input.sourceId || mapping.sourceId === input.sourceId) && mapping.status === 'APPROVED'
  );
  const contextMappings = selectedMappings.length > 0 ? selectedMappings : sameSourceMappings;
  const selectedIds = new Set(selectedMappings.map((mapping) => mapping.conceptId));
  const sameSourceIds = new Set(sameSourceMappings.map((mapping) => mapping.conceptId));
  const seedIds = new Set(contextMappings.map((mapping) => mapping.conceptId));

  if (!input.sourceId && !input.sourceItemId && seedIds.size === 0) {
    const firstActiveDomain = graphDomains(input.graph).find((domain) =>
      domain.concepts.some((concept) => concept.status !== 'ARCHIVED')
    );
    firstActiveDomain?.concepts
      .filter((concept) => concept.status !== 'ARCHIVED')
      .forEach((concept) => seedIds.add(concept.id));
  }

  const domainFrequency = new Map<string, number>();
  for (const id of seedIds) {
    const concept = conceptById.get(id);
    if (!concept || concept.status === 'ARCHIVED') continue;
    domainFrequency.set(
      concept.primaryDomainId,
      (domainFrequency.get(concept.primaryDomainId) ?? 0) + 1
    );
  }
  const primaryDomainId = [...domainFrequency.entries()].sort(
    ([leftId, leftCount], [rightId, rightCount]) =>
      rightCount - leftCount || leftId.localeCompare(rightId)
  )[0]?.[0];

  const visibleIds = new Set<string>(seedIds);
  for (const relation of input.graph.conceptRelations) {
    if (relation.status === 'ARCHIVED') continue;
    if (seedIds.has(relation.sourceConceptId)) visibleIds.add(relation.targetConceptId);
    if (seedIds.has(relation.targetConceptId)) visibleIds.add(relation.sourceConceptId);
  }
  if (primaryDomainId) {
    concepts
      .filter(
        (concept) => concept.primaryDomainId === primaryDomainId && concept.status !== 'ARCHIVED'
      )
      .slice(0, 6)
      .forEach((concept) => visibleIds.add(concept.id));
  }

  const canonicalConcepts = concepts
    .filter((concept) => visibleIds.has(concept.id) && concept.status !== 'ARCHIVED')
    .sort((left, right) => {
      const selectedPriority = Number(selectedIds.has(right.id)) - Number(selectedIds.has(left.id));
      if (selectedPriority) return selectedPriority;
      const sourcePriority =
        Number(sameSourceIds.has(right.id)) - Number(sameSourceIds.has(left.id));
      return sourcePriority || left.order - right.order || left.id.localeCompare(right.id);
    })
    .slice(0, 8)
    .map((concept) => ({
      id: concept.id,
      title: concept.title,
      status: concept.status,
      domainId: concept.primaryDomainId,
      mappedToSelectedSourceItem: selectedIds.has(concept.id),
      mappedToSameSource: sameSourceIds.has(concept.id),
      learningObjectiveCount: input.graph.learningObjectives.filter(
        (objective) => objective.conceptId === concept.id && objective.status !== 'ARCHIVED'
      ).length,
    }));
  const visibleCanonicalIds = new Set(canonicalConcepts.map((concept) => concept.id));
  const relationships = input.graph.conceptRelations
    .filter(
      (relation) =>
        relation.status !== 'ARCHIVED' &&
        visibleCanonicalIds.has(relation.sourceConceptId) &&
        visibleCanonicalIds.has(relation.targetConceptId)
    )
    .map((relation) => ({
      id: relation.id,
      type: relation.type,
      sourceConceptId: relation.sourceConceptId,
      targetConceptId: relation.targetConceptId,
      label: relationshipLabel(relation.type),
    }));
  const persistedRelationshipTypes = [
    ...new Set(
      input.graph.conceptRelations
        .filter((relation) => relation.status !== 'ARCHIVED')
        .map((relation) => relation.type)
    ),
  ].sort();

  const subject =
    input.graph.subjects.find((item) => item.id === input.subjectId) ??
    input.graph.subjects[0] ??
    null;
  const grade =
    subject?.grades.find((item) => item.id === input.gradeId) ?? subject?.grades[0] ?? null;
  const domain = graphDomains(input.graph).find((item) => item.id === primaryDomainId) ?? null;
  const placement: GraphOrientationPlacement = selectedMappings.length
    ? 'MAPPED'
    : canonicalConcepts.length
      ? 'UNMAPPED_WITH_NEARBY_CONTEXT'
      : 'UNMAPPED';

  return {
    canonicalNodeTypes: ['SUBJECT', 'GRADE', 'DOMAIN', 'CONCEPT'],
    supportedRelationshipTypes: SUPPORTED_RELATIONSHIPS,
    persistedRelationshipTypes,
    subject: subject ? { id: subject.id, title: subject.title } : null,
    grade: grade ? { id: grade.id, title: grade.title } : null,
    domain: domain ? { id: domain.id, title: domain.title } : null,
    placement,
    placementTitle:
      placement === 'MAPPED'
        ? 'Nguồn đã có vị trí trong Knowledge Graph'
        : 'Nguồn chưa có Concept canonical',
    placementExplanation:
      placement === 'MAPPED'
        ? 'Vùng này được xác định từ các mapping nguồn đã được duyệt.'
        : placement === 'UNMAPPED_WITH_NEARBY_CONTEXT'
          ? 'Vùng nền dùng các mapping đã duyệt gần nhất của cùng nguồn. Bản nháp chưa được gán vào một miền canonical.'
          : 'Chưa có mapping đã duyệt để xác định một vùng canonical cho nguồn này.',
    canonicalConcepts,
    relationships,
    selectedSourceConceptIds: [...selectedIds],
    contextSourceItemIds: [...new Set(contextMappings.map((mapping) => mapping.sourceItemId))],
    graphShape: 'MIXED',
  };
}
