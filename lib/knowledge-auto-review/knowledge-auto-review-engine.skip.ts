import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import type { AiGateway } from '@/lib/ai/ai-gateway';
import { executeWithBoundedRetry } from '@/lib/ai/ai-gateway';
import {
  AiProviderError,
  knowledgeAutoReviewResultSchema,
  type AutoReviewReference,
  type KnowledgeAutoReviewInput,
  type KnowledgeAutoReviewResult,
  type KnowledgeAutoReviewSession,
  type KnowledgeCandidateReview,
  type KnowledgeReviewReasonCode,
} from '@/lib/ai/ai-types';
import type { KgDocument } from '@/lib/knowledge-graph/kg-types';
import type { PipelineDocument } from '@/lib/pipeline/types';
import type { LessonConceptMapping, Textbook } from '@/lib/textbook/types';
import type { SemanticProposalPackage } from '@/lib/textbook/semantic-proposal-types';
import { LESSON_1_GOLDEN_REVIEW, evaluateGoldenReview } from './golden-review-fixtures';
import {
  applyKnowledgeReviewPolicy,
  clearKnowledgeAutoReviewFlights,
  runKnowledgeAutoReview,
} from './knowledge-auto-review-engine';
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

function input(overrides: Partial<KnowledgeAutoReviewInput> = {}): KnowledgeAutoReviewInput {
  return {
    subject: { id: 'math', title: 'Toán học' },
    grade: { id: '12', title: 'Lớp 12' },
    domainContext: { id: 'calculus', title: 'Hàm số và đạo hàm' },
    textbook: { id: 'book', title: 'Textbook' },
    chapter: { id: 'chapter', title: 'Chapter' },
    lesson: { id: 'lesson', title: 'Lesson' },
    semanticRecords: [
      {
        id: 'source-definition',
        type: 'DEFINITION',
        title: 'Giá trị lớn nhất và giá trị nhỏ nhất của hàm số',
      },
      {
        id: 'source-method',
        type: 'TOPIC',
        title: 'Cách tìm giá trị lớn nhất và giá trị nhỏ nhất',
      },
    ],
    existingConceptCandidates: [
      {
        id: 'concept-function',
        title: 'Hàm số',
        aliases: [],
        domainId: 'calculus',
      },
    ],
    deterministicMatches: [
      {
        sourceRecordId: 'source-definition',
        matchType: 'NONE',
        canonicalConceptIds: [],
      },
      {
        sourceRecordId: 'source-method',
        matchType: 'NONE',
        canonicalConceptIds: [],
      },
    ],
    relevantGraphVersion: '3:one',
    ...overrides,
  };
}

function validResult(): KnowledgeAutoReviewResult {
  return {
    candidateReviews: [
      {
        sourceRecordId: 'source-definition',
        classification: 'NEW_CONCEPT',
        proposedCanonicalTitle: 'Giá trị lớn nhất và giá trị nhỏ nhất của hàm số',
        conciseRationale: 'Reusable mathematical knowledge.',
        evidence: ['Definition evidence'],
        confidence: 0.94,
        reasonCodes: ['REUSABLE_KNOWLEDGE'],
        evidenceSufficiency: 'SUFFICIENT',
        titleEvidenceAssessment: 'CONSISTENT',
      },
      {
        sourceRecordId: 'source-method',
        classification: 'METHOD_OR_PROCEDURE',
        conciseRationale: 'A procedure for finding extrema.',
        evidence: ['Procedural steps'],
        confidence: 0.93,
        reasonCodes: ['PROCEDURAL_LANGUAGE'],
        evidenceSufficiency: 'SUFFICIENT',
        titleEvidenceAssessment: 'CONSISTENT',
      },
    ],
    mergeProposals: [],
    learningObjectives: [
      {
        id: 'lo-1',
        statement: 'Xác định được giá trị lớn nhất và giá trị nhỏ nhất trên một đoạn.',
        targetReference: {
          kind: 'SOURCE_CANDIDATE',
          id: 'source-definition',
          title: 'Giá trị lớn nhất và giá trị nhỏ nhất của hàm số',
        },
        bloomLevel: 'APPLY',
        conciseRationale: 'Requires applying the definition.',
        sourceSemanticRecordIds: ['source-definition', 'source-method'],
        confidence: 0.9,
      },
    ],
    prerequisiteProposals: [
      {
        id: 'pre-1',
        sourceReference: {
          kind: 'EXISTING_CONCEPT',
          id: 'concept-function',
          title: 'Hàm số',
        },
        targetReference: {
          kind: 'SOURCE_CANDIDATE',
          id: 'source-definition',
          title: 'Giá trị lớn nhất và giá trị nhỏ nhất của hàm số',
        },
        relationType: 'LEARNING_PREREQUISITE',
        conciseRationale: 'Function knowledge materially supports extrema.',
        sourceSemanticRecordIds: ['source-definition'],
        confidence: 0.9,
      },
    ],
    prerequisiteAudits: [
      {
        id: 'audit-1',
        sourceReference: {
          kind: 'EXISTING_CONCEPT',
          id: 'concept-function',
          title: 'Hàm số',
        },
        targetReference: {
          kind: 'SOURCE_CANDIDATE',
          id: 'source-definition',
          title: 'Giá trị lớn nhất và giá trị nhỏ nhất của hàm số',
        },
        assessment: 'STRONG_PREREQUISITE',
        conciseRationale: 'Function knowledge materially supports extrema.',
        sourceSemanticRecordIds: ['source-definition'],
        confidence: 0.9,
      },
    ],
    missingPrerequisites: [],
    ambiguities: [],
  };
}

