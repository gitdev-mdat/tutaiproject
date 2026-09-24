import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import type { AiGateway } from '@/lib/ai/ai-gateway';
import type {
  KnowledgeAutoReviewInput,
  KnowledgeAutoReviewResult,
  KnowledgeAutoReviewSession,
  KnowledgeCandidateReview,
} from '@/lib/ai/ai-types';
import {
  KNOWLEDGE_AUTO_REVIEW_V1_SYSTEM_PROMPT,
  KNOWLEDGE_AUTO_REVIEW_V2_SYSTEM_PROMPT,
} from '@/lib/ai/prompts/knowledge-auto-review';
import {
  KNOWLEDGE_AUTO_REVIEW_MODELS,
  KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSION,
  KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS,
} from '@/lib/config/knowledge-auto-review';
import type { KgDocument } from '@/lib/knowledge-graph/kg-types';
import type { PipelineDocument } from '@/lib/pipeline/types';
import type { SemanticProposalPackage } from '@/lib/textbook/semantic-proposal-types';
import type { LessonConceptMapping, Textbook } from '@/lib/textbook/types';
import {
  LESSON_1_GOLDEN_REVIEW,
  LESSON_2_GOLDEN_REVIEW,
  evaluateCalibratedGoldenReview,
  type GoldenReviewFixture,
} from './golden-review-fixtures';
import { applyKnowledgeReviewPolicy, runKnowledgeAutoReview } from './knowledge-auto-review-engine';
import {
  deterministicHash,
  knowledgeAutoReviewInputHash,
  prepareKnowledgeAutoReviewInput,
} from './knowledge-auto-review-retrieval';
import type { KnowledgeAutoReviewStore } from './knowledge-auto-review-storage';
import {
  CALIBRATION_ERROR_CATEGORIES,
  V1_CALIBRATION_EVIDENCE,
  createUntouchedHumanEvaluation,
} from './knowledge-review-calibration';
import { auditKnowledgePromptSize } from './prompt-size-audit';

const TEXTBOOK_ID = 'mryei32t-0fybu39';
const LESSON_1_ID = 'mryhipx2-eh6ke0j';
const LESSON_2_ID = 'mryhipx2-9r8oliu';
const BLIND_LESSON_ID = 'mryhipx2-ozx6csd';

class MemoryStore implements KnowledgeAutoReviewStore {
  constructor(public sessions: KnowledgeAutoReviewSession[] = []) {}

  async list() {
    return structuredClone(this.sessions);
  }

  async upsert(session: KnowledgeAutoReviewSession) {
    const index = this.sessions.findIndex((item) => item.id === session.id);
    if (index >= 0) this.sessions[index] = structuredClone(session);
    else this.sessions.push(structuredClone(session));
  }
}

function diskInput(lessonId: string): {
  input: KnowledgeAutoReviewInput;
  graphRaw: string;
  importRaw: string;
  mappingsRaw: string;
} {
  const graphRaw = readFileSync(
    path.join(process.cwd(), 'data', 'knowledge-graph', 'graph.json'),
    'utf8'
  );
  const importRaw = readFileSync(path.join(process.cwd(), 'data', 'import-data.json'), 'utf8');
  const mappingsRaw = readFileSync(
    path.join(process.cwd(), 'data', 'textbook-mappings.json'),
    'utf8'
  );
  const textbook = (
    JSON.parse(
      readFileSync(path.join(process.cwd(), 'data', 'textbooks.json'), 'utf8')
    ) as Textbook[]
  ).find((item) => item.id === TEXTBOOK_ID)!;
  return {
    input: prepareKnowledgeAutoReviewInput({
      textbook,
      document: JSON.parse(
        readFileSync(
          path.join(process.cwd(), 'tmp', 'uploads', TEXTBOOK_ID, 'document.json'),
          'utf8'
        )
      ) as PipelineDocument,
      graph: JSON.parse(graphRaw) as KgDocument,
      lessonId,
      textbookMappings: JSON.parse(mappingsRaw) as LessonConceptMapping[],
      semantic: JSON.parse(
        readFileSync(
          path.join(process.cwd(), 'tmp', 'uploads', TEXTBOOK_ID, 'semantic-proposals.json'),
          'utf8'
        )
      ) as SemanticProposalPackage,
    }),
    graphRaw,
    importRaw,
    mappingsRaw,
  };
}

