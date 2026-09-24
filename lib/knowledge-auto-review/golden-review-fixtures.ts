import type {
  KnowledgeAutoReviewInput,
  KnowledgeAutoReviewResult,
  KnowledgeReviewClassification,
} from '@/lib/ai/ai-types';
import { normalizeText } from '@/lib/knowledge-graph/kg-import-service';
import type { BloomLevel } from '@/lib/knowledge-graph/kg-types';

export interface GoldenReviewFixture {
  id: string;
  lessonTitle: string;
  expectedConceptTitles: string[];
  expectedMergeGroupings: string[][];
  expectedNonConceptClassifications: Array<{
    sourceTitle: string;
    classification: KnowledgeReviewClassification;
  }>;
  expectedLearningObjectives: string[];
  expectedLearningObjectiveDetails?: Array<{
    statement: string;
    targetTitle: string;
    bloomLevel: BloomLevel;
  }>;
  expectedImportantPrerequisites: Array<{ sourceTitle: string; targetTitle: string }>;
  expectedOntologyHolds: string[];
}

export const LESSON_1_GOLDEN_REVIEW: GoldenReviewFixture = {
  id: 'golden-math12-kntt-lesson1-v1',
  lessonTitle: 'Bài 1. Tính đơn điệu và cực trị của hàm số',
  expectedConceptTitles: ['Tính đơn điệu của hàm số', 'Cực trị của hàm số'],
  expectedMergeGroupings: [
    ['Hàm số đồng biến', 'Hàm số nghịch biến'],
    ['Điểm cực trị của hàm số', 'Giá trị cực trị'],
  ],
  expectedNonConceptClassifications: [
    {
      sourceTitle: 'Quy tắc tìm cực trị',
      classification: 'METHOD_OR_PROCEDURE',
    },
  ],
  expectedLearningObjectives: [
    'Nhận biết và giải thích được các khoảng đồng biến, nghịch biến của hàm số từ định nghĩa hoặc đồ thị.',
    'Sử dụng dấu của đạo hàm và bảng biến thiên để xác định các khoảng đồng biến, nghịch biến của hàm số.',
    'Phân biệt được điểm cực đại/cực tiểu, giá trị cực đại/cực tiểu và điểm cực trị trên đồ thị.',
    'Áp dụng điều kiện đổi dấu của đạo hàm và bảng biến thiên để xác định điểm và giá trị cực trị của hàm số.',
  ],
  expectedLearningObjectiveDetails: [
    {
      statement:
        'Nhận biết và giải thích được các khoảng đồng biến, nghịch biến của hàm số từ định nghĩa hoặc đồ thị.',
      targetTitle: 'Tính đơn điệu của hàm số',
      bloomLevel: 'UNDERSTAND',
    },
    {
      statement:
        'Sử dụng dấu của đạo hàm và bảng biến thiên để xác định các khoảng đồng biến, nghịch biến của hàm số.',
      targetTitle: 'Tính đơn điệu của hàm số',
      bloomLevel: 'APPLY',
    },
    {
      statement:
        'Phân biệt được điểm cực đại/cực tiểu, giá trị cực đại/cực tiểu và điểm cực trị trên đồ thị.',
      targetTitle: 'Cực trị của hàm số',
      bloomLevel: 'UNDERSTAND',
    },
    {
      statement:
        'Áp dụng điều kiện đổi dấu của đạo hàm và bảng biến thiên để xác định điểm và giá trị cực trị của hàm số.',
      targetTitle: 'Cực trị của hàm số',
      bloomLevel: 'APPLY',
    },
  ],
  expectedImportantPrerequisites: [
    { sourceTitle: 'Hàm số', targetTitle: 'Tính đơn điệu của hàm số' },
    { sourceTitle: 'Đạo hàm', targetTitle: 'Tính đơn điệu của hàm số' },
    { sourceTitle: 'Tính đơn điệu của hàm số', targetTitle: 'Cực trị của hàm số' },
  ],
  expectedOntologyHolds: ['Bảng biến thiên'],
};