function completeV3Result(
  result: KnowledgeAutoReviewResult,
  reviewInput: KnowledgeAutoReviewInput
): KnowledgeAutoReviewResult {
  const completed = structuredClone(result);
  for (const review of completed.candidateReviews) {
    review.evidenceSufficiency ??= 'SUFFICIENT';
    review.titleEvidenceAssessment ??= 'CONSISTENT';
  }
  completed.missingPrerequisites ??= [];
  if (!completed.prerequisiteAudits) {
    const targets: AutoReviewReference[] = completed.mergeProposals.map((merge) => ({
      kind: 'MERGE_PROPOSAL' as const,
      id: merge.id,
      title: merge.proposedCanonicalTitle,
    }));
    for (const review of completed.candidateReviews) {
      if (review.classification === 'NEW_CONCEPT') {
        targets.push({
          kind: 'SOURCE_CANDIDATE',
          id: review.sourceRecordId,
          title:
            review.proposedCanonicalTitle ??
            reviewInput.semanticRecords.find((record) => record.id === review.sourceRecordId)
              ?.title ??
            review.sourceRecordId,
        });
      } else if (review.classification === 'EXISTING_CONCEPT' && review.existingConceptId) {
        targets.push({
          kind: 'EXISTING_CONCEPT',
          id: review.existingConceptId,
          title:
            reviewInput.existingConceptCandidates.find(
              (concept) => concept.id === review.existingConceptId
            )?.title ?? review.existingConceptId,
        });
      }
    }
    completed.prerequisiteAudits = reviewInput.existingConceptCandidates.flatMap(
      (concept, conceptIndex) =>
        targets.map((target, targetIndex) => {
          const isStrong = completed.prerequisiteProposals.some(
            (proposal) =>
              proposal.sourceReference.kind === 'EXISTING_CONCEPT' &&
              proposal.sourceReference.id === concept.id &&
              proposal.targetReference.kind === target.kind &&
              proposal.targetReference.id === target.id
          );
          return {
            id: `audit-${conceptIndex}-${targetIndex}`,
            sourceReference: {
              kind: 'EXISTING_CONCEPT' as const,
              id: concept.id,
              title: concept.title,
            },
            targetReference: target,
            assessment: isStrong ? ('STRONG_PREREQUISITE' as const) : ('NOT_REQUIRED' as const),
            conciseRationale: isStrong
              ? 'Material learning dependency.'
              : 'Retrieved knowledge is not materially required.',
            sourceSemanticRecordIds: [reviewInput.semanticRecords[0].id],
            confidence: 0.9,
          };
        })
    );
  }
  return completed;
}

function gateway(result = validResult()): AiGateway & { calls: number } {
  return {
    calls: 0,
    async reviewKnowledgeCandidates(reviewInput) {
      this.calls += 1;
      return { result: completeV3Result(result, reviewInput) };
    },
  };
}

