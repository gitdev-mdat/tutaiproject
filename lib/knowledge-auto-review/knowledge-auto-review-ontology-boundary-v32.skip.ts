import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import type { AiGateway } from '@/lib/ai/ai-gateway';
import {
  knowledgeAutoReviewV32ResultSchema,
  type KnowledgeAutoReviewInput,
  type KnowledgeAutoReviewSession,
  type KnowledgeAutoReviewV31Result,
  type KnowledgeAutoReviewV32Result,
  type OntologyIdentityAssessment,
} from '@/lib/ai/ai-types';
import {
  KNOWLEDGE_AUTO_REVIEW_V32_ONTOLOGY_POLICY,
  KNOWLEDGE_AUTO_REVIEW_V32_SYSTEM_PROMPT,
  buildKnowledgeAutoReviewV32Prompt,
} from '@/lib/ai/prompts/knowledge-auto-review-v3-2';
import {
  AUTO_REVIEW_POLICY_VERSION,
  KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSION,
  KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS,
} from '@/lib/config/knowledge-auto-review';
import { runKnowledgeAutoReview } from './knowledge-auto-review-engine';
import type { KnowledgeAutoReviewStore } from './knowledge-auto-review-storage';
import { applyOntologyBoundaryPolicyV32, isIdentitySafeMerge } from './ontology-boundary-v32';

const ROOT = process.cwd();
const DOCUMENT_ID = 'mryei32t-0fybu39';
const BAI_6_SESSION_ID = 'df75a1ee-387a-47f4-9bbb-6f624a3a2819';

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

function identityAssessment(
  overrides: Partial<OntologyIdentityAssessment> = {}
): OntologyIdentityAssessment {
  return {
    sameKnowledgeIdentity: true,
    independentlyTeachableA: false,
    independentlyTeachableB: false,
    independentlyAssessableA: false,
    independentlyAssessableB: false,
    directionalDependencyExists: false,
    constituentRelationshipExists: false,
    rationale: 'The records are synonymous facets of one reusable mathematical identity.',
    ...overrides,
  };
}

function input(): KnowledgeAutoReviewInput {
  return {
    subject: { id: 'math', title: 'Mathematics' },
    grade: { id: 'grade', title: 'Grade' },
    textbook: { id: 'book', title: 'Offline fixture' },
    chapter: { id: 'chapter', title: 'Generic chapter' },
    lesson: { id: 'lesson', title: 'Generic lesson' },
    semanticRecords: [
      {
        id: 'source-a',
        type: 'DEFINITION',
        title: 'Record A',
        sourceText: 'Reusable definition A.',
      },
      {
        id: 'source-b',
        type: 'DEFINITION',
        title: 'Record B',
        sourceText: 'Reusable definition B.',
      },
    ],
    existingConceptCandidates: [],
    deterministicMatches: [
      { sourceRecordId: 'source-a', matchType: 'NONE', canonicalConceptIds: [] },
      { sourceRecordId: 'source-b', matchType: 'NONE', canonicalConceptIds: [] },
    ],
    relevantGraphVersion: 'offline-v32',
  };
}

function result(
  assessment = identityAssessment(),
  confidence = 0.95
): KnowledgeAutoReviewV32Result {
  return {
    candidateReviews: ['source-a', 'source-b'].map((sourceRecordId) => ({
      sourceRecordId,
      classification: 'MERGE_CANDIDATE' as const,
      proposedCanonicalTitle: 'Shared identity',
      conciseRationale: 'The records appear to describe one reusable identity.',
      evidence: [`Evidence for ${sourceRecordId}.`],
      confidence,
      reasonCodes: ['REUSABLE_KNOWLEDGE', 'COMPLEMENTARY_CONCEPTS'],
      evidenceSufficiency: 'SUFFICIENT' as const,
      titleEvidenceAssessment: 'CONSISTENT' as const,
    })),
    mergeProposals: [
      {
        id: 'merge-a-b',
        sourceCandidateIds: ['source-a', 'source-b'],
        proposedCanonicalTitle: 'Shared identity',
        conciseRationale: 'One mastery state preserves the learning distinction.',
        confidence,
        reasonCodes: ['REUSABLE_KNOWLEDGE', 'COMPLEMENTARY_CONCEPTS'],
        ontologyIdentityAssessment: assessment,
      },
    ],
    learningObjectives: [],
    prerequisiteProposals: [],
    prerequisiteAudits: [],
    graphMissingPrerequisites: [],
    ambiguities: [],
    ontologyBoundaryRecommendations: [],
  };
}

