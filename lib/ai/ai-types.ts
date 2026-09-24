import { z } from 'zod';

export const KNOWLEDGE_REVIEW_CLASSIFICATIONS = [
  'EXISTING_CONCEPT',
  'NEW_CONCEPT',
  'MERGE_CANDIDATE',
  'LEARNING_OBJECTIVE',
  'METHOD_OR_PROCEDURE',
  'REPRESENTATION_OR_TOOL',
  'APPLICATION_CONTEXT',
  'EXAMPLE_OR_EXERCISE',
  'TEXTBOOK_ONLY',
  'ONTOLOGY_AMBIGUOUS',
  'REJECT_INVALID',
] as const;

export const KNOWLEDGE_REVIEW_REASON_CODES = [
  'REUSABLE_KNOWLEDGE',
  'TEXTBOOK_SPECIFIC',
  'PROCEDURAL_LANGUAGE',
  'COMPLEMENTARY_CONCEPTS',
  'EXISTING_CANONICAL_MATCH',
  'GRANULARITY_TOO_FINE',
  'ONTOLOGY_CATEGORY_UNCLEAR',
  'INSUFFICIENT_EVIDENCE',
  'TITLE_EVIDENCE_CONFLICT',
] as const;

export const EVIDENCE_SUFFICIENCY_LEVELS = [
  'SUFFICIENT',
  'WEAK',
  'CONFLICTING',
  'INSUFFICIENT',
] as const;

export const TITLE_EVIDENCE_ASSESSMENTS = ['CONSISTENT', 'CONFLICTING', 'UNCLEAR'] as const;

export const PREREQUISITE_ASSESSMENTS = [
  'STRONG_PREREQUISITE',
  'SUPPORTING_KNOWLEDGE',
  'NOT_REQUIRED',
] as const;

export const REVIEW_REFERENCE_KINDS = [
  'EXISTING_CONCEPT',
  'SOURCE_CANDIDATE',
  'MERGE_PROPOSAL',
  'CONSTITUENT_PROPOSAL',
] as const;

export const ONTOLOGY_BOUNDARY_RECOMMENDATIONS = [
  'KEEP_SEPARATE_RELATED_CONCEPTS',
  'KEEP_SEPARATE_WITH_PART_OF_RELATION',
  'ONTOLOGY_AMBIGUOUS',
] as const;

export const WITHIN_RECORD_RECOMMENDED_ACTIONS = [
  'KEEP_AS_SINGLE_CONCEPT',
  'PROPOSE_CONSTITUENT_SPLIT',
  'ONTOLOGY_AMBIGUOUS',
] as const;

export const KNOWLEDGE_GRANULARITY_STATUSES = [
  'SINGLE_CONCEPT',
  'NEEDS_CONSTITUENT_REVIEW',
  'ONTOLOGY_AMBIGUOUS',
] as const;

export const RETRIEVAL_REASON_CODES = [
  'SAME_DOMAIN',
  'RELATED_DOMAIN',
  'TITLE_OVERLAP',
  'ALIAS_OVERLAP',
  'TEXTBOOK_MAPPING_SUPPORT',
  'PREREQUISITE_NEIGHBOR',
  'LOW_RELEVANCE',
  'UNRELATED_DOMAIN',
] as const;

export const BLOOM_LEVELS = [
  'REMEMBER',
  'UNDERSTAND',
  'APPLY',
  'ANALYZE',
  'EVALUATE',
  'CREATE',
] as const;

const confidenceSchema = z.number().min(0).max(1);
const reasonCodesSchema = z.array(z.enum(KNOWLEDGE_REVIEW_REASON_CODES)).min(1);

export const autoReviewReferenceSchema = z
  .object({
    kind: z.enum(REVIEW_REFERENCE_KINDS),
    id: z.string().min(1),
    title: z.string().min(1),
  })
  .strict();

