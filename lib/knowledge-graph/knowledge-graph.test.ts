import { describe, it, expect, beforeEach } from 'vitest';
import { validateKnowledgeGraph } from './kg-validator';
import { walkKgNodes } from './kg-utils';
import { KgDocument, ConceptRelation } from './kg-types';

describe('Knowledge Graph Validator', () => {
  let mockDoc: KgDocument;

  beforeEach(() => {
    mockDoc = {
      schemaVersion: 3,
      updatedAt: '2023-01-01T00:00:00Z',
      subjects: [
        {
          id: 's1',
          type: 'SUBJECT',
          title: 'Toán học',
          slug: 'toan-hoc',
          order: 1,
          status: 'PUBLISHED',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          grades: [
            {
              id: 'g1',
              type: 'GRADE',
              subjectId: 's1',
              title: 'Lớp 12',
              slug: 'lop-12',
              order: 1,
              status: 'PUBLISHED',
              createdAt: '2023-01-01T00:00:00Z',
              updatedAt: '2023-01-01T00:00:00Z',
              domains: [
                {
                  id: 'd1',
                  type: 'DOMAIN',
                  subjectId: 's1',
                  gradeId: 'g1',
                  title: 'Giải tích',
                  slug: 'giai-tich',
                  order: 1,
                  status: 'PUBLISHED',
                  createdAt: '2023-01-01T00:00:00Z',
                  updatedAt: '2023-01-01T00:00:00Z',
                  concepts: [
                    {
                      id: 'c1',
                      type: 'CONCEPT',
                      primaryDomainId: 'd1',
                      title: 'Đạo hàm',
                      slug: 'dao-ham',
                      aliases: [],
                      order: 1,
                      status: 'PUBLISHED',
                      createdAt: '2023-01-01T00:00:00Z',
                      updatedAt: '2023-01-01T00:00:00Z',
                      detailedDescription: 'Khái niệm đạo hàm',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      learningObjectives: [],
      conceptRelations: [],
      domainMemberships: [],
    };
  });

  it('should validate a correct document', () => {
    const result = validateKnowledgeGraph(mockDoc);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing title', () => {
    mockDoc.subjects[0].grades[0].title = '   ';
    const result = validateKnowledgeGraph(mockDoc);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'MISSING_TITLE', nodeId: 'g1' })
    );
  });

  it('should detect duplicate slug within the same level', () => {
    // Add another grade with the same slug
    const g2 = JSON.parse(JSON.stringify(mockDoc.subjects[0].grades[0]));
    g2.id = 'g2';
    g2.title = 'Lớp 12 khác';
    mockDoc.subjects[0].grades.push(g2);

    const result = validateKnowledgeGraph(mockDoc);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'DUPLICATE_SLUG', nodeId: 'g2' })
    );
  });

  it('should detect invalid status', () => {
    (mockDoc.subjects[0].status as unknown) = 'UNKNOWN';
    const result = validateKnowledgeGraph(mockDoc);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'INVALID_STATUS', nodeId: 's1' })
    );
  });
});

describe('Knowledge Graph Service', () => {
  it('walkKgNodes yields all nodes with correct levels', () => {
    const doc: KgDocument = {
      schemaVersion: 3,
      updatedAt: '',
      learningObjectives: [],
      conceptRelations: [],
      domainMemberships: [],
      subjects: [
        {
          id: 's1',
          type: 'SUBJECT',
          title: '',
          slug: '',
          order: 1,
          status: 'PUBLISHED',
          createdAt: '',
          updatedAt: '',
          grades: [
            {
              id: 'g1',
              type: 'GRADE',
              subjectId: 's1',
              title: '',
              slug: '',
              order: 1,
              status: 'PUBLISHED',
              createdAt: '',
              updatedAt: '',
              domains: [
                {
                  id: 'd1',
                  type: 'DOMAIN',
                  subjectId: 's1',
                  gradeId: 'g1',
                  title: '',
                  slug: '',
                  order: 1,
                  status: 'PUBLISHED',
                  createdAt: '',
                  updatedAt: '',
                  concepts: [
                    {
                      id: 'c1',
                      type: 'CONCEPT',
                      primaryDomainId: 'd1',
                      aliases: [],
                      title: '',
                      slug: '',
                      order: 1,
                      status: 'PUBLISHED',
                      createdAt: '',
                      updatedAt: '',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const nodes = Array.from(walkKgNodes(doc));
    expect(nodes).toHaveLength(4);
    expect(nodes[0].node.id).toBe('s1');
    expect(nodes[0].level).toBe(0);
    expect(nodes[1].node.id).toBe('g1');
    expect(nodes[1].level).toBe(1);
    expect(nodes[1].parent?.id).toBe('s1');
    expect(nodes[2].node.id).toBe('d1');
    expect(nodes[2].level).toBe(2);
    expect(nodes[2].parent?.id).toBe('g1');
    expect(nodes[3].node.id).toBe('c1');
    expect(nodes[3].level).toBe(3);
    expect(nodes[3].parent?.id).toBe('d1');
  });
});

import { detectCycle } from './kg-service';

describe('Cycle Detection (detectCycle)', () => {
  it('should detect direct self-reference', () => {
    const rels: ConceptRelation[] = [];
    const newRel = {
      sourceConceptId: 'A',
      targetConceptId: 'A',
      type: 'PREREQUISITE',
    } as ConceptRelation;
    expect(detectCycle(rels, newRel)).toBe(true);
  });

  it('should detect direct cycle A -> B -> A', () => {
    const rels = [
      { sourceConceptId: 'A', targetConceptId: 'B', type: 'PREREQUISITE' } as ConceptRelation,
    ];
    const newRel = {
      sourceConceptId: 'B',
      targetConceptId: 'A',
      type: 'PREREQUISITE',
    } as ConceptRelation;
    expect(detectCycle(rels, newRel)).toBe(true);
  });

  it('should detect indirect cycle A -> B -> C -> A', () => {
    const rels = [
      { sourceConceptId: 'A', targetConceptId: 'B', type: 'PREREQUISITE' } as ConceptRelation,
      { sourceConceptId: 'B', targetConceptId: 'C', type: 'PREREQUISITE' } as ConceptRelation,
    ];
    const newRel = {
      sourceConceptId: 'C',
      targetConceptId: 'A',
      type: 'PREREQUISITE',
    } as ConceptRelation;
    expect(detectCycle(rels, newRel)).toBe(true);
  });

  it('should allow valid DAG', () => {
    // A -> B, A -> C, B -> D, C -> D is valid
    const rels = [
      { sourceConceptId: 'A', targetConceptId: 'B', type: 'PREREQUISITE' } as ConceptRelation,
      { sourceConceptId: 'A', targetConceptId: 'C', type: 'PREREQUISITE' } as ConceptRelation,
      { sourceConceptId: 'B', targetConceptId: 'D', type: 'PREREQUISITE' } as ConceptRelation,
    ];
    const newRel = {
      sourceConceptId: 'C',
      targetConceptId: 'D',
      type: 'PREREQUISITE',
    } as ConceptRelation;
    expect(detectCycle(rels, newRel)).toBe(false);
  });
});
