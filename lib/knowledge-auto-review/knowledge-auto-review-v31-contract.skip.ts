import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import type { AiGateway } from '@/lib/ai/ai-gateway';
import {
  AiProviderError,
  knowledgeAutoReviewV31ResultSchema,
  type AutoReviewReference,
  type KnowledgeAutoReviewInput,
  type KnowledgeAutoReviewSession,
  type KnowledgeAutoReviewV31Result,
} from '@/lib/ai/ai-types';
import {
  AUTO_REVIEW_POLICY_VERSION,
  KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSION,
  KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS,
} from '@/lib/config/knowledge-auto-review';
import {
  KNOWLEDGE_AUTO_REVIEW_V31_SYSTEM_PROMPT,
  buildKnowledgeAutoReviewV31Prompt,
} from '@/lib/ai/prompts/knowledge-auto-review-v3-1';
import type { KgDocument } from '@/lib/knowledge-graph/kg-types';
import type { PipelineDocument } from '@/lib/pipeline/types';
import type { SemanticProposalPackage } from '@/lib/textbook/semantic-proposal-types';
import type { LessonConceptMapping, Textbook } from '@/lib/textbook/types';
import { applyKnowledgeReviewPolicy, runKnowledgeAutoReview } from './knowledge-auto-review-engine';
import {
  deterministicHash,
  knowledgeAutoReviewInputHash,
  prepareKnowledgeAutoReviewInput,
} from './knowledge-auto-review-retrieval';
import type { KnowledgeAutoReviewStore } from './knowledge-auto-review-storage';

class MemoryStore implements KnowledgeAutoReviewStore {
  sessions: KnowledgeAutoReviewSession[] = [];

  async list() {
    return structuredClone(this.sessions);
  }

  async upsert(session: KnowledgeAutoReviewSession) {
    const index = this.sessions.findIndex((item) => item.id === session.id);
    if (index >= 0) this.sessions[index] = structuredClone(session);
    else this.sessions.push(structuredClone(session));
  }
}

function input(retrievedCount: number, targetCount: number): KnowledgeAutoReviewInput {
  const semanticRecordCount = Math.max(1, targetCount);
  return {
    subject: { id: 'math', title: 'Toán học' },
    grade: { id: '12', title: 'Lớp 12' },
    textbook: { id: 'book', title: 'Sách kiểm thử' },
    chapter: { id: 'chapter', title: 'Chương kiểm thử' },
    lesson: { id: 'lesson', title: 'Bài kiểm thử tổng quát' },
    semanticRecords: Array.from({ length: semanticRecordCount }, (_, index) => ({
      id: `source-${index + 1}`,
      type: 'DEFINITION',
      title: `Đối tượng ${index + 1}`,
      description: `Định nghĩa độc lập cho đối tượng ${index + 1}.`,
      sourceText: `Bằng chứng định nghĩa ${index + 1}.`,
    })),
    existingConceptCandidates: Array.from({ length: retrievedCount }, (_, index) => ({
      id: `canonical-${index + 1}`,
      title: `Kiến thức nền ${index + 1}`,
      aliases: [],
      domainId: 'domain',
    })),
    deterministicMatches: Array.from({ length: semanticRecordCount }, (_, index) => ({
      sourceRecordId: `source-${index + 1}`,
      matchType: 'NONE' as const,
      canonicalConceptIds: [],
    })),
    relevantGraphVersion: 'v31-contract',
  };
}

function targetReference(index: number): AutoReviewReference {
  return {
    kind: 'SOURCE_CANDIDATE',
    id: `source-${index + 1}`,
    title: `Đối tượng ${index + 1}`,
  };
}

