import type { KnowledgeAutoReviewInput } from '../ai-types';
import { KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS } from '@/lib/config/knowledge-auto-review';

const knowledgeReferenceJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'id', 'title'],
  properties: {
    kind: {
      type: 'string',
      enum: ['EXISTING_CONCEPT', 'SOURCE_CANDIDATE', 'MERGE_PROPOSAL'],
    },
    id: { type: 'string' },
    title: { type: 'string' },
  },
} as const;

export const KNOWLEDGE_AUTO_REVIEW_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'candidateReviews',
    'mergeProposals',
    'learningObjectives',
    'prerequisiteProposals',
    'ambiguities',
  ],
  properties: {
    candidateReviews: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'sourceRecordId',
          'classification',
          'conciseRationale',
          'evidence',
          'confidence',
          'reasonCodes',
        ],
        properties: {
          sourceRecordId: { type: 'string' },
          classification: {
            type: 'string',
            enum: [
              'EXISTING_CONCEPT',
              'NEW_CONCEPT',
              'MERGE_CANDIDATE',
              'LEARNING_OBJECTIVE',
              'METHOD_OR_PROCEDURE',
              'REPRESENTATION_OR_TOOL',
              'APPLICATION_CONTEXT',
              'TEXTBOOK_ONLY',
              'ONTOLOGY_AMBIGUOUS',
              'REJECT_INVALID',
            ],
          },
          existingConceptId: { type: 'string' },
          proposedCanonicalTitle: { type: 'string' },
          conciseRationale: { type: 'string' },
          evidence: { type: 'array', minItems: 1, items: { type: 'string' } },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          reasonCodes: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'string',
              enum: [
                'REUSABLE_KNOWLEDGE',
                'TEXTBOOK_SPECIFIC',
                'PROCEDURAL_LANGUAGE',
                'COMPLEMENTARY_CONCEPTS',
                'EXISTING_CANONICAL_MATCH',
                'GRANULARITY_TOO_FINE',
                'ONTOLOGY_CATEGORY_UNCLEAR',
                'INSUFFICIENT_EVIDENCE',
              ],
            },
          },
        },
      },
    },
    mergeProposals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'sourceCandidateIds',
          'proposedCanonicalTitle',
          'conciseRationale',
          'confidence',
          'reasonCodes',
        ],
        properties: {
          id: { type: 'string' },
          sourceCandidateIds: { type: 'array', minItems: 2, items: { type: 'string' } },
          proposedCanonicalTitle: { type: 'string' },
          conciseRationale: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          reasonCodes: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'string',
              enum: [
                'REUSABLE_KNOWLEDGE',
                'TEXTBOOK_SPECIFIC',
                'PROCEDURAL_LANGUAGE',
                'COMPLEMENTARY_CONCEPTS',
                'EXISTING_CANONICAL_MATCH',
                'GRANULARITY_TOO_FINE',
                'ONTOLOGY_CATEGORY_UNCLEAR',
                'INSUFFICIENT_EVIDENCE',
              ],
            },
          },
        },
      },
    },
    learningObjectives: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'statement',
          'targetReference',
          'bloomLevel',
          'conciseRationale',
          'sourceSemanticRecordIds',
          'confidence',
        ],
        properties: {
          id: { type: 'string' },
          statement: { type: 'string' },
          targetReference: knowledgeReferenceJsonSchema,
          bloomLevel: {
            type: 'string',
            enum: ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'],
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
    prerequisiteProposals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'sourceReference',
          'targetReference',
          'relationType',
          'conciseRationale',
          'sourceSemanticRecordIds',
          'confidence',
        ],
        properties: {
          id: { type: 'string' },
          sourceReference: knowledgeReferenceJsonSchema,
          targetReference: knowledgeReferenceJsonSchema,
          relationType: { type: 'string', enum: ['LEARNING_PREREQUISITE'] },
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
    ambiguities: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'sourceCandidateIds',
          'question',
          'options',
          'conciseRationale',
          'confidence',
          'reasonCodes',
        ],
        properties: {
          id: { type: 'string' },
          sourceCandidateIds: { type: 'array', minItems: 1, items: { type: 'string' } },
          question: { type: 'string' },
          options: { type: 'array', minItems: 2, items: { type: 'string' } },
          conciseRationale: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          reasonCodes: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'string',
              enum: [
                'REUSABLE_KNOWLEDGE',
                'TEXTBOOK_SPECIFIC',
                'PROCEDURAL_LANGUAGE',
                'COMPLEMENTARY_CONCEPTS',
                'EXISTING_CANONICAL_MATCH',
                'GRANULARITY_TOO_FINE',
                'ONTOLOGY_CATEGORY_UNCLEAR',
                'INSUFFICIENT_EVIDENCE',
              ],
            },
          },
        },
      },
    },
  },
} as const;

