import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import type { AiGateway } from '@/lib/ai/ai-gateway';
import {
  knowledgeAutoReviewV32ResultSchema,
  knowledgeAutoReviewV33ResultSchema,
  knowledgeAutoReviewV34ResultSchema,
  type KnowledgeAutoReviewInput,
  type KnowledgeAutoReviewSession,
  type KnowledgeAutoReviewV33Result,
  type KnowledgeAutoReviewV34Result,
  type OntologyBoundaryMemberRefV34,
  type WithinRecordConstituent,
} from '@/lib/ai/ai-types';
import {
  KNOWLEDGE_AUTO_REVIEW_V34_JSON_SCHEMA,
  KNOWLEDGE_AUTO_REVIEW_V34_SYSTEM_PROMPT,
} from '@/lib/ai/prompts/knowledge-auto-review-v3-4';
import {
  AUTO_REVIEW_POLICY_VERSION,
  KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSION,
  KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS,
} from '@/lib/config/knowledge-auto-review';
import {
  applyBoundaryReferencePolicyV34,
  validateBoundaryReferencesV34,
} from './boundary-reference-v34';
import { runKnowledgeAutoReview } from './knowledge-auto-review-engine';
import type { KnowledgeAutoReviewStore } from './knowledge-auto-review-storage';

const DOCUMENT_ID = 'mryei32t-0fybu39';
const FAILED_V33_SESSION_ID = 'b79db7c4-01c9-41b1-a97f-4806f03c620c';
const FAILED_V33_RAW_SHA256 = 'F8E2CAA90C75CF22AB9A803A5958031A65248C5C6EC9E15129CEF60111587275';
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
    chapter: { id: 'chapter', title: 'General chapter' },
    lesson: { id: 'lesson', title: 'General lesson' },
    semanticRecords: SOURCE_IDS.map((id) => ({
      id,
      type: 'CONCEPT_CANDIDATE',
      title: `Source ${id}`,
      sourceText: `Direct evidence for ${id}.`,
    })),
    existingConceptCandidates: includeCanonical
      ? [{ id: 'canonical-a', title: 'Canonical A', aliases: [], domainId: 'domain' }]
      : [],
    deterministicMatches: SOURCE_IDS.map((sourceRecordId) => ({
      sourceRecordId,
      matchType: 'NONE' as const,
      canonicalConceptIds: [],
    })),
    relevantGraphVersion: 'v34-contract-fixture',
  };
}

function constituent(temporaryRef: string): WithinRecordConstituent {
  return {
    temporaryRef,
    proposedTitle: `Proposed ${temporaryRef}`,
    rationale: `${temporaryRef} is independently reviewable.`,
    independentlyTeachable: true,
    independentlyAssessable: true,
    reusableAcrossProblems: true,
    evidenceSpan: `Direct evidence for ${temporaryRef}.`,
    confidence: 0.95,
  };
}

function source(sourceCandidateId: string): OntologyBoundaryMemberRefV34 {
  return { kind: 'SOURCE_CANDIDATE', sourceCandidateId };
}

function proposed(temporaryRef: string): OntologyBoundaryMemberRefV34 {
  return { kind: 'CONSTITUENT_PROPOSAL', temporaryRef };
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
    rationale: 'The two governed objects retain distinct mastery identities.',
  };
}

