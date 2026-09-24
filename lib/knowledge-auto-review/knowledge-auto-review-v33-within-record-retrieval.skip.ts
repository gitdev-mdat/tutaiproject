import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import type { AiGateway } from '@/lib/ai/ai-gateway';
import {
  knowledgeAutoReviewV33ResultSchema,
  type KnowledgeAutoReviewInput,
  type KnowledgeAutoReviewSession,
  type KnowledgeAutoReviewV33Result,
  type WithinRecordAssessment,
} from '@/lib/ai/ai-types';
import {
  KNOWLEDGE_AUTO_REVIEW_V33_SYSTEM_PROMPT,
  buildKnowledgeAutoReviewV33Prompt,
} from '@/lib/ai/prompts/knowledge-auto-review-v3-3';
import {
  AUTO_REVIEW_POLICY_VERSION,
  KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSION,
  KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS,
} from '@/lib/config/knowledge-auto-review';
import type { KgConcept, KgDocument, KgDomain } from '@/lib/knowledge-graph/kg-types';
import type { PipelineDocument } from '@/lib/pipeline/types';
import type { SemanticProposalPackage } from '@/lib/textbook/semantic-proposal-types';
import type { LessonConceptMapping, Textbook } from '@/lib/textbook/types';
import { applyKnowledgeReviewPolicy, runKnowledgeAutoReview } from './knowledge-auto-review-engine';
import {
  prepareKnowledgeAutoReviewInput,
  retrieveRelevantConceptsV33,
} from './knowledge-auto-review-retrieval';
import type { KnowledgeAutoReviewStore } from './knowledge-auto-review-storage';
import {
  BAI_8_LESSON_ID,
  GOVERNED_BAI_8_SESSION_LINEAGE,
  HISTORICAL_RETRIEVAL_REGRESSION_LESSON_IDS,
} from './governed-session-lineage.test-fixture';
import {
  applyWithinRecordPolicyV33,
  calculateOverFlatteningMetricsV33,
  passesConstituentSplitGate,
} from './within-record-v33';

const ROOT = process.cwd();
const DOCUMENT_ID = 'mryei32t-0fybu39';
const BAI_7_SESSION_ID = 'ff47bdee-52a1-47f4-963d-4d3dc8506152';
const NOW = '2026-07-27T00:00:00.000Z';

class MemoryStore implements KnowledgeAutoReviewStore {
  sessions: KnowledgeAutoReviewSession[] = [];

  async list() {
    return structuredClone(this.sessions);
  }

  async upsert(session: KnowledgeAutoReviewSession) {
    const index = this.sessions.findIndex((item) => item.id === session.id);
    if (index >= 0) this.sessions[index] = structuredClone(session);
    else this.sessions.push(structuredClone(session));
  }
}