export const candidateReviewSchema = z
  .object({
    sourceRecordId: z.string().min(1),
    classification: z.enum(KNOWLEDGE_REVIEW_CLASSIFICATIONS),
    existingConceptId: z.string().min(1).optional(),
    proposedCanonicalTitle: z.string().min(1).optional(),
    conciseRationale: z.string().min(1),
    evidence: z.array(z.string().min(1)).min(1),
    confidence: confidenceSchema,
    reasonCodes: reasonCodesSchema,
    evidenceSufficiency: z.enum(EVIDENCE_SUFFICIENCY_LEVELS).optional(),
    titleEvidenceAssessment: z.enum(TITLE_EVIDENCE_ASSESSMENTS).optional(),
    granularityStatus: z.enum(KNOWLEDGE_GRANULARITY_STATUSES).optional(),
  })
  .strict();

export const withinRecordConstituentSchema = z
  .object({
    temporaryRef: z.string().min(1),
    proposedTitle: z.string().min(1),
    rationale: z.string().min(1),
    independentlyTeachable: z.boolean(),
    independentlyAssessable: z.boolean(),
    reusableAcrossProblems: z.boolean(),
    evidenceSpan: z.string().min(1).optional(),
    confidence: confidenceSchema,
  })
  .strict();

export const withinRecordAssessmentSchema = z
  .object({
    sourceRecordId: z.string().min(1),
    containsMultipleKnowledgeObjects: z.boolean(),
    constituents: z.array(withinRecordConstituentSchema).min(2).optional(),
    recommendedAction: z.enum(WITHIN_RECORD_RECOMMENDED_ACTIONS),
    rationale: z.string().min(1),
  })
  .strict();

export const constituentSplitProposalSchema = z
  .object({
    id: z.string().min(1),
    sourceRecordId: z.string().min(1),
    proposedConstituents: z.array(withinRecordConstituentSchema).min(2),
    rationale: z.string().min(1),
    confidence: confidenceSchema,
  })
  .strict();

export const proposedConstituentV35Schema = z
  .object({
    temporaryRef: z.string().trim().min(1),
    proposedTitle: z.string().trim().min(1),
    rationale: z.string().trim().min(1),
    independentlyTeachable: z.boolean(),
    independentlyAssessable: z.boolean(),
    reusableAcrossProblems: z.boolean(),
    evidenceSpan: z.string().trim().min(1),
    confidence: confidenceSchema,
  })
  .strict();

const keepAsSingleConceptAssessmentV35Schema = z
  .object({
    sourceRecordId: z.string().trim().min(1),
    containsMultipleKnowledgeObjects: z.literal(false),
    recommendedAction: z.literal('KEEP_AS_SINGLE_CONCEPT'),
    rationale: z.string().trim().min(1),
  })
  .strict();

const proposeConstituentSplitAssessmentV35Schema = z
  .object({
    sourceRecordId: z.string().trim().min(1),
    containsMultipleKnowledgeObjects: z.literal(true),
    recommendedAction: z.literal('PROPOSE_CONSTITUENT_SPLIT'),
    constituentSplitProposalRef: z.string().trim().min(1),
    rationale: z.string().trim().min(1),
  })
  .strict();

const ontologyAmbiguousAssessmentV35Schema = z
  .object({
    sourceRecordId: z.string().trim().min(1),
    containsMultipleKnowledgeObjects: z.boolean(),
    recommendedAction: z.literal('ONTOLOGY_AMBIGUOUS'),
    rationale: z.string().trim().min(1),
  })
  .strict();

export const withinRecordAssessmentV35Schema = z.discriminatedUnion('recommendedAction', [
  keepAsSingleConceptAssessmentV35Schema,
  proposeConstituentSplitAssessmentV35Schema,
  ontologyAmbiguousAssessmentV35Schema,
]);

export const constituentSplitProposalV35Schema = z
  .object({
    id: z.string().trim().min(1),
    sourceRecordId: z.string().trim().min(1),
    proposedConstituents: z
      .tuple([proposedConstituentV35Schema, proposedConstituentV35Schema])
      .rest(proposedConstituentV35Schema),
    rationale: z.string().trim().min(1),
    confidence: confidenceSchema,
  })
  .strict();

