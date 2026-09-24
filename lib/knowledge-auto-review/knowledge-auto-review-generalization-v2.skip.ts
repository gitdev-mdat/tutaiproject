import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import type { KnowledgeAutoReviewSession } from '@/lib/ai/ai-types';
import { KNOWLEDGE_AUTO_REVIEW_V2_SYSTEM_PROMPT } from '@/lib/ai/prompts/knowledge-auto-review';
import { KNOWLEDGE_AUTO_REVIEW_MODELS } from '@/lib/config/knowledge-auto-review';
import {
  calculateCombinedGeneralizationMetrics,
  RETRIEVAL_AUDIT_CLASSIFICATIONS,
  type GeneralizationEvaluation,
} from './generalization-validation';
import { deterministicHash } from './knowledge-auto-review-retrieval';

const ROOT = process.cwd();
const DOCUMENT_ID = 'mryei32t-0fybu39';
const BAI_3_SESSION_ID = 'af8d8931-0f16-49bd-9b23-62b1fd6e1b0b';
const BAI_4_SESSION_ID = '41fa1aee-67b8-4523-88db-74b21b1d1528';
const BAI_5_INTERRUPTED_SESSION_ID = '7a34082b-f8e8-4d11-b625-068317f0bc66';
const BAI_5_REPLACEMENT_SESSION_ID = '110e1b38-1964-430b-b093-bba2440305c3';

interface RetrievalAuditRow {
  conceptTitle: string;
  classification: string;
  materialTo: string;
  note: string;
}

interface LessonEvaluation extends GeneralizationEvaluation {
  sourceSessionId: string;
  sourceInputHash: string;
  retrievalAudit: RetrievalAuditRow[];
  applicationContextAudit?: Array<{
    sourceRecordId: string;
    recommendedClassification: string;
    note: string;
  }>;
}

interface GeneralizationArtifact {
  canonicalCommitPerformed: boolean;
  frozenConfiguration: {
    promptVersion: string;
    promptSha256: string;
    promptSourceFileSha256: string;
    model: string;
    policyVersion: string;
  };
  immutabilityBaseline: {
    graphSha256: string;
    textbookMappingsSha256: string;
    controlledImportSha256: string;
    controlledImportSessionIds: string[];
    existingSessionIds: string[];
  };
  bai4HumanEvaluation: LessonEvaluation;
  bai5ExecutionLineage: {
    providerAttempts: number;
    successfulCompletedResults: number;
    interruptedSession: {
      id: string;
      status: string;
      errorCode: string;
      inputHash: string;
      providerAttempt: number;
    };
    replacementSession: {
      id: string;
      replacementForSessionId: string;
      status: string;
      inputHash: string;
      providerAttempt: number;
    };
  };
  bai5HumanEvaluation: LessonEvaluation;
}

interface CalibrationArtifact {
  bai3HumanEvaluation: LessonEvaluation;
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8')) as T;
}