export const LESSON_2_GOLDEN_REVIEW: GoldenReviewFixture = {
  id: 'golden-math12-kntt-lesson2-v1',
  lessonTitle: 'Bài 2. Giá trị lớn nhất và giá trị nhỏ nhất của hàm số',
  expectedConceptTitles: ['Giá trị lớn nhất và giá trị nhỏ nhất của hàm số'],
  expectedMergeGroupings: [['Giá trị lớn nhất', 'Giá trị nhỏ nhất']],
  expectedNonConceptClassifications: [
    {
      sourceTitle: 'Quy tắc tìm GTLN và GTNN',
      classification: 'METHOD_OR_PROCEDURE',
    },
  ],
  expectedLearningObjectives: [
    'Nhận biết và giải thích được giá trị lớn nhất, giá trị nhỏ nhất của hàm số trên một tập hợp số.',
    'Áp dụng đạo hàm và quy tắc xét giá trị tại các điểm tới hạn cùng hai đầu mút để xác định được giá trị lớn nhất, giá trị nhỏ nhất của hàm số liên tục trên một đoạn [a; b].',
  ],
  expectedLearningObjectiveDetails: [
    {
      statement:
        'Nhận biết và giải thích được giá trị lớn nhất, giá trị nhỏ nhất của hàm số trên một tập hợp số.',
      targetTitle: 'Giá trị lớn nhất và giá trị nhỏ nhất của hàm số',
      bloomLevel: 'UNDERSTAND',
    },
    {
      statement:
        'Áp dụng đạo hàm và quy tắc xét giá trị tại các điểm tới hạn cùng hai đầu mút để xác định được giá trị lớn nhất, giá trị nhỏ nhất của hàm số liên tục trên một đoạn [a; b].',
      targetTitle: 'Giá trị lớn nhất và giá trị nhỏ nhất của hàm số',
      bloomLevel: 'APPLY',
    },
  ],
  expectedImportantPrerequisites: [
    {
      sourceTitle: 'Hàm số',
      targetTitle: 'Giá trị lớn nhất và giá trị nhỏ nhất của hàm số',
    },
    {
      sourceTitle: 'Đạo hàm',
      targetTitle: 'Giá trị lớn nhất và giá trị nhỏ nhất của hàm số',
    },
    {
      sourceTitle: 'Tính đơn điệu của hàm số',
      targetTitle: 'Giá trị lớn nhất và giá trị nhỏ nhất của hàm số',
    },
  ],
  expectedOntologyHolds: [],
};

function normalizedSet(values: string[]): Set<string> {
  return new Set(values.map(normalizeText));
}

export interface GoldenReviewEvaluation {
  fixtureId: string;
  checks: Array<{ dimension: string; expected: number; matched: number }>;
  matched: number;
  total: number;
  agreement: number;
}

export interface CalibratedGoldenReviewEvaluation {
  fixtureId: string;
  dimensions: {
    conceptOntology: { expected: number; matched: number; agreement: number };
    merge: { expected: number; matched: number; agreement: number };
    learningObjective: { expected: number; matched: number; agreement: number };
    bloom: { expected: number; matched: number; agreement: number };
    prerequisite: { expected: number; matched: number; agreement: number };
    ontologyHold: { expected: number; matched: number; agreement: number };
  };
}

function dimension(expected: number, matched: number) {
  return { expected, matched, agreement: expected ? matched / expected : 1 };
}