export const mergeProposalSchema = z
  .object({
    id: z.string().min(1),
    sourceCandidateIds: z.array(z.string().min(1)).min(2),
    proposedCanonicalTitle: z.string().min(1),
    conciseRationale: z.string().min(1),
    confidence: confidenceSchema,
    reasonCodes: reasonCodesSchema,
  })
  .strict();

export const ontologyIdentityAssessmentSchema = z
  .object({
    sameKnowledgeIdentity: z.boolean(),
    independentlyTeachableA: z.boolean(),
    independentlyTeachableB: z.boolean(),
    independentlyAssessableA: z.boolean(),
    independentlyAssessableB: z.boolean(),
    directionalDependencyExists: z.boolean(),
    constituentRelationshipExists: z.boolean(),
    rationale: z.string().min(1),
  })
  .strict();

export const ontologyBoundaryRecommendationSchema = z
  .object({
    id: z.string().min(1),
    sourceCandidateIds: z.array(z.string().min(1)).min(2),
    recommendation: z.enum(ONTOLOGY_BOUNDARY_RECOMMENDATIONS),
    ontologyIdentityAssessment: ontologyIdentityAssessmentSchema,
    conciseRationale: z.string().min(1),
    confidence: confidenceSchema,
  })
  .strict();

export const ontologyBoundaryMemberRefV34Schema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('SOURCE_CANDIDATE'),
      sourceCandidateId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('CONSTITUENT_PROPOSAL'),
      temporaryRef: z.string().min(1),
    })
    .strict(),
]);

export const ontologyBoundaryRecommendationV34Schema = z
  .object({
    id: z.string().min(1),
    members: z.tuple([ontologyBoundaryMemberRefV34Schema, ontologyBoundaryMemberRefV34Schema]),
    recommendation: z.enum(ONTOLOGY_BOUNDARY_RECOMMENDATIONS),
    ontologyIdentityAssessment: ontologyIdentityAssessmentSchema,
    conciseRationale: z.string().min(1),
    confidence: confidenceSchema,
  })
  .strict();

export const autoReviewLearningObjectiveSchema = z
  .object({
    id: z.string().min(1),
    statement: z.string().min(1),
    targetReference: autoReviewReferenceSchema,
    bloomLevel: z.enum(BLOOM_LEVELS),
    conciseRationale: z.string().min(1),
    sourceSemanticRecordIds: z.array(z.string().min(1)).min(1),
    confidence: confidenceSchema,
  })
  .strict();

export const autoReviewPrerequisiteSchema = z
  .object({
    id: z.string().min(1),
    sourceReference: autoReviewReferenceSchema,
    targetReference: autoReviewReferenceSchema,
    relationType: z.literal('LEARNING_PREREQUISITE'),
    conciseRationale: z.string().min(1),
    sourceSemanticRecordIds: z.array(z.string().min(1)).min(1),
    confidence: confidenceSchema,
  })
  .strict();

export const ontologyAmbiguitySchema = z
  .object({
    id: z.string().min(1),
    sourceCandidateIds: z.array(z.string().min(1)).min(1),
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    conciseRationale: z.string().min(1),
    confidence: confidenceSchema,
    reasonCodes: reasonCodesSchema,
  })
  .strict();

export const prerequisiteAuditSchema = z
  .object({
    id: z.string().min(1),
    sourceReference: autoReviewReferenceSchema,
    targetReference: autoReviewReferenceSchema,
    assessment: z.enum(PREREQUISITE_ASSESSMENTS),
    conciseRationale: z.string().min(1),
    sourceSemanticRecordIds: z.array(z.string().min(1)).min(1),
    confidence: confidenceSchema,
  })
  .strict();

export const graphMissingPrerequisiteSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    targetReference: autoReviewReferenceSchema,
    classification: z.literal('GRAPH_CONCEPT_MISSING'),
    conciseRationale: z.string().min(1),
    sourceSemanticRecordIds: z.array(z.string().min(1)).min(1),
    confidence: confidenceSchema,
  })
  .strict();

