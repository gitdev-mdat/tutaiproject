import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AiGateway } from '@/lib/ai/ai-gateway';
import {
  knowledgeAutoReviewV31ResultSchema,
  knowledgeAutoReviewV32ResultSchema,
  knowledgeAutoReviewV33ResultSchema,
  knowledgeAutoReviewV34ResultSchema,
  knowledgeAutoReviewV35ResultSchema,
  withinRecordAssessmentV35Schema,
  type KnowledgeAutoReviewInput,
  type KnowledgeAutoReviewSession,
  type KnowledgeAutoReviewV35Result,
  type ProposedConstituentV35,
} from '@/lib/ai/ai-types';
import {
  KNOWLEDGE_AUTO_REVIEW_V35_JSON_SCHEMA,
  KNOWLEDGE_AUTO_REVIEW_V35_SYSTEM_PROMPT,
} from '@/lib/ai/prompts/knowledge-auto-review-v3-5';
import {
  AUTO_REVIEW_POLICY_VERSION,
  KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSION,
  KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS,
} from '@/lib/config/knowledge-auto-review';
import { KnowledgeAutoReviewPanel } from '@/components/admin/textbooks/knowledge-auto-review-panel';
import {
  applyNormalizedConstituentPolicyV35,
  validateNormalizedConstituentContractV35,
} from './normalized-constituent-v35';
import { runKnowledgeAutoReview } from './knowledge-auto-review-engine';
import type { KnowledgeAutoReviewStore } from './knowledge-auto-review-storage';
import { GOVERNED_BAI_8_SESSION_LINEAGE } from './governed-session-lineage.test-fixture';

const DOCUMENT_ID = 'mryei32t-0fybu39';
const FAILED_V33_SESSION_ID = 'b79db7c4-01c9-41b1-a97f-4806f03c620c';
const FAILED_V34_SESSION_ID = '169668a4-fac1-4b3d-89db-4286751b4543';
const COMPLETED_V35_SESSION_ID = '58fb0235-0f34-481c-98dd-a123f3ad6a03';
const FAILED_V33_SHA256 = 'F8E2CAA90C75CF22AB9A803A5958031A65248C5C6EC9E15129CEF60111587275';
const FAILED_V34_SHA256 = '902B51916A453436DEBCCB0AD6AE4ED35748FB5C68CDCCCAEE26B42BF8D67339';
const SOURCE_IDS = ['source-a', 'source-b', 'source-c'] as const;

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

function input(includeCanonical = false): KnowledgeAutoReviewInput {
  return {
    subject: { id: 'subject', title: 'Subject' },
    grade: { id: 'grade', title: 'Grade' },
    textbook: { id: 'textbook', title: 'Textbook' },
    chapter: { id: 'chapter', title: 'Generic chapter' },
    lesson: { id: 'lesson', title: 'Generic lesson' },
    semanticRecords: SOURCE_IDS.map((id) => ({
      id,
      type: 'CONCEPT_CANDIDATE',
      title: `Source ${id}`,
      sourceText: `Direct structural evidence for ${id}.`,
    })),
    existingConceptCandidates: includeCanonical
      ? [{ id: 'canonical-x', title: 'Canonical X', aliases: [], domainId: 'domain' }]
      : [],
    deterministicMatches: SOURCE_IDS.map((sourceRecordId) => ({
      sourceRecordId,
      matchType: 'NONE' as const,
      canonicalConceptIds: [],
    })),
    retrievalTrace: {
      version: 'knowledge-retrieval-v3.3',
      maxTopK: 12,
      minimumRelevanceScore: 1.75,
      eligibleCandidateCount: includeCanonical ? 1 : 0,
      selectedCount: includeCanonical ? 1 : 0,
      entries: [],
    },
    relevantGraphVersion: 'v35-contract-fixture',
  };
}

function constituent(ref: string, title = `Proposed ${ref}`): ProposedConstituentV35 {
  return {
    temporaryRef: ref,
    proposedTitle: title,
    rationale: `${ref} has an independent governed identity.`,
    independentlyTeachable: true,
    independentlyAssessable: true,
    reusableAcrossProblems: true,
    evidenceSpan: `Direct evidence for ${ref}.`,
    confidence: 0.95,
  };
}