function referenceForTitle(
  title: string,
  input: KnowledgeAutoReviewInput,
  merges: KnowledgeAutoReviewResult['mergeProposals']
) {
  const merge = merges.find((proposal) => proposal.proposedCanonicalTitle === title);
  if (merge) return { kind: 'MERGE_PROPOSAL' as const, id: merge.id, title };
  const existing = input.existingConceptCandidates.find((concept) => concept.title === title);
  if (existing) return { kind: 'EXISTING_CONCEPT' as const, id: existing.id, title };
  const source = input.semanticRecords.find((record) => record.title === title);
  if (source) return { kind: 'SOURCE_CANDIDATE' as const, id: source.id, title };
  throw new Error(`Golden reference is absent from bounded input: ${title}`);
}

function goldenResult(
  fixture: GoldenReviewFixture,
  input: KnowledgeAutoReviewInput
): KnowledgeAutoReviewResult {
  const recordIdByTitle = new Map(input.semanticRecords.map((record) => [record.title, record.id]));
  const mergeTargetBySourceTitle = new Map<string, string>();
  fixture.expectedMergeGroupings.forEach((group, index) => {
    for (const title of group) {
      mergeTargetBySourceTitle.set(title, fixture.expectedConceptTitles[index]);
    }
  });
  const nonConceptByTitle = new Map(
    fixture.expectedNonConceptClassifications.map((item) => [item.sourceTitle, item.classification])
  );
  const ontologyHolds = new Set(fixture.expectedOntologyHolds);
  const candidateReviews: KnowledgeCandidateReview[] = input.semanticRecords.map((record) => {
    const mergeTarget = mergeTargetBySourceTitle.get(record.title);
    const classification = mergeTarget
      ? ('MERGE_CANDIDATE' as const)
      : (nonConceptByTitle.get(record.title) ??
        (ontologyHolds.has(record.title) ? 'REPRESENTATION_OR_TOOL' : 'REJECT_INVALID'));
    return {
      sourceRecordId: record.id,
      classification,
      proposedCanonicalTitle: mergeTarget,
      conciseRationale: 'Golden calibration evaluation output.',
      evidence: [record.sourceText ?? record.description ?? record.title],
      confidence: 0.96,
      evidenceSufficiency:
        classification === 'ONTOLOGY_AMBIGUOUS' ? ('WEAK' as const) : ('SUFFICIENT' as const),
      titleEvidenceAssessment:
        classification === 'ONTOLOGY_AMBIGUOUS' ? ('UNCLEAR' as const) : ('CONSISTENT' as const),
      reasonCodes:
        classification === 'MERGE_CANDIDATE'
          ? ['COMPLEMENTARY_CONCEPTS']
          : classification === 'METHOD_OR_PROCEDURE'
            ? ['PROCEDURAL_LANGUAGE']
            : classification === 'REPRESENTATION_OR_TOOL'
              ? ['ONTOLOGY_CATEGORY_UNCLEAR']
              : ['INSUFFICIENT_EVIDENCE'],
    };
  });
  const mergeProposals = fixture.expectedMergeGroupings.map((group, index) => ({
    id: `golden-merge-${index}`,
    sourceCandidateIds: group.map((title) => recordIdByTitle.get(title)!),
    proposedCanonicalTitle: fixture.expectedConceptTitles[index],
    conciseRationale: 'Golden complementary grouping.',
    confidence: 0.97,
    reasonCodes: ['COMPLEMENTARY_CONCEPTS' as const],
  }));
  const learningObjectives = (fixture.expectedLearningObjectiveDetails ?? []).map(
    (objective, index) => ({
      id: `golden-lo-${index}`,
      statement: objective.statement,
      targetReference: referenceForTitle(objective.targetTitle, input, mergeProposals),
      bloomLevel: objective.bloomLevel,
      conciseRationale: 'Golden observable learner capability.',
      sourceSemanticRecordIds: input.semanticRecords.map((record) => record.id),
      confidence: 0.96,
    })
  );
  const prerequisiteProposals = fixture.expectedImportantPrerequisites.map((relation, index) => ({
    id: `golden-prerequisite-${index}`,
    sourceReference: referenceForTitle(relation.sourceTitle, input, mergeProposals),
    targetReference: referenceForTitle(relation.targetTitle, input, mergeProposals),
    relationType: 'LEARNING_PREREQUISITE' as const,
    conciseRationale: 'Golden material learning dependency.',
    sourceSemanticRecordIds: input.semanticRecords.map((record) => record.id),
    confidence: 0.95,
  }));
  return {
    candidateReviews,
    mergeProposals,
    learningObjectives,
    prerequisiteProposals,
    ambiguities: [],
  };
}