function diskFixture(lessonId: string): {
  input: KnowledgeAutoReviewInput;
  graphRaw: string;
  importRaw: string;
} {
  const graphPath = path.join(process.cwd(), 'data', 'knowledge-graph', 'graph.json');
  const documentPath = path.join(
    process.cwd(),
    'tmp',
    'uploads',
    'mryei32t-0fybu39',
    'document.json'
  );
  const graphRaw = readFileSync(graphPath, 'utf8');
  const importRaw = readFileSync(path.join(process.cwd(), 'data', 'import-data.json'), 'utf8');
  const textbook = (
    JSON.parse(
      readFileSync(path.join(process.cwd(), 'data', 'textbooks.json'), 'utf8')
    ) as Textbook[]
  ).find((item) => item.id === 'mryei32t-0fybu39')!;
  const semantic = JSON.parse(
    readFileSync(
      path.join(process.cwd(), 'tmp', 'uploads', 'mryei32t-0fybu39', 'semantic-proposals.json'),
      'utf8'
    )
  ) as SemanticProposalPackage;
  return {
    input: prepareKnowledgeAutoReviewInput({
      textbook,
      document: JSON.parse(readFileSync(documentPath, 'utf8')) as PipelineDocument,
      graph: JSON.parse(graphRaw) as KgDocument,
      lessonId,
      textbookMappings: JSON.parse(
        readFileSync(path.join(process.cwd(), 'data', 'textbook-mappings.json'), 'utf8')
      ) as LessonConceptMapping[],
      semantic,
    }),
    graphRaw,
    importRaw,
  };
}