function identityAssessment() {
  return {
    sameKnowledgeIdentity: false,
    independentlyTeachableA: true,
    independentlyTeachableB: true,
    independentlyAssessableA: true,
    independentlyAssessableB: true,
    directionalDependencyExists: false,
    constituentRelationshipExists: false,
    rationale: 'The two governed objects retain distinct identities.',
  };
}

function result(): KnowledgeAutoReviewV35Result {
  return {
    candidateReviews: SOURCE_IDS.map((sourceRecordId) => ({
      sourceRecordId,
      classification: 'NEW_CONCEPT' as const,
      proposedCanonicalTitle: `Source ${sourceRecordId}`,
      conciseRationale: 'The source contains reusable knowledge.',
      evidence: [`Direct structural evidence for ${sourceRecordId}.`],
      confidence: 0.95,
      reasonCodes: ['REUSABLE_KNOWLEDGE' as const],
      evidenceSufficiency: 'SUFFICIENT' as const,
      titleEvidenceAssessment: 'CONSISTENT' as const,
    })),
    mergeProposals: [],
    learningObjectives: [
      {
        id: 'lo-a',
        statement: 'Demonstrate the first proposed capability.',
        targetReference: {
          kind: 'CONSTITUENT_PROPOSAL',
          id: 'temp-a1',
          title: 'Provider label is not authoritative',
        },
        bloomLevel: 'APPLY',
        conciseRationale: 'The capability is independently observable.',
        sourceSemanticRecordIds: ['source-a'],
        confidence: 0.94,
      },
    ],
    prerequisiteProposals: [
      {
        id: 'prerequisite-a',
        sourceReference: {
          kind: 'CONSTITUENT_PROPOSAL',
          id: 'temp-a1',
          title: 'Provider source label',
        },
        targetReference: {
          kind: 'CONSTITUENT_PROPOSAL',
          id: 'temp-a2',
          title: 'Provider target label',
        },
        relationType: 'LEARNING_PREREQUISITE',
        conciseRationale: 'The first governed capability supports the second.',
        sourceSemanticRecordIds: ['source-a'],
        confidence: 0.91,
      },
    ],
    prerequisiteAudits: [],
    graphMissingPrerequisites: [],
    ambiguities: [],
    ontologyBoundaryRecommendations: [
      {
        id: 'boundary-a',
        members: [
          { kind: 'CONSTITUENT_PROPOSAL', temporaryRef: 'temp-a1' },
          { kind: 'CONSTITUENT_PROPOSAL', temporaryRef: 'temp-a2' },
        ],
        recommendation: 'KEEP_SEPARATE_RELATED_CONCEPTS',
        ontologyIdentityAssessment: identityAssessment(),
        conciseRationale: 'The two authoritative constituents remain separate.',
        confidence: 0.94,
      },
    ],
    withinRecordAssessments: [
      {
        sourceRecordId: 'source-a',
        containsMultipleKnowledgeObjects: true,
        recommendedAction: 'PROPOSE_CONSTITUENT_SPLIT',
        constituentSplitProposalRef: 'split-a',
        rationale: 'The source contains two independently governed objects.',
      },
      {
        sourceRecordId: 'source-b',
        containsMultipleKnowledgeObjects: false,
        recommendedAction: 'KEEP_AS_SINGLE_CONCEPT',
        rationale: 'The source remains one object.',
      },
      {
        sourceRecordId: 'source-c',
        containsMultipleKnowledgeObjects: true,
        recommendedAction: 'ONTOLOGY_AMBIGUOUS',
        rationale: 'The source boundary remains uncertain.',
      },
    ],
    constituentSplitProposals: [
      {
        id: 'split-a',
        sourceRecordId: 'source-a',
        proposedConstituents: [constituent('temp-a1'), constituent('temp-a2')],
        rationale: 'The source has two authoritative proposed constituents.',
        confidence: 0.95,
      },
    ],
  };
}

