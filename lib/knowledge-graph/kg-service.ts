import { readKnowledgeGraph, writeKnowledgeGraph } from './kg-storage';
import {
  KgBaseNode,
  KgNode,
  KgSubject,
  KgGrade,
  KgDomain,
  KgConcept,
  LearningObjective,
  ConceptRelation,
  ConceptDomainMembership,
} from './kg-types';

import { walkKgNodes } from './kg-utils';

export async function findKgNode(nodeId: string): Promise<KgNode | undefined> {
  const doc = await readKnowledgeGraph();
  for (const { node } of walkKgNodes(doc)) {
    if (node.id === nodeId) {
      return node;
    }
  }
  return undefined;
}

export async function kgNodeExists(nodeId: string): Promise<boolean> {
  const node = await findKgNode(nodeId);
  return !!node;
}

export interface KgBreadcrumb {
  subject: KgSubject;
  grade: KgGrade;
  domain: KgDomain;
  concept: KgConcept;
}

export async function getAllConceptsWithBreadcrumb(): Promise<KgBreadcrumb[]> {
  const doc = await readKnowledgeGraph();
  const list: KgBreadcrumb[] = [];

  for (const subject of doc.subjects) {
    for (const grade of subject.grades) {
      for (const domain of grade.domains) {
        for (const concept of domain.concepts) {
          list.push({ subject, grade, domain, concept });
        }
      }
    }
  }
  return list;
}

export async function getKgNodeBreadcrumb(nodeId: string): Promise<KgBreadcrumb | undefined> {
  const all = await getAllConceptsWithBreadcrumb();
  return all.find((b) => b.concept.id === nodeId);
}

function genId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function createSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizeString(str: string): string {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ─── VALIDATION ─────────────────────────────────────────────────────────────

export async function validateConceptTitleAndAlias(
  subjectId: string,
  conceptId: string | null,
  title: string,
  aliases: string[]
): Promise<void> {
  const doc = await readKnowledgeGraph();
  const normTitle = normalizeString(title);
  if (!normTitle) throw new Error('Title cannot be empty');

  const normAliases = aliases.map(normalizeString).filter(Boolean);
  if (new Set(normAliases).size !== normAliases.length) {
    throw new Error('Aliases must be unique');
  }

  if (normAliases.includes(normTitle)) {
    throw new Error('Alias cannot duplicate the title');
  }

  // Find the subject to check for uniqueness within it
  const subject = doc.subjects.find((s) => s.id === subjectId);
  if (!subject) throw new Error('Subject not found');

  for (const grade of subject.grades) {
    for (const domain of grade.domains) {
      for (const concept of domain.concepts) {
        if (concept.id === conceptId) continue;

        const existingNormTitle = normalizeString(concept.title);
        const existingNormAliases = (concept.aliases || []).map(normalizeString);

        if (existingNormTitle === normTitle || existingNormAliases.includes(normTitle)) {
          throw new Error(`Duplicate concept title '${title}' in this Subject.`);
        }
        for (const alias of normAliases) {
          if (existingNormTitle === alias || existingNormAliases.includes(alias)) {
            throw new Error(`Duplicate alias '${alias}' in this Subject.`);
          }
        }
      }
    }
  }
}

export function detectCycle(relations: ConceptRelation[], newRelation: ConceptRelation): boolean {
  if (newRelation.type !== 'PREREQUISITE') return false;
  if (newRelation.sourceConceptId === newRelation.targetConceptId) return true;

  // Build adjacency list for prerequisites
  const adj = new Map<string, string[]>();
  for (const r of relations) {
    if (r.type === 'PREREQUISITE') {
      if (!adj.has(r.sourceConceptId)) adj.set(r.sourceConceptId, []);
      adj.get(r.sourceConceptId)!.push(r.targetConceptId);
    }
  }

  // Add the new edge
  if (!adj.has(newRelation.sourceConceptId)) adj.set(newRelation.sourceConceptId, []);
  adj.get(newRelation.sourceConceptId)!.push(newRelation.targetConceptId);

  // DFS cycle detection
  const visited = new Set<string>();
  const stack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    if (stack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    stack.add(nodeId);

    const neighbors = adj.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (hasCycle(neighbor)) return true;
    }

    stack.delete(nodeId);
    return false;
  }

  return hasCycle(newRelation.targetConceptId) || hasCycle(newRelation.sourceConceptId);
}