function result(
  members: readonly [OntologyBoundaryMemberRefV34, OntologyBoundaryMemberRefV34] = [
    proposed('temp-a1'),
    proposed('temp-a2'),
  ]
): KnowledgeAutoReviewV34Result {
  const a = [constituent('temp-a1'), constituent('temp-a2')];
  const b = [constituent('temp-b1'), constituent('temp-b2')];
  return {
    candidateReviews: SOURCE_IDS.map((sourceRecordId) => ({
      sourceRecordId,
      classification: 'NEW_CONCEPT' as const,
      proposedCanonicalTitle: `Source ${sourceRecordId}`,
      conciseRationale: 'The source contains reusable knowledge.',
      evidence: [`Direct evidence for ${sourceRecordId}.`],
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
        id: 'boundary-one',
        members: [structuredClone(members[0]), structuredClone(members[1])],
        recommendation: 'KEEP_SEPARATE_RELATED_CONCEPTS',
        ontologyIdentityAssessment: identityAssessment(),
        conciseRationale: 'The governed pair remains separate.',
        confidence: 0.94,
      },
    ],
    withinRecordAssessments: [
      {
        sourceRecordId: 'source-a',
        containsMultipleKnowledgeObjects: true,
        constituents: structuredClone(a),
        recommendedAction: 'PROPOSE_CONSTITUENT_SPLIT',
        rationale: 'Source A contains two governed constituents.',
      },
      {
        sourceRecordId: 'source-b',
        containsMultipleKnowledgeObjects: true,
        constituents: structuredClone(b),
        recommendedAction: 'PROPOSE_CONSTITUENT_SPLIT',
        rationale: 'Source B contains two governed constituents.',
      },
      {
        sourceRecordId: 'source-c',
        containsMultipleKnowledgeObjects: false,
        recommendedAction: 'KEEP_AS_SINGLE_CONCEPT',
        rationale: 'Source C remains one review object.',
      },
    ],
    constituentSplitProposals: [
      {
        id: 'split-a',
        sourceRecordId: 'source-a',
        proposedConstituents: structuredClone(a),
        rationale: 'Source A contains two governed constituents.',
        confidence: 0.95,
      },
      {
        id: 'split-b',
        sourceRecordId: 'source-b',
        proposedConstituents: structuredClone(b),
        rationale: 'Source B contains two governed constituents.',
        confidence: 0.95,
      },
    ],
  };
}

function gateway(
  rawResult: KnowledgeAutoReviewV34Result | KnowledgeAutoReviewV33Result
): AiGateway {
  return {
    reviewKnowledgeCandidates: async () => ({ result: rawResult, rawResult }),
  };
}

function validate(raw: KnowledgeAutoReviewV34Result, reviewInput = input()) {
  expect(knowledgeAutoReviewV34ResultSchema.safeParse(raw).success).toBe(true);
  validateBoundaryReferencesV34(raw, reviewInput);
}

function failedV33Session(): KnowledgeAutoReviewSession {
  const store = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), 'tmp/uploads', DOCUMENT_ID, 'knowledge-auto-review.json'),
      'utf8'
    )
  ) as { sessions: KnowledgeAutoReviewSession[] };
  const session = store.sessions.find((item) => item.id === FAILED_V33_SESSION_ID);
  if (!session) throw new Error('Failed V3.3 audit session is missing');
  return session;
}