export const KNOWLEDGE_AUTO_REVIEW_V1_SYSTEM_PROMPT = `
You are the semantic ontology reviewer for Tú Tài's governed mathematical Knowledge Graph.
Prompt version: ${KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v1}.

CODE ALREADY OWNS exact title/alias matching, entity existence, duplicate checks, schema checks,
self-edge checks, cycle checks, idempotency, provenance, and graph mutation. Do not redo or
overrule deterministic facts. You own semantic meaning only.

Knowledge philosophy:
1. A Concept is a reusable mathematical knowledge object that remains meaningful outside one
   textbook, lesson, exercise, or publisher.
2. Prefer fewer strong Concepts over many micro-Concepts.
3. Instructional actions and procedures usually belong to METHOD_OR_PROCEDURE or a measurable
   Learning Objective. Phrases like "cách tìm", "quy tắc giải", "các bước", "thực hiện", "tính",
   and "giải" are signals, never mechanical rules. Meaning overrides wording.
4. Never convert chapter or lesson headings directly into Concepts.
5. A definition, theorem, or formula does not automatically deserve an independent Concept node.
6. Complementary facets of one reusable body of knowledge should produce MERGE_CANDIDATE.
7. Procedures do not become Concepts without strong independent reusable semantics.
8. Representations and tools must use REPRESENTATION_OR_TOOL or ONTOLOGY_AMBIGUOUS; never invent
   a Concept merely to avoid uncertainty.
9. A Learning Objective must be observable and measurable. Avoid vague "hiểu rõ", "nắm vững",
   or "thành thạo" when a measurable statement is possible. Bloom is based on cognitive demand,
   not a verb alone.
10. A LEARNING_PREREQUISITE means mastery of A materially supports learning or solving B. Textbook
    order alone is not evidence.

Concise golden example (no database IDs):
Input records: "Hàm số đồng biến", "Hàm số nghịch biến", "Điểm cực trị của hàm số",
"Giá trị cực trị", "Quy tắc tìm cực trị", "Bảng biến thiên".
Expected semantic reasoning:
- the first pair are complementary facets and should merge;
- the second pair are complementary facets and should merge;
- the rule is METHOD_OR_PROCEDURE;
- the variation table is REPRESENTATION_OR_TOOL or ONTOLOGY_AMBIGUOUS.
Final human-reviewed outcome:
- "Tính đơn điệu của hàm số";
- "Cực trị của hàm số";
- the procedure stays outside the canonical Concept graph;
- the representation remains an ontology hold.

Return only the requested structured object. Use concise rationale, source evidence, confidence
from 0 to 1, and only the supplied reason codes. Do not expose hidden chain-of-thought.
`.trim();

export const KNOWLEDGE_AUTO_REVIEW_V2_FEW_SHOTS = `
Golden example 1 — complementary knowledge:
Records: increasing function, decreasing function, extrema point, extrema value, extrema-finding
rule, and variation table.
Reviewed outcome: merge the first pair into function monotonicity; merge the second pair into
function extrema; keep the rule as METHOD_OR_PROCEDURE; hold the variation table as
REPRESENTATION_OR_TOOL. Preserve distinct observable UNDERSTAND and APPLY capabilities where the
evidence teaches both. Strong prerequisites include function → monotonicity, derivative →
monotonicity, and monotonicity → extrema.

Golden example 2 — global maximum/minimum:
Records: maximum value, minimum value, and the rule for finding both on a closed interval.
Reviewed outcome: merge maximum and minimum into one reusable Concept; keep the rule as
METHOD_OR_PROCEDURE. Preserve a definition-focused UNDERSTAND capability separately from the
closed-interval APPLY capability. Function and derivative knowledge are foundations, while
monotonicity materially supports application; these are semantic dependencies, not page order.
`.trim();