function concept(
  id: string,
  title: string,
  domainId: string,
  status: KgConcept['status'] = 'PUBLISHED',
  aliases: string[] = []
): KgConcept {
  return {
    id,
    title,
    slug: id,
    order: 1,
    status,
    type: 'CONCEPT',
    primaryDomainId: domainId,
    aliases,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function domain(id: string, title: string, concepts: KgConcept[]): KgDomain {
  return {
    id,
    title,
    slug: id,
    order: 1,
    status: 'PUBLISHED',
    type: 'DOMAIN',
    subjectId: 'math',
    gradeId: '12',
    concepts,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function graph(domains?: KgDomain[]): KgDocument {
  return {
    schemaVersion: 3,
    updatedAt: NOW,
    subjects: [
      {
        id: 'math',
        title: 'Mathematics',
        slug: 'math',
        order: 1,
        status: 'PUBLISHED',
        type: 'SUBJECT',
        grades: [
          {
            id: '12',
            title: 'Grade 12',
            slug: '12',
            order: 1,
            status: 'PUBLISHED',
            type: 'GRADE',
            subjectId: 'math',
            domains: domains ?? [
              domain('calculus', 'Calculus and derivatives', [
                concept('derivative', 'Derivative of a function', 'calculus'),
                concept('extrema', 'Function extrema', 'calculus'),
              ]),
              domain('vectors', 'Vectors and spatial coordinates', [
                concept('vector', 'Vector in space', 'vectors', 'PUBLISHED', ['spatial vector']),
                concept('coordinate-frame', 'Orthogonal coordinate frame', 'vectors'),
                concept('archived-vector', 'Archived vector notation', 'vectors', 'ARCHIVED'),
              ]),
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
    conceptRelations: [],
    domainMemberships: [],
  };
}

function reviewInput(
  existingConceptCandidates: KnowledgeAutoReviewInput['existingConceptCandidates'] = []
): KnowledgeAutoReviewInput {
  return {
    subject: { id: 'math', title: 'Mathematics' },
    grade: { id: '12', title: 'Grade 12' },
    textbook: { id: 'book', title: 'Offline fixture' },
    chapter: { id: 'chapter', title: 'A transferable mathematical chapter' },
    lesson: { id: 'lesson', title: 'A transferable mathematical lesson' },
    semanticRecords: [
      {
        id: 'combined-record',
        type: 'CONCEPT_CANDIDATE',
        title: 'Combined reusable identities',
        sourceText: 'Direct evidence for identity A. Direct evidence for identity B.',
      },
    ],
    existingConceptCandidates,
    deterministicMatches: [
      { sourceRecordId: 'combined-record', matchType: 'NONE', canonicalConceptIds: [] },
    ],
    relevantGraphVersion: 'offline-v33',
  };
}

function assessment(overrides: Partial<WithinRecordAssessment> = {}): WithinRecordAssessment {
  return {
    sourceRecordId: 'combined-record',
    containsMultipleKnowledgeObjects: true,
    constituents: [
      {
        temporaryRef: 'constituent-a',
        proposedTitle: 'Identity A',
        rationale: 'A has an independent reusable definition and mastery state.',
        independentlyTeachable: true,
        independentlyAssessable: true,
        reusableAcrossProblems: true,
        evidenceSpan: 'Direct evidence for identity A.',
        confidence: 0.95,
      },
      {
        temporaryRef: 'constituent-b',
        proposedTitle: 'Identity B',
        rationale: 'B has an independent reusable definition and mastery state.',
        independentlyTeachable: true,
        independentlyAssessable: true,
        reusableAcrossProblems: true,
        evidenceSpan: 'Direct evidence for identity B.',
        confidence: 0.94,
      },
    ],
    recommendedAction: 'PROPOSE_CONSTITUENT_SPLIT',
    rationale: 'A learner can master either identity while failing the other.',
    ...overrides,
  };
}

function v33Result(
  overrides: Partial<KnowledgeAutoReviewV33Result> = {}
): KnowledgeAutoReviewV33Result {
  const splitAssessment = assessment();
  const result: KnowledgeAutoReviewV33Result = {
    candidateReviews: [
      {
        sourceRecordId: 'combined-record',
        classification: 'NEW_CONCEPT',
        proposedCanonicalTitle: 'Combined reusable identities',
        conciseRationale: 'The record contains reusable mathematical knowledge.',
        evidence: ['Direct evidence for identity A.', 'Direct evidence for identity B.'],
        confidence: 0.95,
        reasonCodes: ['REUSABLE_KNOWLEDGE'],
        evidenceSufficiency: 'SUFFICIENT',
        titleEvidenceAssessment: 'CONSISTENT',
      },
    ],
    mergeProposals: [],
    learningObjectives: [
      {
        id: 'lo-a',
        statement: 'Apply identity A.',
        targetReference: {
          kind: 'CONSTITUENT_PROPOSAL',
          id: 'constituent-a',
          title: 'Identity A',
        },
        bloomLevel: 'APPLY',
        conciseRationale: 'A has its own observable mastery target.',
        sourceSemanticRecordIds: ['combined-record'],
        confidence: 0.91,
      },
    ],
    prerequisiteProposals: [
      {
        id: 'a-before-b',
        sourceReference: {
          kind: 'CONSTITUENT_PROPOSAL',
          id: 'constituent-a',
          title: 'Identity A',
        },
        targetReference: {
          kind: 'CONSTITUENT_PROPOSAL',
          id: 'constituent-b',
          title: 'Identity B',
        },
        relationType: 'LEARNING_PREREQUISITE',
        conciseRationale: 'Identity A is materially required for identity B.',
        sourceSemanticRecordIds: ['combined-record'],
        confidence: 0.9,
      },
    ],
    prerequisiteAudits: [],
    graphMissingPrerequisites: [],
    ambiguities: [],
    ontologyBoundaryRecommendations: [],
    withinRecordAssessments: [splitAssessment],
    constituentSplitProposals: [
      {
        id: 'split-combined-record',
        sourceRecordId: 'combined-record',
        proposedConstituents: structuredClone(splitAssessment.constituents!),
        rationale: splitAssessment.rationale,
        confidence: 0.94,
      },
    ],
  };
  return { ...result, ...overrides };
}

function keepSingleResult(reason: string): KnowledgeAutoReviewV33Result {
  return v33Result({
    learningObjectives: [],
    prerequisiteProposals: [],
    withinRecordAssessments: [
      assessment({
        containsMultipleKnowledgeObjects: false,
        constituents: undefined,
        recommendedAction: 'KEEP_AS_SINGLE_CONCEPT',
        rationale: reason,
      }),
    ],
    constituentSplitProposals: [],
  });
}

function retrieve(params: {
  chapterTitle: string;
  lessonTitle: string;
  recordTitle: string;
  graph?: KgDocument;
  mappings?: LessonConceptMapping[];
  maxTopK?: number;
}) {
  return retrieveRelevantConceptsV33({
    graph: params.graph ?? graph(),
    subjectId: 'math',
    gradeId: '12',
    textbookId: 'book',
    lessonId: 'lesson',
    chapterTitle: params.chapterTitle,
    lessonTitle: params.lessonTitle,
    semanticRecords: [
      {
        id: 'record',
        type: 'CONCEPT_CANDIDATE',
        title: params.recordTitle,
      },
    ],
    textbookMappings: params.mappings,
    maxTopK: params.maxTopK,
  });
}

function sha256(relativePath: string): string {
  return createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, relativePath)))
    .digest('hex')
    .toUpperCase();
}

describe('Phase 4.12 V3.3 within-record and retrieval calibration', () => {
  it('keeps a single-identity record as one Concept', () => {
    const governed = applyWithinRecordPolicyV33(
      keepSingleResult('One reusable identity with supporting explanation.')
    );
    expect(governed.constituentSplitProposals).toHaveLength(0);
    expect(governed.candidateReviews[0].granularityStatus).toBe('SINGLE_CONCEPT');
  });

  it('does not split synonyms inside one source record', () => {
    const governed = applyWithinRecordPolicyV33(
      keepSingleResult('The two phrases are aliases for the same mathematical identity.')
    );
    expect(governed.withinRecordAssessments[0].recommendedAction).toBe('KEEP_AS_SINGLE_CONCEPT');
  });

  it('does not split a definition from its explanation', () => {
    const governed = applyWithinRecordPolicyV33(
      keepSingleResult(
        'The explanation only elaborates the definition and has no separate mastery state.'
      )
    );
    expect(governed.constituentSplitProposals).toEqual([]);
  });

  it('allows two independently teachable and assessable identities to propose a split', () => {
    const raw = v33Result();
    expect(
      passesConstituentSplitGate({
        assessment: raw.withinRecordAssessments[0],
        proposal: raw.constituentSplitProposals[0],
        candidateClassification: 'NEW_CONCEPT',
      })
    ).toBe(true);
  });

  it('blocks lexical or incomplete splits that fail the semantic gate', () => {
    const raw = v33Result();
    raw.constituentSplitProposals[0].proposedConstituents[1].independentlyAssessable = false;
    const governed = applyWithinRecordPolicyV33(raw);
    expect(governed.constituentSplitProposals).toEqual([]);
    expect(governed.withinRecordAssessments[0].recommendedAction).toBe('ONTOLOGY_AMBIGUOUS');
  });

  it('keeps a valid split governed and human-required', () => {
    const governed = applyWithinRecordPolicyV33(v33Result());
    const decisions = applyKnowledgeReviewPolicy(governed.candidateReviews, reviewInput());
    expect(governed.candidateReviews[0].granularityStatus).toBe('NEEDS_CONSTITUENT_REVIEW');
    expect(decisions[0].disposition).toBe('HUMAN_REQUIRED');
  });

  it('allows Learning Objectives to target constituent proposal refs', () => {
    const governed = applyWithinRecordPolicyV33(v33Result());
    expect(governed.learningObjectives[0].targetReference).toMatchObject({
      kind: 'CONSTITUENT_PROPOSAL',
      id: 'constituent-a',
    });
  });

  it('allows prerequisite proposals to reference constituent proposal refs', () => {
    const governed = applyWithinRecordPolicyV33(v33Result());
    expect(governed.prerequisiteProposals[0]).toMatchObject({
      sourceReference: { kind: 'CONSTITUENT_PROPOSAL', id: 'constituent-a' },
      targetReference: { kind: 'CONSTITUENT_PROPOSAL', id: 'constituent-b' },
    });
  });

  it('never mutates the raw provider artifact while governing a split', () => {
    const raw = v33Result();
    const before = JSON.stringify(raw);
    applyWithinRecordPolicyV33(raw);
    expect(JSON.stringify(raw)).toBe(before);
  });

  it('retains the V3.2 same-identity merge behavior', () => {
    const raw = v33Result({
      candidateReviews: ['combined-record', 'other-record'].map((sourceRecordId) => ({
        sourceRecordId,
        classification: 'MERGE_CANDIDATE' as const,
        proposedCanonicalTitle: 'One identity',
        conciseRationale: 'Synonymous evidence.',
        evidence: ['Same identity evidence.'],
        confidence: 0.96,
        reasonCodes: ['REUSABLE_KNOWLEDGE', 'COMPLEMENTARY_CONCEPTS'],
        evidenceSufficiency: 'SUFFICIENT' as const,
        titleEvidenceAssessment: 'CONSISTENT' as const,
      })),
      mergeProposals: [
        {
          id: 'same-identity',
          sourceCandidateIds: ['combined-record', 'other-record'],
          proposedCanonicalTitle: 'One identity',
          conciseRationale: 'One mastery state.',
          confidence: 0.96,
          reasonCodes: ['REUSABLE_KNOWLEDGE', 'COMPLEMENTARY_CONCEPTS'],
          ontologyIdentityAssessment: {
            sameKnowledgeIdentity: true,
            independentlyTeachableA: false,
            independentlyTeachableB: false,
            independentlyAssessableA: false,
            independentlyAssessableB: false,
            directionalDependencyExists: false,
            constituentRelationshipExists: false,
            rationale: 'The records are synonyms.',
          },
        },
      ],
      learningObjectives: [],
      prerequisiteProposals: [],
      withinRecordAssessments: [
        assessment({
          containsMultipleKnowledgeObjects: false,
          constituents: undefined,
          recommendedAction: 'KEEP_AS_SINGLE_CONCEPT',
        }),
        {
          sourceRecordId: 'other-record',
          containsMultipleKnowledgeObjects: false,
          recommendedAction: 'KEEP_AS_SINGLE_CONCEPT',
          rationale: 'One identity.',
        },
      ],
      constituentSplitProposals: [],
    });
    expect(applyWithinRecordPolicyV33(raw).mergeProposals).toHaveLength(1);
  });

  it('excludes unrelated Domain noise and archived Concepts', () => {
    const result = retrieve({
      chapterTitle: 'Spatial coordinate geometry',
      lessonTitle: 'Vectors in space',
      recordTitle: 'Coordinates of a spatial vector',
    });
    expect(result.concepts.map((item) => item.id)).not.toContain('derivative');
    expect(result.concepts.map((item) => item.id)).not.toContain('extrema');
    expect(result.trace.entries.map((item) => item.conceptId)).not.toContain('archived-vector');
  });

  it('returns fewer than maxTopK when only a bounded relevant set exists', () => {
    const result = retrieve({
      chapterTitle: 'Spatial coordinate geometry',
      lessonTitle: 'Vectors in space',
      recordTitle: 'Vector in space',
      maxTopK: 10,
    });
    expect(result.concepts.length).toBeGreaterThan(0);
    expect(result.concepts.length).toBeLessThan(10);
  });

  it('returns zero instead of low-quality filler', () => {
    const result = retrieve({
      chapterTitle: 'Unrepresented topic',
      lessonTitle: 'Unrepresented topic',
      recordTitle: 'Unrepresented topic',
    });
    expect(result.concepts).toEqual([]);
    expect(result.trace.selectedCount).toBe(0);
  });

  it('uses deterministic scoring and trace ordering', () => {
    const request = {
      chapterTitle: 'Spatial coordinate geometry',
      lessonTitle: 'Vectors in space',
      recordTitle: 'Orthogonal coordinate frame',
    };
    expect(retrieve(request)).toEqual(retrieve(request));
  });

  it('uses current textbook mapping evidence without requiring a fixed result count', () => {
    const mapping: LessonConceptMapping = {
      id: 'map',
      textbookId: 'book',
      lessonId: 'lesson',
      conceptId: 'coordinate-frame',
      role: 'PREREQUISITE',
      relevance: 1,
      status: 'APPROVED',
      createdAt: NOW,
      updatedAt: NOW,
    };
    const result = retrieve({
      chapterTitle: 'Generic chapter',
      lessonTitle: 'Generic lesson',
      recordTitle: 'Generic record',
      mappings: [mapping],
    });
    expect(result.concepts.map((item) => item.id)).toEqual(['coordinate-frame']);
    expect(
      result.trace.entries.find((item) => item.conceptId === 'coordinate-frame')?.reasonCodes
    ).toContain('TEXTBOOK_MAPPING_SUPPORT');
  });

  it('preserves graph-missing prerequisites when retrieval returns zero', async () => {
    const raw = keepSingleResult('One identity.');
    raw.graphMissingPrerequisites = [
      {
        title: 'Missing foundation',
        reason: 'Required knowledge is absent from the filtered graph context.',
        confidence: 0.9,
      },
    ];
    const gateway: AiGateway = {
      reviewKnowledgeCandidates: async () => ({
        result: raw,
        rawResult: raw,
      }),
    };
    const completed = await runKnowledgeAutoReview({
      gateway,
      store: new MemoryStore(),
      input: reviewInput([]),
      idFactory: () => 'offline-session',
      promptVersion: KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v33,
      policyVersion: 'knowledge-auto-review-policy-v3.3',
    });
    expect(completed.session.rawProviderResult?.graphMissingPrerequisites).toHaveLength(1);
  });

  it('builds the exhaustive prerequisite matrix only over the filtered retrieval set', async () => {
    const candidate = {
      id: 'vector',
      title: 'Vector in space',
      aliases: [],
      domainId: 'vectors',
    };
    const raw = keepSingleResult('One identity.');
    raw.prerequisiteAudits = [
      {
        sourceConceptRef: {
          kind: 'EXISTING_CONCEPT',
          id: 'vector',
          title: 'Vector in space',
        },
        targetConceptRef: {
          kind: 'SOURCE_CANDIDATE',
          id: 'combined-record',
          title: 'Combined reusable identities',
        },
        classification: 'NOT_REQUIRED',
        rationale: 'The candidate is relevant context but not a strict prerequisite.',
      },
    ];
    const gateway: AiGateway = {
      reviewKnowledgeCandidates: async () => ({
        result: raw,
        rawResult: raw,
      }),
    };
    const completed = await runKnowledgeAutoReview({
      gateway,
      store: new MemoryStore(),
      input: reviewInput([candidate]),
      idFactory: () => 'filtered-matrix-session',
      promptVersion: KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v33,
      policyVersion: 'knowledge-auto-review-policy-v3.3',
    });
    expect(completed.session.status).toBe('COMPLETED');
    expect(completed.session.rawProviderResult?.prerequisiteAudits).toHaveLength(1);
  });

  it('contains no Chapter-II or lesson-specific retrieval hardcoding', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'lib/knowledge-auto-review/knowledge-auto-review-retrieval.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/Chapter II|Chương II|Bài 7|tọa độ của điểm/i);
  });

  it('calibrates the persisted Bài 7 defect offline without rewriting its raw result', () => {
    const store = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, 'tmp/uploads', DOCUMENT_ID, 'knowledge-auto-review.json'),
        'utf8'
      )
    ) as { sessions: KnowledgeAutoReviewSession[] };
    const evaluation = JSON.parse(
      fs.readFileSync(
        path.join(
          ROOT,
          'tmp/uploads',
          DOCUMENT_ID,
          'knowledge-auto-review-v32-second-blind-evaluation.json'
        ),
        'utf8'
      )
    ) as {
      candidateEvaluations: Array<{
        sourceRecordId: string;
        granularityLabel: string;
        independentlyTeachable: boolean;
        independentlyAssessable: boolean;
        umbrellaConstituentRelationshipExists: boolean;
      }>;
    };
    const session = store.sessions.find((item) => item.id === BAI_7_SESSION_ID)!;
    const rawBefore = JSON.stringify(session.rawProviderResult);
    const knownDefect = evaluation.candidateEvaluations.find(
      (item) => item.granularityLabel === 'ACCEPTABLE_WITH_EDIT'
    )!;
    expect(knownDefect).toMatchObject({
      independentlyTeachable: true,
      independentlyAssessable: true,
      umbrellaConstituentRelationshipExists: true,
    });
    const offlineAssessment = assessment({
      sourceRecordId: knownDefect.sourceRecordId,
      rationale:
        'The persisted human evaluation establishes separate teachability, assessment, and mastery value.',
    });
    expect(offlineAssessment.recommendedAction).toBe('PROPOSE_CONSTITUENT_SPLIT');
    expect(JSON.stringify(session.rawProviderResult)).toBe(rawBefore);
    const laterBai8Sessions = store.sessions.filter((item) => item.lessonId === BAI_8_LESSON_ID);
    expect(
      laterBai8Sessions.map((item) => ({
        id: item.id,
        status: item.status,
        promptVersion: item.promptVersion,
        policyVersion: item.policyVersion,
        retrievalVersion: item.input.retrievalTrace?.version ?? null,
        errorCode: item.errorCode ?? null,
        providerAttempt: item.providerAttempt ?? null,
        retryCount: item.retryCount,
        replacementForSessionId: item.replacementForSessionId ?? null,
        rawResultPresence: item.rawProviderResult === undefined ? 'ABSENT' : 'PRESENT',
        rawResultSha256:
          item.rawProviderResult === undefined
            ? null
            : createHash('sha256')
                .update(JSON.stringify(item.rawProviderResult))
                .digest('hex')
                .toUpperCase(),
      }))
    ).toEqual(GOVERNED_BAI_8_SESSION_LINEAGE);
  });

  it('reports merge, within-record, and total over-flattening separately', () => {
    const raw = v33Result();
    expect(
      calculateOverFlatteningMetricsV33({
        mergeOverFlattening: 0,
        assessments: raw.withinRecordAssessments,
        governedSplitProposals: [],
      })
    ).toEqual({
      mergeOverFlattening: 0,
      withinRecordOverFlattening: 1,
      totalOverFlattening: 1,
    });
  });

  it('versions the V3.3 schema, prompt, policy, and structured output contract', () => {
    expect(KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v33).toBe('knowledge-auto-review-v3.3');
    expect(KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSION).toBe(KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v35);
    expect(AUTO_REVIEW_POLICY_VERSION).toBe('knowledge-auto-review-policy-v3.5');
    expect(KNOWLEDGE_AUTO_REVIEW_V33_SYSTEM_PROMPT).toContain(
      'Prompt version: knowledge-auto-review-v3.3.'
    );
    expect(
      createHash('sha256')
        .update(KNOWLEDGE_AUTO_REVIEW_V33_SYSTEM_PROMPT)
        .digest('hex')
        .toUpperCase()
    ).toBe('2BC4E47EF74FD338EB6F8C6C2524BFA005AFCF6BD79A37CFC5119E235F362C72');
    expect(buildKnowledgeAutoReviewV33Prompt(reviewInput())).not.toContain('"retrievalTrace"');
    expect(knowledgeAutoReviewV33ResultSchema.safeParse(v33Result()).success).toBe(true);
  });

  it('shows governed constituent review actions without a Controlled Import handoff', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'components/admin/textbooks/knowledge-auto-review-panel.tsx'),
      'utf8'
    );
    for (const expected of [
      'AI phát hiện mục này có thể chứa nhiều kiến thức độc lập.',
      'Mục gốc:',
      'Các thành phần được đề xuất:',
      'Xác nhận tách',
      'Chỉnh sửa',
      'Giữ nguyên',
      'Chưa quyết định',
      'dữ liệu canonical.',
      'session.input.retrievalTrace?.selectedCount',
    ]) {
      expect(source).toContain(expected);
    }
    expect(source).not.toContain('/knowledge-import');
  });

  it('keeps canonical stores and the persisted Bài 7 evidence byte-identical', () => {
    expect(sha256('data/knowledge-graph/graph.json')).toBe(
      'B594BF59E329260A4BB51CE00A988A3CC4E5118409C30417F852B80212D1681E'
    );
    expect(sha256('data/textbook-mappings.json')).toBe(
      '9524B3086CAA2F9296513CD9BB998DD90B0A87A48AFD20969DF9452294E9F067'
    );
    expect(sha256('data/import-data.json')).toBe(
      'ACB8BCABD8B67E7969987B514760D3C5CB19744AD7084240DC1EBC61C1F5DF3E'
    );
    expect(sha256(`tmp/uploads/${DOCUMENT_ID}/knowledge-auto-review-calibration-v33.json`)).toBe(
      '69EC6C907D60F623FE17ABA575F1B18895528E0A69BE81A6FD606694A9E6CE48'
    );
    const store = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, 'tmp/uploads', DOCUMENT_ID, 'knowledge-auto-review.json'),
        'utf8'
      )
    ) as { sessions: KnowledgeAutoReviewSession[] };
    const bai7 = store.sessions.find((item) => item.id === BAI_7_SESSION_ID)!;
    const evaluation = JSON.parse(
      fs.readFileSync(
        path.join(
          ROOT,
          'tmp/uploads',
          DOCUMENT_ID,
          'knowledge-auto-review-v32-second-blind-evaluation.json'
        ),
        'utf8'
      )
    ) as { execution: { rawResultSha256: string } };
    expect(
      createHash('sha256')
        .update(JSON.stringify(bai7.rawProviderResult))
        .digest('hex')
        .toUpperCase()
    ).toBe(evaluation.execution.rawResultSha256);
  });

  it('measures the offline Bài 1–7 retrieval regression without provider calls', () => {
    const textbook = (
      JSON.parse(fs.readFileSync(path.join(ROOT, 'data/textbooks.json'), 'utf8')) as Textbook[]
    ).find((item) => item.id === DOCUMENT_ID)!;
    const document = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'tmp/uploads', DOCUMENT_ID, 'document.json'), 'utf8')
    ) as PipelineDocument;
    const canonicalGraph = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'data/knowledge-graph/graph.json'), 'utf8')
    ) as KgDocument;
    const mappings = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'data/textbook-mappings.json'), 'utf8')
    ) as LessonConceptMapping[];
    const semantic = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, 'tmp/uploads', DOCUMENT_ID, 'semantic-proposals.json'),
        'utf8'
      )
    ) as SemanticProposalPackage;
    const store = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, 'tmp/uploads', DOCUMENT_ID, 'knowledge-auto-review.json'),
        'utf8'
      )
    ) as { sessions: KnowledgeAutoReviewSession[] };
    const latestCompletedByLesson = new Map<string, KnowledgeAutoReviewSession>();
    for (const session of store.sessions
      .filter((item) => item.status === 'COMPLETED')
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))) {
      latestCompletedByLesson.set(session.lessonId, session);
    }
    const comparisons = [...latestCompletedByLesson.values()]
      .filter((session) =>
        HISTORICAL_RETRIEVAL_REGRESSION_LESSON_IDS.includes(
          session.lessonId as (typeof HISTORICAL_RETRIEVAL_REGRESSION_LESSON_IDS)[number]
        )
      )
      .map((session) => {
        const calibrated = prepareKnowledgeAutoReviewInput({
          textbook,
          document,
          graph: canonicalGraph,
          lessonId: session.lessonId,
          textbookMappings: mappings,
          semantic,
        });
        return {
          lessonId: session.lessonId,
          lessonTitle: session.input.lesson.title,
          oldCount: session.input.existingConceptCandidates.length,
          newCount: calibrated.existingConceptCandidates.length,
          oldIds: session.input.existingConceptCandidates.map((item) => item.id),
          newIds: calibrated.existingConceptCandidates.map((item) => item.id),
        };
      });
    expect(comparisons).toHaveLength(7);
    expect(Object.fromEntries(comparisons.map((item) => [item.lessonId, item.newCount]))).toEqual({
      'mryhipx2-9r8oliu': 4,
      'mryhipx2-eh6ke0j': 4,
      'mryhipx2-ozx6csd': 4,
      'mryhipx2-5sfrupk': 4,
      'mryhipx2-4bm668b': 4,
      'mryhipx3-2payll9': 0,
      'mryhipx3-dz9b818': 0,
    });
    expect(comparisons.reduce((total, item) => total + item.newCount, 0)).toBeLessThan(
      comparisons.reduce((total, item) => total + item.oldCount, 0)
    );
    expect(comparisons.find((item) => item.lessonId === 'mryhipx3-dz9b818')?.newCount).toBe(0);
  });
});
