import type { KnowledgeAutoReviewInput } from '../ai-types';
import { KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS } from '@/lib/config/knowledge-auto-review';
import {
  KNOWLEDGE_AUTO_REVIEW_V32_JSON_SCHEMA,
  KNOWLEDGE_AUTO_REVIEW_V32_SYSTEM_PROMPT,
} from './knowledge-auto-review-v3-2';

const v32Reference =
  KNOWLEDGE_AUTO_REVIEW_V32_JSON_SCHEMA.properties.learningObjectives.items.properties
    .targetReference;

const v33Reference = {
  ...v32Reference,
  properties: {
    ...v32Reference.properties,
    kind: {
      type: 'string',
      enum: ['EXISTING_CONCEPT', 'SOURCE_CANDIDATE', 'MERGE_PROPOSAL', 'CONSTITUENT_PROPOSAL'],
    },
  },
} as const;

const constituentJsonSchema = {
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
    temporaryRef: { type: 'string' },
    proposedTitle: { type: 'string' },
    rationale: { type: 'string' },
    independentlyTeachable: { type: 'boolean' },
    independentlyAssessable: { type: 'boolean' },
    reusableAcrossProblems: { type: 'boolean' },
    evidenceSpan: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
} as const;

export const KNOWLEDGE_AUTO_REVIEW_V33_JSON_SCHEMA = {
  ...KNOWLEDGE_AUTO_REVIEW_V32_JSON_SCHEMA,
  required: [
    ...KNOWLEDGE_AUTO_REVIEW_V32_JSON_SCHEMA.required,
    'withinRecordAssessments',
    'constituentSplitProposals',
  ],
  properties: {
    ...KNOWLEDGE_AUTO_REVIEW_V32_JSON_SCHEMA.properties,
    learningObjectives: {
      ...KNOWLEDGE_AUTO_REVIEW_V32_JSON_SCHEMA.properties.learningObjectives,
      items: {
        ...KNOWLEDGE_AUTO_REVIEW_V32_JSON_SCHEMA.properties.learningObjectives.items,
        properties: {
          ...KNOWLEDGE_AUTO_REVIEW_V32_JSON_SCHEMA.properties.learningObjectives.items.properties,
          targetReference: v33Reference,
        },
      },
    },
    prerequisiteProposals: {
      ...KNOWLEDGE_AUTO_REVIEW_V32_JSON_SCHEMA.properties.prerequisiteProposals,
      items: {
        ...KNOWLEDGE_AUTO_REVIEW_V32_JSON_SCHEMA.properties.prerequisiteProposals.items,
        properties: {
          ...KNOWLEDGE_AUTO_REVIEW_V32_JSON_SCHEMA.properties.prerequisiteProposals.items
            .properties,
          sourceReference: v33Reference,
          targetReference: v33Reference,
        },
      },
    },
    prerequisiteAudits: {
      ...KNOWLEDGE_AUTO_REVIEW_V32_JSON_SCHEMA.properties.prerequisiteAudits,
      items: {
        ...KNOWLEDGE_AUTO_REVIEW_V32_JSON_SCHEMA.properties.prerequisiteAudits.items,
        properties: {
          ...KNOWLEDGE_AUTO_REVIEW_V32_JSON_SCHEMA.properties.prerequisiteAudits.items.properties,
          targetConceptRef: v33Reference,
        },
      },
    },
    withinRecordAssessments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'sourceRecordId',
          'containsMultipleKnowledgeObjects',
          'recommendedAction',
          'rationale',
        ],
        properties: {
          sourceRecordId: { type: 'string' },
          containsMultipleKnowledgeObjects: { type: 'boolean' },
          constituents: {
            type: 'array',
            minItems: 2,
            items: constituentJsonSchema,
          },
          recommendedAction: {
            type: 'string',
            enum: ['KEEP_AS_SINGLE_CONCEPT', 'PROPOSE_CONSTITUENT_SPLIT', 'ONTOLOGY_AMBIGUOUS'],
          },
          rationale: { type: 'string' },
        },
      },
    },
    constituentSplitProposals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'sourceRecordId', 'proposedConstituents', 'rationale', 'confidence'],
        properties: {
          id: { type: 'string' },
          sourceRecordId: { type: 'string' },
          proposedConstituents: {
            type: 'array',
            minItems: 2,
            items: constituentJsonSchema,
          },
          rationale: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  },
} as const;