export const prerequisiteAuditV31Schema = z
  .object({
    sourceConceptRef: autoReviewReferenceSchema.extend({
      kind: z.literal('EXISTING_CONCEPT'),
    }),
    targetConceptRef: autoReviewReferenceSchema,
    classification: z.enum(PREREQUISITE_ASSESSMENTS),
    rationale: z.string().min(1),
  })
  .strict();

export const graphMissingPrerequisiteV31Schema = z
  .object({
    title: z.string().min(1),
    reason: z.string().min(1),
    confidence: confidenceSchema,
  })
  .strict();

export const knowledgeAutoReviewResultSchema = z
  .object({
    candidateReviews: z.array(candidateReviewSchema),
    mergeProposals: z.array(mergeProposalSchema),
    learningObjectives: z.array(autoReviewLearningObjectiveSchema),
    prerequisiteProposals: z.array(autoReviewPrerequisiteSchema),
    prerequisiteAudits: z.array(prerequisiteAuditSchema).optional(),
    missingPrerequisites: z.array(graphMissingPrerequisiteSchema).optional(),
    ambiguities: z.array(ontologyAmbiguitySchema),
  })
  .strict();

export const knowledgeAutoReviewV3ResultSchema = knowledgeAutoReviewResultSchema.extend({
  candidateReviews: z.array(
    candidateReviewSchema.extend({
      evidenceSufficiency: z.enum(EVIDENCE_SUFFICIENCY_LEVELS),
      titleEvidenceAssessment: z.enum(TITLE_EVIDENCE_ASSESSMENTS),
    })
  ),
  prerequisiteAudits: z.array(prerequisiteAuditSchema),
  missingPrerequisites: z.array(graphMissingPrerequisiteSchema),
});

export const knowledgeAutoReviewV31ResultSchema = knowledgeAutoReviewResultSchema
  .omit({
    prerequisiteAudits: true,
    missingPrerequisites: true,
  })
  .extend({
    candidateReviews: z.array(
      candidateReviewSchema.extend({
        evidenceSufficiency: z.enum(EVIDENCE_SUFFICIENCY_LEVELS),
        titleEvidenceAssessment: z.enum(TITLE_EVIDENCE_ASSESSMENTS),
      })
    ),
    prerequisiteAudits: z.array(prerequisiteAuditV31Schema),
    graphMissingPrerequisites: z.array(graphMissingPrerequisiteV31Schema),
  });

export const knowledgeAutoReviewV32ResultSchema = knowledgeAutoReviewV31ResultSchema
  .omit({
    mergeProposals: true,
  })
  .extend({
    mergeProposals: z.array(
      mergeProposalSchema.extend({
        ontologyIdentityAssessment: ontologyIdentityAssessmentSchema,
      })
    ),
    ontologyBoundaryRecommendations: z.array(ontologyBoundaryRecommendationSchema),
  });

export const knowledgeAutoReviewV33ResultSchema = knowledgeAutoReviewV32ResultSchema.extend({
  withinRecordAssessments: z.array(withinRecordAssessmentSchema),
  constituentSplitProposals: z.array(constituentSplitProposalSchema),
});

export const knowledgeAutoReviewV34ResultSchema = knowledgeAutoReviewV33ResultSchema
  .omit({
    ontologyBoundaryRecommendations: true,
  })
  .extend({
    ontologyBoundaryRecommendations: z.array(ontologyBoundaryRecommendationV34Schema),
  });

export const knowledgeAutoReviewV35ResultSchema = knowledgeAutoReviewV34ResultSchema
  .omit({
    withinRecordAssessments: true,
    constituentSplitProposals: true,
  })
  .extend({
    withinRecordAssessments: z.array(withinRecordAssessmentV35Schema),
    constituentSplitProposals: z.array(constituentSplitProposalV35Schema),
  });

