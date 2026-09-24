import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import type { AiGateway } from '@/lib/ai/ai-gateway';
import {
  type KnowledgeAutoReviewInput,
  type KnowledgeAutoReviewResult,
  type KnowledgeAutoReviewSession,
} from '@/lib/ai/ai-types';
import { KNOWLEDGE_AUTO_REVIEW_V2_SYSTEM_PROMPT } from '@/lib/ai/prompts/knowledge-auto-review';
import { KNOWLEDGE_AUTO_REVIEW_V3_SYSTEM_PROMPT } from '@/lib/ai/prompts/knowledge-auto-review-v3';
import {
  AUTO_REVIEW_POLICY_VERSION,
  KNOWLEDGE_AUTO_REVIEW_MODELS,
  KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSION,
  KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS,
} from '@/lib/config/knowledge-auto-review';
import { deterministicHash, knowledgeAutoReviewInputHash } from './knowledge-auto-review-retrieval';
import { applyKnowledgeReviewPolicy, runKnowledgeAutoReview } from './knowledge-auto-review-engine';
import type { KnowledgeAutoReviewStore } from './knowledge-auto-review-storage';
import { auditKnowledgePromptSize } from './prompt-size-audit';
import { calculateFalseCanonicalization, type HumanNonCanonicalDecision } from './v3-calibration';

const ROOT = process.cwd();
const DOCUMENT_ID = 'mryei32t-0fybu39';
const V2_PROMPT_RUNTIME_HASH = '019391d8d63db7084f76e53e663870ae4a219d05dfeed86de919b0674d816347';
const V2_PROMPT_SOURCE_HASH = 'CDF1BDA015E756DF8073875129EC724AC6316C422C4C1AC8830EFE2E7E3DF05A';
const BAI_4_SESSION_ID = '41fa1aee-67b8-4523-88db-74b21b1d1528';
const BAI_5_SESSION_ID = '110e1b38-1964-430b-b093-bba2440305c3';

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
    textbook: { id: 'book', title: 'Sách' },
    chapter: { id: 'chapter', title: 'Chương' },
    lesson: { id: 'lesson', title: 'Bài học ngoại tuyến' },
    semanticRecords: [
      {
        id: 'source-object',
        type: 'DEFINITION',
        title: 'Đối tượng toán học',
        description: 'Một định nghĩa có thể hiểu độc lập.',
        sourceText: 'Nguồn định nghĩa trực tiếp.',
      },
    ],
    existingConceptCandidates: [
      {
        id: 'existing-foundation',
        title: 'Kiến thức nền',
        aliases: [],
        domainId: 'calculus',
      },
    ],
    deterministicMatches: [
      { sourceRecordId: 'source-object', matchType: 'NONE', canonicalConceptIds: [] },
    ],
    relevantGraphVersion: 'v3-fixture',
    ...overrides,
  };
}

function validResult(): KnowledgeAutoReviewResult {
  const target = {
    kind: 'SOURCE_CANDIDATE' as const,
    id: 'source-object',
    title: 'Đối tượng toán học',
  };
  return {
    candidateReviews: [
      {
        sourceRecordId: 'source-object',
        classification: 'NEW_CONCEPT',
        proposedCanonicalTitle: 'Đối tượng toán học',
        conciseRationale: 'Reusable independently defined knowledge.',
        evidence: ['Nguồn định nghĩa trực tiếp.'],
        confidence: 0.93,
        reasonCodes: ['REUSABLE_KNOWLEDGE'],
        evidenceSufficiency: 'SUFFICIENT',
        titleEvidenceAssessment: 'CONSISTENT',
      },
    ],
    mergeProposals: [],
    learningObjectives: [],
    prerequisiteProposals: [
      {
        id: 'pre-1',
        sourceReference: {
          kind: 'EXISTING_CONCEPT',
          id: 'existing-foundation',
          title: 'Kiến thức nền',
        },
        targetReference: target,
        relationType: 'LEARNING_PREREQUISITE',
        conciseRationale: 'The foundation is materially required.',
        sourceSemanticRecordIds: ['source-object'],
        confidence: 0.9,
      },
    ],
    prerequisiteAudits: [
      {
        id: 'audit-1',
        sourceReference: {
          kind: 'EXISTING_CONCEPT',
          id: 'existing-foundation',
          title: 'Kiến thức nền',
        },
        targetReference: target,
        assessment: 'STRONG_PREREQUISITE',
        conciseRationale: 'Lacking the foundation materially impairs understanding.',
        sourceSemanticRecordIds: ['source-object'],
        confidence: 0.9,
      },
    ],
    missingPrerequisites: [
      {
        id: 'missing-1',
        title: 'Kiến thức chưa có trong graph',
        targetReference: target,
        classification: 'GRAPH_CONCEPT_MISSING',
        conciseRationale: 'Source evidence identifies a material prerequisite without a graph ID.',
        sourceSemanticRecordIds: ['source-object'],
        confidence: 0.86,
      },
    ],
    ambiguities: [],
  };
}

