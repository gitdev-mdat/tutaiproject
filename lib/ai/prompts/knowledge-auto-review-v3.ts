import type { KnowledgeAutoReviewInput } from '../ai-types';
import { KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS } from '@/lib/config/knowledge-auto-review';
import { KNOWLEDGE_AUTO_REVIEW_JSON_SCHEMA as V2_JSON_SCHEMA } from './knowledge-auto-review';

const v3Classifications = [
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

const v3ReasonCodes = [
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

const v3ReferenceJsonSchema =
  V2_JSON_SCHEMA.properties.learningObjectives.items.properties.targetReference;

const v3CandidateReviewJsonSchema = {
  ...V2_JSON_SCHEMA.properties.candidateReviews.items,
  required: [
    ...V2_JSON_SCHEMA.properties.candidateReviews.items.required,
    'evidenceSufficiency',
    'titleEvidenceAssessment',
  ],
  properties: {
    ...V2_JSON_SCHEMA.properties.candidateReviews.items.properties,
    classification: { type: 'string', enum: v3Classifications },
    reasonCodes: {
      type: 'array',
      minItems: 1,
      items: { type: 'string', enum: v3ReasonCodes },
    },
    evidenceSufficiency: {
      type: 'string',
      enum: ['SUFFICIENT', 'WEAK', 'CONFLICTING', 'INSUFFICIENT'],
    },
    titleEvidenceAssessment: {
      type: 'string',
      enum: ['CONSISTENT', 'CONFLICTING', 'UNCLEAR'],
    },
  },
} as const;

export const KNOWLEDGE_AUTO_REVIEW_V3_JSON_SCHEMA = {
  ...V2_JSON_SCHEMA,
  required: [...V2_JSON_SCHEMA.required, 'prerequisiteAudits', 'missingPrerequisites'],
  properties: {
    ...V2_JSON_SCHEMA.properties,
    candidateReviews: {
      type: 'array',
      items: v3CandidateReviewJsonSchema,
    },
    ambiguities: {
      ...V2_JSON_SCHEMA.properties.ambiguities,
      items: {
        ...V2_JSON_SCHEMA.properties.ambiguities.items,
        properties: {
          ...V2_JSON_SCHEMA.properties.ambiguities.items.properties,
          reasonCodes: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', enum: v3ReasonCodes },
          },
        },
      },
    },
    prerequisiteAudits: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'sourceReference',
          'targetReference',
          'assessment',
          'conciseRationale',
          'sourceSemanticRecordIds',
          'confidence',
        ],
        properties: {
          id: { type: 'string' },
          sourceReference: v3ReferenceJsonSchema,
          targetReference: v3ReferenceJsonSchema,
          assessment: {
            type: 'string',
            enum: ['STRONG_PREREQUISITE', 'SUPPORTING_KNOWLEDGE', 'NOT_REQUIRED'],
          },
          conciseRationale: { type: 'string' },
          sourceSemanticRecordIds: {
            type: 'array',
            minItems: 1,
            items: { type: 'string' },
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    missingPrerequisites: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'title',
          'targetReference',
          'classification',
          'conciseRationale',
          'sourceSemanticRecordIds',
          'confidence',
        ],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          targetReference: v3ReferenceJsonSchema,
          classification: { type: 'string', enum: ['GRAPH_CONCEPT_MISSING'] },
          conciseRationale: { type: 'string' },
          sourceSemanticRecordIds: {
            type: 'array',
            minItems: 1,
            items: { type: 'string' },
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  },
} as const;

export const KNOWLEDGE_AUTO_REVIEW_V3_FEW_SHOTS = `
Compact calibration examples:

1. Evaluated lesson A: two records describing increasing and decreasing behavior are compatible
facets of one reusable monotonicity object and may merge when both have SUFFICIENT evidence. A
step-by-step extrema rule is METHOD_OR_PROCEDURE. Definition-focused and application-focused
capabilities become separate measurable LOs. A variation-table item with uncertain ontology is
held, not promoted.

2. Evaluated lesson B: maximum-value and minimum-value records may merge when their definitions
are sufficient and complementary. A sequence for finding them is METHOD_OR_PROCEDURE, not a
separate Concept.

3. Conflict pattern: a title names one mathematical object while the description and source
evidence define a materially different object. Return ONTOLOGY_AMBIGUOUS with CONFLICTING evidence
and TITLE_EVIDENCE_CONFLICT. Do not repair the title or invent a convenient Concept.

4. Application pattern: a real-world quantity appears only inside a modeled scenario and has no
independent reusable mathematical definition. Return APPLICATION_CONTEXT. It may support an
application LO or metadata without becoming a graph Concept.
`.trim();

export const KNOWLEDGE_AUTO_REVIEW_V3_SYSTEM_PROMPT = `
You are a conservative ontology review assistant for a Vietnamese K-12 mathematical Knowledge
Graph. Prompt version: ${KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v3}.

Goal: minimize false canonicalization. An ontology hold is a valid, preferred governance outcome
when evidence is incomplete, conflicting, or semantically uncertain. Never commit graph data.

Candidate pass:
1. Review every unresolved semantic record exactly once.
2. First classify its role as reusable canonical knowledge, method/procedure, application context,
example/exercise, representation/tool, textbook-only material, ambiguity, or invalid extraction.
3. Before NEW_CONCEPT or MERGE_CANDIDATE, explicitly assess whether the object is materially
explained, independently understandable outside the local problem, reusable across sources, and
more than a contextual label. Return evidenceSufficiency as SUFFICIENT, WEAK, CONFLICTING, or
INSUFFICIENT.
4. Compare title with description, semantic payload, and quoted source evidence. Return
titleEvidenceAssessment as CONSISTENT, CONFLICTING, or UNCLEAR. Material conflict requires
ONTOLOGY_AMBIGUOUS plus TITLE_EVIDENCE_CONFLICT; never silently rename it.
5. NEW_CONCEPT requires SUFFICIENT evidence and a CONSISTENT title. WEAK or INSUFFICIENT evidence
cannot create a Concept. CONFLICTING evidence requires ONTOLOGY_AMBIGUOUS.
6. A merge requires the same reusable knowledge object, compatible or complementary facets, no
information loss, and SUFFICIENT mutually compatible evidence for every source member. Co-occurrence
or two related contextual labels is not enough. If uncertain, hold as ONTOLOGY_AMBIGUOUS.
7. APPLICATION_CONTEXT covers real-world scenarios, interpretations, modeled quantities, and
problem-specific labels unless independently defined as reusable mathematics. EXAMPLE_OR_EXERCISE
covers a concrete worked instance or task. Neither becomes a graph Concept.
8. Use concise direct evidence from the supplied record. Do not use outside facts to upgrade weak
source evidence.

Learning Objective pass:
9. Preserve observable, measurable, target-bound LOs. Split materially distinct cognitive demands.
Choose Bloom from demonstrated demand, not verb matching alone. Application contexts may provide
evidence for application LOs without becoming canonical targets.

Prerequisite completeness pass:
10. After Concept decisions, review every retrieved canonical Concept A against every accepted or
proposed Concept B. Ask whether lacking A would materially impair understanding or applying B.
Return exactly one prerequisiteAudit per A/B pair: STRONG_PREREQUISITE, SUPPORTING_KNOWLEDGE, or
NOT_REQUIRED. Only STRONG_PREREQUISITE may also appear in prerequisiteProposals.
11. Inspect source evidence for materially required knowledge absent from retrieved graph context.
Report it separately in missingPrerequisites as GRAPH_CONCEPT_MISSING. Do not invent an ID or node.
12. Never target a prerequisite edge at APPLICATION_CONTEXT or EXAMPLE_OR_EXERCISE. Attach relevant
evidence to the mathematical Concept, LO, or application metadata instead.
13. Prerequisite direction is prerequisite A -> dependent B. Never emit self-edges, duplicates, or
cycles.

Governance:
14. Exact/alias matches are deterministic. New Concepts, merges, LOs, prerequisites, ambiguities,
and representations always require humans. High-confidence non-Concept classification remains
visible audit evidence. No response authorizes canonical writes.
15. Return only JSON matching the supplied schema. Use only supplied record and Concept IDs.

${KNOWLEDGE_AUTO_REVIEW_V3_FEW_SHOTS}
`.trim();

export function buildKnowledgeAutoReviewV3Prompt(input: KnowledgeAutoReviewInput): string {
  return JSON.stringify(
    {
      instruction:
        'Review only unresolved records; complete the conservative candidate, LO, and prerequisite passes.',
      input,
    },
    null,
    2
  );
}