function completeV3Result(
  result: KnowledgeAutoReviewResult,
  input: KnowledgeAutoReviewInput
): KnowledgeAutoReviewResult {
  const completed = structuredClone(result);
  for (const review of completed.candidateReviews) {
    review.evidenceSufficiency ??= 'SUFFICIENT';
    review.titleEvidenceAssessment ??= 'CONSISTENT';
  }
  const targets = [
    ...completed.candidateReviews.flatMap((review) =>
      review.classification === 'NEW_CONCEPT'
        ? [
            {
              kind: 'SOURCE_CANDIDATE' as const,
              id: review.sourceRecordId,
              title:
                review.proposedCanonicalTitle ??
                input.semanticRecords.find((record) => record.id === review.sourceRecordId)
                  ?.title ??
                review.sourceRecordId,
            },
          ]
        : []
    ),
    ...completed.mergeProposals.map((merge) => ({
      kind: 'MERGE_PROPOSAL' as const,
      id: merge.id,
      title: merge.proposedCanonicalTitle,
    })),
  ];
  completed.prerequisiteAudits = input.existingConceptCandidates.flatMap((concept, conceptIndex) =>
    targets.map((target, targetIndex) => {
      const strong = completed.prerequisiteProposals.some(
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
        assessment: strong ? ('STRONG_PREREQUISITE' as const) : ('NOT_REQUIRED' as const),
        conciseRationale: strong
          ? 'Material learning dependency.'
          : 'Retrieved knowledge is not materially required.',
        sourceSemanticRecordIds: [input.semanticRecords[0].id],
        confidence: 0.9,
      };
    })
  );
  completed.missingPrerequisites = [];
  return completed;
}

function gateway(result: KnowledgeAutoReviewResult): AiGateway {
  return {
    async reviewKnowledgeCandidates(input) {
      return { result: completeV3Result(result, input) };
    },
  };
}

function persistedSessions(): KnowledgeAutoReviewSession[] {
  return (
    JSON.parse(
      readFileSync(
        path.join(process.cwd(), 'tmp', 'uploads', TEXTBOOK_ID, 'knowledge-auto-review.json'),
        'utf8'
      )
    ) as { sessions: KnowledgeAutoReviewSession[] }
  ).sessions;
}