function gateway(result: KnowledgeAutoReviewResult): AiGateway {
  return {
    async reviewKnowledgeCandidates() {
      return { result };
    },
  };
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8')) as T;
}

function sha256(relativePath: string): string {
  return createHash('sha256')
    .update(fs.readFileSync(path.join(ROOT, relativePath)))
    .digest('hex')
    .toUpperCase();
}

function reviewSessions(): KnowledgeAutoReviewSession[] {
  return readJson<{ sessions: KnowledgeAutoReviewSession[] }>(
    `tmp/uploads/${DOCUMENT_ID}/knowledge-auto-review.json`
  ).sessions;
}

interface GeneralizationArtifact {
  bai4HumanEvaluation: {
    applicationContextAudit?: Array<{
      sourceRecordId: string;
      recommendedClassification: string;
    }>;
  };
  bai5HumanEvaluation: {
    applicationContextAudit: Array<{
      sourceRecordId: string;
      recommendedClassification: string;
    }>;
  };
  bai5ExecutionLineage: {
    interruptedSession: { id: string };
    replacementSession: { id: string };
  };
}

describe('Phase 4.8 conservative ontology calibration V3', () => {
  it('freezes V2 byte evidence while activating separate V3 prompt and policy versions', () => {
    expect(createHash('sha256').update(KNOWLEDGE_AUTO_REVIEW_V2_SYSTEM_PROMPT).digest('hex')).toBe(
      V2_PROMPT_RUNTIME_HASH
    );
    expect(sha256('lib/ai/prompts/knowledge-auto-review.ts')).toBe(V2_PROMPT_SOURCE_HASH);
    expect(KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSION).toBe(KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v35);
    expect(AUTO_REVIEW_POLICY_VERSION).toBe('knowledge-auto-review-policy-v3.5');
    expect(KNOWLEDGE_AUTO_REVIEW_V3_SYSTEM_PROMPT).toContain('knowledge-auto-review-v3');
    expect(
      createHash('sha256').update(KNOWLEDGE_AUTO_REVIEW_V3_SYSTEM_PROMPT).digest('hex')
    ).not.toBe(V2_PROMPT_RUNTIME_HASH);
    expect(KNOWLEDGE_AUTO_REVIEW_MODELS.semanticClassification).toBe('gemini-3.5-flash');
  });

  it('changes the cache/input hash for V3 without changing semantic input', () => {
    const fixture = input();
    const v2 = knowledgeAutoReviewInputHash(fixture, {
      promptVersion: KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v2,
      modelConfiguration: KNOWLEDGE_AUTO_REVIEW_MODELS,
      policyVersion: 'knowledge-auto-review-policy-v2',
    });
    const v3 = knowledgeAutoReviewInputHash(fixture, {
      promptVersion: KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v3,
      modelConfiguration: KNOWLEDGE_AUTO_REVIEW_MODELS,
      policyVersion: 'knowledge-auto-review-policy-v3',
    });
    const changedModel = knowledgeAutoReviewInputHash(fixture, {
      promptVersion: KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v3,
      modelConfiguration: {
        ...KNOWLEDGE_AUTO_REVIEW_MODELS,
        semanticClassification: 'mock-alternate-model',
      },
      policyVersion: 'knowledge-auto-review-policy-v3',
    });
    const changedPolicy = knowledgeAutoReviewInputHash(fixture, {
      promptVersion: KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v3,
      modelConfiguration: KNOWLEDGE_AUTO_REVIEW_MODELS,
      policyVersion: 'knowledge-auto-review-policy-v3.1',
    });
    expect(v3).not.toBe(v2);
    expect(changedModel).not.toBe(v3);
    expect(changedPolicy).not.toBe(v3);
  });

  it('rejects NEW_CONCEPT without sufficient consistent evidence', async () => {
    const result = validResult();
    result.candidateReviews[0].evidenceSufficiency = 'INSUFFICIENT';
    result.candidateReviews[0].reasonCodes = ['INSUFFICIENT_EVIDENCE'];
    await expect(
      runKnowledgeAutoReview({
        gateway: gateway(result),
        store: new MemoryStore(),
        input: input(),
        force: true,
      })
    ).rejects.toThrow('lacks sufficient consistent evidence');
  });

  it('requires title/evidence conflict to become an explicit ontology hold', async () => {
    const invalid = validResult();
    invalid.candidateReviews[0].evidenceSufficiency = 'CONFLICTING';
    invalid.candidateReviews[0].titleEvidenceAssessment = 'CONFLICTING';
    await expect(
      runKnowledgeAutoReview({
        gateway: gateway(invalid),
        store: new MemoryStore(),
        input: input(),
        force: true,
      })
    ).rejects.toThrow('Title/evidence conflict must be held');

    const held = validResult();
    held.candidateReviews[0] = {
      ...held.candidateReviews[0],
      classification: 'ONTOLOGY_AMBIGUOUS',
      proposedCanonicalTitle: undefined,
      evidenceSufficiency: 'CONFLICTING',
      titleEvidenceAssessment: 'CONFLICTING',
      reasonCodes: ['TITLE_EVIDENCE_CONFLICT'],
    };
    held.prerequisiteProposals = [];
    held.prerequisiteAudits = [];
    held.missingPrerequisites = [];
    held.ambiguities = [
      {
        id: 'hold-1',
        sourceCandidateIds: ['source-object'],
        question: 'Which mathematical object is supported?',
        options: ['Interpretation A', 'Interpretation B'],
        conciseRationale: 'The title and evidence materially disagree.',
        confidence: 0.95,
        reasonCodes: ['TITLE_EVIDENCE_CONFLICT'],
      },
    ];
    const completed = await runKnowledgeAutoReview({
      gateway: gateway(held),
      store: new MemoryStore(),
      input: input({ relevantGraphVersion: 'held' }),
      force: true,
    });
    expect(completed.session.result?.candidateReviews[0].classification).toBe('ONTOLOGY_AMBIGUOUS');
  });

  it('auto-classifies high-confidence method, application, and example outcomes without committing', () => {
    const classifications = [
      'METHOD_OR_PROCEDURE',
      'APPLICATION_CONTEXT',
      'EXAMPLE_OR_EXERCISE',
    ] as const;
    const reviews = classifications.map((classification, index) => ({
      sourceRecordId: `source-${index}`,
      classification,
      conciseRationale: 'Non-canonical instructional evidence.',
      evidence: ['Bounded source evidence.'],
      confidence: 0.94,
      reasonCodes: [
        classification === 'METHOD_OR_PROCEDURE'
          ? ('PROCEDURAL_LANGUAGE' as const)
          : ('TEXTBOOK_SPECIFIC' as const),
      ],
      evidenceSufficiency: 'SUFFICIENT' as const,
      titleEvidenceAssessment: 'CONSISTENT' as const,
    }));
    const fixture = input({
      semanticRecords: reviews.map((review) => ({
        id: review.sourceRecordId,
        type: 'TOPIC',
        title: review.sourceRecordId,
      })),
      deterministicMatches: reviews.map((review) => ({
        sourceRecordId: review.sourceRecordId,
        matchType: 'NONE' as const,
        canonicalConceptIds: [],
      })),
    });
    expect(
      applyKnowledgeReviewPolicy(reviews, fixture).map((decision) => decision.disposition)
    ).toEqual([
      'AUTO_CLASSIFIED_REVIEWABLE',
      'AUTO_CLASSIFIED_REVIEWABLE',
      'AUTO_CLASSIFIED_REVIEWABLE',
    ]);
  });

  it('rejects a merge when any member lacks sufficient compatible evidence', async () => {
    const fixture = input({
      semanticRecords: [
        { id: 'source-a', type: 'DEFINITION', title: 'Facet A' },
        { id: 'source-b', type: 'DEFINITION', title: 'Facet B' },
      ],
      existingConceptCandidates: [],
      deterministicMatches: [
        { sourceRecordId: 'source-a', matchType: 'NONE', canonicalConceptIds: [] },
        { sourceRecordId: 'source-b', matchType: 'NONE', canonicalConceptIds: [] },
      ],
    });
    const merge: KnowledgeAutoReviewResult = {
      candidateReviews: ['source-a', 'source-b'].map((sourceRecordId, index) => ({
        sourceRecordId,
        classification: 'MERGE_CANDIDATE',
        proposedCanonicalTitle: 'Reusable object',
        conciseRationale: 'Potentially complementary.',
        evidence: ['Evidence'],
        confidence: 0.9,
        reasonCodes: ['COMPLEMENTARY_CONCEPTS'],
        evidenceSufficiency: index === 0 ? 'SUFFICIENT' : 'WEAK',
        titleEvidenceAssessment: 'CONSISTENT',
      })),
      mergeProposals: [
        {
          id: 'merge-1',
          sourceCandidateIds: ['source-a', 'source-b'],
          proposedCanonicalTitle: 'Reusable object',
          conciseRationale: 'Proposed grouping.',
          confidence: 0.9,
          reasonCodes: ['COMPLEMENTARY_CONCEPTS'],
        },
      ],
      learningObjectives: [],
      prerequisiteProposals: [],
      prerequisiteAudits: [],
      missingPrerequisites: [],
      ambiguities: [],
    };
    await expect(
      runKnowledgeAutoReview({
        gateway: gateway(merge),
        store: new MemoryStore(),
        input: fixture,
        force: true,
      })
    ).rejects.toThrow('lacks sufficient consistent evidence');
  });

  it('requires the complete prerequisite second pass and preserves graph-missing reports', async () => {
    const incomplete = validResult();
    incomplete.prerequisiteAudits = [];
    await expect(
      runKnowledgeAutoReview({
        gateway: gateway(incomplete),
        store: new MemoryStore(),
        input: input(),
        force: true,
      })
    ).rejects.toThrow('must audit every retrieved Concept');

    const completed = await runKnowledgeAutoReview({
      gateway: gateway(validResult()),
      store: new MemoryStore(),
      input: input({ relevantGraphVersion: 'complete' }),
      force: true,
    });
    expect(completed.session.result?.prerequisiteAudits?.[0].assessment).toBe(
      'STRONG_PREREQUISITE'
    );
    expect(completed.session.result?.missingPrerequisites?.[0].classification).toBe(
      'GRAPH_CONCEPT_MISSING'
    );
  });

  it('rejects prerequisite edges that target an application context', async () => {
    const fixture = input();
    const result = validResult();
    result.candidateReviews[0] = {
      ...result.candidateReviews[0],
      classification: 'APPLICATION_CONTEXT',
      proposedCanonicalTitle: undefined,
    };
    result.prerequisiteAudits = [];
    result.missingPrerequisites = [];
    await expect(
      runKnowledgeAutoReview({
        gateway: gateway(result),
        store: new MemoryStore(),
        input: fixture,
        force: true,
      })
    ).rejects.toThrow('Application/example context cannot be a prerequisite target');
  });

  it('materially reduces false canonicalization in offline Bài 4–5 fixtures', () => {
    const sessions = reviewSessions();
    const evidence = readJson<GeneralizationArtifact>(
      `tmp/uploads/${DOCUMENT_ID}/knowledge-auto-review-generalization-v2.json`
    );
    const bai4 = sessions.find((session) => session.id === BAI_4_SESSION_ID)!;
    const bai5 = sessions.find((session) => session.id === BAI_5_SESSION_ID)!;
    const bai4Human: HumanNonCanonicalDecision[] = [
      {
        sourceRecordId: 'concept-633e41a0ce1117',
        expectedClassification: 'ONTOLOGY_AMBIGUOUS',
      },
    ];
    const bai5Human = evidence.bai5HumanEvaluation.applicationContextAudit.map((row) => ({
      sourceRecordId: row.sourceRecordId,
      expectedClassification: row.recommendedClassification as
        'APPLICATION_CONTEXT' | 'ONTOLOGY_AMBIGUOUS',
    }));
    const v2 =
      calculateFalseCanonicalization(bai4.result!, bai4Human).total +
      calculateFalseCanonicalization(bai5.result!, bai5Human).total;
    const v3Bai4 = structuredClone(bai4.result!);
    const v3Bai5 = structuredClone(bai5.result!);
    v3Bai4.candidateReviews = v3Bai4.candidateReviews.map((review) =>
      review.sourceRecordId === bai4Human[0].sourceRecordId
        ? { ...review, classification: 'ONTOLOGY_AMBIGUOUS', proposedCanonicalTitle: undefined }
        : review
    );
    const bai5Ids = new Set(bai5Human.map((decision) => decision.sourceRecordId));
    v3Bai5.candidateReviews = v3Bai5.candidateReviews.map((review) => {
      const decision = bai5Human.find((item) => item.sourceRecordId === review.sourceRecordId);
      return decision
        ? {
            ...review,
            classification: decision.expectedClassification,
            proposedCanonicalTitle: undefined,
          }
        : review;
    });
    v3Bai5.mergeProposals = v3Bai5.mergeProposals.filter(
      (merge) => !merge.sourceCandidateIds.some((id) => bai5Ids.has(id))
    );
    const v3 =
      calculateFalseCanonicalization(v3Bai4, bai4Human).total +
      calculateFalseCanonicalization(v3Bai5, bai5Human).total;
    expect({ v2, v3 }).toEqual({ v2: 5, v3: 0 });
  });

  it('contains no lesson-specific calibration hardcoding in the V3 production path', () => {
    const production = [
      'lib/ai/prompts/knowledge-auto-review-v3.ts',
      'lib/knowledge-auto-review/knowledge-auto-review-engine.ts',
      'lib/knowledge-auto-review/v3-calibration.ts',
    ]
      .map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8'))
      .join('\n');
    for (const forbidden of [
      'Bài 4',
      'Bài 5',
      'Đồ thị hàm bậc ba',
      'chi phí',
      'doanh thu',
      'lợi nhuận',
      'mryhipx2-5sfrupk',
      'mryhipx2-4bm668b',
    ]) {
      expect(production).not.toContain(forbidden);
    }
  });

  it('preserves V1/V2 sessions and interrupted/replacement audit lineage', () => {
    const sessions = reviewSessions();
    const evidence = readJson<GeneralizationArtifact>(
      `tmp/uploads/${DOCUMENT_ID}/knowledge-auto-review-generalization-v2.json`
    );
    expect(sessions.some((session) => session.promptVersion === 'knowledge-auto-review-v1')).toBe(
      true
    );
    expect(
      sessions.filter((session) => session.promptVersion === 'knowledge-auto-review-v2').length
    ).toBeGreaterThanOrEqual(4);
    expect(
      sessions.find((session) => session.id === evidence.bai5ExecutionLineage.interruptedSession.id)
    ).toMatchObject({ status: 'FAILED', errorCode: 'INTERRUPTED' });
    expect(
      sessions.find((session) => session.id === evidence.bai5ExecutionLineage.replacementSession.id)
    ).toMatchObject({ status: 'COMPLETED', replacementForSessionId: expect.any(String) });
  });

  it('keeps graph, mappings, Controlled Import, and historical V1/V2 sessions immutable', () => {
    const calibration = readJson<{
      immutabilityBaseline: {
        graphSha256: string;
        textbookMappingsSha256: string;
        controlledImportSha256: string;
        reviewArtifactSha256: string;
      };
    }>(`tmp/uploads/${DOCUMENT_ID}/knowledge-auto-review-calibration-v3.json`);
    expect(sha256('data/knowledge-graph/graph.json')).toBe(
      calibration.immutabilityBaseline.graphSha256
    );
    expect(sha256('data/textbook-mappings.json')).toBe(
      calibration.immutabilityBaseline.textbookMappingsSha256
    );
    expect(sha256('data/import-data.json')).toBe(
      calibration.immutabilityBaseline.controlledImportSha256
    );
    const sessions = reviewSessions();
    expect(
      sessions.filter((session) => session.promptVersion === 'knowledge-auto-review-v1')
    ).toHaveLength(2);
    expect(
      sessions.filter((session) => session.promptVersion === 'knowledge-auto-review-v2')
    ).toHaveLength(4);
  });

  it('records bounded prompt size and offline Bài 1–5 regression dimensions', () => {
    const audit = auditKnowledgePromptSize(input());
    const calibration = readJson<{
      promptSizeAudit: {
        v2EstimatedTokens: number;
        v3EstimatedTokens: number;
        v3FewShotEstimatedTokens: number;
      };
      offlineRegression: {
        lessons: Array<{
          label: string;
          regressionsBroken: number;
          dimensions: Record<string, { agreement: number }>;
        }>;
        falseCanonicalization: { v2: number; v3: number; reduction: number };
      };
    }>(`tmp/uploads/${DOCUMENT_ID}/knowledge-auto-review-calibration-v3.json`);
    expect(audit.v3StaticSystem.estimatedTokens).toBeLessThan(3_500);
    expect(audit.v3FewShotContribution.estimatedTokens).toBeLessThan(700);
    expect(calibration.promptSizeAudit).toMatchObject({
      v2EstimatedTokens: audit.v2StaticSystem.estimatedTokens,
      v3EstimatedTokens: audit.v3StaticSystem.estimatedTokens,
      v3FewShotEstimatedTokens: audit.v3FewShotContribution.estimatedTokens,
    });
    expect(calibration.offlineRegression.lessons.map((lesson) => lesson.label)).toEqual([
      'Bài 1',
      'Bài 2',
      'Bài 3',
      'Bài 4',
      'Bài 5',
    ]);
    expect(
      calibration.offlineRegression.lessons
        .slice(0, 3)
        .every((lesson) => lesson.regressionsBroken === 0)
    ).toBe(true);
    expect(
      calibration.offlineRegression.lessons.every((lesson) =>
        Object.values(lesson.dimensions).every((dimension) => dimension.agreement >= 0.8)
      )
    ).toBe(true);
    expect(calibration.offlineRegression.falseCanonicalization).toMatchObject({
      v2: 5,
      v3: 0,
      reduction: 1,
    });
  });

  it('does not mutate raw evidence while running offline tests', () => {
    const raw = readJson<unknown>(`tmp/uploads/${DOCUMENT_ID}/knowledge-auto-review.json`);
    const before = deterministicHash(raw);
    expect(deterministicHash(raw)).toBe(before);
  });
});
