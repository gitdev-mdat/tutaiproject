import type { KnowledgeAutoReviewInput } from '../ai-types';
import { KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS } from '@/lib/config/knowledge-auto-review';
import {
  KNOWLEDGE_AUTO_REVIEW_V31_JSON_SCHEMA,
  KNOWLEDGE_AUTO_REVIEW_V31_SYSTEM_PROMPT,
} from './knowledge-auto-review-v3-1';

const ontologyIdentityAssessmentJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'sameKnowledgeIdentity',
    'independentlyTeachableA',
    'independentlyTeachableB',
    'independentlyAssessableA',
    'independentlyAssessableB',
    'directionalDependencyExists',
    'constituentRelationshipExists',
    'rationale',
  ],
  properties: {
    sameKnowledgeIdentity: { type: 'boolean' },
    independentlyTeachableA: { type: 'boolean' },
    independentlyTeachableB: { type: 'boolean' },
    independentlyAssessableA: { type: 'boolean' },
    independentlyAssessableB: { type: 'boolean' },
    directionalDependencyExists: { type: 'boolean' },
    constituentRelationshipExists: { type: 'boolean' },
    rationale: { type: 'string' },
  },
} as const;

export const KNOWLEDGE_AUTO_REVIEW_V32_JSON_SCHEMA = {
  ...KNOWLEDGE_AUTO_REVIEW_V31_JSON_SCHEMA,
  required: [...KNOWLEDGE_AUTO_REVIEW_V31_JSON_SCHEMA.required, 'ontologyBoundaryRecommendations'],
  properties: {
    ...KNOWLEDGE_AUTO_REVIEW_V31_JSON_SCHEMA.properties,
    mergeProposals: {
      ...KNOWLEDGE_AUTO_REVIEW_V31_JSON_SCHEMA.properties.mergeProposals,
      items: {
        ...KNOWLEDGE_AUTO_REVIEW_V31_JSON_SCHEMA.properties.mergeProposals.items,
        required: [
          ...KNOWLEDGE_AUTO_REVIEW_V31_JSON_SCHEMA.properties.mergeProposals.items.required,
          'ontologyIdentityAssessment',
        ],
        properties: {
          ...KNOWLEDGE_AUTO_REVIEW_V31_JSON_SCHEMA.properties.mergeProposals.items.properties,
          ontologyIdentityAssessment: ontologyIdentityAssessmentJsonSchema,
        },
      },
    },
    ontologyBoundaryRecommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'sourceCandidateIds',
          'recommendation',
          'ontologyIdentityAssessment',
          'conciseRationale',
          'confidence',
        ],
        properties: {
          id: { type: 'string' },
          sourceCandidateIds: {
            type: 'array',
            minItems: 2,
            items: { type: 'string' },
          },
          recommendation: {
            type: 'string',
            enum: [
              'KEEP_SEPARATE_RELATED_CONCEPTS',
              'KEEP_SEPARATE_WITH_PART_OF_RELATION',
              'ONTOLOGY_AMBIGUOUS',
            ],
          },
          ontologyIdentityAssessment: ontologyIdentityAssessmentJsonSchema,
          conciseRationale: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  },
} as const;

export const KNOWLEDGE_AUTO_REVIEW_V32_ONTOLOGY_POLICY = `
V3.2 targeted ontology-boundary policy:
- Before proposing MERGE_CANDIDATE, answer: are the records the same reusable mathematical
  identity, or merely strongly related knowledge? Strong relatedness is never sufficient.
- Every merge proposal must include ontologyIdentityAssessment. A merge is allowed only when
  sameKnowledgeIdentity is true and all members can safely share one mastery state without losing
  an independently meaningful learning distinction.
- Common teaching order, lesson co-occurrence, lexical similarity, shared formulas, shared
  examples, shared Learning Objectives, mathematical-family membership, computation support, or
  prerequisite proximity are not merge evidence by themselves.
- Ask both mastery-separation questions: could a student understand A but still fail B, and could a
  student master B while retaining a distinct weakness in A? A stable educational distinction is
  evidence against merge. Separate target knowledge in natural Learning Objectives is also
  evidence against merge, though LO count alone never decides the result.
- Distinguish a broader reusable family from an independently meaningful constituent. If the
  member has its own definition, LO, assessment use, prerequisite profile, or diagnostic value,
  return KEEP_SEPARATE_WITH_PART_OF_RELATION in ontologyBoundaryRecommendations. This is an
  ontology recommendation only; do not create a canonical PART_OF relation.
- If a meaningful A -> B dependency exists, A and B cannot also be one merged Concept unless the
  apparent direction is only a wording artifact. Return KEEP_SEPARATE_RELATED_CONCEPTS when the
  distinction is supported, otherwise ONTOLOGY_AMBIGUOUS.
- MERGE_CANDIDATE requires sufficient consistent evidence, same identity, no meaningful
  independent mastery distinction, no directional dependency, no important constituent
  relationship, and confidence at or above the governed merge threshold. When uncertain, prefer
  an ontology hold. False-negative merges are safer than destructive over-merging.
- Add ontologyBoundaryRecommendations for every evaluated pair that is kept separate or held.
  Do not add a merge proposal for the same pair.
`.trim();

export const KNOWLEDGE_AUTO_REVIEW_V32_SYSTEM_PROMPT =
  `${KNOWLEDGE_AUTO_REVIEW_V31_SYSTEM_PROMPT.replace(
    `Prompt version: ${KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v31}.`,
    `Prompt version: ${KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v32}.`
  )}

${KNOWLEDGE_AUTO_REVIEW_V32_ONTOLOGY_POLICY}`.trim();

export function buildKnowledgeAutoReviewV32Prompt(input: KnowledgeAutoReviewInput): string {
  const retrievedCanonicalConceptCount = input.existingConceptCandidates.length;
  return JSON.stringify(
    {
      instruction:
        'Review unresolved records using the conservative identity test, then complete the unchanged LO and exhaustive prerequisite passes.',
      ontologyBoundaryContract: {
        identityQuestion:
          'Are these records the same reusable mathematical identity, or merely strongly related knowledge?',
        masterySeparationQuestions: [
          'Could a student understand A but still fail B?',
          'Could a student master B while retaining a distinct weakness in A?',
        ],
        governedMergeConfidenceThreshold: 0.9,
        uncertainOutcome: 'ONTOLOGY_AMBIGUOUS',
      },
      prerequisiteMatrixContract: {
        retrievedCanonicalConceptCount,
        reusableTargetConceptCount:
          'T = count of reusable Concept targets after candidate and merge decisions',
        requiredPrerequisiteAuditRows: `${retrievedCanonicalConceptCount} × T, excluding only canonical self-pairs`,
        completenessRule:
          'Every eligible canonical source/target pair must occur exactly once; uncertainty must be classified, never omitted.',
      },
      input,
    },
    null,
    2
  );
}
