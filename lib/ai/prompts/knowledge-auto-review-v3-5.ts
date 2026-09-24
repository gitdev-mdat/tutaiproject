import type { KnowledgeAutoReviewInput } from '../ai-types';
import { KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS } from '@/lib/config/knowledge-auto-review';
import { KNOWLEDGE_AUTO_REVIEW_V3_FEW_SHOTS } from './knowledge-auto-review-v3';
import { KNOWLEDGE_AUTO_REVIEW_V33_WITHIN_RECORD_POLICY } from './knowledge-auto-review-v3-3';
import {
  KNOWLEDGE_AUTO_REVIEW_V34_BOUNDARY_REFERENCE_POLICY,
  KNOWLEDGE_AUTO_REVIEW_V34_JSON_SCHEMA,
  KNOWLEDGE_AUTO_REVIEW_V34_SYSTEM_PROMPT,
} from './knowledge-auto-review-v3-4';

const nonemptyString = { type: 'string', minLength: 1 } as const;

const proposedConstituentV35JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'temporaryRef',
    'proposedTitle',
    'rationale',
    'independentlyTeachable',
    'independentlyAssessable',
    'reusableAcrossProblems',
    'evidenceSpan',
    'confidence',
  ],
  properties: {
    temporaryRef: nonemptyString,
    proposedTitle: nonemptyString,
    rationale: nonemptyString,
    independentlyTeachable: { type: 'boolean' },
    independentlyAssessable: { type: 'boolean' },
    reusableAcrossProblems: { type: 'boolean' },
    evidenceSpan: nonemptyString,
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
} as const;

const keepAssessmentV35JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'sourceRecordId',
    'containsMultipleKnowledgeObjects',
    'recommendedAction',
    'rationale',
  ],
  properties: {
    sourceRecordId: nonemptyString,
    containsMultipleKnowledgeObjects: { type: 'boolean', enum: [false] },
    recommendedAction: { type: 'string', enum: ['KEEP_AS_SINGLE_CONCEPT'] },
    rationale: nonemptyString,
  },
} as const;

const splitAssessmentV35JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'sourceRecordId',
    'containsMultipleKnowledgeObjects',
    'recommendedAction',
    'constituentSplitProposalRef',
    'rationale',
  ],
  properties: {
    sourceRecordId: nonemptyString,
    containsMultipleKnowledgeObjects: { type: 'boolean', enum: [true] },
    recommendedAction: { type: 'string', enum: ['PROPOSE_CONSTITUENT_SPLIT'] },
    constituentSplitProposalRef: nonemptyString,
    rationale: nonemptyString,
  },
} as const;

const ambiguousAssessmentV35JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'sourceRecordId',
    'containsMultipleKnowledgeObjects',
    'recommendedAction',
    'rationale',
  ],
  properties: {
    sourceRecordId: nonemptyString,
    containsMultipleKnowledgeObjects: { type: 'boolean' },
    recommendedAction: { type: 'string', enum: ['ONTOLOGY_AMBIGUOUS'] },
    rationale: nonemptyString,
  },
} as const;

export const KNOWLEDGE_AUTO_REVIEW_V35_JSON_SCHEMA = {
  ...KNOWLEDGE_AUTO_REVIEW_V34_JSON_SCHEMA,
  properties: {
    ...KNOWLEDGE_AUTO_REVIEW_V34_JSON_SCHEMA.properties,
    withinRecordAssessments: {
      type: 'array',
      items: {
        oneOf: [
          keepAssessmentV35JsonSchema,
          splitAssessmentV35JsonSchema,
          ambiguousAssessmentV35JsonSchema,
        ],
      },
    },
    constituentSplitProposals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'sourceRecordId', 'proposedConstituents', 'rationale', 'confidence'],
        properties: {
          id: nonemptyString,
          sourceRecordId: nonemptyString,
          proposedConstituents: {
            type: 'array',
            minItems: 2,
            items: proposedConstituentV35JsonSchema,
          },
          rationale: nonemptyString,
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  },
} as const;

