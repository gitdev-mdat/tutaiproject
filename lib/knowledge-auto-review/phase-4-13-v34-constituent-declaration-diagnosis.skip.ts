import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  knowledgeAutoReviewV34ResultSchema,
  type KnowledgeAutoReviewInput,
  type KnowledgeAutoReviewSession,
  type KnowledgeAutoReviewV34Result,
  type WithinRecordConstituent,
} from '@/lib/ai/ai-types';
import {
  applyBoundaryReferencePolicyV34,
  validateBoundaryReferencesV34,
} from './boundary-reference-v34';

const DOCUMENT_ID = 'mryei32t-0fybu39';
const SESSION_ID = '169668a4-fac1-4b3d-89db-4286751b4543';
const RAW_SHA256 = '902B51916A453436DEBCCB0AD6AE4ED35748FB5C68CDCCCAEE26B42BF8D67339';
const RAW_UTF8_BYTES = 22_641;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex').toUpperCase();
}

function failedSession(): KnowledgeAutoReviewSession {
  const store = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), 'tmp', 'uploads', DOCUMENT_ID, 'knowledge-auto-review.json'),
      'utf8'
    )
  ) as { sessions: KnowledgeAutoReviewSession[] };
  const session = store.sessions.find((item) => item.id === SESSION_ID);
  if (!session) throw new Error('V3.4 diagnosis session is missing');
  return session;
}

function input(): KnowledgeAutoReviewInput {
  return {
    subject: { id: 'subject', title: 'Subject' },
    grade: { id: 'grade', title: 'Grade' },
    textbook: { id: 'textbook', title: 'Textbook' },
    chapter: { id: 'chapter', title: 'Chapter' },
    lesson: { id: 'lesson', title: 'Lesson' },
    semanticRecords: [
      {
        id: 'source-a',
        type: 'CONCEPT_CANDIDATE',
        title: 'Source A',
        sourceText: 'Structural fixture A.',
      },
      {
        id: 'source-b',
        type: 'CONCEPT_CANDIDATE',
        title: 'Source B',
        sourceText: 'Structural fixture B.',
      },
    ],
    existingConceptCandidates: [],
    deterministicMatches: [
      { sourceRecordId: 'source-a', matchType: 'NONE', canonicalConceptIds: [] },
      { sourceRecordId: 'source-b', matchType: 'NONE', canonicalConceptIds: [] },
    ],
    relevantGraphVersion: 'structural-diagnosis',
  };
}

function constituent(temporaryRef: string): WithinRecordConstituent {
  return {
    temporaryRef,
    proposedTitle: `Title ${temporaryRef}`,
    rationale: `Rationale ${temporaryRef}`,
    independentlyTeachable: true,
    independentlyAssessable: true,
    reusableAcrossProblems: true,
    evidenceSpan: `Evidence ${temporaryRef}`,
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
    rationale: 'Structurally distinct fixture identities.',
  };
}

function result(): KnowledgeAutoReviewV34Result {
  const declarations = [constituent('temp-a'), constituent('temp-b')];
  return {
    candidateReviews: [
      {
        sourceRecordId: 'source-a',
        classification: 'NEW_CONCEPT',
        proposedCanonicalTitle: 'Source A',
        conciseRationale: 'Reusable structural fixture.',
        evidence: ['Structural fixture A.'],
        confidence: 0.95,
        reasonCodes: ['REUSABLE_KNOWLEDGE'],
        evidenceSufficiency: 'SUFFICIENT',
        titleEvidenceAssessment: 'CONSISTENT',
      },
      {
        sourceRecordId: 'source-b',
        classification: 'NEW_CONCEPT',
        proposedCanonicalTitle: 'Source B',
        conciseRationale: 'Reusable structural fixture.',
        evidence: ['Structural fixture B.'],
        confidence: 0.95,
        reasonCodes: ['REUSABLE_KNOWLEDGE'],
        evidenceSufficiency: 'SUFFICIENT',
        titleEvidenceAssessment: 'CONSISTENT',
      },
    ],
    mergeProposals: [],
    learningObjectives: [],
    prerequisiteProposals: [],
    prerequisiteAudits: [],
    graphMissingPrerequisites: [],
    ambiguities: [],
    withinRecordAssessments: [
      {
        sourceRecordId: 'source-a',
        containsMultipleKnowledgeObjects: true,
        constituents: structuredClone(declarations),
        recommendedAction: 'PROPOSE_CONSTITUENT_SPLIT',
        rationale: 'Structural split assessment.',
      },
      {
        sourceRecordId: 'source-b',
        containsMultipleKnowledgeObjects: false,
        recommendedAction: 'KEEP_AS_SINGLE_CONCEPT',
        rationale: 'Structural single assessment.',
      },
    ],
    constituentSplitProposals: [
      {
        id: 'split-a',
        sourceRecordId: 'source-a',
        proposedConstituents: structuredClone(declarations),
        rationale: 'Structural split proposal.',
        confidence: 0.95,
      },
    ],
    ontologyBoundaryRecommendations: [
      {
        id: 'boundary-a',
        members: [
          { kind: 'CONSTITUENT_PROPOSAL', temporaryRef: 'temp-a' },
          { kind: 'CONSTITUENT_PROPOSAL', temporaryRef: 'temp-b' },
        ],
        recommendation: 'KEEP_SEPARATE_RELATED_CONCEPTS',
        ontologyIdentityAssessment: identityAssessment(),
        conciseRationale: 'Structural boundary fixture.',
        confidence: 0.95,
      },
    ],
  };
}