describe('Phase 4.5 knowledge auto-review engine', () => {
  it('uses strict structured output schemas and validates classification, merge, LO, Bloom, and prerequisite fields', () => {
    expect(knowledgeAutoReviewResultSchema.parse(validResult())).toEqual(validResult());
    expect(() =>
      knowledgeAutoReviewResultSchema.parse({
        ...validResult(),
        unexpected: true,
      })
    ).toThrow();
    expect(() =>
      knowledgeAutoReviewResultSchema.parse({
        ...validResult(),
        learningObjectives: [{ ...validResult().learningObjectives[0], bloomLevel: 'MASTER' }],
      })
    ).toThrow();
    expect(() =>
      knowledgeAutoReviewResultSchema.parse({
        ...validResult(),
        mergeProposals: [
          {
            id: 'merge',
            sourceCandidateIds: ['only-one'],
            proposedCanonicalTitle: 'Invalid',
            conciseRationale: 'Invalid merge.',
            confidence: 0.9,
            reasonCodes: ['COMPLEMENTARY_CONCEPTS'],
          },
        ],
      })
    ).toThrow();
  });

  it('rejects invalid AI output without partially applying it and persists FAILED', async () => {
    const store = new MemoryStore();
    const invalid = {
      ...validResult(),
      candidateReviews: validResult().candidateReviews.slice(0, 1),
    } as KnowledgeAutoReviewResult;
    await expect(
      runKnowledgeAutoReview({ gateway: gateway(invalid), store, input: input() })
    ).rejects.toThrow('exactly once');
    expect(store.sessions).toHaveLength(1);
    expect(store.sessions[0]).toMatchObject({
      status: 'FAILED',
      errorCode: 'SCHEMA_VALIDATION',
    });
    expect(store.sessions[0].result).toBeUndefined();
  });

  it('bypasses AI when an exact deterministic match resolves every record', async () => {
    const exactInput = input({
      semanticRecords: [{ id: 'exact', type: 'DEFINITION', title: 'Hàm số' }],
      deterministicMatches: [
        {
          sourceRecordId: 'exact',
          matchType: 'EXACT_TITLE',
          canonicalConceptIds: ['concept-function'],
        },
      ],
    });
    const fakeGateway = gateway();
    const completed = await runKnowledgeAutoReview({
      gateway: fakeGateway,
      store: new MemoryStore(),
      input: exactInput,
    });
    expect(fakeGateway.calls).toBe(0);
    expect(completed.session.result?.candidateReviews[0]).toMatchObject({
      classification: 'EXISTING_CONCEPT',
      existingConceptId: 'concept-function',
      confidence: 1,
    });
    expect(completed.session.policyDecisions?.[0].disposition).toBe('AUTO_RESOLVABLE');
  });

  it('computes stable input hashes and invalidates them on graph or model/prompt inputs', () => {
    expect(deterministicHash({ b: 2, a: 1 })).toBe(deterministicHash({ a: 1, b: 2 }));
    const first = knowledgeAutoReviewInputHash(input());
    expect(knowledgeAutoReviewInputHash(input())).toBe(first);
    expect(knowledgeAutoReviewInputHash(input({ relevantGraphVersion: '3:two' }))).not.toBe(first);
    expect(
      knowledgeAutoReviewInputHash(input(), {
        promptVersion: 'knowledge-auto-review-v2',
        modelConfiguration: {
          semanticClassification: 'gemini-fast',
          ontologyAmbiguity: 'gemini-strong',
        },
      })
    ).not.toBe(first);
    expect(
      knowledgeAutoReviewInputHash(input(), {
        promptVersion: 'knowledge-auto-review-v1',
        modelConfiguration: {
          semanticClassification: 'gemini-different',
          ontologyAmbiguity: 'gemini-different',
        },
      })
    ).not.toBe(first);
  });

  it('reuses a completed review cache and makes no duplicate provider call', async () => {
    const store = new MemoryStore();
    const fakeGateway = gateway();
    const first = await runKnowledgeAutoReview({ gateway: fakeGateway, store, input: input() });
    const second = await runKnowledgeAutoReview({ gateway: fakeGateway, store, input: input() });
    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(second.session.id).toBe(first.session.id);
    expect(fakeGateway.calls).toBe(1);
  });

  it('graph-version changes invalidate a completed review cache', async () => {
    const store = new MemoryStore();
    const fakeGateway = gateway();
    const first = await runKnowledgeAutoReview({ gateway: fakeGateway, store, input: input() });
    const changed = await runKnowledgeAutoReview({
      gateway: fakeGateway,
      store,
      input: input({ relevantGraphVersion: '3:changed' }),
    });
    expect(changed.session.inputHash).not.toBe(first.session.inputHash);
    expect(fakeGateway.calls).toBe(2);
  });

  it('deduplicates simultaneous requests with a single flight', async () => {
    clearKnowledgeAutoReviewFlights();
    const store = new MemoryStore();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fakeGateway = gateway();
    fakeGateway.reviewKnowledgeCandidates = vi.fn(async () => {
      fakeGateway.calls += 1;
      await gate;
      return { result: validResult() };
    });
    const first = runKnowledgeAutoReview({ gateway: fakeGateway, store, input: input() });
    await vi.waitFor(() => expect(fakeGateway.calls).toBe(1));
    const second = runKnowledgeAutoReview({ gateway: fakeGateway, store, input: input() });
    release();
    const [left, right] = await Promise.all([first, second]);
    expect(fakeGateway.calls).toBe(1);
    expect(left.session.id).toBe(right.session.id);
    expect(right.sharedFlight).toBe(true);
  });

  it('uses bounded retry for rate limits and stops after the configured attempts', async () => {
    let calls = 0;
    const recovered = await executeWithBoundedRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new AiProviderError('RATE_LIMIT', '429', true);
        return 'ok';
      },
      { maxAttempts: 3, sleep: async () => undefined, random: () => 0 }
    );
    expect(recovered).toEqual({ value: 'ok', retryCount: 2 });
    calls = 0;
    await expect(
      executeWithBoundedRetry(
        async () => {
          calls += 1;
          throw new AiProviderError('RATE_LIMIT', '429', true);
        },
        { maxAttempts: 3, sleep: async () => undefined, random: () => 0 }
      )
    ).rejects.toThrow('429');
    expect(calls).toBe(3);
  });

  it('honors a single-provider-attempt execution budget without retrying', async () => {
    const store = new MemoryStore();
    let calls = 0;
    const retryableGateway: AiGateway = {
      async reviewKnowledgeCandidates() {
        calls += 1;
        throw new AiProviderError('RATE_LIMIT', '429', true);
      },
    };

    await expect(
      runKnowledgeAutoReview({
        gateway: retryableGateway,
        store,
        input: input(),
        providerMaxAttempts: 1,
      })
    ).rejects.toThrow('429');

    expect(calls).toBe(1);
    expect(store.sessions).toHaveLength(1);
    expect(store.sessions[0]).toMatchObject({
      status: 'FAILED',
      retryCount: 0,
      errorCode: 'RATE_LIMIT',
    });
  });

  it('persists a single-attempt timeout without fabricating a raw result', async () => {
    const store = new MemoryStore();
    let calls = 0;
    const timeoutGateway: AiGateway = {
      async reviewKnowledgeCandidates() {
        calls += 1;
        throw new AiProviderError('TIMEOUT', 'Gemini request timed out', true);
      },
    };

    await expect(
      runKnowledgeAutoReview({
        gateway: timeoutGateway,
        store,
        input: input(),
        providerMaxAttempts: 1,
      })
    ).rejects.toThrow('Gemini request timed out');

    expect(calls).toBe(1);
    expect(store.sessions).toHaveLength(1);
    expect(store.sessions[0]).toMatchObject({
      status: 'FAILED',
      retryCount: 0,
      errorCode: 'TIMEOUT',
      errorMessage: 'Gemini request timed out',
    });
    expect(store.sessions[0].rawProviderResult).toBeUndefined();
  });

  it('does not retry malformed or schema-invalid output', async () => {
    let calls = 0;
    await expect(
      executeWithBoundedRetry(
        async () => {
          calls += 1;
          throw new AiProviderError('SCHEMA_VALIDATION', 'invalid', false);
        },
        { maxAttempts: 3, sleep: async () => undefined }
      )
    ).rejects.toThrow('invalid');
    expect(calls).toBe(1);
  });

  it('keeps new Concepts and merges human-confirmed while preserving ontology ambiguity', () => {
    const reviews = [
      ...validResult().candidateReviews,
      {
        sourceRecordId: 'ambiguous',
        classification: 'ONTOLOGY_AMBIGUOUS' as const,
        conciseRationale: 'Category unclear.',
        evidence: ['Ambiguous evidence'],
        confidence: 0.6,
        reasonCodes: ['ONTOLOGY_CATEGORY_UNCLEAR' as const],
        evidenceSufficiency: 'WEAK' as const,
        titleEvidenceAssessment: 'UNCLEAR' as const,
      },
    ];
    const policy = applyKnowledgeReviewPolicy(
      reviews,
      input({
        semanticRecords: [
          ...input().semanticRecords,
          { id: 'ambiguous', type: 'REPRESENTATION', title: 'Bảng' },
        ],
        deterministicMatches: [
          ...input().deterministicMatches,
          { sourceRecordId: 'ambiguous', matchType: 'NONE', canonicalConceptIds: [] },
        ],
      })
    );
    expect(policy.find((item) => item.sourceRecordId === 'source-definition')?.disposition).toBe(
      'HUMAN_CONFIRM_REQUIRED'
    );
    expect(policy.find((item) => item.sourceRecordId === 'source-method')?.disposition).toBe(
      'AUTO_CLASSIFIED_REVIEWABLE'
    );
    expect(policy.find((item) => item.sourceRecordId === 'ambiguous')?.disposition).toBe(
      'HUMAN_REQUIRED'
    );
  });

  it('rejects invalid prerequisite endpoints, self-edges, cycles, and duplicate LOs during handoff', async () => {
    const invalidEndpoint = validResult();
    invalidEndpoint.prerequisiteProposals[0].sourceReference.id = 'missing';
    await expect(
      runKnowledgeAutoReview({
        gateway: gateway(invalidEndpoint),
        store: new MemoryStore(),
        input: input(),
      })
    ).rejects.toThrow('Invalid review reference');

    const selfEdge = validResult();
    selfEdge.prerequisiteProposals[0].sourceReference =
      selfEdge.prerequisiteProposals[0].targetReference;
    await expect(
      runKnowledgeAutoReview({
        gateway: gateway(selfEdge),
        store: new MemoryStore(),
        input: input({ relevantGraphVersion: 'self' }),
      })
    ).rejects.toThrow('Self prerequisite');

    const cycle = validResult();
    cycle.prerequisiteProposals.push({
      ...cycle.prerequisiteProposals[0],
      id: 'pre-cycle',
      sourceReference: cycle.prerequisiteProposals[0].targetReference,
      targetReference: cycle.prerequisiteProposals[0].sourceReference,
    });
    await expect(
      runKnowledgeAutoReview({
        gateway: gateway(cycle),
        store: new MemoryStore(),
        input: input({ relevantGraphVersion: 'cycle' }),
      })
    ).rejects.toThrow('directed cycle');

    const duplicateLo = validResult();
    duplicateLo.learningObjectives.push({
      ...duplicateLo.learningObjectives[0],
      id: 'lo-duplicate',
    });
    await expect(
      runKnowledgeAutoReview({
        gateway: gateway(duplicateLo),
        store: new MemoryStore(),
        input: input({ relevantGraphVersion: 'duplicate-lo' }),
      })
    ).rejects.toThrow('Duplicate LO');
  });

  it('compares Bài 1 recommendations with the semantic golden fixture without UUID coupling', async () => {
    const fixture = diskFixture('mryhipx2-eh6ke0j');
    const byTitle = new Map(
      fixture.input.semanticRecords.map((record) => [record.title, record.id])
    );
    const mergeMonotonicity = 'merge-monotonicity';
    const mergeExtrema = 'merge-extrema';
    const classifications: KnowledgeCandidateReview[] = fixture.input.semanticRecords.map(
      (record) => {
        let classification:
          'MERGE_CANDIDATE' | 'METHOD_OR_PROCEDURE' | 'ONTOLOGY_AMBIGUOUS' | 'REJECT_INVALID' =
          'REJECT_INVALID';
        if (
          [
            'Hàm số đồng biến',
            'Hàm số nghịch biến',
            'Điểm cực trị của hàm số',
            'Giá trị cực trị',
          ].includes(record.title)
        ) {
          classification = 'MERGE_CANDIDATE';
        } else if (record.title === 'Quy tắc tìm cực trị') {
          classification = 'METHOD_OR_PROCEDURE';
        } else if (record.title === 'Bảng biến thiên') {
          classification = 'ONTOLOGY_AMBIGUOUS';
        }
        const reasonCodes: KnowledgeReviewReasonCode[] =
          classification === 'METHOD_OR_PROCEDURE'
            ? ['PROCEDURAL_LANGUAGE']
            : classification === 'ONTOLOGY_AMBIGUOUS'
              ? ['ONTOLOGY_CATEGORY_UNCLEAR']
              : classification === 'MERGE_CANDIDATE'
                ? ['COMPLEMENTARY_CONCEPTS']
                : ['INSUFFICIENT_EVIDENCE'];
        return {
          sourceRecordId: record.id,
          classification,
          conciseRationale: 'Golden evaluation output.',
          evidence: [record.title],
          confidence: 0.95,
          reasonCodes,
        };
      }
    );
    const result: KnowledgeAutoReviewResult = {
      candidateReviews: classifications,
      mergeProposals: [
        {
          id: mergeMonotonicity,
          sourceCandidateIds: [
            byTitle.get('Hàm số đồng biến')!,
            byTitle.get('Hàm số nghịch biến')!,
          ],
          proposedCanonicalTitle: 'Tính đơn điệu của hàm số',
          conciseRationale: 'Complementary facets.',
          confidence: 0.96,
          reasonCodes: ['COMPLEMENTARY_CONCEPTS'],
        },
        {
          id: mergeExtrema,
          sourceCandidateIds: [
            byTitle.get('Điểm cực trị của hàm số')!,
            byTitle.get('Giá trị cực trị')!,
          ],
          proposedCanonicalTitle: 'Cực trị của hàm số',
          conciseRationale: 'Complementary facets.',
          confidence: 0.96,
          reasonCodes: ['COMPLEMENTARY_CONCEPTS'],
        },
      ],
      learningObjectives: LESSON_1_GOLDEN_REVIEW.expectedLearningObjectives.map(
        (statement, index) => ({
          id: `lo-${index}`,
          statement,
          targetReference: {
            kind: 'MERGE_PROPOSAL',
            id: index < 2 ? mergeMonotonicity : mergeExtrema,
            title: index < 2 ? 'Tính đơn điệu của hàm số' : 'Cực trị của hàm số',
          },
          bloomLevel: index % 2 ? 'APPLY' : 'UNDERSTAND',
          conciseRationale: 'Golden measurable objective.',
          sourceSemanticRecordIds: [fixture.input.semanticRecords[0].id],
          confidence: 0.95,
        })
      ),
      prerequisiteProposals: LESSON_1_GOLDEN_REVIEW.expectedImportantPrerequisites.map(
        (relation, index) => ({
          id: `pre-${index}`,
          sourceReference: {
            kind:
              relation.sourceTitle === 'Tính đơn điệu của hàm số'
                ? 'MERGE_PROPOSAL'
                : 'EXISTING_CONCEPT',
            id:
              relation.sourceTitle === 'Tính đơn điệu của hàm số'
                ? mergeMonotonicity
                : fixture.input.existingConceptCandidates.find(
                    (concept) => concept.title === relation.sourceTitle
                  )!.id,
            title: relation.sourceTitle,
          },
          targetReference: {
            kind: 'MERGE_PROPOSAL',
            id:
              relation.targetTitle === 'Tính đơn điệu của hàm số'
                ? mergeMonotonicity
                : mergeExtrema,
            title: relation.targetTitle,
          },
          relationType: 'LEARNING_PREREQUISITE',
          conciseRationale: 'Materially supports learning.',
          sourceSemanticRecordIds: [fixture.input.semanticRecords[0].id],
          confidence: 0.95,
        })
      ),
      ambiguities: [],
    };
    const store = new MemoryStore();
    const completed = await runKnowledgeAutoReview({
      gateway: gateway(result),
      store,
      input: fixture.input,
      force: true,
    });
    const evaluation = evaluateGoldenReview(
      LESSON_1_GOLDEN_REVIEW,
      fixture.input,
      completed.session.result!
    );
    expect(evaluation).toMatchObject({ matched: 13, total: 13, agreement: 1 });
    expect(completed.session.status).toBe('COMPLETED');
    expect(store.sessions).toHaveLength(1);
    expect(
      readFileSync(path.join(process.cwd(), 'data', 'knowledge-graph', 'graph.json'), 'utf8')
    ).toBe(fixture.graphRaw);
  });

  it('runs a Bài 2 acceptance session without committing or mutating canonical/import data', async () => {
    const fixture = diskFixture('mryhipx2-9r8oliu');
    const method = fixture.input.semanticRecords.find((record) =>
      record.title.includes('Quy tắc')
    )!;
    const definition = fixture.input.semanticRecords.find((record) => record.id !== method.id)!;
    const canonical = fixture.input.existingConceptCandidates[0];
    const result: KnowledgeAutoReviewResult = {
      candidateReviews: fixture.input.semanticRecords.map((record) =>
        record.id === method.id
          ? {
              sourceRecordId: record.id,
              classification: 'METHOD_OR_PROCEDURE' as const,
              conciseRationale: 'A bounded-interval procedure.',
              evidence: [record.description ?? record.title],
              confidence: 0.94,
              reasonCodes: ['PROCEDURAL_LANGUAGE' as const],
            }
          : {
              sourceRecordId: record.id,
              classification: 'NEW_CONCEPT' as const,
              proposedCanonicalTitle: record.title,
              conciseRationale: 'Reusable extrema knowledge.',
              evidence: [record.description ?? record.title],
              confidence: 0.94,
              reasonCodes: ['REUSABLE_KNOWLEDGE' as const],
            }
      ),
      mergeProposals: [],
      learningObjectives: [],
      prerequisiteProposals: canonical
        ? [
            {
              id: 'bai2-pre',
              sourceReference: {
                kind: 'EXISTING_CONCEPT',
                id: canonical.id,
                title: canonical.title,
              },
              targetReference: {
                kind: 'SOURCE_CANDIDATE',
                id: definition.id,
                title: definition.title,
              },
              relationType: 'LEARNING_PREREQUISITE',
              conciseRationale: 'Existing function knowledge supports extrema.',
              sourceSemanticRecordIds: [definition.id],
              confidence: 0.85,
            },
          ]
        : [],
      ambiguities: [],
    };
    const completed = await runKnowledgeAutoReview({
      gateway: gateway(result),
      store: new MemoryStore(),
      input: fixture.input,
    });
    expect(completed.session.status).toBe('COMPLETED');
    expect(
      readFileSync(path.join(process.cwd(), 'data', 'knowledge-graph', 'graph.json'), 'utf8')
    ).toBe(fixture.graphRaw);
    expect(readFileSync(path.join(process.cwd(), 'data', 'import-data.json'), 'utf8')).toBe(
      fixture.importRaw
    );
  });
});