function result(reviewInput: KnowledgeAutoReviewInput): KnowledgeAutoReviewV31Result {
  const targetCount =
    reviewInput.lesson.title === 'Bài kiểm thử không có Concept tái sử dụng'
      ? 0
      : reviewInput.semanticRecords.length;
  const targets = Array.from({ length: targetCount }, (_, index) => targetReference(index));
  return {
    candidateReviews: reviewInput.semanticRecords.map((record, index) => ({
      sourceRecordId: record.id,
      classification: index < targetCount ? 'NEW_CONCEPT' : 'METHOD_OR_PROCEDURE',
      proposedCanonicalTitle: index < targetCount ? record.title : undefined,
      conciseRationale:
        index < targetCount
          ? 'Reusable independently defined mathematical knowledge.'
          : 'A procedure rather than a reusable Concept.',
      evidence: [record.sourceText ?? record.title],
      confidence: 0.92,
      reasonCodes: [index < targetCount ? 'REUSABLE_KNOWLEDGE' : 'PROCEDURAL_LANGUAGE'],
      evidenceSufficiency: 'SUFFICIENT',
      titleEvidenceAssessment: 'CONSISTENT',
    })),
    mergeProposals: [],
    learningObjectives: [],
    prerequisiteProposals: [],
    prerequisiteAudits: reviewInput.existingConceptCandidates.flatMap((concept) =>
      targets.map((target) => ({
        sourceConceptRef: {
          kind: 'EXISTING_CONCEPT' as const,
          id: concept.id,
          title: concept.title,
        },
        targetConceptRef: target,
        classification: 'NOT_REQUIRED' as const,
        rationale: 'No material dependency is established by the supplied evidence.',
      }))
    ),
    graphMissingPrerequisites: [],
    ambiguities: [],
  };
}

function gateway(rawResult: KnowledgeAutoReviewV31Result): AiGateway {
  return {
    async reviewKnowledgeCandidates() {
      return { result: rawResult, rawResult };
    },
  };
}

async function run(reviewInput: KnowledgeAutoReviewInput, rawResult: KnowledgeAutoReviewV31Result) {
  const store = new MemoryStore();
  const completed = await runKnowledgeAutoReview({
    gateway: gateway(rawResult),
    store,
    input: reviewInput,
    force: true,
    promptVersion: KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v31,
    policyVersion: 'knowledge-auto-review-policy-v3.1',
  });
  return { completed, store };
}