describe('Phase 4.6 Knowledge Auto-Review calibration V2', () => {
  it('preserves the V1 prompt and activates an explicit V2 prompt version', () => {
    const v1Hash = createHash('sha256')
      .update(KNOWLEDGE_AUTO_REVIEW_V1_SYSTEM_PROMPT)
      .digest('hex');
    expect(v1Hash).toBe('72537a5986ede825f0ccd3d77d196cd37f18d647cd45ed90b1bacadfac8046d2');
    expect(KNOWLEDGE_AUTO_REVIEW_V1_SYSTEM_PROMPT).toContain('knowledge-auto-review-v1');
    expect(KNOWLEDGE_AUTO_REVIEW_V2_SYSTEM_PROMPT).toContain('knowledge-auto-review-v2');
    expect(KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSION).toBe(KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v35);
  });

  it('makes V1 and V2 hashes different without changing semantic input', () => {
    const { input } = diskInput(LESSON_2_ID);
    const v1 = knowledgeAutoReviewInputHash(input, {
      promptVersion: KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v1,
      modelConfiguration: KNOWLEDGE_AUTO_REVIEW_MODELS,
    });
    const v2 = knowledgeAutoReviewInputHash(input, {
      promptVersion: KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v2,
      modelConfiguration: KNOWLEDGE_AUTO_REVIEW_MODELS,
    });
    expect(v2).not.toBe(v1);
  });

  it('captures Golden Fixture #2 semantically without UUID coupling', () => {
    expect(LESSON_2_GOLDEN_REVIEW).toMatchObject({
      expectedConceptTitles: ['Giá trị lớn nhất và giá trị nhỏ nhất của hàm số'],
      expectedMergeGroupings: [['Giá trị lớn nhất', 'Giá trị nhỏ nhất']],
      expectedOntologyHolds: [],
    });
    expect(
      LESSON_2_GOLDEN_REVIEW.expectedLearningObjectiveDetails?.map((item) => item.bloomLevel)
    ).toEqual(['UNDERSTAND', 'APPLY']);
    expect(JSON.stringify(LESSON_2_GOLDEN_REVIEW)).not.toMatch(
      /mryhipx2|concept-[a-f0-9]|node-[a-z0-9]/
    );
  });

  it.each([
    ['Bài 1', LESSON_1_ID, LESSON_1_GOLDEN_REVIEW],
    ['Bài 2', LESSON_2_ID, LESSON_2_GOLDEN_REVIEW],
  ])(
    'runs V2 production validation for %s and reports every dimension',
    async (_, lessonId, fixture) => {
      const disk = diskInput(lessonId);
      const result = goldenResult(fixture, disk.input);
      const completed = await runKnowledgeAutoReview({
        gateway: gateway(result),
        store: new MemoryStore(),
        input: disk.input,
        force: true,
      });
      const evaluation = evaluateCalibratedGoldenReview(
        fixture,
        disk.input,
        completed.session.result!
      );
      expect(completed.session.promptVersion).toBe(KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v35);
      expect(Object.values(evaluation.dimensions).every((item) => item.agreement === 1)).toBe(true);
      expect(
        readFileSync(path.join(process.cwd(), 'data', 'knowledge-graph', 'graph.json'), 'utf8')
      ).toBe(disk.graphRaw);
    }
  );

  it('records the evidenced V1 LO and prerequisite completeness gaps', () => {
    expect(CALIBRATION_ERROR_CATEGORIES).toContain('LO_MISSING');
    expect(CALIBRATION_ERROR_CATEGORIES).toContain('PREREQUISITE_MISSING');
    expect(
      V1_CALIBRATION_EVIDENCE.filter((row) => row.observed && row.category === 'LO_MISSING')
    ).toHaveLength(2);
    expect(
      V1_CALIBRATION_EVIDENCE.filter(
        (row) => row.observed && row.category === 'PREREQUISITE_MISSING'
      )
    ).toHaveLength(2);
  });

  it.each([
    [
      'Bài 1',
      LESSON_1_ID,
      LESSON_1_GOLDEN_REVIEW,
      { conceptOntology: 1, merge: 1, learningObjective: 0, bloom: 0, prerequisite: 1 / 3 },
    ],
    [
      'Bài 2',
      LESSON_2_ID,
      LESSON_2_GOLDEN_REVIEW,
      { conceptOntology: 1, merge: 1, learningObjective: 0, bloom: 0, prerequisite: 1 / 3 },
    ],
  ])(
    'measures live V1 %s dimensions without rewriting the artifact',
    (_, lessonId, fixture, expected) => {
      const session = persistedSessions().find((item) => item.lessonId === lessonId)!;
      const before = structuredClone(session);
      const evaluation = evaluateCalibratedGoldenReview(fixture, session.input, session.result!);
      expect(
        Object.fromEntries(
          Object.entries(evaluation.dimensions).map(([key, value]) => [key, value.agreement])
        )
      ).toMatchObject(expected);
      expect(session).toEqual(before);
    }
  );

  it('keeps completed V1 evidence intact when V2 creates a new versioned session', async () => {
    const v1 = persistedSessions().find((session) => session.lessonId === LESSON_2_ID)!;
    const before = structuredClone(v1);
    const store = new MemoryStore([v1]);
    const result = goldenResult(LESSON_2_GOLDEN_REVIEW, v1.input);
    const v2 = await runKnowledgeAutoReview({
      gateway: gateway(result),
      store,
      input: v1.input,
    });
    expect(v2.cacheHit).toBe(false);
    expect(store.sessions).toHaveLength(2);
    expect(store.sessions[0]).toEqual(before);
    expect(v2.session.promptVersion).toBe(KNOWLEDGE_AUTO_REVIEW_PROMPT_VERSIONS.v35);
    expect(v2.session.inputHash).not.toBe(v1.inputHash);
  });

  it('creates human evaluation separately without changing the original AI artifact', () => {
    const session = persistedSessions().find((item) => item.lessonId === LESSON_2_ID)!;
    const before = structuredClone(session);
    const evaluation = createUntouchedHumanEvaluation(session, [
      {
        id: 'lo-v1',
        category: 'LEARNING_OBJECTIVE',
        rating: 'ACCEPTABLE_WITH_EDIT',
        note: 'Restrict wording to the supplied closed-interval evidence.',
      },
    ]);
    expect(evaluation.totals.ACCEPTABLE_WITH_EDIT).toBe(1);
    expect(session).toEqual(before);
  });

  it('keeps persisted Bài 2/Bài 3 AI sessions immutable beside the separate calibration artifact', () => {
    const calibration = JSON.parse(
      readFileSync(
        path.join(
          process.cwd(),
          'tmp',
          'uploads',
          TEXTBOOK_ID,
          'knowledge-auto-review-calibration-v2.json'
        ),
        'utf8'
      )
    ) as {
      canonicalCommitPerformed: boolean;
      bai2GoldenReview: { sourceSessionId: string; sourceSessionHash: string };
      bai3HumanEvaluation: {
        sourceSessionId: string;
        sourceSessionHash: string;
        totals: { correct: number; acceptableWithEdit: number; wrong: number };
      };
    };
    const sessions = persistedSessions();
    const lesson2 = sessions.find(
      (session) => session.id === calibration.bai2GoldenReview.sourceSessionId
    )!;
    const lesson3 = sessions.find(
      (session) => session.id === calibration.bai3HumanEvaluation.sourceSessionId
    )!;
    expect(deterministicHash(lesson2)).toBe(calibration.bai2GoldenReview.sourceSessionHash);
    expect(deterministicHash(lesson3)).toBe(calibration.bai3HumanEvaluation.sourceSessionHash);
    expect(calibration.bai3HumanEvaluation.totals).toMatchObject({
      correct: 8,
      acceptableWithEdit: 1,
      wrong: 0,
    });
    expect(calibration.canonicalCommitPerformed).toBe(false);
  });

  it('keeps textbook-only records visible for human confirmation under the V3 policy', () => {
    const { input } = diskInput(LESSON_2_ID);
    const record = input.semanticRecords[0];
    const policy = applyKnowledgeReviewPolicy(
      [
        {
          sourceRecordId: record.id,
          classification: 'TEXTBOOK_ONLY',
          conciseRationale: 'Publisher-specific context.',
          evidence: [record.title],
          confidence: 0.95,
          reasonCodes: ['TEXTBOOK_SPECIFIC'],
        },
      ],
      {
        ...input,
        semanticRecords: [record],
        deterministicMatches: [
          { sourceRecordId: record.id, matchType: 'NONE', canonicalConceptIds: [] },
        ],
      }
    );
    expect(policy[0].disposition).toBe('HUMAN_CONFIRM_REQUIRED');
  });

  it('contains no blind-lesson or title-specific deterministic behavior', () => {
    const productionLogic = [
      'knowledge-auto-review-engine.ts',
      'knowledge-auto-review-retrieval.ts',
    ]
      .map((file) =>
        readFileSync(path.join(process.cwd(), 'lib', 'knowledge-auto-review', file), 'utf8')
      )
      .join('\n');
    expect(productionLogic).not.toContain(BLIND_LESSON_ID);
    expect(productionLogic).not.toContain('Đường tiệm cận');
    expect(productionLogic).not.toContain('GTLN');
  });

  it('uses calibrated human-action copy instead of raw enums as the main Admin UX', () => {
    const panel = readFileSync(
      path.join(
        process.cwd(),
        'components',
        'admin',
        'textbooks',
        'knowledge-auto-review-panel.tsx'
      ),
      'utf8'
    );
    expect(panel).toContain('AI khá chắc đây là một phương pháp, không phải Concept');
    expect(panel).toContain('Learning Objective cần review');
    expect(panel).toContain('classificationLabel(review.classification)');
    expect(panel).not.toContain('{review.classification}');
  });

  it('runs a mocked blind Bài 3 session without committing graph, import, or mappings', async () => {
    const disk = diskInput(BLIND_LESSON_ID);
    const result: KnowledgeAutoReviewResult = {
      candidateReviews: disk.input.semanticRecords.map((record) => ({
        sourceRecordId: record.id,
        classification: 'TEXTBOOK_ONLY',
        conciseRationale: 'Mocked blind acceptance classification.',
        evidence: [record.title],
        confidence: 0.95,
        reasonCodes: ['TEXTBOOK_SPECIFIC'],
      })),
      mergeProposals: [],
      learningObjectives: [],
      prerequisiteProposals: [],
      ambiguities: [],
    };
    await runKnowledgeAutoReview({
      gateway: gateway(result),
      store: new MemoryStore(),
      input: disk.input,
      force: true,
    });
    expect(
      readFileSync(path.join(process.cwd(), 'data', 'knowledge-graph', 'graph.json'), 'utf8')
    ).toBe(disk.graphRaw);
    expect(readFileSync(path.join(process.cwd(), 'data', 'import-data.json'), 'utf8')).toBe(
      disk.importRaw
    );
    expect(readFileSync(path.join(process.cwd(), 'data', 'textbook-mappings.json'), 'utf8')).toBe(
      disk.mappingsRaw
    );
  });

  it('audits V2 prompt size and keeps bounded canonical retrieval visible', () => {
    const audit = auditKnowledgePromptSize(diskInput(LESSON_2_ID).input);
    expect(audit.v2StaticSystem.estimatedTokens).toBeLessThan(2_500);
    expect(audit.v2FewShotContribution.estimatedTokens).toBeLessThan(600);
    expect(audit.retrievedCanonicalContext.characters).toBeGreaterThan(0);
  });
});