export type KnowledgeReviewClassification = (typeof KNOWLEDGE_REVIEW_CLASSIFICATIONS)[number];
export type KnowledgeReviewReasonCode = (typeof KNOWLEDGE_REVIEW_REASON_CODES)[number];
export type AutoReviewReference = z.infer<typeof autoReviewReferenceSchema>;
export type KnowledgeCandidateReview = z.infer<typeof candidateReviewSchema>;
export type KnowledgeMergeProposal = z.infer<typeof mergeProposalSchema>;
export type OntologyIdentityAssessment = z.infer<typeof ontologyIdentityAssessmentSchema>;
export type OntologyBoundaryRecommendation = z.infer<typeof ontologyBoundaryRecommendationSchema>;
export type OntologyBoundaryMemberRefV34 = z.infer<typeof ontologyBoundaryMemberRefV34Schema>;
export type OntologyBoundaryRecommendationV34 = z.infer<
  typeof ontologyBoundaryRecommendationV34Schema
>;
export type KnowledgeAutoReviewResult = z.infer<typeof knowledgeAutoReviewResultSchema>;
export type KnowledgeAutoReviewV31Result = z.infer<typeof knowledgeAutoReviewV31ResultSchema>;
export type KnowledgeAutoReviewV32Result = z.infer<typeof knowledgeAutoReviewV32ResultSchema>;
export type KnowledgeAutoReviewV33Result = z.infer<typeof knowledgeAutoReviewV33ResultSchema>;
export type KnowledgeAutoReviewV34Result = z.infer<typeof knowledgeAutoReviewV34ResultSchema>;
export type KnowledgeAutoReviewV35Result = z.infer<typeof knowledgeAutoReviewV35ResultSchema>;
export type WithinRecordAssessment = z.infer<typeof withinRecordAssessmentSchema>;
export type WithinRecordConstituent = z.infer<typeof withinRecordConstituentSchema>;
export type ConstituentSplitProposal = z.infer<typeof constituentSplitProposalSchema>;
export type ProposedConstituentV35 = z.infer<typeof proposedConstituentV35Schema>;
export type WithinRecordAssessmentV35 = z.infer<typeof withinRecordAssessmentV35Schema>;
export type ConstituentSplitProposalV35 = z.infer<typeof constituentSplitProposalV35Schema>;
export type OntologyBoundaryMemberRefV35 = OntologyBoundaryMemberRefV34;
export type OntologyBoundaryRecommendationV35 = OntologyBoundaryRecommendationV34;
export type RetrievalReasonCode = (typeof RETRIEVAL_REASON_CODES)[number];
export type KnowledgeAutoReviewGovernedResult = Omit<
  KnowledgeAutoReviewResult,
  'mergeProposals'
> & {
  mergeProposals: Array<
    KnowledgeMergeProposal & {
      ontologyIdentityAssessment?: OntologyIdentityAssessment;
    }
  >;
  ontologyBoundaryRecommendations?: Array<
    OntologyBoundaryRecommendation | OntologyBoundaryRecommendationV34
  >;
  withinRecordAssessments?: Array<WithinRecordAssessment | WithinRecordAssessmentV35>;
  constituentSplitProposals?: Array<ConstituentSplitProposal | ConstituentSplitProposalV35>;
};

export interface KnowledgeSemanticRecord {
  id: string;
  type: string;
  title: string;
  description?: string;
  sourceText?: string;
  formulas?: string[];
  pageReference?: number;
  confidence?: number;
}

export interface ExistingConceptCandidate {
  id: string;
  title: string;
  aliases: string[];
  domainId: string;
  shortDescription?: string;
}

export interface KnowledgeRetrievalTraceEntry {
  conceptId: string;
  totalRelevanceScore: number;
  reasonCodes: RetrievalReasonCode[];
  selected: boolean;
  topContributingFeatures: Array<{
    reasonCode: RetrievalReasonCode;
    contribution: number;
  }>;
}