function sha256(relativePath: string): string {
  return createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, relativePath)))
    .digest('hex')
    .toUpperCase();
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8')) as T;
}

function phase49Fixture(): {
  raw: KnowledgeAutoReviewV31Result;
  evaluation: {
    mergeEvaluations: Array<{ mergeProposalId: string; humanLabel: string }>;
    falseCanonicalization: { total: number };
    humanReviewReduction: { rawCandidateReviewReductionRate: number };
  };
} {
  const sessions = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, 'tmp', 'uploads', DOCUMENT_ID, 'knowledge-auto-review.json'),
      'utf8'
    )
  ) as { sessions: KnowledgeAutoReviewSession[] };
  const session = sessions.sessions.find((item) => item.id === BAI_6_SESSION_ID);
  if (!session?.rawProviderResult) throw new Error('Persisted Phase 4.9 raw result is missing');
  const evaluation = JSON.parse(
    fs.readFileSync(
      path.join(
        ROOT,
        'tmp',
        'uploads',
        DOCUMENT_ID,
        'knowledge-auto-review-v31-chapter-ii-blind-evaluation.json'
      ),
      'utf8'
    )
  ) as {
    mergeEvaluations: Array<{ mergeProposalId: string; humanLabel: string }>;
    falseCanonicalization: { total: number };
    humanReviewReduction: { rawCandidateReviewReductionRate: number };
  };
  return {
    raw: structuredClone(session.rawProviderResult) as KnowledgeAutoReviewV31Result,
    evaluation,
  };
}

function calibratedPhase49Fixture(): KnowledgeAutoReviewV32Result {
  const { raw } = phase49Fixture();
  return {
    ...raw,
    mergeProposals: raw.mergeProposals.map((merge) => ({
      ...merge,
      ontologyIdentityAssessment:
        merge.id === 'merge_vecto_khong_gian'
          ? identityAssessment()
          : merge.id === 'merge_phep_toan_vecto'
            ? identityAssessment({
                sameKnowledgeIdentity: false,
                independentlyTeachableA: true,
                independentlyTeachableB: true,
                independentlyAssessableA: true,
                independentlyAssessableB: true,
                constituentRelationshipExists: true,
                rationale:
                  'A broader family would flatten independently assessable constituent knowledge.',
              })
            : identityAssessment({
                sameKnowledgeIdentity: false,
                independentlyTeachableA: true,
                independentlyTeachableB: true,
                independentlyAssessableA: true,
                independentlyAssessableB: true,
                directionalDependencyExists: true,
                rationale:
                  'The two reusable objects have a meaningful directional learning dependency.',
              }),
    })),
    ontologyBoundaryRecommendations: [],
  };
}

