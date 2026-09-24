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
} from '@/lib/ai/ai-types';
import { runKnowledgeAutoReview } from './knowledge-auto-review-engine';
import type { KnowledgeAutoReviewStore } from './knowledge-auto-review-storage';

const SESSION_ID = 'b79db7c4-01c9-41b1-a97f-4806f03c620c';
const RAW_SHA256 = 'F8E2CAA90C75CF22AB9A803A5958031A65248C5C6EC9E15129CEF60111587275';
const RAW_UTF8_BYTES = 21_365;
const SOURCE_IDS = ['source-a', 'source-b', 'source-c'] as const;
const V33_EXECUTION = {
  promptVersion: 'knowledge-auto-review-v3.3',
  policyVersion: 'knowledge-auto-review-policy-v3.3',
} as const;

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
    chapter: { id: 'chapter', title: 'Chapter' },
    lesson: { id: 'lesson', title: 'Lesson' },
    semanticRecords: SOURCE_IDS.map((id) => ({
      id,
      type: 'CONCEPT_CANDIDATE',
      title: `Candidate ${id}`,
      sourceText: `Direct source evidence for ${id}.`,
    })),
    existingConceptCandidates: includeCanonical
      ? [
          {
            id: 'canonical-a',
            title: 'Canonical A',
            aliases: [],
            domainId: 'domain',
          },
        ]
      : [],
    deterministicMatches: SOURCE_IDS.map((sourceRecordId) => ({
      sourceRecordId,
      matchType: 'NONE' as const,
      canonicalConceptIds: [],
    })),
    relevantGraphVersion: 'diagnostic-fixture',
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
    rationale: 'The pair retains separate review identities.',
  };
}

function result(): KnowledgeAutoReviewV33Result {
  return {
    candidateReviews: SOURCE_IDS.map((sourceRecordId) => ({
      sourceRecordId,
      classification: 'NEW_CONCEPT' as const,
      proposedCanonicalTitle: `Candidate ${sourceRecordId}`,
      conciseRationale: 'The record contains reusable knowledge.',
      evidence: [`Direct source evidence for ${sourceRecordId}.`],
      confidence: 0.95,
      reasonCodes: ['REUSABLE_KNOWLEDGE' as const],
      evidenceSufficiency: 'SUFFICIENT' as const,
      titleEvidenceAssessment: 'CONSISTENT' as const,
    })),
    mergeProposals: [],
    learningObjectives: [],
    prerequisiteProposals: [],
    prerequisiteAudits: [],
    graphMissingPrerequisites: [],
    ambiguities: [],
    ontologyBoundaryRecommendations: [
      {
        id: 'recommendation-a-b',
        sourceCandidateIds: ['source-a', 'source-b'],
        recommendation: 'KEEP_SEPARATE_RELATED_CONCEPTS',
        ontologyIdentityAssessment: identityAssessment(),
        conciseRationale: 'The two declared source candidates remain separate.',
        confidence: 0.94,
      },
    ],
    withinRecordAssessments: SOURCE_IDS.map((sourceRecordId) => ({
      sourceRecordId,
      containsMultipleKnowledgeObjects: false,
      recommendedAction: 'KEEP_AS_SINGLE_CONCEPT' as const,
      rationale: 'The diagnostic fixture keeps this source as one review object.',
    })),
    constituentSplitProposals: [],
  };
}

function gateway(rawResult: KnowledgeAutoReviewV33Result): AiGateway {
  return {
    reviewKnowledgeCandidates: async () => ({
      result: rawResult,
      rawResult,
    }),
  };
}