export const KNOWLEDGE_AUTO_REVIEW_V33_WITHIN_RECORD_POLICY = `
V3.3 governed within-record granularity policy:
- Before accepting NEW_CONCEPT for each semantic record, decide whether the record contains more
  than one independently meaningful reusable mathematical identity. Do not infer a split merely
  from conjunctions, multiple nouns, formulas, examples, or textbook subpoints.
- Apply the mastery-separation test: could a learner understand one constituent while failing the
  other, and could each constituent have its own Learning Objective or prerequisite profile?
- PROPOSE_CONSTITUENT_SPLIT requires at least two distinct identities, a direct evidenceSpan for
  each, independent teachability, independent assessability, reuse across problems, and diagnostic
  mastery value. Synonyms and definition/explanation fragments remain one Concept.
- Emit exactly one withinRecordAssessments entry for every reviewed source record. Emit a
  constituentSplitProposals item only for a valid PROPOSE_CONSTITUENT_SPLIT assessment.
- A split is a human-confirmed proposal. Never create canonical IDs or silently replace the source
  record. The umbrella NEW_CONCEPT remains human-required until review.
- Learning Objectives and prerequisite reasoning may target CONSTITUENT_PROPOSAL temporaryRef
  values. Target the umbrella only when the capability truly spans every constituent.
- The prerequisite matrix uses governed constituent targets instead of a split umbrella. It
  remains exhaustive over the filtered retrieved canonical Concept set.
`.trim();

export const KNOWLEDGE_AUTO_REVIEW_V33_SYSTEM_PROMPT =
  `${KNOWLEDGE_AUTO_REVIEW_V32_SYSTEM_PROMPT.replace(
    `Prompt version: ${KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v32}.`,
    `Prompt version: ${KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v33}.`
  )}

${KNOWLEDGE_AUTO_REVIEW_V33_WITHIN_RECORD_POLICY}`.trim();

export function buildKnowledgeAutoReviewV33Prompt(input: KnowledgeAutoReviewInput): string {
  const { retrievalTrace, ...providerInput } = input;
  const retrievedCanonicalConceptCount = input.existingConceptCandidates.length;
  return JSON.stringify(
    {
      instruction:
        'Review unresolved records with V3.2 ontology safety plus V3.3 within-record analysis, then complete LO and exhaustive prerequisite passes.',
      withinRecordContract: {
        assessmentCount: input.semanticRecords.length,
        splitOutcome: 'CONSTITUENT_SPLIT_PROPOSAL_REQUIRES_HUMAN_CONFIRMATION',
        masteryQuestion:
          'Could a learner understand A while failing B, and could B have its own LO or prerequisite profile?',
      },
      retrievalContract: {
        retrievedCanonicalConceptCount,
        retrievalVersion: retrievalTrace?.version ?? 'knowledge-retrieval-v3.3',
        mayReturnFewerThanTopK: true,
      },
      prerequisiteMatrixContract: {
        retrievedCanonicalConceptCount,
        reusableTargetConceptCount:
          'T = governed reusable targets; constituent refs replace an umbrella when split is proposed',
        requiredPrerequisiteAuditRows: `${retrievedCanonicalConceptCount} × T, excluding only canonical self-pairs`,
        completenessRule:
          'Every eligible canonical source/target pair must occur exactly once; uncertainty must be classified, never omitted.',
      },
      input: providerInput,
    },
    null,
    2
  );
}