function addSecondSplit(raw: KnowledgeAutoReviewV35Result): void {
  raw.withinRecordAssessments[1] = {
    sourceRecordId: 'source-b',
    containsMultipleKnowledgeObjects: true,
    recommendedAction: 'PROPOSE_CONSTITUENT_SPLIT',
    constituentSplitProposalRef: 'split-b',
    rationale: 'The second source contains two governed objects.',
  };
  raw.constituentSplitProposals.push({
    id: 'split-b',
    sourceRecordId: 'source-b',
    proposedConstituents: [constituent('temp-b1'), constituent('temp-b2')],
    rationale: 'The second source has two authoritative proposed constituents.',
    confidence: 0.95,
  });
}

function validate(raw: KnowledgeAutoReviewV35Result, reviewInput = input()) {
  expect(knowledgeAutoReviewV35ResultSchema.safeParse(raw).success).toBe(true);
  return validateNormalizedConstituentContractV35(raw, reviewInput);
}

function sessionStore() {
  return JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), 'tmp/uploads', DOCUMENT_ID, 'knowledge-auto-review.json'),
      'utf8'
    )
  ) as { sessions: KnowledgeAutoReviewSession[] };
}

function sha256Json(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').toUpperCase();
}

describe('Knowledge Auto-Review V3.5 normalized constituent contract', () => {
  it('selects explicit V3.5 prompt/policy versions and a strong provider schema', () => {
    expect(KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSION).toBe('knowledge-auto-review-v3.5');
    expect(AUTO_REVIEW_POLICY_VERSION).toBe('knowledge-auto-review-policy-v3.5');
    expect(KNOWLEDGE_AUTO_REVIEW_V35_SYSTEM_PROMPT).toContain(
      'Prompt version: knowledge-auto-review-v3.5.'
    );
    expect(KNOWLEDGE_AUTO_REVIEW_V35_SYSTEM_PROMPT).toContain(
      'only authoritative location for full'
    );
    expect(KNOWLEDGE_AUTO_REVIEW_V35_SYSTEM_PROMPT).toContain('V3.5 generic structural examples');
    expect(KNOWLEDGE_AUTO_REVIEW_V35_SYSTEM_PROMPT).not.toContain('monotonicity');
    expect(
      KNOWLEDGE_AUTO_REVIEW_V35_JSON_SCHEMA.properties.withinRecordAssessments.items.oneOf
    ).toHaveLength(3);
    expect(
      KNOWLEDGE_AUTO_REVIEW_V35_JSON_SCHEMA.properties.constituentSplitProposals.items.properties
        .proposedConstituents.minItems
    ).toBe(2);
  });

  describe('assessment schema', () => {
    it('accepts each governed action variant', () => {
      for (const assessment of result().withinRecordAssessments) {
        expect(withinRecordAssessmentV35Schema.safeParse(assessment).success).toBe(true);
      }
    });

    it.each([
      [
        'KEEP with proposal ref',
        {
          sourceRecordId: 'source-a',
          containsMultipleKnowledgeObjects: false,
          recommendedAction: 'KEEP_AS_SINGLE_CONCEPT',
          constituentSplitProposalRef: 'split-a',
          rationale: 'Invalid cross-variant field.',
        },
      ],
      [
        'split with false discriminator',
        {
          sourceRecordId: 'source-a',
          containsMultipleKnowledgeObjects: false,
          recommendedAction: 'PROPOSE_CONSTITUENT_SPLIT',
          constituentSplitProposalRef: 'split-a',
          rationale: 'Invalid discriminator.',
        },
      ],
      [
        'split without proposal ref',
        {
          sourceRecordId: 'source-a',
          containsMultipleKnowledgeObjects: true,
          recommendedAction: 'PROPOSE_CONSTITUENT_SPLIT',
          rationale: 'Missing reference.',
        },
      ],
      [
        'split with duplicate declarations',
        {
          sourceRecordId: 'source-a',
          containsMultipleKnowledgeObjects: true,
          recommendedAction: 'PROPOSE_CONSTITUENT_SPLIT',
          constituentSplitProposalRef: 'split-a',
          constituents: [constituent('temp-a1'), constituent('temp-a2')],
          rationale: 'Declarations are forbidden here.',
        },
      ],
      [
        'ambiguous with proposal ref',
        {
          sourceRecordId: 'source-a',
          containsMultipleKnowledgeObjects: true,
          recommendedAction: 'ONTOLOGY_AMBIGUOUS',
          constituentSplitProposalRef: 'split-a',
          rationale: 'Invalid cross-variant field.',
        },
      ],
    ])('rejects %s', (_label, assessment) => {
      expect(withinRecordAssessmentV35Schema.safeParse(assessment).success).toBe(false);
    });
  });

  describe('proposal ownership and identity', () => {
    it('accepts valid one-to-one ownership', () => {
      expect(validate(result()).size).toBe(2);
    });

    it.each([
      [
        'V35_MISSING_SPLIT_PROPOSAL',
        (raw: KnowledgeAutoReviewV35Result) => {
          raw.withinRecordAssessments[0] = {
            ...raw.withinRecordAssessments[0],
            constituentSplitProposalRef: 'missing-split',
          } as KnowledgeAutoReviewV35Result['withinRecordAssessments'][number];
        },
      ],
      [
        'V35_ASSESSMENT_PROPOSAL_SOURCE_MISMATCH',
        (raw: KnowledgeAutoReviewV35Result) => {
          raw.constituentSplitProposals[0].sourceRecordId = 'source-b';
        },
      ],
      [
        'V35_ORPHAN_SPLIT_PROPOSAL',
        (raw: KnowledgeAutoReviewV35Result) => {
          raw.withinRecordAssessments[0] = {
            sourceRecordId: 'source-a',
            containsMultipleKnowledgeObjects: false,
            recommendedAction: 'KEEP_AS_SINGLE_CONCEPT',
            rationale: 'No split is requested.',
          };
        },
      ],
      [
        'V35_DUPLICATE_PROPOSAL_ID',
        (raw: KnowledgeAutoReviewV35Result) => {
          addSecondSplit(raw);
          raw.constituentSplitProposals[1].id = 'split-a';
        },
      ],
      [
        'V35_MULTIPLE_PROPOSALS_FOR_SOURCE',
        (raw: KnowledgeAutoReviewV35Result) => {
          raw.constituentSplitProposals.push({
            id: 'split-a-second',
            sourceRecordId: 'source-a',
            proposedConstituents: [constituent('temp-x1'), constituent('temp-x2')],
            rationale: 'Invalid second proposal.',
            confidence: 0.9,
          });
        },
      ],
      [
        'V35_PROPOSAL_REFERENCED_BY_MULTIPLE_ASSESSMENTS',
        (raw: KnowledgeAutoReviewV35Result) => {
          raw.withinRecordAssessments[1] = {
            sourceRecordId: 'source-b',
            containsMultipleKnowledgeObjects: true,
            recommendedAction: 'PROPOSE_CONSTITUENT_SPLIT',
            constituentSplitProposalRef: 'split-a',
            rationale: 'Invalid shared ownership.',
          };
        },
      ],
    ] as const)('rejects %s with a stable governed category', (code, mutate) => {
      const raw = result();
      mutate(raw);
      expect(() => validateNormalizedConstituentContractV35(raw, input())).toThrow(code);
    });

    it('rejects fewer than two constituents in Zod', () => {
      const raw = result() as unknown as {
        constituentSplitProposals: Array<{ proposedConstituents: ProposedConstituentV35[] }>;
      };
      raw.constituentSplitProposals[0].proposedConstituents = [constituent('only-one')];
      expect(knowledgeAutoReviewV35ResultSchema.safeParse(raw).success).toBe(false);
    });

    it.each([
      [
        'within one proposal',
        (raw: KnowledgeAutoReviewV35Result) => {
          raw.constituentSplitProposals[0].proposedConstituents[1].temporaryRef = 'temp-a1';
        },
      ],
      [
        'across proposals',
        (raw: KnowledgeAutoReviewV35Result) => {
          addSecondSplit(raw);
          raw.constituentSplitProposals[1].proposedConstituents[0].temporaryRef = 'temp-a1';
        },
      ],
    ])('rejects duplicate temporary refs %s', (_label, mutate) => {
      const raw = result();
      mutate(raw);
      expect(() => validateNormalizedConstituentContractV35(raw, input())).toThrow(
        'V35_DUPLICATE_TEMPORARY_REF'
      );
    });

    it.each([
      ['canonical-x', true, 'canonical Concept ID'],
      ['source-b', false, 'source candidate ID'],
      ['split-a', false, 'split proposal ID'],
      ['boundary-a', false, 'recommendation ID'],
    ] as const)('rejects temporary ref collision %s', (ref, includeCanonical, namespace) => {
      const raw = result();
      raw.constituentSplitProposals[0].proposedConstituents[0].temporaryRef = ref;
      raw.ontologyBoundaryRecommendations[0].members[0] = {
        kind: 'CONSTITUENT_PROPOSAL',
        temporaryRef: ref,
      };
      expect(() => validateNormalizedConstituentContractV35(raw, input(includeCanonical))).toThrow(
        namespace
      );
    });

    it('preserves temporary refs unchanged through policy projection', () => {
      const raw = result();
      const before = raw.constituentSplitProposals[0].proposedConstituents.map(
        (item) => item.temporaryRef
      );
      const governed = applyNormalizedConstituentPolicyV35(raw, input());
      expect(
        governed.constituentSplitProposals[0].proposedConstituents.map((item) => item.temporaryRef)
      ).toEqual(before);
      expect(JSON.stringify(governed)).not.toContain('canonicalId');
    });
  });

  describe('downstream and boundary resolution', () => {
    it('resolves LO, prerequisite source/target, audit, and boundary refs from proposal symbols', () => {
      const raw = result();
      raw.prerequisiteAudits.push({
        sourceConceptRef: { kind: 'EXISTING_CONCEPT', id: 'canonical-x', title: 'Canonical X' },
        targetConceptRef: {
          kind: 'CONSTITUENT_PROPOSAL',
          id: 'temp-a2',
          title: 'Non-authoritative label',
        },
        classification: 'SUPPORTING_KNOWLEDGE',
        rationale: 'Generic audit evidence.',
      });
      expect(validate(raw, input(true)).size).toBe(2);
    });

    it.each([
      [
        'learningObjectives[0].targetReference.id',
        (raw: KnowledgeAutoReviewV35Result) => {
          raw.learningObjectives[0].targetReference.id = 'undeclared';
        },
      ],
      [
        'prerequisiteProposals[0].sourceReference.id',
        (raw: KnowledgeAutoReviewV35Result) => {
          raw.prerequisiteProposals[0].sourceReference.id = 'undeclared';
        },
      ],
      [
        'prerequisiteProposals[0].targetReference.id',
        (raw: KnowledgeAutoReviewV35Result) => {
          raw.prerequisiteProposals[0].targetReference.id = 'undeclared';
        },
      ],
      [
        'ontologyBoundaryRecommendations[0].members[0].temporaryRef',
        (raw: KnowledgeAutoReviewV35Result) => {
          raw.ontologyBoundaryRecommendations[0].members[0] = {
            kind: 'CONSTITUENT_PROPOSAL',
            temporaryRef: 'undeclared',
          };
        },
      ],
    ] as const)('reports exact undeclared path %s', (expectedPath, mutate) => {
      const raw = result();
      mutate(raw);
      expect(() => validateNormalizedConstituentContractV35(raw, input())).toThrow(expectedPath);
    });

    it('fails the rejected split gate at the primary capability path', () => {
      const raw = result();
      raw.constituentSplitProposals[0].proposedConstituents[0].independentlyAssessable = false;
      expect(() => applyNormalizedConstituentPolicyV35(raw, input())).toThrow(
        'constituentSplitProposals[0].proposedConstituents[0].independentlyAssessable'
      );
    });

    it.each([
      [
        'two source candidates',
        [
          { kind: 'SOURCE_CANDIDATE', sourceCandidateId: 'source-a' },
          { kind: 'SOURCE_CANDIDATE', sourceCandidateId: 'source-b' },
        ],
      ],
      [
        'two constituents of one source',
        [
          { kind: 'CONSTITUENT_PROPOSAL', temporaryRef: 'temp-a1' },
          { kind: 'CONSTITUENT_PROPOSAL', temporaryRef: 'temp-a2' },
        ],
      ],
    ] as const)('accepts boundary members: %s', (_label, members) => {
      const raw = result();
      raw.ontologyBoundaryRecommendations[0].members = [
        structuredClone(members[0]),
        structuredClone(members[1]),
      ];
      validate(raw);
    });

    it('accepts constituents of different sources', () => {
      const raw = result();
      addSecondSplit(raw);
      raw.ontologyBoundaryRecommendations[0].members = [
        { kind: 'CONSTITUENT_PROPOSAL', temporaryRef: 'temp-a1' },
        { kind: 'CONSTITUENT_PROPOSAL', temporaryRef: 'temp-b1' },
      ];
      validate(raw);
    });

    it('rejects source-to-own-constituent, duplicate unordered pairs, and duplicate IDs', () => {
      const sourcePair = result();
      sourcePair.ontologyBoundaryRecommendations[0].members = [
        { kind: 'SOURCE_CANDIDATE', sourceCandidateId: 'source-a' },
        { kind: 'CONSTITUENT_PROPOSAL', temporaryRef: 'temp-a1' },
      ];
      expect(() => validateNormalizedConstituentContractV35(sourcePair, input())).toThrow(
        'V35_SOURCE_TO_OWN_CONSTITUENT_PAIR'
      );

      const duplicatePair = result();
      duplicatePair.ontologyBoundaryRecommendations.push({
        ...structuredClone(duplicatePair.ontologyBoundaryRecommendations[0]),
        id: 'boundary-b',
        members: [
          { kind: 'CONSTITUENT_PROPOSAL', temporaryRef: 'temp-a2' },
          { kind: 'CONSTITUENT_PROPOSAL', temporaryRef: 'temp-a1' },
        ],
      });
      expect(() => validateNormalizedConstituentContractV35(duplicatePair, input())).toThrow(
        'V35_DUPLICATE_UNORDERED_BOUNDARY_PAIR'
      );

      duplicatePair.ontologyBoundaryRecommendations[1].members = [
        { kind: 'SOURCE_CANDIDATE', sourceCandidateId: 'source-a' },
        { kind: 'SOURCE_CANDIDATE', sourceCandidateId: 'source-b' },
      ];
      duplicatePair.ontologyBoundaryRecommendations[1].id = 'boundary-a';
      expect(() => validateNormalizedConstituentContractV35(duplicatePair, input())).toThrow(
        'V35_DUPLICATE_RECOMMENDATION_ID'
      );
    });

    it('rejects canonical and bare-string boundary members at schema/runtime boundaries', () => {
      const canonical = result();
      canonical.ontologyBoundaryRecommendations[0].members = [
        { kind: 'SOURCE_CANDIDATE', sourceCandidateId: 'canonical-x' },
        { kind: 'SOURCE_CANDIDATE', sourceCandidateId: 'source-b' },
      ];
      expect(() => validateNormalizedConstituentContractV35(canonical, input(true))).toThrow(
        'V35_INVALID_BOUNDARY_SOURCE_REFERENCE'
      );
      const bare = result() as unknown as {
        ontologyBoundaryRecommendations: Array<{ members: unknown }>;
      };
      bare.ontologyBoundaryRecommendations[0].members = ['temp-a1', 'temp-a2'];
      expect(knowledgeAutoReviewV35ResultSchema.safeParse(bare).success).toBe(false);
    });

    it('is independent of top-level and array order', () => {
      const raw = result();
      raw.withinRecordAssessments.reverse();
      raw.constituentSplitProposals.reverse();
      raw.learningObjectives.reverse();
      const reordered = Object.fromEntries(Object.entries(raw).reverse());
      validate(knowledgeAutoReviewV35ResultSchema.parse(reordered));
    });
  });

  it('dispatches a current run through V3.5 without a real provider request', async () => {
    const raw = result();
    let selectedPromptVersion: string | undefined;
    const gateway: AiGateway = {
      async reviewKnowledgeCandidates(_reviewInput, options) {
        selectedPromptVersion = options?.promptVersion;
        return { result: raw, rawResult: raw };
      },
    };
    const completed = await runKnowledgeAutoReview({
      gateway,
      store: new MemoryStore(),
      input: input(),
      idFactory: () => 'memory-only-v35-session',
      providerMaxAttempts: 1,
    });
    expect(selectedPromptVersion).toBe(KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v35);
    expect(completed.session).toMatchObject({
      status: 'COMPLETED',
      promptVersion: 'knowledge-auto-review-v3.5',
      policyVersion: 'knowledge-auto-review-policy-v3.5',
    });
    expect(completed.session.rawProviderResult).toEqual(raw);
  });

  it('preserves explicit V3.1-V3.4 schemas and refuses to reinterpret V3.4 as V3.5', () => {
    const v35 = result();
    const proposal = v35.constituentSplitProposals[0];
    const v34 = {
      ...v35,
      withinRecordAssessments: v35.withinRecordAssessments.map((assessment) =>
        assessment.recommendedAction === 'PROPOSE_CONSTITUENT_SPLIT'
          ? {
              sourceRecordId: assessment.sourceRecordId,
              containsMultipleKnowledgeObjects: true,
              recommendedAction: assessment.recommendedAction,
              constituents: structuredClone(proposal.proposedConstituents),
              rationale: assessment.rationale,
            }
          : assessment
      ),
    };
    expect(knowledgeAutoReviewV34ResultSchema.safeParse(v34).success).toBe(true);
    expect(knowledgeAutoReviewV35ResultSchema.safeParse(v34).success).toBe(false);

    const legacyBoundary = [
      {
        id: 'legacy-boundary',
        sourceCandidateIds: ['source-a', 'source-b'],
        recommendation: 'KEEP_SEPARATE_RELATED_CONCEPTS',
        ontologyIdentityAssessment: identityAssessment(),
        conciseRationale: 'Historical source-only boundary.',
        confidence: 0.94,
      },
    ];
    const v33 = { ...v34, ontologyBoundaryRecommendations: legacyBoundary };
    expect(knowledgeAutoReviewV33ResultSchema.safeParse(v33).success).toBe(true);
    const {
      withinRecordAssessments: _assessments,
      constituentSplitProposals: _proposals,
      ...v32
    } = v33;
    void _assessments;
    void _proposals;
    expect(knowledgeAutoReviewV32ResultSchema.safeParse(v32).success).toBe(true);
    const { ontologyBoundaryRecommendations: _boundaries, ...v31 } = v32;
    void _boundaries;
    expect(knowledgeAutoReviewV31ResultSchema.safeParse(v31).success).toBe(true);
  });

  it('keeps failed raw artifacts byte-equivalent and preserves the one authorized V3.5 session', () => {
    const store = sessionStore();
    const v33 = store.sessions.find((session) => session.id === FAILED_V33_SESSION_ID);
    const v34 = store.sessions.find((session) => session.id === FAILED_V34_SESSION_ID);
    expect(sha256Json(v33?.rawProviderResult)).toBe(FAILED_V33_SHA256);
    expect(sha256Json(v34?.rawProviderResult)).toBe(FAILED_V34_SHA256);
    expect(knowledgeAutoReviewV34ResultSchema.safeParse(v34?.rawProviderResult).success).toBe(true);
    expect(knowledgeAutoReviewV35ResultSchema.safeParse(v34?.rawProviderResult).success).toBe(
      false
    );
    const v35Sessions = store.sessions.filter(
      (session) => session.promptVersion === KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v35
    );
    expect(v35Sessions).toHaveLength(1);
    expect(v35Sessions[0]).toMatchObject({
      id: COMPLETED_V35_SESSION_ID,
      status: 'COMPLETED',
      promptVersion: 'knowledge-auto-review-v3.5',
      policyVersion: 'knowledge-auto-review-policy-v3.5',
      providerAttempt: 5,
      retryCount: 0,
      replacementForSessionId: FAILED_V34_SESSION_ID,
    });
    expect(v35Sessions[0].input.retrievalTrace?.version).toBe('knowledge-retrieval-v3.3');
    expect(sha256Json(v35Sessions[0].rawProviderResult)).toBe(
      GOVERNED_BAI_8_SESSION_LINEAGE[4].rawResultSha256
    );
  });

  it('renders V3.5 authoritative links/labels while preserving historical V3.4 controls', () => {
    const raw = result();
    const {
      prerequisiteAudits: _v35Audits,
      graphMissingPrerequisites: _v35Missing,
      ...governedResult
    } = raw;
    void _v35Audits;
    void _v35Missing;
    const baseSession: KnowledgeAutoReviewSession = {
      id: 'render-session',
      textbookId: 'textbook',
      lessonId: 'lesson',
      modelProvider: 'GEMINI',
      modelName: 'offline-fixture',
      promptVersion: KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v35,
      policyVersion: AUTO_REVIEW_POLICY_VERSION,
      inputHash: 'offline-hash',
      status: 'COMPLETED',
      input: input(),
      result: governedResult,
      rawProviderResult: raw,
      policyDecisions: raw.candidateReviews.map((review) => ({
        sourceRecordId: review.sourceRecordId,
        classification: review.classification,
        disposition: 'HUMAN_REQUIRED' as const,
        reason: 'Read-only fixture.',
      })),
      summary: {
        total: 3,
        safe: 0,
        conceptConfirmation: 3,
        mergeConfirmation: 0,
        nonConcept: 0,
        ontologyDecision: 0,
        humanReviewRequired: 3,
      },
      retryCount: 0,
      createdAt: '2026-07-31T00:00:00.000Z',
      updatedAt: '2026-07-31T00:00:00.000Z',
      completedAt: '2026-07-31T00:00:00.000Z',
    };
    const html = renderToStaticMarkup(
      React.createElement(KnowledgeAutoReviewPanel, {
        documentId: 'document',
        lessonId: 'lesson',
        initialSession: baseSession,
      })
    );
    expect(html).toContain('V3.5 within-record assessments');
    expect(html).toContain('Linked proposal: split-a');
    expect(html).toContain('Assessment link: RESOLVED');
    expect(html).toContain('TEMPORARY · NONCANONICAL');
    expect(html).toContain('Proposed temp-a1');
    expect(html).not.toContain('Provider label is not authoritative');
    expect(html).not.toContain('Xác nhận tách');

    const proposal = raw.constituentSplitProposals[0];
    const historical = {
      ...raw,
      withinRecordAssessments: raw.withinRecordAssessments.map((assessment) =>
        assessment.recommendedAction === 'PROPOSE_CONSTITUENT_SPLIT'
          ? {
              sourceRecordId: assessment.sourceRecordId,
              containsMultipleKnowledgeObjects: true,
              recommendedAction: assessment.recommendedAction,
              constituents: structuredClone(proposal.proposedConstituents),
              rationale: assessment.rationale,
            }
          : assessment
      ),
    };
    const {
      prerequisiteAudits: _historicalAudits,
      graphMissingPrerequisites: _historicalMissing,
      ...historicalGoverned
    } = historical;
    void _historicalAudits;
    void _historicalMissing;
    const historicalHtml = renderToStaticMarkup(
      React.createElement(KnowledgeAutoReviewPanel, {
        documentId: 'document',
        lessonId: 'lesson',
        initialSession: {
          ...baseSession,
          promptVersion: KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v34,
          policyVersion: 'knowledge-auto-review-policy-v3.4',
          result: historicalGoverned,
          rawProviderResult: knowledgeAutoReviewV34ResultSchema.parse(historical),
        },
      })
    );
    expect(historicalHtml).toContain('Xác nhận tách');
    expect(historicalHtml).not.toContain('V3.5 within-record assessments');
  });
});