describe('Phase 4.13 governed schema-validation diagnosis', () => {
  it('verifies the persisted raw artifact identity and preserves its structural IDs through parsing', () => {
    const store = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'tmp/uploads/mryei32t-0fybu39/knowledge-auto-review.json'),
        'utf8'
      )
    ) as { sessions: KnowledgeAutoReviewSession[] };
    const session = store.sessions.find((item) => item.id === SESSION_ID);
    expect(session?.rawProviderResult).toBeDefined();

    const serialized = JSON.stringify(session?.rawProviderResult);
    expect(Buffer.byteLength(serialized)).toBe(RAW_UTF8_BYTES);
    expect(createHash('sha256').update(serialized).digest('hex').toUpperCase()).toBe(RAW_SHA256);

    const parsedJson = JSON.parse(serialized) as KnowledgeAutoReviewV33Result;
    const parsedSchema = knowledgeAutoReviewV33ResultSchema.parse(parsedJson);
    expect(parsedSchema.ontologyBoundaryRecommendations[0]).toMatchObject({
      id: 'rec_midpoint_centroid',
      sourceCandidateIds: ['temp_midpoint', 'temp_centroid'],
    });
    expect(
      parsedSchema.constituentSplitProposals.flatMap((proposal) =>
        proposal.proposedConstituents.map((constituent) => constituent.temporaryRef)
      )
    ).toEqual(
      expect.arrayContaining([
        'temp_midpoint',
        'temp_centroid',
        'temp_vector_length',
        'temp_distance',
      ])
    );
    expect(JSON.stringify(session?.rawProviderResult)).toBe(serialized);
  });

  it('accepts declared source-candidate pairs independently of recommendation array order', async () => {
    const raw = result();
    raw.ontologyBoundaryRecommendations.push({
      id: 'recommendation-b-c',
      sourceCandidateIds: ['source-b', 'source-c'],
      recommendation: 'ONTOLOGY_AMBIGUOUS',
      ontologyIdentityAssessment: identityAssessment(),
      conciseRationale: 'The second declared pair remains held for review.',
      confidence: 0.72,
    });
    raw.ontologyBoundaryRecommendations.reverse();

    const completed = await runKnowledgeAutoReview({
      gateway: gateway(raw),
      store: new MemoryStore(),
      input: input(),
      idFactory: () => 'valid-source-pair-session',
      providerMaxAttempts: 1,
      ...V33_EXECUTION,
    });

    expect(completed.session.status).toBe('COMPLETED');
    expect(
      completed.session.result?.ontologyBoundaryRecommendations?.map((item) => item.id)
    ).toEqual(['recommendation-b-c', 'recommendation-a-b']);
  });

  it('reproduces the exact temporary-constituent namespace rejection without mutating raw output', async () => {
    const raw = result();
    raw.withinRecordAssessments[0] = {
      sourceRecordId: 'source-a',
      containsMultipleKnowledgeObjects: true,
      constituents: [
        {
          temporaryRef: 'temp-a',
          proposedTitle: 'Temporary A',
          rationale: 'Temporary A is independently reviewable.',
          independentlyTeachable: true,
          independentlyAssessable: true,
          reusableAcrossProblems: true,
          evidenceSpan: 'Direct evidence A.',
          confidence: 0.95,
        },
        {
          temporaryRef: 'temp-b',
          proposedTitle: 'Temporary B',
          rationale: 'Temporary B is independently reviewable.',
          independentlyTeachable: true,
          independentlyAssessable: true,
          reusableAcrossProblems: true,
          evidenceSpan: 'Direct evidence B.',
          confidence: 0.94,
        },
      ],
      recommendedAction: 'PROPOSE_CONSTITUENT_SPLIT',
      rationale: 'The source contains two independently reviewable objects.',
    };
    raw.constituentSplitProposals = [
      {
        id: 'split-source-a',
        sourceRecordId: 'source-a',
        proposedConstituents: structuredClone(raw.withinRecordAssessments[0].constituents!),
        rationale: raw.withinRecordAssessments[0].rationale,
        confidence: 0.94,
      },
    ];
    raw.ontologyBoundaryRecommendations = [
      {
        id: 'rec_midpoint_centroid',
        sourceCandidateIds: ['temp-a', 'temp-b'],
        recommendation: 'KEEP_SEPARATE_RELATED_CONCEPTS',
        ontologyIdentityAssessment: identityAssessment(),
        conciseRationale: 'The declared temporary pair remains separate.',
        confidence: 0.94,
      },
    ];
    const before = JSON.stringify(raw);
    const store = new MemoryStore();

    await expect(
      runKnowledgeAutoReview({
        gateway: gateway(raw),
        store,
        input: input(),
        idFactory: () => 'temporary-ref-session',
        providerMaxAttempts: 1,
        ...V33_EXECUTION,
      })
    ).rejects.toThrow('Invalid ontology boundary recommendation: rec_midpoint_centroid');

    expect(store.sessions[0]).toMatchObject({
      status: 'FAILED',
      errorCode: 'SCHEMA_VALIDATION',
      rawProviderResult: raw,
    });
    expect(JSON.stringify(raw)).toBe(before);
    expect(JSON.stringify(store.sessions[0].rawProviderResult)).toBe(before);
  });

  it.each([
    ['dangling ID', ['source-a', 'missing-source']],
    ['canonical Concept namespace', ['source-a', 'canonical-a']],
    ['recommendation enum mistaken for an ID', ['source-a', 'ONTOLOGY_AMBIGUOUS']],
  ])('rejects a %s in sourceCandidateIds', async (_label, sourceCandidateIds) => {
    const raw = result();
    raw.ontologyBoundaryRecommendations[0].sourceCandidateIds = sourceCandidateIds;

    await expect(
      runKnowledgeAutoReview({
        gateway: gateway(raw),
        store: new MemoryStore(),
        input: input(_label === 'canonical Concept namespace'),
        idFactory: () => 'wrong-namespace-session',
        providerMaxAttempts: 1,
        ...V33_EXECUTION,
      })
    ).rejects.toThrow('Invalid ontology boundary recommendation: recommendation-a-b');
  });

  it('rejects a duplicate boundary pair even when recommendation IDs differ', async () => {
    const raw = result();
    raw.ontologyBoundaryRecommendations.push({
      ...structuredClone(raw.ontologyBoundaryRecommendations[0]),
      id: 'second-id-for-same-pair',
      sourceCandidateIds: ['source-b', 'source-a'],
    });

    await expect(
      runKnowledgeAutoReview({
        gateway: gateway(raw),
        store: new MemoryStore(),
        input: input(),
        idFactory: () => 'duplicate-pair-session',
        providerMaxAttempts: 1,
        ...V33_EXECUTION,
      })
    ).rejects.toThrow('Invalid ontology boundary recommendation: second-id-for-same-pair');
  });

  it('documents that duplicate recommendation IDs are not currently a governed invariant', async () => {
    const raw = result();
    raw.ontologyBoundaryRecommendations.push({
      ...structuredClone(raw.ontologyBoundaryRecommendations[0]),
      sourceCandidateIds: ['source-b', 'source-c'],
    });

    expect(knowledgeAutoReviewV33ResultSchema.safeParse(raw).success).toBe(true);
    const completed = await runKnowledgeAutoReview({
      gateway: gateway(raw),
      store: new MemoryStore(),
      input: input(),
      idFactory: () => 'duplicate-recommendation-id-session',
      providerMaxAttempts: 1,
      ...V33_EXECUTION,
    });
    expect(completed.session.status).toBe('COMPLETED');
    expect(
      completed.session.result?.ontologyBoundaryRecommendations?.map((item) => item.id)
    ).toEqual(['recommendation-a-b', 'recommendation-a-b']);
  });
});
