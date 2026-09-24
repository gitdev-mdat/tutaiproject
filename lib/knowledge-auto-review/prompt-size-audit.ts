import type { KnowledgeAutoReviewInput } from '@/lib/ai/ai-types';
import {
  KNOWLEDGE_AUTO_REVIEW_V1_SYSTEM_PROMPT,
  KNOWLEDGE_AUTO_REVIEW_V2_FEW_SHOTS,
  KNOWLEDGE_AUTO_REVIEW_V2_SYSTEM_PROMPT,
} from '@/lib/ai/prompts/knowledge-auto-review';
import {
  KNOWLEDGE_AUTO_REVIEW_V3_FEW_SHOTS,
  KNOWLEDGE_AUTO_REVIEW_V3_SYSTEM_PROMPT,
} from '@/lib/ai/prompts/knowledge-auto-review-v3';
import { KNOWLEDGE_AUTO_REVIEW_V31_SYSTEM_PROMPT } from '@/lib/ai/prompts/knowledge-auto-review-v3-1';
import {
  KNOWLEDGE_AUTO_REVIEW_V32_ONTOLOGY_POLICY,
  KNOWLEDGE_AUTO_REVIEW_V32_SYSTEM_PROMPT,
} from '@/lib/ai/prompts/knowledge-auto-review-v3-2';

export function estimatePromptTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface KnowledgePromptSizeAudit {
  v1StaticSystem: { characters: number; estimatedTokens: number };
  v2StaticSystem: { characters: number; estimatedTokens: number };
  v2FewShotContribution: { characters: number; estimatedTokens: number };
  v3StaticSystem: { characters: number; estimatedTokens: number };
  v3FewShotContribution: { characters: number; estimatedTokens: number };
  v31StaticSystem: { characters: number; estimatedTokens: number };
  v32StaticSystem: { characters: number; estimatedTokens: number };
  v32OntologyPolicyContribution: { characters: number; estimatedTokens: number };
  dynamicLessonInput: { characters: number; estimatedTokens: number };
  retrievedCanonicalContext: { characters: number; estimatedTokens: number };
}

function size(text: string) {
  return { characters: text.length, estimatedTokens: estimatePromptTokens(text) };
}

export function auditKnowledgePromptSize(
  input: KnowledgeAutoReviewInput
): KnowledgePromptSizeAudit {
  const { existingConceptCandidates, ...lessonInput } = input;
  return {
    v1StaticSystem: size(KNOWLEDGE_AUTO_REVIEW_V1_SYSTEM_PROMPT),
    v2StaticSystem: size(KNOWLEDGE_AUTO_REVIEW_V2_SYSTEM_PROMPT),
    v2FewShotContribution: size(KNOWLEDGE_AUTO_REVIEW_V2_FEW_SHOTS),
    v3StaticSystem: size(KNOWLEDGE_AUTO_REVIEW_V3_SYSTEM_PROMPT),
    v3FewShotContribution: size(KNOWLEDGE_AUTO_REVIEW_V3_FEW_SHOTS),
    v31StaticSystem: size(KNOWLEDGE_AUTO_REVIEW_V31_SYSTEM_PROMPT),
    v32StaticSystem: size(KNOWLEDGE_AUTO_REVIEW_V32_SYSTEM_PROMPT),
    v32OntologyPolicyContribution: size(KNOWLEDGE_AUTO_REVIEW_V32_ONTOLOGY_POLICY),
    dynamicLessonInput: size(JSON.stringify(lessonInput)),
    retrievedCanonicalContext: size(JSON.stringify(existingConceptCandidates)),
  };
}
