import { GEMINI_MODELS } from './models';

export const KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS = {
  v1: 'knowledge-auto-review-v1',
  v2: 'knowledge-auto-review-v2',
  v3: 'knowledge-auto-review-v3',
  v31: 'knowledge-auto-review-v3.1',
  v32: 'knowledge-auto-review-v3.2',
  v33: 'knowledge-auto-review-v3.3',
  v34: 'knowledge-auto-review-v3.4',
  v35: 'knowledge-auto-review-v3.5',
} as const;

export const KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSION = KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v35;

export const AUTO_REVIEW_THRESHOLDS = {
  semanticHighConfidence: 0.88,
  mergeHighConfidence: 0.9,
  ambiguityThreshold: 0.72,
} as const;

export const AUTO_REVIEW_RETRY = {
  maxAttempts: 3,
  baseDelayMs: 300,
  maxDelayMs: 2_000,
} as const;

export const KNOWLEDGE_AUTO_REVIEW_MODELS = {
  semanticClassification: GEMINI_MODELS.semanticClassification,
  ontologyAmbiguity: GEMINI_MODELS.ontologyAmbiguity,
} as const;

export const KNOWLEDGE_RETRIEVAL_V33 = {
  version: 'knowledge-retrieval-v3.3',
  maxTopK: 12,
  minimumRelevanceScore: 1.75,
  noDomainMinimumBoost: 0.75,
  minimumSemanticContribution: 0.5,
  domainHintMinimumScore: 0.18,
  weights: {
    sameDomain: 2.4,
    relatedDomain: 0.8,
    titleTokenOverlap: 4,
    aliasTokenOverlap: 3.5,
    textbookMappingSupport: 2.8,
    prerequisiteNeighbor: 1.4,
    unrelatedDomainPenalty: 2.2,
    weakRelatedDomainPenalty: 1.1,
  },
} as const;

// Conservative calibration policy; canonical writes always remain human-controlled.
export const AUTO_REVIEW_POLICY_VERSION = 'knowledge-auto-review-policy-v3.5';
