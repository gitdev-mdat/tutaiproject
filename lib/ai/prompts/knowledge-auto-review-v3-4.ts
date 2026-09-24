import type { KnowledgeAutoReviewInput } from '../ai-types';
import { KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS } from '@/lib/config/knowledge-auto-review';
import {
  KNOWLEDGE_AUTO_REVIEW_V33_JSON_SCHEMA,
  KNOWLEDGE_AUTO_REVIEW_V33_SYSTEM_PROMPT,
} from './knowledge-auto-review-v3-3';

const sourceCandidateMemberJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'sourceCandidateId'],
  properties: {
    kind: { type: 'string', enum: ['SOURCE_CANDIDATE'] },
    sourceCandidateId: { type: 'string' },
  },
} as const;

const constituentProposalMemberJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'temporaryRef'],
  properties: {
    kind: { type: 'string', enum: ['CONSTITUENT_PROPOSAL'] },
    temporaryRef: { type: 'string' },
  },
} as const;

const ontologyBoundaryMemberJsonSchema = {
  oneOf: [sourceCandidateMemberJsonSchema, constituentProposalMemberJsonSchema],
} as const;

export const KNOWLEDGE_AUTO_REVIEW_V34_JSON_SCHEMA = {
  ...KNOWLEDGE_AUTO_REVIEW_V33_JSON_SCHEMA,
  properties: {
    ...KNOWLEDGE_AUTO_REVIEW_V33_JSON_SCHEMA.properties,
    ontologyBoundaryRecommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'members',
          'recommendation',
          'ontologyIdentityAssessment',
          'conciseRationale',
          'confidence',
        ],
        properties: {
          id: { type: 'string' },
          members: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: ontologyBoundaryMemberJsonSchema,
          },
          recommendation: {
            type: 'string',
            enum: [
              'KEEP_SEPARATE_RELATED_CONCEPTS',
              'KEEP_SEPARATE_WITH_PART_OF_RELATION',
              'ONTOLOGY_AMBIGUOUS',
            ],
          },
          ontologyIdentityAssessment:
            KNOWLEDGE_AUTO_REVIEW_V33_JSON_SCHEMA.properties.ontologyBoundaryRecommendations.items
              .properties.ontologyIdentityAssessment,
          conciseRationale: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  },
} as const;

export const KNOWLEDGE_AUTO_REVIEW_V34_BOUNDARY_REFERENCE_POLICY = `
V3.4 governed ontology-boundary reference policy:
- Each ontologyBoundaryRecommendations item has exactly two distinct members. Member order has no
  semantic meaning. Recommendation IDs and unordered member pairs must be unique.
- A SOURCE_CANDIDATE member has exactly
  {"kind":"SOURCE_CANDIDATE","sourceCandidateId":"<input semanticRecords id>"}. Use only an ID
  copied from input.semanticRecords.
- A CONSTITUENT_PROPOSAL member has exactly
  {"kind":"CONSTITUENT_PROPOSAL","temporaryRef":"<declared temporaryRef>"}. Use it only after the
  same temporaryRef has been declared consistently for the same parent source in both the
  withinRecordAssessments constituent list and its governed constituentSplitProposals item.
- Never put a bare string in members. Never use a canonical Concept ID, Learning Objective ID,
  recommendation ID, prerequisite proposal ID, merge proposal ID, or invented ID as a member.
- Never compare a source umbrella with one of its own proposed constituents. The source remains an
  evidence container, not an independent sibling of that projected constituent.
- Two valid constituents of one source may be compared. Constituents of different sources may be
  compared. Source candidates from different records may be compared.
- Do not emit a boundary recommendation for the same unordered source-candidate pair as a merge
  proposal. Constituent refs remain temporary, review-only, and noncanonical; never convert them to
  canonical IDs.
`.trim();

export const KNOWLEDGE_AUTO_REVIEW_V34_SYSTEM_PROMPT =
  `${KNOWLEDGE_AUTO_REVIEW_V33_SYSTEM_PROMPT.replace(
    `Prompt version: ${KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v33}.`,
    `Prompt version: ${KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v34}.`
  )}

${KNOWLEDGE_AUTO_REVIEW_V34_BOUNDARY_REFERENCE_POLICY}`.trim();

export function buildKnowledgeAutoReviewV34Prompt(input: KnowledgeAutoReviewInput): string {
  const { retrievalTrace, ...providerInput } = input;
  return JSON.stringify(
    {
      instruction:
        'Review unresolved records under the V3.4 discriminated boundary-reference contract, then complete the unchanged V3.3 within-record, LO, and prerequisite passes.',
      boundaryReferenceContract: {
        memberCount: 2,
        pairOrderSignificant: false,
        allowedKinds: ['SOURCE_CANDIDATE', 'CONSTITUENT_PROPOSAL'],
        sourceToOwnConstituentAllowed: false,
        bareStringsAllowed: false,
        canonicalConceptIdsAllowed: false,
        inventedIdsAllowed: false,
        recommendationIdsUnique: true,
      },
      retrievalContract: {
        retrievedCanonicalConceptCount: input.existingConceptCandidates.length,
        retrievalVersion: retrievalTrace?.version ?? 'knowledge-retrieval-v3.3',
        mayReturnFewerThanTopK: true,
      },
      input: providerInput,
    },
    null,
    2
  );
}