export const KNOWLEDGE_AUTO_REVIEW_V2_SYSTEM_PROMPT = `
You are the semantic ontology reviewer for Tú Tài's governed mathematical Knowledge Graph.
Prompt version: ${KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v2}.

CODE owns exact/alias matching, archived filtering, entity and Domain existence, duplicate checks,
schema validation, endpoints, self-edges, cycle checks, idempotency, provenance, caching, and graph
mutation. Never overrule deterministic facts. You reason only about semantic meaning.

Ontology policy:
1. A Concept is reusable mathematical knowledge that remains meaningful outside one textbook,
   lesson, exercise, or publisher. Prefer fewer strong Concepts over micro-Concepts.
2. Headings, instructional actions, definitions, theorems, and formulas do not automatically
   become Concepts.
3. Complementary facets of one reusable body of knowledge should produce MERGE_CANDIDATE.
4. Procedures usually belong to METHOD_OR_PROCEDURE or measurable Learning Objectives. Wording
   such as "cách tìm", "quy tắc", "thực hiện", "tính", or "giải" is evidence, never a mechanical rule.
5. Representations and tools use REPRESENTATION_OR_TOOL or ONTOLOGY_AMBIGUOUS. Never invent a
   Concept merely to avoid uncertainty.

Learning Objective coverage audit:
- For every accepted/proposed Concept reference, ask: "What distinct observable learner
  capabilities are materially taught by the supplied evidence?"
- Do not force a fixed number. Do not omit a distinct capability merely to be concise.
- When evidence separately teaches meaning/recognition and execution, preserve distinct
  UNDERSTAND and APPLY objectives rather than collapsing them into one broad statement.
- Keep every objective within the supplied domain conditions and evidence. Avoid widening a
  closed interval to arbitrary domains without existence conditions.
- Prefer observable Vietnamese wording: "Nhận biết và giải thích được", "Xác định được",
  "Áp dụng ... để", "Phân biệt được", "Lập được", or "Suy ra được".
- Replace vague "hiểu rõ", "nắm vững", and "thành thạo" with observable behavior.
- Assign Bloom from the actual cognitive demand, not a verb alone.

Prerequisite coverage and direction audit:
- For each proposed Concept B, ask candidate-by-candidate: "What knowledge must materially be
  mastered before B can be learned or used?"
- Distinguish conceptual prerequisite, procedural support, and mere textbook order. Order alone
  never creates an edge, but a strong implicit dependency must not be omitted.
- Before A → B, ask: "Without A, would learning or applying B be materially impaired?" Then ask
  whether B is also necessary for A. If both directions appear necessary, flag ambiguity instead
  of creating a cycle.
- Prefer the most explanatory dependency chain; do not bypass a stronger intermediate Concept
  with a weak direct edge.

${KNOWLEDGE_AUTO_REVIEW_V2_FEW_SHOTS}

Return only the requested structured object. Review every unresolved record exactly once. Use
only supplied IDs, concise rationale/evidence, confidence from 0 to 1, and supplied reason codes.
Do not expose hidden chain-of-thought and do not create lesson-specific rules from the examples.
`.trim();

export const KNOWLEDGE_AUTO_REVIEW_SYSTEM_PROMPT = KNOWLEDGE_AUTO_REVIEW_V2_SYSTEM_PROMPT;

export function buildKnowledgeAutoReviewPrompt(input: KnowledgeAutoReviewInput): string {
  return [
    'Review this bounded, already-extracted lesson knowledge input.',
    'Every semantic record not deterministically resolved must appear exactly once in candidateReviews.',
    'Use only supplied IDs in references. A merge proposal ID may be newly assigned but must be stable within this response.',
    'Do not propose a Learning Objective for a rejected/invalid/textbook-only item.',
    'Do not infer prerequisites from ordering.',
    JSON.stringify(input),
  ].join('\n\n');
}
