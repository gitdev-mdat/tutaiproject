import type { KnowledgeAutoReviewInput } from '../ai-types';
import { KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS } from '@/lib/config/knowledge-auto-review';
import {
  KNOWLEDGE_AUTO_REVIEW_V3_JSON_SCHEMA,
  KNOWLEDGE_AUTO_REVIEW_V3_SYSTEM_PROMPT,
} from './knowledge-auto-review-v3';

const referenceJsonSchema =
  KNOWLEDGE_AUTO_REVIEW_V3_JSON_SCHEMA.properties.learningObjectives.items.properties
    .targetReference;
const { missingPrerequisites: _legacyMissingPrerequisites, ...v31Properties } =
  KNOWLEDGE_AUTO_REVIEW_V3_JSON_SCHEMA.properties;
void _legacyMissingPrerequisites;

export const KNOWLEDGE_AUTO_REVIEW_V31_JSON_SCHEMA = {
  ...KNOWLEDGE_AUTO_REVIEW_V3_JSON_SCHEMA,
  required: [
    ...KNOWLEDGE_AUTO_REVIEW_V3_JSON_SCHEMA.required.filter(
      (field) => field !== 'missingPrerequisites'
    ),
    'graphMissingPrerequisites',
  ],
  properties: {
    ...v31Properties,
    prerequisiteAudits: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['sourceConceptRef', 'targetConceptRef', 'classification', 'rationale'],
        properties: {
          sourceConceptRef: {
            ...referenceJsonSchema,
            properties: {
              ...referenceJsonSchema.properties,
              kind: { type: 'string', enum: ['EXISTING_CONCEPT'] },
            },
          },
          targetConceptRef: referenceJsonSchema,
          classification: {
            type: 'string',
            enum: ['STRONG_PREREQUISITE', 'SUPPORTING_KNOWLEDGE', 'NOT_REQUIRED'],
          },
          rationale: { type: 'string' },
        },
      },
    },
    graphMissingPrerequisites: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'reason', 'confidence'],
        properties: {
          title: { type: 'string' },
          reason: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  },
} as const;

const v31PrerequisiteContract = `
V3.1 prerequisite output contract (output completeness only):
- Prerequisite completeness is exhaustive, not selective.
- First finish all candidate and merge decisions. Then construct the complete list of accepted or
  proposed reusable Concept targets: every NEW_CONCEPT source, every EXISTING_CONCEPT decision,
  and every mergeProposals item. Do not include methods, applications, examples, representations,
  textbook-only items, rejected items, or ontology holds.
- For every retrieved canonical Concept A in existingConceptCandidates and every reusable target
  Concept B, return exactly one prerequisiteAudits row. Never omit a pair.
- Each row must contain only sourceConceptRef, targetConceptRef, classification, and rationale.
  sourceConceptRef must be the supplied EXISTING_CONCEPT reference for A. targetConceptRef must be
  the accepted/proposed reference for B. classification must be STRONG_PREREQUISITE,
  SUPPORTING_KNOWLEDGE, or NOT_REQUIRED.
- If uncertain, return SUPPORTING_KNOWLEDGE or NOT_REQUIRED and explain the uncertainty. Omission
  is never an uncertainty mechanism.
- Do not return duplicate pairs. Do not return a self-pair when both references resolve to the same
  canonical Concept.
- Only STRONG_PREREQUISITE rows may also appear in prerequisiteProposals, and every such row must
  have exactly one corresponding prerequisite proposal in the same direction.
- Knowledge absent from existingConceptCandidates is outside the canonical matrix. Return it only
  in graphMissingPrerequisites as an ID-less object containing title, reason, and confidence.
  Never invent an ID or canonical reference for graph-missing knowledge.
`.trim();

export const KNOWLEDGE_AUTO_REVIEW_V31_SYSTEM_PROMPT =
  `${KNOWLEDGE_AUTO_REVIEW_V3_SYSTEM_PROMPT.replace(
    `Prompt version: ${KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v3}.`,
    `Prompt version: ${KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v31}.`
  )
    .replace(
      'Report it separately in missingPrerequisites as GRAPH_CONCEPT_MISSING. Do not invent an ID or node.',
      'Report it separately in graphMissingPrerequisites. Do not invent an ID, node, or canonical reference.'
    )
    .replace(
      'Return exactly one prerequisiteAudit per A/B pair: STRONG_PREREQUISITE, SUPPORTING_KNOWLEDGE, or',
      'Return exactly one prerequisiteAudits row per A/B pair: STRONG_PREREQUISITE, SUPPORTING_KNOWLEDGE, or'
    )}

${v31PrerequisiteContract}`.trim();

export function buildKnowledgeAutoReviewV31Prompt(input: KnowledgeAutoReviewInput): string {
  const retrievedCanonicalConceptCount = input.existingConceptCandidates.length;
  return JSON.stringify(
    {
      instruction:
        'Review only unresolved records; complete the conservative candidate, LO, and exhaustive prerequisite passes.',
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