export const KNOWLEDGE_AUTO_REVIEW_V35_NORMALIZED_CONSTITUENT_POLICY = `
V3.5 normalized constituent declaration policy:
- constituentSplitProposals[].proposedConstituents[] is the only authoritative location for full
  constituent declarations. Never place a constituents array or constituent object in an
  assessment.
- A PROPOSE_CONSTITUENT_SPLIT assessment has containsMultipleKnowledgeObjects=true and a nonempty
  constituentSplitProposalRef. That ID resolves to exactly one proposal with the same
  sourceRecordId. KEEP_AS_SINGLE_CONCEPT and ONTOLOGY_AMBIGUOUS must not carry that reference.
- Proposal IDs are globally unique. Temporary refs are globally unique and declared in exactly one
  authoritative split proposal. One source split assessment owns one proposal and one proposal is
  owned by one source split assessment. Output and array order have no semantic meaning.
- Every constituent temporary ref used by an ontology boundary, Learning Objective, prerequisite,
  prerequisite audit, or graph-missing output must resolve from the complete proposal symbol table.
  Do not invent, repair, rename, or synthesize proposal IDs or temporary refs.
- Temporary refs are review-only identities, not canonical Concept IDs. Never copy a temporary ref
  into a canonical ID field.
- Boundary members keep the V3.4 discriminated shape. A CONSTITUENT_PROPOSAL boundary member is
  valid only when its temporaryRef belongs to a proposal linked to its valid split assessment.
- Generic structural example: assessment source-record-alpha references split-alpha; split-alpha
  owns two complete constituent declarations with unique refs. Downstream objects may reference
  those refs only after that declaration. No declaration is copied back into the assessment.
`.trim();

export const KNOWLEDGE_AUTO_REVIEW_V35_GENERIC_STRUCTURAL_EXAMPLES = `
V3.5 generic structural examples:
- A keep assessment declares only its source, false multiplicity, keep action, and rationale. It
  has no proposal reference and no constituent objects.
- A split assessment for source-record-alpha references split-alpha. The split-alpha proposal owns
  two or more complete declarations with distinct titles and refs, and declares the same source.
- A downstream target using temp-alpha resolves only after every proposal declaration has been
  indexed. A missing or rejected owner fails at its primary governed path.
`.trim();

export const KNOWLEDGE_AUTO_REVIEW_V35_SYSTEM_PROMPT =
  KNOWLEDGE_AUTO_REVIEW_V34_SYSTEM_PROMPT.replace(
    `Prompt version: ${KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v34}.`,
    `Prompt version: ${KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v35}.`
  )
    .replace(
      KNOWLEDGE_AUTO_REVIEW_V3_FEW_SHOTS,
      KNOWLEDGE_AUTO_REVIEW_V35_GENERIC_STRUCTURAL_EXAMPLES
    )
    .replace(KNOWLEDGE_AUTO_REVIEW_V33_WITHIN_RECORD_POLICY, '')
    .replace(
      KNOWLEDGE_AUTO_REVIEW_V34_BOUNDARY_REFERENCE_POLICY,
      KNOWLEDGE_AUTO_REVIEW_V35_NORMALIZED_CONSTITUENT_POLICY
    )
    .trim();

export function buildKnowledgeAutoReviewV35Prompt(input: KnowledgeAutoReviewInput): string {
  const { retrievalTrace, ...providerInput } = input;
  return JSON.stringify(
    {
      instruction:
        'Review unresolved records under the V3.5 single-authority constituent contract and return only the governed structured output.',
      constituentContract: {
        identityModel: 'SINGLE_AUTHORITATIVE_DECLARATION_PLUS_REFERENCE',
        authoritativeDeclaration: 'constituentSplitProposals[].proposedConstituents[]',
        assessmentReference: 'withinRecordAssessments[].constituentSplitProposalRef',
        assessmentDuplicatesConstituents: false,
        temporaryRefsCanonical: false,
        outputOrderSignificant: false,
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
