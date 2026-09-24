import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import type { KnowledgeAutoReviewSession } from '@/lib/ai/ai-types';
import { KNOWLEDGE_AUTO_REVIEW_V32_SYSTEM_PROMPT } from '@/lib/ai/prompts/knowledge-auto-review-v3-2';
import {
  BAI_8_LESSON_ID,
  GOVERNED_BAI_8_SESSION_LINEAGE,
} from './governed-session-lineage.test-fixture';

const ROOT = process.cwd();
const DOCUMENT_ID = 'mryei32t-0fybu39';
const BAI_7_LESSON_ID = 'mryhipx3-dz9b818';
const SESSION_ID = 'ff47bdee-52a1-47f4-963d-4d3dc8506152';

interface BlindEvaluation {
  execution: {
    sessionId: string;
    providerAttemptCount: number;
    rawResultSha256: string;
  };
  mergeMetrics: {
    falseMerge: number;
    overFlattening: number;
  };
  falseCanonicalization: { total: number };
  ontologyHoldEvaluation: {
    holdCount: number;
    justified: number;
    overConservative: number;
    insufficientlyConservative: number;
  };
  humanReviewReduction: {
    totalCandidateRecords: number;
    safelyAutoClassifiedRecords: number;
    humanRequiredRecords: number;
    reviewReductionRate: number;
  };
  prerequisiteCompleteness: {
    retrievedCanonicalConceptCount: number;
    governedReusableTargetCount: number;
    expectedAuditRowCount: number;
    actualAuditRowCount: number;
    missingPairCount: number;
    duplicatePairCount: number;
    invalidReferenceCount: number;
    inventedCanonicalIdCount: number;
    directedCycleCount: number;
  };
  graphMissingPrerequisiteEvaluations: Array<{ idless: boolean; humanLabel: string }>;
  safety: {
    bai7ProviderRequestAttempts: number;
    bai7CompletedResults: number;
    bai7SessionCount: number;
    bai8SessionCount: number;
    hiddenReanalysisCount: number;
  };
  finalRecommendation: string;
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

function rawFingerprint(session: KnowledgeAutoReviewSession): string {
  return createHash('sha256')
    .update(JSON.stringify(session.rawProviderResult))
    .digest('hex')
    .toUpperCase();
}

function sessions(): KnowledgeAutoReviewSession[] {
  return readJson<{ sessions: KnowledgeAutoReviewSession[] }>(
    `tmp/uploads/${DOCUMENT_ID}/knowledge-auto-review.json`
  ).sessions;
}

function evaluation(): BlindEvaluation {
  return readJson<BlindEvaluation>(
    `tmp/uploads/${DOCUMENT_ID}/knowledge-auto-review-v32-second-blind-evaluation.json`
  );
}

describe('Phase 4.11 V3.2 second blind provider validation', () => {
  it('persists exactly one completed Bài 7 provider result with no retry', () => {
    const lessonSessions = sessions().filter((session) => session.lessonId === BAI_7_LESSON_ID);
    expect(lessonSessions).toHaveLength(1);
    expect(lessonSessions[0]).toMatchObject({
      id: SESSION_ID,
      status: 'COMPLETED',
      promptVersion: 'knowledge-auto-review-v3.2',
      policyVersion: 'knowledge-auto-review-policy-v3',
      modelProvider: 'GEMINI',
      modelName: 'gemini-3.5-flash',
      retryCount: 0,
      inputHash: '73460c0ed727c08c9b4fd58f1919976664f9b99a46c970c13c85facc013c3f04',
    });
    expect(evaluation().execution.providerAttemptCount).toBe(1);
  });

  it('keeps the raw result immutable and stores evaluation separately', () => {
    const session = sessions().find((item) => item.id === SESSION_ID)!;
    expect(rawFingerprint(session)).toBe(
      'FEBDA4B420AFB7FCEC5FD58950DAA1FD59CF85B84E47E1CDF6A6DBE483032B7D'
    );
    expect(evaluation().execution.rawResultSha256).toBe(rawFingerprint(session));
    expect(session).not.toHaveProperty('humanEvaluation');
  });

  it('separates related identities without a merge proposal', () => {
    const session = sessions().find((item) => item.id === SESSION_ID)!;
    const raw = session.rawProviderResult;
    expect(raw?.mergeProposals).toHaveLength(0);
    expect(raw && 'ontologyBoundaryRecommendations' in raw).toBe(true);
    if (!raw || !('ontologyBoundaryRecommendations' in raw)) {
      throw new Error('Expected a persisted V3.2 raw result');
    }
    expect(raw.ontologyBoundaryRecommendations).toHaveLength(1);
    expect(raw.ontologyBoundaryRecommendations[0]).toMatchObject({
      recommendation: 'KEEP_SEPARATE_RELATED_CONCEPTS',
      ontologyIdentityAssessment: {
        sameKnowledgeIdentity: false,
        independentlyTeachableA: true,
        independentlyTeachableB: true,
        independentlyAssessableA: true,
        independentlyAssessableB: true,
        directionalDependencyExists: true,
        constituentRelationshipExists: false,
      },
    });
  });

  it('reports false merge separately from within-record over-flattening', () => {
    expect(evaluation().mergeMetrics).toMatchObject({
      falseMerge: 0,
      overFlattening: 1,
    });
    expect(evaluation().falseCanonicalization.total).toBe(0);
  });

  it('records zero ontology holds without treating hold count as a target', () => {
    expect(evaluation().ontologyHoldEvaluation).toEqual({
      holdCount: 0,
      justified: 0,
      overConservative: 0,
      insufficientlyConservative: 0,
      note: expect.any(String),
    });
  });

  it('preserves the exhaustive R × T prerequisite matrix', () => {
    const completeness = evaluation().prerequisiteCompleteness;
    expect(completeness.retrievedCanonicalConceptCount).toBe(5);
    expect(completeness.governedReusableTargetCount).toBe(2);
    expect(completeness.expectedAuditRowCount).toBe(10);
    expect(completeness.actualAuditRowCount).toBe(10);
    expect(completeness).toMatchObject({
      missingPairCount: 0,
      duplicatePairCount: 0,
      invalidReferenceCount: 0,
      inventedCanonicalIdCount: 0,
      directedCycleCount: 0,
    });
  });

  it('keeps graph-missing foundations ID-less', () => {
    const session = sessions().find((item) => item.id === SESSION_ID)!;
    expect(session.rawProviderResult?.graphMissingPrerequisites).toHaveLength(2);
    expect(
      session.rawProviderResult?.graphMissingPrerequisites.every(
        (item) => Object.keys(item).sort().join(',') === 'confidence,reason,title'
      )
    ).toBe(true);
    expect(
      evaluation().graphMissingPrerequisiteEvaluations.every(
        (item) => item.idless && item.humanLabel === 'CORRECT'
      )
    ).toBe(true);
  });

  it('reports the actual one-third candidate review reduction', () => {
    expect(evaluation().humanReviewReduction).toMatchObject({
      totalCandidateRecords: 3,
      safelyAutoClassifiedRecords: 1,
      humanRequiredRecords: 2,
    });
    expect(evaluation().humanReviewReduction.reviewReductionRate).toBeCloseTo(1 / 3);
  });

  it('records that Phase 4.11 created no Bài 8 session or hidden Bài 7 re-analysis', () => {
    expect(evaluation().safety).toEqual({
      bai7ProviderRequestAttempts: 1,
      bai7CompletedResults: 1,
      bai7SessionCount: 1,
      bai8SessionCount: 0,
      hiddenReanalysisCount: 0,
    });
    const laterBai8Sessions = sessions().filter((session) => session.lessonId === BAI_8_LESSON_ID);
    expect(
      laterBai8Sessions.map((session) => ({
        id: session.id,
        status: session.status,
        promptVersion: session.promptVersion,
        policyVersion: session.policyVersion,
        retrievalVersion: session.input.retrievalTrace?.version ?? null,
        errorCode: session.errorCode ?? null,
        providerAttempt: session.providerAttempt ?? null,
        retryCount: session.retryCount,
        replacementForSessionId: session.replacementForSessionId ?? null,
        rawResultPresence: session.rawProviderResult === undefined ? 'ABSENT' : 'PRESENT',
        rawResultSha256:
          session.rawProviderResult === undefined
            ? null
            : createHash('sha256')
                .update(JSON.stringify(session.rawProviderResult))
                .digest('hex')
                .toUpperCase(),
      }))
    ).toEqual(GOVERNED_BAI_8_SESSION_LINEAGE);
  });

  it('preserves Phase 4.9 failed/replacement lineage and Phase 4.10 calibration', () => {
    const all = sessions();
    expect(
      all.find((session) => session.id === '7533464d-8587-417e-a235-57ad3dc555e1')
    ).toMatchObject({
      status: 'FAILED',
      promptVersion: 'knowledge-auto-review-v3',
      errorCode: 'SCHEMA_VALIDATION',
      inputHash: '836062d811218ab657b598ce77ee1f5f623dab48ea34f291b86d71ff5239d835',
    });
    expect(
      all.find((session) => session.id === 'df75a1ee-387a-47f4-9bbb-6f624a3a2819')
    ).toMatchObject({
      status: 'COMPLETED',
      promptVersion: 'knowledge-auto-review-v3.1',
      replacementForSessionId: '7533464d-8587-417e-a235-57ad3dc555e1',
      providerAttempt: 2,
    });
    expect(sha256(`tmp/uploads/${DOCUMENT_ID}/knowledge-auto-review-calibration-v32.json`)).toBe(
      '517467EBA37176FEF708619DEBB5238E5AA63276D4F4F7CC07667ECF2F1C9A21'
    );
  });

  it('keeps the frozen V3.2 prompt and canonical stores byte-identical', () => {
    expect(
      createHash('sha256')
        .update(KNOWLEDGE_AUTO_REVIEW_V32_SYSTEM_PROMPT)
        .digest('hex')
        .toUpperCase()
    ).toBe('909C359D5609CE34F3455757ED875599B40BE6682508B4BDBDDA2A4A748A9D3B');
    expect(sha256('lib/ai/prompts/knowledge-auto-review-v3-2.ts')).toBe(
      'F84261B9C5CCD8F4EC9E03305967E64D3464DD5D685F93FD4F35CAC31680814C'
    );
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

  it('exposes Phase 4.11 review evidence in the Admin panel', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'components/admin/textbooks/knowledge-auto-review-panel.tsx'),
      'utf8'
    );
    for (const expected of [
      'Trang nguồn:',
      'ontologyBoundaryRecommendations',
      'Điểm cần quyết định ontology',
      'learningObjectives',
      'prerequisiteProposals',
      'prerequisiteAudits',
      'graphMissingPrerequisites',
      'Session:',
      'Provider attempt:',
      'session.modelName',
      'session.promptVersion',
    ]) {
      expect(source).toContain(expected);
    }
  });

  it('records the honest targeted-edit recommendation', () => {
    expect(evaluation().finalRecommendation).toBe('V3_2_ACCEPTABLE_WITH_TARGETED_EDITS');
  });
});