function fileSha256(relativePath: string): string {
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

function generalizationArtifact(): GeneralizationArtifact {
  return readJson<GeneralizationArtifact>(
    `tmp/uploads/${DOCUMENT_ID}/knowledge-auto-review-generalization-v2.json`
  );
}

describe('Phase 4.7 frozen V2 generalization evidence', () => {
  it('locks the V2 runtime prompt hash, routing, and policy', () => {
    const evidence = generalizationArtifact();
    const runtimeHash = createHash('sha256')
      .update(KNOWLEDGE_AUTO_REVIEW_V2_SYSTEM_PROMPT)
      .digest('hex');

    expect(runtimeHash).toBe('019391d8d63db7084f76e53e663870ae4a219d05dfeed86de919b0674d816347');
    expect(runtimeHash).toBe(evidence.frozenConfiguration.promptSha256);
    expect(evidence.frozenConfiguration.promptVersion).toBe('knowledge-auto-review-v2');
    expect(KNOWLEDGE_AUTO_REVIEW_MODELS.semanticClassification).toBe('gemini-3.5-flash');
    expect(evidence.frozenConfiguration.policyVersion).toBe('knowledge-auto-review-policy-v2');
  });

  it('preserves the interrupted Bài 5 attempt and links one completed replacement', () => {
    const evidence = generalizationArtifact();
    const sessions = reviewSessions();
    const interrupted = sessions.find((session) => session.id === BAI_5_INTERRUPTED_SESSION_ID);
    const replacement = sessions.find((session) => session.id === BAI_5_REPLACEMENT_SESSION_ID);

    expect(interrupted).toMatchObject({
      status: 'FAILED',
      errorCode: 'INTERRUPTED',
      providerAttempt: 1,
      promptVersion: 'knowledge-auto-review-v2',
      modelProvider: 'GEMINI',
    });
    expect(interrupted?.result).toBeUndefined();
    expect(interrupted?.startedAt).toBeTruthy();
    expect(interrupted?.interruptedAt).toBeTruthy();
    expect(replacement).toMatchObject({
      status: 'COMPLETED',
      providerAttempt: 2,
      replacementForSessionId: BAI_5_INTERRUPTED_SESSION_ID,
      promptVersion: 'knowledge-auto-review-v2',
    });
    expect(replacement?.id).not.toBe(interrupted?.id);
    expect(replacement?.inputHash).toBe(interrupted?.inputHash);
    expect(
      sessions.filter((session) => session.replacementForSessionId === BAI_5_INTERRUPTED_SESSION_ID)
    ).toHaveLength(1);
    expect(evidence.bai5ExecutionLineage.providerAttempts).toBe(2);
    expect(evidence.bai5ExecutionLineage.successfulCompletedResults).toBe(1);
  });

  it.each([
    ['Bài 4', BAI_4_SESSION_ID, 'mryhipx2-5sfrupk'],
    ['Bài 5', BAI_5_REPLACEMENT_SESSION_ID, 'mryhipx2-4bm668b'],
  ])('%s acceptance artifact is completed and non-committing', (_label, sessionId, lessonId) => {
    const artifact = generalizationArtifact();
    const session = reviewSessions().find((item) => item.id === sessionId);
    const graphText = fs.readFileSync(path.join(ROOT, 'data/knowledge-graph/graph.json'), 'utf8');
    const mappingText = fs.readFileSync(path.join(ROOT, 'data/textbook-mappings.json'), 'utf8');
    const importText = fs.readFileSync(path.join(ROOT, 'data/import-data.json'), 'utf8');

    expect(session).toMatchObject({
      id: sessionId,
      lessonId,
      status: 'COMPLETED',
      promptVersion: 'knowledge-auto-review-v2',
    });
    expect(artifact.canonicalCommitPerformed).toBe(false);
    expect(graphText).not.toContain(lessonId);
    expect(mappingText).not.toContain(lessonId);
    expect(importText).not.toContain(sessionId);
  });

  it('keeps raw AI sessions immutable while separate human evaluations are read', () => {
    const raw = readJson<{ sessions: KnowledgeAutoReviewSession[] }>(
      `tmp/uploads/${DOCUMENT_ID}/knowledge-auto-review.json`
    );
    const before = deterministicHash(raw);
    const evaluation = structuredClone(generalizationArtifact());

    expect(evaluation.bai4HumanEvaluation.sourceSessionId).toBe(BAI_4_SESSION_ID);
    expect(evaluation.bai5HumanEvaluation.sourceSessionId).toBe(BAI_5_REPLACEMENT_SESSION_ID);
    expect(deterministicHash(raw)).toBe(before);
  });

  it('records application-context over-generation without rewriting the AI result', () => {
    const evidence = generalizationArtifact();
    const session = reviewSessions().find((item) => item.id === BAI_5_REPLACEMENT_SESSION_ID)!;
    const audit = evidence.bai5HumanEvaluation.applicationContextAudit ?? [];

    expect(audit).toHaveLength(3);
    expect(audit.map((row) => row.recommendedClassification)).toEqual([
      'APPLICATION_CONTEXT',
      'APPLICATION_CONTEXT',
      'ONTOLOGY_AMBIGUOUS',
    ]);
    for (const row of audit) {
      expect(
        session.result?.candidateReviews.find(
          (candidate) => candidate.sourceRecordId === row.sourceRecordId
        )?.classification
      ).toBe('MERGE_CANDIDATE');
    }
  });

  it('reports retrieval gaps using only the governed classification vocabulary', () => {
    const evidence = generalizationArtifact();
    const rows = [
      ...evidence.bai4HumanEvaluation.retrievalAudit,
      ...evidence.bai5HumanEvaluation.retrievalAudit,
    ];

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(RETRIEVAL_AUDIT_CLASSIFICATIONS).toContain(row.classification);
    }
    expect(rows.every((row) => row.classification === 'GRAPH_CONCEPT_MISSING')).toBe(true);
  });

  it('calculates combined Bài 3–5 metrics without hiding wrong decisions', () => {
    const sessions = reviewSessions();
    const evidence = generalizationArtifact();
    const calibration = readJson<CalibrationArtifact>(
      `tmp/uploads/${DOCUMENT_ID}/knowledge-auto-review-calibration-v2.json`
    );
    const metrics = calculateCombinedGeneralizationMetrics([
      {
        session: sessions.find((session) => session.id === BAI_3_SESSION_ID)!,
        evaluation: calibration.bai3HumanEvaluation,
      },
      {
        session: sessions.find((session) => session.id === BAI_4_SESSION_ID)!,
        evaluation: evidence.bai4HumanEvaluation,
      },
      {
        session: sessions.find((session) => session.id === BAI_5_REPLACEMENT_SESSION_ID)!,
        evaluation: evidence.bai5HumanEvaluation,
      },
    ]);

    expect(metrics).toMatchObject({
      totalDecisions: 51,
      correct: 32,
      acceptableWithEdit: 6,
      wrong: 11,
      uncertain: 2,
      candidateCount: 11,
      aiSafeClassifications: 1,
      humanConfirmationsRequired: 10,
      humanEditsRequired: 6,
      ontologyHolds: 4,
      providerAttemptCount: 4,
      successfulResultCount: 3,
      boundedRetryRate: 0,
      interruptedAttemptRate: 0.25,
    });
    expect(metrics.rawCandidateReviewReduction).toBeCloseTo(1 / 11);
    expect(metrics.operationalHumanReviewReduction).toBeCloseTo(1 / 33);
    expect(metrics.averageProviderTokens).toBeCloseTo(7440.333, 2);
    expect(metrics.averageLatencyMs).toBeCloseTo(17096.667, 2);
    expect(metrics.byCategory.ONTOLOGY_APPLICATION_CLASSIFICATION.wrong).toBe(3);
    expect(metrics.byCategory.ONTOLOGY_CLASSIFICATION.wrong).toBe(1);
  });

  it('keeps graph, mappings, and Controlled Import state byte-identical', () => {
    const evidence = generalizationArtifact();
    const semantic = readJson<{ controlledImportSessionIds: string[] }>(
      `tmp/uploads/${DOCUMENT_ID}/semantic-proposals.json`
    );

    expect(fileSha256('data/knowledge-graph/graph.json')).toBe(
      evidence.immutabilityBaseline.graphSha256
    );
    expect(fileSha256('data/textbook-mappings.json')).toBe(
      evidence.immutabilityBaseline.textbookMappingsSha256
    );
    expect(fileSha256('data/import-data.json')).toBe(
      evidence.immutabilityBaseline.controlledImportSha256
    );
    expect(semantic.controlledImportSessionIds).toEqual(
      evidence.immutabilityBaseline.controlledImportSessionIds
    );
  });

  it('contains no Bài 4/Bài 5 lesson-specific production hardcoding', () => {
    const productionText = [
      'lib/ai/prompts/knowledge-auto-review.ts',
      'lib/config/knowledge-auto-review.ts',
      'lib/knowledge-auto-review/knowledge-auto-review-engine.ts',
      'lib/knowledge-auto-review/knowledge-auto-review-retrieval.ts',
      'lib/knowledge-auto-review/generalization-validation.ts',
    ]
      .map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8'))
      .join('\n');

    for (const forbidden of [
      'mryhipx2-5sfrupk',
      'mryhipx2-4bm668b',
      'Khảo sát sự biến thiên và vẽ đồ thị',
      'Ứng dụng đạo hàm để giải quyết',
      'Hàm chi phí, doanh thu và lợi nhuận',
    ]) {
      expect(productionText).not.toContain(forbidden);
    }
  });
});