export function evaluateGoldenReview(
  fixture: GoldenReviewFixture,
  input: KnowledgeAutoReviewInput,
  result: KnowledgeAutoReviewResult
): GoldenReviewEvaluation {
  const recordTitles = new Map(input.semanticRecords.map((record) => [record.id, record.title]));
  const actualConceptTitles = normalizedSet([
    ...result.candidateReviews
      .filter((review) => review.classification === 'NEW_CONCEPT')
      .map((review) => review.proposedCanonicalTitle ?? ''),
    ...result.mergeProposals.map((proposal) => proposal.proposedCanonicalTitle),
  ]);
  const conceptMatched = fixture.expectedConceptTitles.filter((title) =>
    actualConceptTitles.has(normalizeText(title))
  ).length;

  const actualGroups = new Set(
    result.mergeProposals.map((proposal) =>
      proposal.sourceCandidateIds
        .map((id) => normalizeText(recordTitles.get(id) ?? id))
        .sort()
        .join('|')
    )
  );
  const mergeMatched = fixture.expectedMergeGroupings.filter((group) =>
    actualGroups.has(group.map(normalizeText).sort().join('|'))
  ).length;

  const actualClassifications = new Map(
    result.candidateReviews.map((review) => [
      normalizeText(recordTitles.get(review.sourceRecordId) ?? review.sourceRecordId),
      review.classification,
    ])
  );
  const nonConceptMatched = fixture.expectedNonConceptClassifications.filter(
    (expected) =>
      actualClassifications.get(normalizeText(expected.sourceTitle)) === expected.classification
  ).length;

  const objectives = normalizedSet(
    result.learningObjectives.map((objective) => objective.statement)
  );
  const objectiveMatched = fixture.expectedLearningObjectives.filter((statement) =>
    objectives.has(normalizeText(statement))
  ).length;

  const relations = new Set(
    result.prerequisiteProposals.map(
      (relation) =>
        `${normalizeText(relation.sourceReference.title)}->${normalizeText(relation.targetReference.title)}`
    )
  );
  const prerequisiteMatched = fixture.expectedImportantPrerequisites.filter((expected) =>
    relations.has(`${normalizeText(expected.sourceTitle)}->${normalizeText(expected.targetTitle)}`)
  ).length;

  const ontologyTitles = normalizedSet(
    result.candidateReviews
      .filter((review) =>
        ['ONTOLOGY_AMBIGUOUS', 'REPRESENTATION_OR_TOOL'].includes(review.classification)
      )
      .map((review) => recordTitles.get(review.sourceRecordId) ?? review.sourceRecordId)
  );
  const ontologyMatched = fixture.expectedOntologyHolds.filter((title) =>
    ontologyTitles.has(normalizeText(title))
  ).length;

  const checks = [
    {
      dimension: 'canonicalConceptTitles',
      expected: fixture.expectedConceptTitles.length,
      matched: conceptMatched,
    },
    {
      dimension: 'mergeGroupings',
      expected: fixture.expectedMergeGroupings.length,
      matched: mergeMatched,
    },
    {
      dimension: 'nonConceptClassifications',
      expected: fixture.expectedNonConceptClassifications.length,
      matched: nonConceptMatched,
    },
    {
      dimension: 'learningObjectives',
      expected: fixture.expectedLearningObjectives.length,
      matched: objectiveMatched,
    },
    {
      dimension: 'importantPrerequisites',
      expected: fixture.expectedImportantPrerequisites.length,
      matched: prerequisiteMatched,
    },
    {
      dimension: 'ontologyHolds',
      expected: fixture.expectedOntologyHolds.length,
      matched: ontologyMatched,
    },
  ];
  const total = checks.reduce((sum, check) => sum + check.expected, 0);
  const matched = checks.reduce((sum, check) => sum + check.matched, 0);
  return {
    fixtureId: fixture.id,
    checks,
    matched,
    total,
    agreement: total ? matched / total : 1,
  };
}

export function evaluateCalibratedGoldenReview(
  fixture: GoldenReviewFixture,
  input: KnowledgeAutoReviewInput,
  result: KnowledgeAutoReviewResult
): CalibratedGoldenReviewEvaluation {
  const base = evaluateGoldenReview(fixture, input, result);
  const checks = new Map(base.checks.map((check) => [check.dimension, check]));
  const expectedDetails = fixture.expectedLearningObjectiveDetails ?? [];
  const actualObjectives = new Map(
    result.learningObjectives.map((objective) => [
      normalizeText(objective.statement),
      {
        targetTitle: normalizeText(objective.targetReference.title),
        bloomLevel: objective.bloomLevel,
      },
    ])
  );
  const bloomMatched = expectedDetails.filter((expected) => {
    const actual = actualObjectives.get(normalizeText(expected.statement));
    return (
      actual?.bloomLevel === expected.bloomLevel &&
      actual.targetTitle === normalizeText(expected.targetTitle)
    );
  }).length;
  const conceptTitle = checks.get('canonicalConceptTitles')!;
  const nonConcept = checks.get('nonConceptClassifications')!;
  const merge = checks.get('mergeGroupings')!;
  const learningObjective = checks.get('learningObjectives')!;
  const prerequisite = checks.get('importantPrerequisites')!;
  const ontologyHold = checks.get('ontologyHolds')!;
  return {
    fixtureId: fixture.id,
    dimensions: {
      conceptOntology: dimension(
        conceptTitle.expected + nonConcept.expected,
        conceptTitle.matched + nonConcept.matched
      ),
      merge: dimension(merge.expected, merge.matched),
      learningObjective: dimension(learningObjective.expected, learningObjective.matched),
      bloom: dimension(expectedDetails.length, bloomMatched),
      prerequisite: dimension(prerequisite.expected, prerequisite.matched),
      ontologyHold: dimension(ontologyHold.expected, ontologyHold.matched),
    },
  };
}