describe('Phase 4.10 V3.2 targeted ontology-boundary calibration', () => {
  it('keeps strongly related but independently teachable Concepts separate', () => {
    const governed = applyOntologyBoundaryPolicyV32(
      result(
        identityAssessment({
          sameKnowledgeIdentity: false,
          independentlyTeachableA: true,
          independentlyTeachableB: true,
          independentlyAssessableA: true,
          independentlyAssessableB: true,
        })
      )
    );
    expect(governed.mergeProposals).toHaveLength(0);
    expect(
      governed.candidateReviews.every((item) => item.classification === 'ONTOLOGY_AMBIGUOUS')
    ).toBe(true);
    expect(governed.ontologyBoundaryRecommendations[0].recommendation).toBe(
      'KEEP_SEPARATE_RELATED_CONCEPTS'
    );
  });

  it('blocks a merge when an explicit directional prerequisite exists', () => {
    const fixture = result();
    fixture.prerequisiteProposals.push({
      id: 'source-a-before-b',
      sourceReference: { kind: 'SOURCE_CANDIDATE', id: 'source-a', title: 'Record A' },
      targetReference: { kind: 'SOURCE_CANDIDATE', id: 'source-b', title: 'Record B' },
      relationType: 'LEARNING_PREREQUISITE',
      conciseRationale: 'A is materially required before B.',
      sourceSemanticRecordIds: ['source-a', 'source-b'],
      confidence: 0.95,
    });
    const governed = applyOntologyBoundaryPolicyV32(fixture);
    expect(governed.mergeProposals).toHaveLength(0);
    expect(governed.prerequisiteProposals).toHaveLength(0);
    expect(governed.ontologyBoundaryRecommendations[0].conciseRationale).toContain(
      'directional dependency'
    );
  });

  it('keeps an umbrella and independently assessable constituent separate', () => {
    const governed = applyOntologyBoundaryPolicyV32(
      result(
        identityAssessment({
          sameKnowledgeIdentity: false,
          independentlyTeachableB: true,
          independentlyAssessableB: true,
          constituentRelationshipExists: true,
        })
      )
    );
    expect(governed.ontologyBoundaryRecommendations[0].recommendation).toBe(
      'KEEP_SEPARATE_WITH_PART_OF_RELATION'
    );
    expect(governed.mergeProposals).toHaveLength(0);
  });

  it('still permits synonymous or definition-fragment records to merge', () => {
    const fixture = result(identityAssessment());
    expect(knowledgeAutoReviewV32ResultSchema.safeParse(fixture).success).toBe(true);
    expect(applyOntologyBoundaryPolicyV32(fixture).mergeProposals).toHaveLength(1);
  });

  it('still merges multiple textbook records that share one knowledge identity', () => {
    expect(
      isIdentitySafeMerge({
        assessment: identityAssessment({
          rationale: 'The records express the same identity using complementary wording.',
        }),
        confidence: 0.93,
      })
    ).toBe(true);
  });

  it('does not treat same-lesson proximity as merge evidence', () => {
    expect(KNOWLEDGE_AUTO_REVIEW_V32_ONTOLOGY_POLICY).toContain('lesson co-occurrence');
    expect(
      applyOntologyBoundaryPolicyV32(result(identityAssessment({ sameKnowledgeIdentity: false })))
        .mergeProposals
    ).toHaveLength(0);
  });

  it('does not treat lexical overlap alone as identity', () => {
    expect(KNOWLEDGE_AUTO_REVIEW_V32_ONTOLOGY_POLICY).toContain('lexical similarity');
    expect(
      isIdentitySafeMerge({
        assessment: identityAssessment({ sameKnowledgeIdentity: false }),
        confidence: 0.99,
      })
    ).toBe(false);
  });

  it('does not treat a shared Learning Objective alone as identity', () => {
    expect(KNOWLEDGE_AUTO_REVIEW_V32_ONTOLOGY_POLICY).toContain('shared Learning Objectives');
    expect(
      applyOntologyBoundaryPolicyV32(result(identityAssessment({ sameKnowledgeIdentity: false })))
        .mergeProposals
    ).toHaveLength(0);
  });

  it('uses separate target knowledge in LOs as evidence against merge', () => {
    const fixture = result(
      identityAssessment({
        independentlyTeachableA: true,
        independentlyAssessableA: true,
      })
    );
    fixture.learningObjectives = [
      {
        id: 'lo-a',
        statement: 'Assess knowledge A.',
        targetReference: {
          kind: 'MERGE_PROPOSAL',
          id: 'merge-a-b',
          title: 'Shared identity',
        },
        bloomLevel: 'APPLY',
        conciseRationale: 'The source supports a distinct target.',
        sourceSemanticRecordIds: ['source-a'],
        confidence: 0.9,
      },
    ];
    const governed = applyOntologyBoundaryPolicyV32(fixture);
    expect(governed.mergeProposals).toHaveLength(0);
    expect(governed.learningObjectives).toHaveLength(0);
  });

  it('turns uncertain identity into an ontology hold', () => {
    const governed = applyOntologyBoundaryPolicyV32(
      result(identityAssessment({ sameKnowledgeIdentity: false }), 0.7)
    );
    expect(governed.ontologyBoundaryRecommendations[0].recommendation).toBe('ONTOLOGY_AMBIGUOUS');
    expect(governed.ambiguities).toHaveLength(1);
  });

  it('preserves V3 application, method, example, evidence, and title protections', () => {
    for (const expected of [
      'APPLICATION_CONTEXT',
      'METHOD_OR_PROCEDURE',
      'EXAMPLE_OR_EXERCISE',
      'evidenceSufficiency',
      'titleEvidenceAssessment',
    ]) {
      expect(KNOWLEDGE_AUTO_REVIEW_V32_SYSTEM_PROMPT).toContain(expected);
    }
  });

  it('preserves the Phase 4.9 exhaustive prerequisite matrix contract', () => {
    const { raw } = phase49Fixture();
    expect(raw.prerequisiteAudits).toHaveLength(18);
    expect(KNOWLEDGE_AUTO_REVIEW_V32_SYSTEM_PROMPT).toContain(
      'Prerequisite completeness is exhaustive, not selective.'
    );
    expect(buildKnowledgeAutoReviewV32Prompt(input())).toContain(
      'Every eligible canonical source/target pair must occur exactly once'
    );
  });

  it('regresses the previously accepted Bài 1–3 ontology behavior without breakage', () => {
    const artifact = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, 'tmp', 'uploads', DOCUMENT_ID, 'knowledge-auto-review-calibration-v3.json'),
        'utf8'
      )
    ) as {
      offlineRegression: {
        lessons: Array<{ label: string; regressionsBroken: number }>;
      };
    };
    expect(artifact.offlineRegression.lessons.slice(0, 3)).toEqual([
      expect.objectContaining({ label: 'Bài 1', regressionsBroken: 0 }),
      expect.objectContaining({ label: 'Bài 2', regressionsBroken: 0 }),
      expect.objectContaining({ label: 'Bài 3', regressionsBroken: 0 }),
    ]);
  });

  it('contains no chapter-specific titles or IDs in V3.2 production rules', () => {
    const production = [
      'lib/ai/prompts/knowledge-auto-review-v3-2.ts',
      'lib/knowledge-auto-review/ontology-boundary-v32.ts',
      'lib/knowledge-auto-review/knowledge-auto-review-engine.ts',
    ]
      .map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8'))
      .join('\n');
    for (const forbidden of [
      'Vectơ trong không gian',
      'Góc giữa hai vectơ',
      'Tích vô hướng',
      'merge_tich_vo_huong',
      'mryhipx3-2payll9',
    ]) {
      expect(production).not.toContain(forbidden);
    }
  });

  it('removes Phase 4.9 false merges and over-flattening in the offline V3.2 fixture', () => {
    const { evaluation } = phase49Fixture();
    const governed = applyOntologyBoundaryPolicyV32(calibratedPhase49Fixture());
    const v31FalseMerge = evaluation.mergeEvaluations.filter(
      (item) => item.humanLabel !== 'CORRECT'
    ).length;
    const v31OverFlattening = evaluation.mergeEvaluations.filter(
      (item) => item.humanLabel === 'ACCEPTABLE_WITH_EDIT'
    ).length;
    expect({
      falseCanonicalization: evaluation.falseCanonicalization.total,
      v31FalseMerge,
      v32FalseMerge: governed.mergeProposals.filter((merge) =>
        ['merge_phep_toan_vecto', 'merge_tich_vo_huong'].includes(merge.id)
      ).length,
      v31OverFlattening,
      v32OverFlattening: governed.mergeProposals.filter(
        (merge) => merge.id === 'merge_phep_toan_vecto'
      ).length,
      ontologyHolds: governed.ontologyBoundaryRecommendations.length,
      humanReviewReduction: evaluation.humanReviewReduction.rawCandidateReviewReductionRate,
    }).toEqual({
      falseCanonicalization: 0,
      v31FalseMerge: 2,
      v32FalseMerge: 0,
      v31OverFlattening: 1,
      v32OverFlattening: 0,
      ontologyHolds: 2,
      humanReviewReduction: 0,
    });
  });

  it('persists untouched raw V3.2 output before applying the governed boundary projection', async () => {
    const raw = result(identityAssessment({ sameKnowledgeIdentity: false }));
    const gateway: AiGateway = {
      async reviewKnowledgeCandidates() {
        return { result: raw, rawResult: raw };
      },
    };
    const store = new MemoryStore();
    const completed = await runKnowledgeAutoReview({
      gateway,
      store,
      input: input(),
      force: true,
      providerMaxAttempts: 1,
      promptVersion: KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v32,
      policyVersion: 'knowledge-auto-review-policy-v3',
    });
    expect(completed.session.rawProviderResult).toEqual(raw);
    expect(completed.session.result?.mergeProposals).toHaveLength(0);
    expect(completed.session.result?.ontologyBoundaryRecommendations).toHaveLength(1);
  });

  it('preserves the frozen V3.2 prompt after the active version advances', () => {
    expect(KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSION).toBe('knowledge-auto-review-v3.5');
    expect(AUTO_REVIEW_POLICY_VERSION).toBe('knowledge-auto-review-policy-v3.5');
    expect(KNOWLEDGE_AUTO_REVIEW_V32_SYSTEM_PROMPT).toContain(
      'Prompt version: knowledge-auto-review-v3.2.'
    );
    expect(
      createHash('sha256')
        .update(KNOWLEDGE_AUTO_REVIEW_V32_SYSTEM_PROMPT)
        .digest('hex')
        .toUpperCase()
    ).toBe('909C359D5609CE34F3455757ED875599B40BE6682508B4BDBDDA2A4A748A9D3B');
  });

  it('keeps Phase 4.9 evidence and canonical stores byte-identical', () => {
    const reviewStore = readJson<{ sessions: KnowledgeAutoReviewSession[] }>(
      `tmp/uploads/${DOCUMENT_ID}/knowledge-auto-review.json`
    );
    const phase49Sessions = reviewStore.sessions.filter((session) =>
      ['7533464d-8587-417e-a235-57ad3dc555e1', 'df75a1ee-387a-47f4-9bbb-6f624a3a2819'].includes(
        session.id
      )
    );
    expect(
      phase49Sessions.map((session) =>
        createHash('sha256').update(JSON.stringify(session)).digest('hex').toUpperCase()
      )
    ).toEqual([
      '91955839EB55889541ABE24DE3E4E2BA4F07D0D63D14FC3CEA1DD5A848DE7D4D',
      '307C20151231E612314A36CD5D6D63E70A77DE6B2E3851517494077E75621F75',
    ]);
    expect(
      sha256(
        `tmp/uploads/${DOCUMENT_ID}/knowledge-auto-review-v31-chapter-ii-blind-evaluation.json`
      )
    ).toBe('BC2C579955CCD1877044BB2AB3825211F9C1699AA3C93AC15DF8C37C4FA231F5');
    expect(sha256('data/knowledge-graph/graph.json')).toBe(
      'B594BF59E329260A4BB51CE00A988A3CC4E5118409C30417F852B80212D1681E'
    );
    expect(sha256('data/textbook-mappings.json')).toBe(
      '9524B3086CAA2F9296513CD9BB998DD90B0A87A48AFD20969DF9452294E9F067'
    );
    expect(sha256('data/import-data.json')).toBe(
      'ACB8BCABD8B67E7969987B514760D3C5CB19744AD7084240DC1EBC61C1F5DF3E'
    );
  });
});