// ─── CRUD OPERATIONS ────────────────────────────────────────────────────────

export async function addKgNode(
  parentId: string | null,
  type: string,
  title: string
): Promise<KgNode> {
  const doc = await readKnowledgeGraph();

  const baseNode = {
    id: `node-${genId()}`,
    title,
    slug: createSlug(title),
    order: 0,
    status: 'DRAFT' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (type === 'SUBJECT') {
    const newNode: KgSubject = {
      ...baseNode,
      type: 'SUBJECT',
      grades: [],
      order: doc.subjects.length + 1,
    };
    doc.subjects.push(newNode);
    await writeKnowledgeGraph(doc);
    return newNode;
  }

  if (!parentId) throw new Error('parentId is required for non-subject nodes');
  const parent = await findKgNode(parentId);
  if (!parent) throw new Error('Parent not found');

  if (parent.type === 'SUBJECT' && type === 'GRADE') {
    const newNode: KgGrade = {
      ...baseNode,
      type: 'GRADE',
      subjectId: parent.id,
      domains: [],
      order: parent.grades.length + 1,
    };
    parent.grades.push(newNode);
    await writeKnowledgeGraph(doc);
    return newNode;
  } else if (parent.type === 'GRADE' && type === 'DOMAIN') {
    const newNode: KgDomain = {
      ...baseNode,
      type: 'DOMAIN',
      subjectId: parent.subjectId,
      gradeId: parent.id,
      concepts: [],
      order: parent.domains.length + 1,
    };
    parent.domains.push(newNode);
    await writeKnowledgeGraph(doc);
    return newNode;
  } else if (parent.type === 'DOMAIN' && type === 'CONCEPT') {
    await validateConceptTitleAndAlias(parent.subjectId, null, title, []);
    const newNode: KgConcept = {
      ...baseNode,
      type: 'CONCEPT',
      primaryDomainId: parent.id,
      shortDescription: '',
      detailedDescription: '',
      aliases: [],
      order: parent.concepts.length + 1,
    };
    parent.concepts.push(newNode);

    doc.domainMemberships.push({
      id: `mem-${newNode.id}-${parent.id}`,
      conceptId: newNode.id,
      domainId: parent.id,
      role: 'PRIMARY',
      createdAt: new Date().toISOString(),
    });
    await writeKnowledgeGraph(doc);
    return newNode;
  }

  throw new Error(`Invalid hierarchy: Cannot add ${type} under ${parent.type}`);
}

export async function updateKgNode(nodeId: string, updates: Partial<KgNode>): Promise<KgNode> {
  const doc = await readKnowledgeGraph();
  let found: KgNode | undefined;
  let subjectId = '';

  for (const { node, parent } of walkKgNodes(doc)) {
    if (node.id === nodeId) {
      found = node;
      if (node.type === 'CONCEPT' && parent?.type === 'DOMAIN') {
        subjectId = (parent as KgDomain).subjectId;
      }
      break;
    }
  }

  if (!found) throw new Error('Node not found');

  if (found.type === 'CONCEPT') {
    const title = updates.title ?? found.title;
    const aliases = (updates as Partial<KgConcept>).aliases ?? (found as KgConcept).aliases ?? [];
    await validateConceptTitleAndAlias(subjectId, found.id, title, aliases);

    if (updates.status === 'PUBLISHED') {
      if (!title.trim()) throw new Error('Cannot publish without a title');
      if (!(found as KgConcept).primaryDomainId)
        throw new Error('Cannot publish without a primary Domain');
      // Add other publishing validations as required
    }
  }

  // If slug should be updated automatically when title changes (as derived metadata)
  if (updates.title && updates.title !== found.title) {
    found.slug = createSlug(updates.title);
  }

  Object.assign(found, updates);
  found.updatedAt = new Date().toISOString();

  await writeKnowledgeGraph(doc);
  return found;
}

export async function archiveKgNode(nodeId: string): Promise<void> {
  await updateKgNode(nodeId, { status: 'ARCHIVED' });
}

export async function deleteKgNode(nodeId: string): Promise<void> {
  const doc = await readKnowledgeGraph();
  let deleted = false;
  let isConcept = false;

  for (let i = 0; i < doc.subjects.length; i++) {
    if (doc.subjects[i].id === nodeId) {
      doc.subjects.splice(i, 1);
      deleted = true;
      break;
    }
    for (let j = 0; j < doc.subjects[i].grades.length; j++) {
      if (doc.subjects[i].grades[j].id === nodeId) {
        doc.subjects[i].grades.splice(j, 1);
        deleted = true;
        break;
      }
      for (let k = 0; k < doc.subjects[i].grades[j].domains.length; k++) {
        if (doc.subjects[i].grades[j].domains[k].id === nodeId) {
          doc.subjects[i].grades[j].domains.splice(k, 1);
          deleted = true;
          break;
        }
        for (let l = 0; l < doc.subjects[i].grades[j].domains[k].concepts.length; l++) {
          if (doc.subjects[i].grades[j].domains[k].concepts[l].id === nodeId) {
            doc.subjects[i].grades[j].domains[k].concepts.splice(l, 1);
            deleted = true;
            isConcept = true;
            break;
          }
        }
      }
    }
  }

  if (!deleted) throw new Error('Node not found');

  // Cascade cleanup for Concepts
  if (isConcept) {
    doc.learningObjectives = doc.learningObjectives.filter((o) => o.conceptId !== nodeId);
    doc.conceptRelations = doc.conceptRelations.filter(
      (r) => r.sourceConceptId !== nodeId && r.targetConceptId !== nodeId
    );
    doc.domainMemberships = doc.domainMemberships.filter((m) => m.conceptId !== nodeId);
  }

  await writeKnowledgeGraph(doc);
}

export async function reorderKgNodes(nodeId: string, newOrder: number): Promise<void> {
  const doc = await readKnowledgeGraph();
  let parentList: KgBaseNode[] | undefined;

  for (const { node, parent } of walkKgNodes(doc)) {
    if (node.id === nodeId) {
      if (!parent) {
        parentList = doc.subjects;
      } else if (parent.type === 'SUBJECT') {
        parentList = parent.grades;
      } else if (parent.type === 'GRADE') {
        parentList = parent.domains;
      } else if (parent.type === 'DOMAIN') {
        parentList = parent.concepts;
      }
      break;
    }
  }

  if (!parentList) throw new Error('Node not found');

  const idx = parentList.findIndex((n) => n.id === nodeId);
  if (idx === -1) return;

  const [moved] = parentList.splice(idx, 1);
  const targetIdx = Math.max(0, Math.min(newOrder - 1, parentList.length));
  parentList.splice(targetIdx, 0, moved);

  for (let i = 0; i < parentList.length; i++) {
    parentList[i].order = i + 1;
  }

  await writeKnowledgeGraph(doc);
}

// ─── LEARNING OBJECTIVES ────────────────────────────────────────────────────

export async function getLearningObjectives(conceptId: string): Promise<LearningObjective[]> {
  const doc = await readKnowledgeGraph();
  return doc.learningObjectives
    .filter((lo) => lo.conceptId === conceptId)
    .sort((a, b) => a.order - b.order);
}

export async function addLearningObjective(
  objective: Omit<LearningObjective, 'id' | 'createdAt' | 'updatedAt' | 'order'>
): Promise<LearningObjective> {
  const doc = await readKnowledgeGraph();
  if (!objective.statement.trim()) throw new Error('Statement cannot be empty');

  const existing = doc.learningObjectives.filter((o) => o.conceptId === objective.conceptId);
  if (existing.some((o) => o.statement.trim() === objective.statement.trim())) {
    throw new Error('Duplicate learning objective statement for this concept');
  }

  const newObj: LearningObjective = {
    ...objective,
    id: `lo-${genId()}`,
    order: existing.length + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  doc.learningObjectives.push(newObj);
  await writeKnowledgeGraph(doc);
  return newObj;
}

export async function updateLearningObjective(
  id: string,
  updates: Partial<LearningObjective>
): Promise<LearningObjective> {
  const doc = await readKnowledgeGraph();
  const obj = doc.learningObjectives.find((o) => o.id === id);
  if (!obj) throw new Error('Learning Objective not found');

  if (updates.statement !== undefined) {
    if (!updates.statement.trim()) throw new Error('Statement cannot be empty');
    const existing = doc.learningObjectives.filter(
      (o) => o.conceptId === obj.conceptId && o.id !== id
    );
    if (existing.some((o) => o.statement.trim() === updates.statement?.trim())) {
      throw new Error('Duplicate learning objective statement for this concept');
    }
  }

  Object.assign(obj, updates);
  obj.updatedAt = new Date().toISOString();
  await writeKnowledgeGraph(doc);
  return obj;
}

export async function deleteLearningObjective(id: string): Promise<void> {
  const doc = await readKnowledgeGraph();
  const idx = doc.learningObjectives.findIndex((o) => o.id === id);
  if (idx === -1) throw new Error('Learning Objective not found');

  const obj = doc.learningObjectives[idx];
  if (obj.status === 'PUBLISHED') {
    throw new Error('Cannot delete a published learning objective. Archive it instead.');
  }

  doc.learningObjectives.splice(idx, 1);
  await writeKnowledgeGraph(doc);
}

// ─── RELATIONS ──────────────────────────────────────────────────────────────

export async function getConceptRelations(): Promise<ConceptRelation[]> {
  const doc = await readKnowledgeGraph();
  return doc.conceptRelations;
}

export async function addConceptRelation(
  relation: Omit<ConceptRelation, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ConceptRelation> {
  const doc = await readKnowledgeGraph();

  if (relation.sourceConceptId === relation.targetConceptId) {
    throw new Error('Concept cannot relate to itself');
  }

  if (relation.strength !== undefined && (relation.strength < 0 || relation.strength > 1)) {
    throw new Error('Strength must be between 0 and 1');
  }

  const sourceNode = await findKgNode(relation.sourceConceptId);
  const targetNode = await findKgNode(relation.targetConceptId);
  if (!sourceNode || !targetNode) throw new Error('Source or target concept not found');
  if (sourceNode.status === 'ARCHIVED' || targetNode.status === 'ARCHIVED') {
    throw new Error('Cannot add relation involving an ARCHIVED concept');
  }

  const isDuplicate = doc.conceptRelations.some(
    (r) =>
      r.sourceConceptId === relation.sourceConceptId &&
      r.targetConceptId === relation.targetConceptId &&
      r.type === relation.type
  );
  if (isDuplicate) {
    throw new Error('Duplicate relationship');
  }

  const newRelation: ConceptRelation = {
    ...relation,
    id: `rel-${genId()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (detectCycle(doc.conceptRelations, newRelation)) {
    throw new Error('Adding this PREREQUISITE would create a circular dependency cycle');
  }

  doc.conceptRelations.push(newRelation);
  await writeKnowledgeGraph(doc);
  return newRelation;
}

export async function deleteConceptRelation(id: string): Promise<void> {
  const doc = await readKnowledgeGraph();
  const idx = doc.conceptRelations.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error('Relation not found');
  doc.conceptRelations.splice(idx, 1);
  await writeKnowledgeGraph(doc);
}

// ─── DOMAIN MEMBERSHIPS ─────────────────────────────────────────────────────

export async function addSecondaryDomainMembership(
  conceptId: string,
  domainId: string
): Promise<ConceptDomainMembership> {
  const doc = await readKnowledgeGraph();

  const existing = doc.domainMemberships.find(
    (m) => m.conceptId === conceptId && m.domainId === domainId
  );
  if (existing) throw new Error('Concept is already a member of this domain');

  const membership: ConceptDomainMembership = {
    id: `mem-${genId()}`,
    conceptId,
    domainId,
    role: 'SECONDARY',
    createdAt: new Date().toISOString(),
  };

  doc.domainMemberships.push(membership);
  await writeKnowledgeGraph(doc);
  return membership;
}

export async function removeSecondaryDomainMembership(
  conceptId: string,
  domainId: string
): Promise<void> {
  const doc = await readKnowledgeGraph();
  const idx = doc.domainMemberships.findIndex(
    (m) => m.conceptId === conceptId && m.domainId === domainId
  );

  if (idx === -1) throw new Error('Membership not found');
  if (doc.domainMemberships[idx].role === 'PRIMARY') {
    throw new Error('Cannot remove primary domain membership');
  }

  doc.domainMemberships.splice(idx, 1);
  await writeKnowledgeGraph(doc);
}