export interface KnowledgeRetrievalTrace {
  version: 'knowledge-retrieval-v3.3';
  maxTopK: number;
  minimumRelevanceScore: number;
  eligibleCandidateCount: number;
  selectedCount: number;
  entries: KnowledgeRetrievalTraceEntry[];
}

export interface DeterministicKnowledgeMatch {
  sourceRecordId: string;
  matchType: 'EXACT_TITLE' | 'ALIAS' | 'NONE';
  canonicalConceptIds: string[];
}

export interface KnowledgeAutoReviewInput {
  subject: { id: string; title: string };
  grade: { id: string; title: string };
  domainContext?: { id: string; title: string };
  textbook: { id: string; title: string };
  chapter: { id: string; title: string };
  lesson: { id: string; title: string };
  semanticRecords: KnowledgeSemanticRecord[];
  existingConceptCandidates: ExistingConceptCandidate[];
  deterministicMatches: DeterministicKnowledgeMatch[];
  retrievalTrace?: KnowledgeRetrievalTrace;
  relevantGraphVersion: string;
}

export interface AiUsageMetadata {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AiKnowledgeReviewResponse {
  result:
    | KnowledgeAutoReviewResult
    | KnowledgeAutoReviewV31Result
    | KnowledgeAutoReviewV32Result
    | KnowledgeAutoReviewV33Result
    | KnowledgeAutoReviewV34Result
    | KnowledgeAutoReviewV35Result;
  rawResult?:
    | KnowledgeAutoReviewV31Result
    | KnowledgeAutoReviewV32Result
    | KnowledgeAutoReviewV33Result
    | KnowledgeAutoReviewV34Result
    | KnowledgeAutoReviewV35Result;
  usage?: AiUsageMetadata;
}

export type KnowledgeReviewDisposition =
  'AUTO_RESOLVABLE' | 'AUTO_CLASSIFIED_REVIEWABLE' | 'HUMAN_CONFIRM_REQUIRED' | 'HUMAN_REQUIRED';

export interface KnowledgeReviewPolicyDecision {
  sourceRecordId: string;
  classification: KnowledgeReviewClassification;
  disposition: KnowledgeReviewDisposition;
  reason: string;
}

export type KnowledgeAutoReviewSessionStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface KnowledgeAutoReviewSummary {
  total: number;
  safe: number;
  conceptConfirmation: number;
  mergeConfirmation: number;
  nonConcept: number;
  ontologyDecision: number;
  humanReviewRequired: number;
}

export interface KnowledgeAutoReviewSession {
  id: string;
  textbookId: string;
  lessonId: string;
  modelProvider: 'GEMINI';
  modelName: string;
  promptVersion: string;
  policyVersion?: string;
  inputHash: string;
  status: KnowledgeAutoReviewSessionStatus;
  input: KnowledgeAutoReviewInput;
  result?: KnowledgeAutoReviewGovernedResult;
  rawProviderResult?:
    | KnowledgeAutoReviewV31Result
    | KnowledgeAutoReviewV32Result
    | KnowledgeAutoReviewV33Result
    | KnowledgeAutoReviewV34Result
    | KnowledgeAutoReviewV35Result;
  policyDecisions?: KnowledgeReviewPolicyDecision[];
  summary?: KnowledgeAutoReviewSummary;
  usage?: AiUsageMetadata;
  requestDurationMs?: number;
  retryCount: number;
  providerAttempt?: number;
  replacementForSessionId?: string;
  createdAt: string;
  startedAt?: string;
  updatedAt: string;
  completedAt?: string;
  failedAt?: string;
  interruptedAt?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface KnowledgeAutoReviewRunResult {
  session: KnowledgeAutoReviewSession;
  cacheHit: boolean;
  sharedFlight: boolean;
}

export class AiProviderError extends Error {
  constructor(
    public readonly code:
      | 'TIMEOUT'
      | 'RATE_LIMIT'
      | 'TRANSIENT_SERVER'
      | 'MALFORMED_RESPONSE'
      | 'SCHEMA_VALIDATION'
      | 'PROVIDER_ERROR',
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}
