import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import type { KgDocument } from './kg-types';
import { buildGraphOrientationModel } from './graph-orientation';

const graph = JSON.parse(
  readFileSync(join(process.cwd(), 'data', 'knowledge-graph', 'graph.json'), 'utf8')
) as KgDocument;

describe('Knowledge Graph orientation', () => {
  it('uses only the canonical node and relationship types defined by persisted data', () => {
    const model = buildGraphOrientationModel({ graph });
    expect(model.canonicalNodeTypes).toEqual(['SUBJECT', 'GRADE', 'DOMAIN', 'CONCEPT']);
    expect(model.supportedRelationshipTypes).toEqual([
      'PREREQUISITE',
      'RELATED',
      'PART_OF',
      'EQUIVALENT',
    ]);
    expect(model.persistedRelationshipTypes).toEqual(['PREREQUISITE']);
    expect(model.relationships.every((relationship) => relationship.type === 'PREREQUISITE')).toBe(
      true
    );
    expect(model.graphShape).toBe('MIXED');
  });

  it('keeps Learning Objectives outside the canonical node set', () => {
    const allCanonicalNodes = graph.subjects.flatMap((subject) => [
      subject,
      ...subject.grades.flatMap((grade) => [
        grade,
        ...grade.domains.flatMap((domain) => [domain, ...domain.concepts]),
      ]),
    ]);
    expect(new Set(allCanonicalNodes.map((node) => node.type))).toEqual(
      new Set(['SUBJECT', 'GRADE', 'DOMAIN', 'CONCEPT'])
    );
    expect(graph.learningObjectives.every((objective) => 'conceptId' in objective)).toBe(true);
  });

  it('orients the graph from canonical data when no source mapping is selected', () => {
    const model = buildGraphOrientationModel({ graph });
    expect(model.canonicalConcepts.length).toBeGreaterThan(0);
    expect(model.selectedSourceConceptIds).toEqual([]);
    expect(model.contextSourceItemIds).toEqual([]);
  });

  it('is deterministic and does not mutate graph input', () => {
    const graphBefore = JSON.stringify(graph);
    expect(buildGraphOrientationModel({ graph })).toEqual(buildGraphOrientationModel({ graph }));
    expect(JSON.stringify(graph)).toBe(graphBefore);
  });
});