describe('Phase 4.9 V3.1 exhaustive prerequisite output contract', () => {
  it('versions the completeness-only patch while preserving the V3 semantic policy', () => {
    expect(KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v31).toBe('knowledge-auto-review-v3.1');
    expect(KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSION).toBe(KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v35);
    expect(AUTO_REVIEW_POLICY_VERSION).toBe('knowledge-auto-review-policy-v3.5');
    expect(KNOWLEDGE_AUTO_REVIEW_V31_SYSTEM_PROMPT).toContain(
      'Prerequisite completeness is exhaustive, not selective.'
    );
    expect(createHash('sha256').update(KNOWLEDGE_AUTO_REVIEW_V31_SYSTEM_PROMPT).digest('hex')).toBe(
      '6d08376f7582ee35b27294016f5bc792ab41f4b926945f0fd3b8cf5a2aca915e'
    );
    const prompt = buildKnowledgeAutoReviewV31Prompt(input(2, 3));
    expect(prompt).toContain('"retrievedCanonicalConceptCount": 2');
    expect(prompt).toContain('2 × T');
  });

  it.each([
    { retrieved: 0, targets: 2, rows: 0 },
    { retrieved: 2, targets: 0, rows: 0 },
    { retrieved: 2, targets: 3, rows: 6 },
  ])(
    'requires $rows rows for R=$retrieved and T=$targets',
    async ({ retrieved, targets, rows }) => {
      const reviewInput = input(retrieved, targets);
      if (targets === 0) {
        reviewInput.lesson.title = 'Bài kiểm thử không có Concept tái sử dụng';
      }
      const rawResult = result(reviewInput);
      expect(rawResult.prerequisiteAudits).toHaveLength(rows);
      const { completed } = await run(reviewInput, rawResult);
      expect(completed.session.status).toBe('COMPLETED');
      expect(completed.session.rawProviderResult).toEqual(rawResult);
    }
  );

  it('rejects a missing pair and persists the untouched raw provider result first', async () => {
    const reviewInput = input(2, 3);
    const incomplete = result(reviewInput);
    incomplete.prerequisiteAudits.pop();
    const store = new MemoryStore();
    await expect(
      runKnowledgeAutoReview({
        gateway: gateway(incomplete),
        store,
        input: reviewInput,
        force: true,
        promptVersion: KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v31,
        policyVersion: 'knowledge-auto-review-policy-v3.1',
      })
    ).rejects.toThrow('Prerequisite completeness pass');
    expect(store.sessions[0]).toMatchObject({
      status: 'FAILED',
      errorCode: 'SCHEMA_VALIDATION',
      rawProviderResult: incomplete,
    });
  });

  it('rejects a duplicate canonical pair', async () => {
    const reviewInput = input(2, 3);
    const duplicate = result(reviewInput);
    duplicate.prerequisiteAudits.push(structuredClone(duplicate.prerequisiteAudits[0]));
    await expect(run(reviewInput, duplicate)).rejects.toThrow('Duplicate prerequisite audit');
  });

  it('rejects an invalid matrix classification at the strict provider schema boundary', () => {
    const invalid = result(input(1, 1)) as unknown as {
      prerequisiteAudits: Array<{ classification: string }>;
    };
    invalid.prerequisiteAudits[0].classification = 'MAYBE';
    expect(knowledgeAutoReviewV31ResultSchema.safeParse(invalid).success).toBe(false);
  });

  it('keeps graph-missing prerequisites ID-less and outside the canonical matrix', async () => {
    const reviewInput = input(1, 1);
    const rawResult = result(reviewInput);
    rawResult.graphMissingPrerequisites = [
      {
        title: 'Kiến thức nền chưa có trong graph',
        reason: 'The source identifies it, but no supplied canonical Concept represents it.',
        confidence: 0.76,
      },
    ];
    const { completed } = await run(reviewInput, rawResult);
    expect(completed.session.rawProviderResult?.graphMissingPrerequisites[0]).toEqual(
      rawResult.graphMissingPrerequisites[0]
    );
    expect(
      knowledgeAutoReviewV31ResultSchema.safeParse({
        ...rawResult,
        graphMissingPrerequisites: [
          { ...rawResult.graphMissingPrerequisites[0], id: 'invented-id' },
        ],
      }).success
    ).toBe(false);
  });

  it('rejects invented canonical IDs in matrix references', async () => {
    const reviewInput = input(1, 1);
    const invented = result(reviewInput);
    invented.prerequisiteAudits[0].sourceConceptRef.id = 'invented-canonical-id';
    await expect(run(reviewInput, invented)).rejects.toThrow('Invalid review reference');
  });

  it('does not change evidence, application, merge, hold, LO, or auto-resolution policy', () => {
    const reviewInput = input(0, 3);
    const reviews = result(reviewInput).candidateReviews;
    reviews[0].classification = 'APPLICATION_CONTEXT';
    reviews[1].classification = 'ONTOLOGY_AMBIGUOUS';
    reviews[1].reasonCodes = ['ONTOLOGY_CATEGORY_UNCLEAR'];
    reviews[2].classification = 'MERGE_CANDIDATE';
    const dispositions = applyKnowledgeReviewPolicy(reviews, reviewInput).map(
      (decision) => decision.disposition
    );
    expect(dispositions).toEqual([
      'AUTO_CLASSIFIED_REVIEWABLE',
      'HUMAN_REQUIRED',
      'HUMAN_CONFIRM_REQUIRED',
    ]);
  });

  it('changes the input hash transparently for V3.1 while leaving factual input unchanged', () => {
    const reviewInput = input(2, 3);
    const v3Hash = knowledgeAutoReviewInputHash(reviewInput, {
      promptVersion: KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v3,
      modelConfiguration: { semanticClassification: 'gemini-3.5-flash' },
      policyVersion: AUTO_REVIEW_POLICY_VERSION,
    });
    expect(knowledgeAutoReviewInputHash(reviewInput)).not.toBe(v3Hash);
  });

  it('keeps the factual Bài 6 input identical for versioned replacement lineage', () => {
    const root = process.cwd();
    const documentId = 'mryei32t-0fybu39';
    const textbook = (
      JSON.parse(readFileSync(path.join(root, 'data', 'textbooks.json'), 'utf8')) as Textbook[]
    ).find((item) => item.id === documentId)!;
    const current = prepareKnowledgeAutoReviewInput({
      textbook,
      document: JSON.parse(
        readFileSync(path.join(root, 'tmp', 'uploads', documentId, 'document.json'), 'utf8')
      ) as PipelineDocument,
      graph: JSON.parse(
        readFileSync(path.join(root, 'data', 'knowledge-graph', 'graph.json'), 'utf8')
      ) as KgDocument,
      lessonId: 'mryhipx3-2payll9',
      textbookMappings: JSON.parse(
        readFileSync(path.join(root, 'data', 'textbook-mappings.json'), 'utf8')
      ) as LessonConceptMapping[],
      semantic: JSON.parse(
        readFileSync(
          path.join(root, 'tmp', 'uploads', documentId, 'semantic-proposals.json'),
          'utf8'
        )
      ) as SemanticProposalPackage,
    });
    const sessions = JSON.parse(
      readFileSync(
        path.join(root, 'tmp', 'uploads', documentId, 'knowledge-auto-review.json'),
        'utf8'
      )
    ) as { sessions: KnowledgeAutoReviewSession[] };
    const failed = sessions.sessions.find(
      (session) => session.id === '7533464d-8587-417e-a235-57ad3dc555e1'
    )!;
    const factualInput = (reviewInput: KnowledgeAutoReviewInput) => {
      const {
        domainContext: _domainContext,
        existingConceptCandidates: _retrieved,
        retrievalTrace: _trace,
        ...facts
      } = reviewInput;
      void _domainContext;
      void _retrieved;
      void _trace;
      return facts;
    };
    expect(deterministicHash(factualInput(current))).toBe(
      deterministicHash(factualInput(failed.input))
    );
  });

  it('preserves the failed blind attempt and persists exactly one valid Bài 6 replacement', () => {
    const root = process.cwd();
    const documentId = 'mryei32t-0fybu39';
    const sessions = JSON.parse(
      readFileSync(
        path.join(root, 'tmp', 'uploads', documentId, 'knowledge-auto-review.json'),
        'utf8'
      )
    ) as { sessions: KnowledgeAutoReviewSession[] };
    const lessonSessions = sessions.sessions.filter(
      (session) => session.lessonId === 'mryhipx3-2payll9'
    );
    const failed = lessonSessions.find(
      (session) => session.id === '7533464d-8587-417e-a235-57ad3dc555e1'
    );
    const replacement = lessonSessions.find(
      (session) => session.id === 'df75a1ee-387a-47f4-9bbb-6f624a3a2819'
    );

    expect(lessonSessions).toHaveLength(2);
    expect(failed).toMatchObject({
      status: 'FAILED',
      promptVersion: 'knowledge-auto-review-v3',
      errorCode: 'SCHEMA_VALIDATION',
      inputHash: '836062d811218ab657b598ce77ee1f5f623dab48ea34f291b86d71ff5239d835',
    });
    expect(failed?.result).toBeUndefined();
    expect(replacement).toMatchObject({
      status: 'COMPLETED',
      promptVersion: 'knowledge-auto-review-v3.1',
      providerAttempt: 2,
      retryCount: 0,
      replacementForSessionId: '7533464d-8587-417e-a235-57ad3dc555e1',
      inputHash: 'b8dce85958339635a21746fa1628f94115d4fcffe76b7aa08ffa724b39969e9a',
    });
    expect(replacement?.rawProviderResult?.prerequisiteAudits).toHaveLength(18);
    expect(replacement?.rawProviderResult?.graphMissingPrerequisites).toHaveLength(2);
    expect(
      replacement?.rawProviderResult?.graphMissingPrerequisites.every(
        (missing) => Object.keys(missing).sort().join(',') === 'confidence,reason,title'
      )
    ).toBe(true);

    const evaluation = JSON.parse(
      readFileSync(
        path.join(
          root,
          'tmp',
          'uploads',
          documentId,
          'knowledge-auto-review-v31-chapter-ii-blind-evaluation.json'
        ),
        'utf8'
      )
    ) as {
      falseCanonicalization: { total: number };
      humanReviewReduction: { rawCandidateReviewReductionRate: number };
      finalRecommendation: string;
    };
    expect(evaluation.falseCanonicalization.total).toBe(0);
    expect(evaluation.humanReviewReduction.rawCandidateReviewReductionRate).toBe(0);
    expect(evaluation.finalRecommendation).toBe('V3_REQUIRES_TARGETED_CALIBRATION');
  });

  it('keeps canonical graph, mappings, and Controlled Import byte-identical', () => {
    const root = process.cwd();
    const sha256 = (relativePath: string) =>
      createHash('sha256')
        .update(readFileSync(path.join(root, relativePath)))
        .digest('hex')
        .toUpperCase();
    expect(sha256('data/knowledge-graph/graph.json')).toBe(
      'B594BF59E329260A4BB51CE00A988A3CC4E5118409C30417F852B80212D1681E'
    );
    expect(sha256('data/textbook-mappings.json')).toBe(
      '9524B3086CAA2F9296513CD9BB998DD90B0A87A48AFD20969DF9452294E9F067'
    );
    expect(sha256('data/import-data.json')).toBe(
      'ACB8BCABD8B67E7969987B514760D3C5CB19744AD7084240DC1EBC61C1F5DF3E'
    );
  });

  it('retains retryable provider errors as factual failures', () => {
    expect(new AiProviderError('RATE_LIMIT', '429', true)).toMatchObject({
      code: 'RATE_LIMIT',
      retryable: true,
    });
  });
});