function expectDeclarationDisagreement(
  mutate: (raw: KnowledgeAutoReviewV34Result) => void,
  sourceRecordId = 'source-a'
): void {
  const raw = result();
  mutate(raw);
  expect(() => validateBoundaryReferencesV34(raw, input())).toThrow(
    `Constituent declarations disagree for source "${sourceRecordId}"`
  );
}

describe('Phase 4.13 V3.4 constituent declaration diagnosis', () => {
  it('preserves the exact failed raw identity and failed session state', () => {
    const session = failedSession();
    const serialized = JSON.stringify(session.rawProviderResult);
    expect(Buffer.byteLength(serialized, 'utf8')).toBe(RAW_UTF8_BYTES);
    expect(sha256(serialized)).toBe(RAW_SHA256);
    expect(session).toMatchObject({
      status: 'FAILED',
      errorCode: 'SCHEMA_VALIDATION',
      promptVersion: 'knowledge-auto-review-v3.4',
    });
  });

  it('preserves the failed shape through parsing and leaves raw untouched during policy projection', () => {
    const session = failedSession();
    const before = JSON.stringify(session.rawProviderResult);
    const parsed = knowledgeAutoReviewV34ResultSchema.parse(session.rawProviderResult);
    expect(JSON.stringify(parsed)).toBe(before);

    const projected = applyBoundaryReferencePolicyV34(parsed);
    expect(JSON.stringify(session.rawProviderResult)).toBe(before);
    expect(projected.constituentSplitProposals).toHaveLength(0);
    expect(projected.ontologyBoundaryRecommendations).toEqual(
      parsed.ontologyBoundaryRecommendations
    );
    expect(
      projected.withinRecordAssessments.filter(
        (assessment) => assessment.recommendedAction === 'ONTOLOGY_AMBIGUOUS'
      )
    ).toHaveLength(2);
  });

  it('reproduces the exact governed path, kind, value, and recommendation failure', () => {
    const parsed = knowledgeAutoReviewV34ResultSchema.parse(failedSession().rawProviderResult);
    const projected = applyBoundaryReferencePolicyV34(parsed);
    expect(() => validateBoundaryReferencesV34(projected, failedSession().input)).toThrow(
      'Invalid ontology boundary member at ontologyBoundaryRecommendations[0].members[0]: CONSTITUENT_PROPOSAL temporaryRef "const_midpoint" is not declared consistently by a governed constituent split. Recommendation: "obr_midpoint_centroid"'
    );
  });

  it('rejects an absent assessment declaration after policy projection', () => {
    const raw = result();
    delete raw.withinRecordAssessments[0].constituents;
    const projected = applyBoundaryReferencePolicyV34(raw);
    expect(projected.constituentSplitProposals).toHaveLength(0);
    expect(() => validateBoundaryReferencesV34(projected, input())).toThrow(
      'ontologyBoundaryRecommendations[0].members[0]'
    );
  });

  it('rejects an absent split declaration after policy projection', () => {
    const raw = result();
    raw.constituentSplitProposals = [];
    const projected = applyBoundaryReferencePolicyV34(raw);
    expect(() => validateBoundaryReferencesV34(projected, input())).toThrow(
      'CONSTITUENT_PROPOSAL temporaryRef "temp-a"'
    );
  });

  it('rejects a split-proposal parent source mismatch', () => {
    expectDeclarationDisagreement((raw) => {
      raw.constituentSplitProposals[0].sourceRecordId = 'source-b';
    }, 'source-b');
  });

  it('rejects a temporaryRef mismatch', () => {
    expectDeclarationDisagreement((raw) => {
      raw.withinRecordAssessments[0].constituents![0].temporaryRef = 'temp-other';
    });
  });

  it.each([
    [
      'title',
      (raw: KnowledgeAutoReviewV34Result) => {
        raw.withinRecordAssessments[0].constituents![0].proposedTitle = 'Different title';
      },
    ],
    [
      'evidence span',
      (raw: KnowledgeAutoReviewV34Result) => {
        raw.withinRecordAssessments[0].constituents![0].evidenceSpan = 'Different evidence';
      },
    ],
    [
      'rationale',
      (raw: KnowledgeAutoReviewV34Result) => {
        raw.withinRecordAssessments[0].constituents![0].rationale = 'Different rationale';
      },
    ],
    [
      'confidence',
      (raw: KnowledgeAutoReviewV34Result) => {
        raw.withinRecordAssessments[0].constituents![0].confidence = 0.8;
      },
    ],
    [
      'independentlyTeachable',
      (raw: KnowledgeAutoReviewV34Result) => {
        raw.withinRecordAssessments[0].constituents![0].independentlyTeachable = false;
      },
    ],
    [
      'independentlyAssessable',
      (raw: KnowledgeAutoReviewV34Result) => {
        raw.withinRecordAssessments[0].constituents![0].independentlyAssessable = false;
      },
    ],
    [
      'reusableAcrossProblems',
      (raw: KnowledgeAutoReviewV34Result) => {
        raw.withinRecordAssessments[0].constituents![0].reusableAcrossProblems = false;
      },
    ],
  ])('rejects a %s mismatch between duplicated declarations', (_label, mutate) => {
    expectDeclarationDisagreement(mutate);
  });

  it('rejects an invalid split action without coercing boundary references', () => {
    const raw = result();
    raw.withinRecordAssessments[0].recommendedAction = 'ONTOLOGY_AMBIGUOUS';
    const projected = applyBoundaryReferencePolicyV34(raw);
    expect(projected.constituentSplitProposals).toHaveLength(0);
    expect(projected.ontologyBoundaryRecommendations).toEqual(raw.ontologyBoundaryRecommendations);
    expect(() => validateBoundaryReferencesV34(projected, input())).toThrow(
      'ontologyBoundaryRecommendations[0].members[0]'
    );
  });

  it('rejects containsMultipleKnowledgeObjects=false for a proposed split', () => {
    const raw = result();
    raw.withinRecordAssessments[0].containsMultipleKnowledgeObjects = false;
    const projected = applyBoundaryReferencePolicyV34(raw);
    expect(projected.constituentSplitProposals).toHaveLength(0);
    expect(() => validateBoundaryReferencesV34(projected, input())).toThrow(
      'ontologyBoundaryRecommendations[0].members[0]'
    );
  });

  it('rejects a duplicate temporaryRef across parent sources', () => {
    const raw = result();
    const secondDeclarations = [
      constituent('temp-a'),
      constituent('temp-c'),
    ] as WithinRecordConstituent[];
    raw.withinRecordAssessments[1] = {
      sourceRecordId: 'source-b',
      containsMultipleKnowledgeObjects: true,
      constituents: structuredClone(secondDeclarations),
      recommendedAction: 'PROPOSE_CONSTITUENT_SPLIT',
      rationale: 'Second structural split assessment.',
    };
    raw.constituentSplitProposals.push({
      id: 'split-b',
      sourceRecordId: 'source-b',
      proposedConstituents: structuredClone(secondDeclarations),
      rationale: 'Second structural split proposal.',
      confidence: 0.95,
    });
    expect(() => validateBoundaryReferencesV34(raw, input())).toThrow(
      'Duplicate constituent proposal reference "temp-a"'
    );
  });

  it('accepts valid consistent declarations independently of collection and constituent order', () => {
    const raw = result();
    raw.withinRecordAssessments.reverse();
    raw.withinRecordAssessments[1].constituents!.reverse();
    raw.constituentSplitProposals[0].proposedConstituents.reverse();
    expect(() => validateBoundaryReferencesV34(raw, input())).not.toThrow();
  });
});