describe('Knowledge Auto-Review V3.4 boundary reference contract', () => {
  it('versions the prompt, policy, provider schema, and discriminated member contract', () => {
    expect(KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSION).toBe('knowledge-auto-review-v3.5');
    expect(AUTO_REVIEW_POLICY_VERSION).toBe('knowledge-auto-review-policy-v3.5');
    expect(KNOWLEDGE_AUTO_REVIEW_V34_SYSTEM_PROMPT).toContain(
      'Prompt version: knowledge-auto-review-v3.4.'
    );
    expect(KNOWLEDGE_AUTO_REVIEW_V34_SYSTEM_PROMPT).toContain('Never put a bare string in members');
    expect(
      KNOWLEDGE_AUTO_REVIEW_V34_JSON_SCHEMA.properties.ontologyBoundaryRecommendations.items
        .properties.members
    ).toMatchObject({ minItems: 2, maxItems: 2 });
  });

  it.each([
    ['two source references', [source('source-a'), source('source-b')]],
    ['two constituents of one source', [proposed('temp-a1'), proposed('temp-a2')]],
    ['constituents of different sources', [proposed('temp-a1'), proposed('temp-b1')]],
  ] as const)('accepts %s', (_label, members) => {
    validate(result(members));
  });

  it('rejects bare strings and one or three members at the V3.4 schema boundary', () => {
    const raw = result() as unknown as {
      ontologyBoundaryRecommendations: Array<{ members: unknown }>;
    };
    raw.ontologyBoundaryRecommendations[0].members = ['temp-a1', 'temp-a2'];
    expect(knowledgeAutoReviewV34ResultSchema.safeParse(raw).success).toBe(false);
    raw.ontologyBoundaryRecommendations[0].members = [proposed('temp-a1')];
    expect(knowledgeAutoReviewV34ResultSchema.safeParse(raw).success).toBe(false);
    raw.ontologyBoundaryRecommendations[0].members = [
      proposed('temp-a1'),
      proposed('temp-a2'),
      proposed('temp-b1'),
    ];
    expect(knowledgeAutoReviewV34ResultSchema.safeParse(raw).success).toBe(false);
  });

  it('rejects malformed member discriminators', () => {
    const raw = result() as unknown as {
      ontologyBoundaryRecommendations: Array<{ members: unknown[] }>;
    };
    raw.ontologyBoundaryRecommendations[0].members[0] = {
      kind: 'EXISTING_CONCEPT',
      sourceCandidateId: 'source-a',
    };
    const parsed = knowledgeAutoReviewV34ResultSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path.join('.')).toContain(
        'ontologyBoundaryRecommendations.0.members.0'
      );
    }
  });

  it.each([
    [
      'dangling source',
      [source('missing-source'), source('source-b')],
      'SOURCE_CANDIDATE sourceCandidateId "missing-source"',
    ],
    [
      'canonical Concept ID',
      [source('canonical-a'), source('source-b')],
      'SOURCE_CANDIDATE sourceCandidateId "canonical-a"',
    ],
    [
      'recommendation ID as member',
      [source('boundary-one'), source('source-b')],
      'SOURCE_CANDIDATE sourceCandidateId "boundary-one"',
    ],
    [
      'dangling constituent',
      [proposed('missing-temp'), proposed('temp-a2')],
      'CONSTITUENT_PROPOSAL temporaryRef "missing-temp"',
    ],
  ] as const)('rejects %s with path and value', (_label, members, expected) => {
    const raw = result(members);
    expect(() =>
      validateBoundaryReferencesV34(raw, input(_label === 'canonical Concept ID'))
    ).toThrow(
      expect.objectContaining({
        message: expect.stringContaining(
          `ontologyBoundaryRecommendations[0].members[0]: ${expected}`
        ),
      })
    );
  });

  it('rejects duplicate logical members', () => {
    const raw = result([proposed('temp-a1'), proposed('temp-a1')]);
    expect(() => validateBoundaryReferencesV34(raw, input())).toThrow('duplicates members[0]');
  });

  it('rejects duplicate unordered member pairs', () => {
    const raw = result([source('source-a'), source('source-b')]);
    raw.ontologyBoundaryRecommendations.push({
      ...structuredClone(raw.ontologyBoundaryRecommendations[0]),
      id: 'boundary-two',
      members: [source('source-b'), source('source-a')],
    });
    expect(() => validateBoundaryReferencesV34(raw, input())).toThrow(
      'Duplicate unordered ontology boundary pair'
    );
  });

  it('rejects duplicate recommendation IDs', () => {
    const raw = result([source('source-a'), source('source-b')]);
    raw.ontologyBoundaryRecommendations.push({
      ...structuredClone(raw.ontologyBoundaryRecommendations[0]),
      members: [source('source-b'), source('source-c')],
    });
    expect(() => validateBoundaryReferencesV34(raw, input())).toThrow(
      'ontologyBoundaryRecommendations[1].id'
    );
  });

  it('rejects a source umbrella paired with its own constituent', () => {
    const raw = result([source('source-a'), proposed('temp-a1')]);
    expect(() => validateBoundaryReferencesV34(raw, input())).toThrow(
      'cannot be compared with its own constituent'
    );
  });

  it('rejects a boundary pair already represented by a merge proposal', () => {
    const raw = result([source('source-a'), source('source-b')]);
    raw.mergeProposals = [
      {
        id: 'merge-a-b',
        sourceCandidateIds: ['source-a', 'source-b'],
        proposedCanonicalTitle: 'Merged pair',
        conciseRationale: 'Fixture-only merge.',
        confidence: 0.95,
        reasonCodes: ['COMPLEMENTARY_CONCEPTS'],
        ontologyIdentityAssessment: {
          ...identityAssessment(),
          sameKnowledgeIdentity: true,
          independentlyTeachableA: false,
          independentlyTeachableB: false,
          independentlyAssessableA: false,
          independentlyAssessableB: false,
        },
      },
    ];
    expect(() => validateBoundaryReferencesV34(raw, input())).toThrow(
      'duplicates merge proposal pair'
    );
  });

  it('resolves all constituent declarations independently of array order', () => {
    const raw = result([proposed('temp-a1'), proposed('temp-b1')]);
    raw.withinRecordAssessments.reverse();
    raw.constituentSplitProposals.reverse();
    validate(raw);
  });

  it('rejects duplicate constituent refs across parents', () => {
    const raw = result();
    raw.withinRecordAssessments[1].constituents![0].temporaryRef = 'temp-a1';
    raw.constituentSplitProposals[1].proposedConstituents[0].temporaryRef = 'temp-a1';
    expect(() => validateBoundaryReferencesV34(raw, input())).toThrow(
      'Duplicate constituent proposal reference "temp-a1"'
    );
  });

  it('rejects disagreement between assessment and split-proposal declarations', () => {
    const raw = result();
    raw.withinRecordAssessments[0].constituents![0].proposedTitle = 'Disagreed title';
    expect(() => validateBoundaryReferencesV34(raw, input())).toThrow(
      'Constituent declarations disagree for source "source-a"'
    );
  });

  it('rejects a temporary ref that masquerades as a canonical ID', () => {
    const raw = result([proposed('canonical-a'), proposed('temp-a2')]);
    raw.withinRecordAssessments[0].constituents![0].temporaryRef = 'canonical-a';
    raw.constituentSplitProposals[0].proposedConstituents[0].temporaryRef = 'canonical-a';
    expect(() => validateBoundaryReferencesV34(raw, input(true))).toThrow(
      'collides with another governed ID namespace'
    );
  });

  it('projects policy without dropping, coercing, or mutating V3.4 member references', () => {
    const raw = result([proposed('temp-a1'), proposed('temp-b1')]);
    const before = JSON.stringify(raw);
    const governed = applyBoundaryReferencePolicyV34(raw);
    expect(governed.ontologyBoundaryRecommendations[0].members).toEqual(
      raw.ontologyBoundaryRecommendations[0].members
    );
    expect(JSON.stringify(raw)).toBe(before);
    expect(JSON.stringify(governed)).not.toContain('canonicalId');
  });

  it('dispatches a current execution through V3.4 and preserves historical V3.3 dispatch', async () => {
    const v34 = result([proposed('temp-a1'), proposed('temp-a2')]);
    const current = await runKnowledgeAutoReview({
      gateway: gateway(v34),
      store: new MemoryStore(),
      input: input(),
      promptVersion: KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v34,
      policyVersion: 'knowledge-auto-review-policy-v3.4',
      idFactory: () => 'v34-session',
      providerMaxAttempts: 1,
    });
    expect(current.session).toMatchObject({
      status: 'COMPLETED',
      promptVersion: 'knowledge-auto-review-v3.4',
      policyVersion: 'knowledge-auto-review-policy-v3.4',
    });

    const v33 = knowledgeAutoReviewV33ResultSchema.parse({
      ...v34,
      ontologyBoundaryRecommendations: [
        {
          id: 'legacy-boundary',
          sourceCandidateIds: ['source-a', 'source-b'],
          recommendation: 'KEEP_SEPARATE_RELATED_CONCEPTS',
          ontologyIdentityAssessment: identityAssessment(),
          conciseRationale: 'Historical source pair.',
          confidence: 0.94,
        },
      ],
    });
    const historical = await runKnowledgeAutoReview({
      gateway: gateway(v33),
      store: new MemoryStore(),
      input: input(),
      promptVersion: KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v33,
      policyVersion: 'knowledge-auto-review-policy-v3.3',
      idFactory: () => 'v33-session',
      providerMaxAttempts: 1,
    });
    expect(historical.session).toMatchObject({
      status: 'COMPLETED',
      promptVersion: 'knowledge-auto-review-v3.3',
    });
    expect(historical.session.result?.ontologyBoundaryRecommendations?.[0]).toHaveProperty(
      'sourceCandidateIds'
    );
  });

  it('keeps historical V3.2/V3.3 artifacts readable and refuses to reinterpret V3.3 as V3.4', () => {
    const failed = failedV33Session();
    const serialized = JSON.stringify(failed.rawProviderResult);
    expect(createHash('sha256').update(serialized).digest('hex').toUpperCase()).toBe(
      FAILED_V33_RAW_SHA256
    );
    expect(knowledgeAutoReviewV33ResultSchema.safeParse(failed.rawProviderResult).success).toBe(
      true
    );
    expect(knowledgeAutoReviewV34ResultSchema.safeParse(failed.rawProviderResult).success).toBe(
      false
    );

    const store = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'tmp/uploads', DOCUMENT_ID, 'knowledge-auto-review.json'),
        'utf8'
      )
    ) as { sessions: KnowledgeAutoReviewSession[] };
    const historicalV32 = store.sessions.find(
      (session) => session.promptVersion === KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v32
    );
    expect(historicalV32).toBeDefined();
    expect(
      knowledgeAutoReviewV32ResultSchema.safeParse(historicalV32?.rawProviderResult).success
    ).toBe(true);
    expect(JSON.stringify(failed.rawProviderResult)).toBe(serialized);
  });

  it('exposes both member kinds and noncanonical constituent provenance in the Admin read model', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'components/admin/textbooks/knowledge-auto-review-panel.tsx'),
      'utf8'
    );
    for (const expected of [
      'Source candidate',
      'Constituent proposal',
      'Tạm thời · không canonical',
      'sourceRecordId',
      'recommendation.confidence',
    ]) {
      expect(source).toContain(expected);
    }
  });
});
