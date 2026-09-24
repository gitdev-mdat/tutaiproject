import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Ajv2020 = require('../node_modules/.pnpm/ajv@8.20.0/node_modules/ajv/dist/2020.js').default;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const clone = (value) => structuredClone(value);
const sha = (character) => character.repeat(64);

const benchmarkSchema = readJson('docs/cgcf-v1-benchmark-item.schema.json');
const manifestSchema = readJson('docs/cgcf-v1-calibration-manifest.schema.json');
const framework = readJson('docs/concept-granularity-framework-v1.json');
const design = readJson('docs/cgcf-v1-offline-calibration-design.json');
const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
const validateItem = ajv.compile(benchmarkSchema);
const validateManifest = ajv.compile(manifestSchema);

const metricSymbols = [
  'TI',
  'AI',
  'RI',
  'PD',
  'TD',
  'MD',
  'GD',
  'MC',
  'SI',
  'RV',
  'RU',
  'ES',
  'CV',
  'SU',
  'KC',
  'AS',
  'partitionUtility',
  'duplicateRisk',
];
const expertMetric = {
  evidenceMode: 'EXPERT_RUBRIC',
  value: 0.5,
  evidenceSegmentIds: ['seg-alpha'],
  rubricAnchor: 'MID',
  rationale: 'Generic structural rubric evidence supports the midpoint anchor.',
  uncertainty: 0.2,
};
const metricVector = Object.fromEntries(
  metricSymbols.map((symbol) => [symbol, clone(expertMetric)])
);
const confidence = {
  semanticConfidence: 0.9,
  evidenceConfidence: 0.8,
  decisionConfidence: 0.85,
  calibrationConfidence: 0.7,
  reportableConfidence: 0.7,
  aggregationRule: 'MINIMUM',
};
const impactAxis = { severity: 0.2, rationale: 'Low downstream impact in this generic example.' };

const validItem = {
  benchmarkItemId: 'bmi-generic-0001',
  benchmarkVersion: 'CGCF_BENCHMARK_1.0.0',
  frameworkVersion: 'CGCF_V1',
  subjectStratum: 'PHYSICS',
  knowledgeMode: 'DECLARATIVE',
  structuralArchetype: 'CLAIM_PLUS_EXPLANATION',
  difficultyStratum: 'MODERATE',
  ambiguityStratum: 'CLEAR',
  graphImpactStratum: 'LOW',
  sourceProvenance: {
    sourceId: 'generic-source-1',
    sourceType: 'EXPERT_AUTHORED',
    sourceTitle: 'Redacted structural calibration source',
    publisherOrOwner: 'Internal research',
    retrievedAt: '2026-08-01T00:00:00.000Z',
    language: 'en',
    containerFamilyId: 'srcfam-generic-1',
  },
  sourceLicenseClassification: 'INTERNAL_ONLY',
  sourceEvidenceSpans: [
    {
      spanId: 'span-alpha',
      sourceLocator: 'generic-source-1:0-42',
      startOffset: 0,
      endOffset: 42,
      exactText: 'A generic claim followed by its explanation.',
      sha256: sha('A'),
    },
  ],
  sourceRecordHash: sha('B'),
  normalizedEvidenceHash: sha('C'),
  evidenceContainer: {
    containerType: 'PASSAGE',
    content: 'A generic claim followed by its explanation.',
    contentSha256: sha('D'),
    presentationOrderIsIdentityFeature: false,
  },
  evidenceSegments: [
    {
      segmentId: 'seg-alpha',
      exactSourceSpanIds: ['span-alpha'],
      normalizedStatement: 'A generic claim and immediate explanation share one core.',
      segmentType: 'CLAIM',
      representationType: 'PROSE',
      claimOrOperationSummary: 'States and explains one invariant claim.',
      uncertainty: 0.1,
      sourceOrder: 0,
      provenance: ['span-alpha'],
    },
  ],
  representationNormalizedSegments: [
    {
      sourceSegmentId: 'seg-alpha',
      normalizedContent: 'A generic claim and immediate explanation share one core.',
      normalizations: ['WORDING'],
      meaningPreserved: true,
    },
  ],
  candidatePartitions: [
    {
      partitionId: 'part-whole',
      childGroups: [{ temporaryChildId: 'child-whole', segmentIds: ['seg-alpha'] }],
      unassignedEvidence: { segmentIds: [], handling: 'NONE' },
      relationOnlyEvidence: { segmentIds: [], relationTypes: [] },
      proposedIdentityCores: [
        {
          temporaryChildId: 'child-whole',
          nameableCore: 'Generic invariant claim',
          semanticCore: 'One claim and its immediate explanation.',
          competencyEnvelope: 'Explain and recognize the generic claim.',
          reasoningOperators: ['INTERPRET'],
          evidenceSegmentIds: ['seg-alpha'],
          canonicalStatus: 'NONCANONICAL_BENCHMARK_ONLY',
        },
      ],
      childViabilityEvidence: ['The whole cluster has one coherent competency.'],
      keepVersusSplitRationale: 'Splitting the explanation has no independent value.',
      duplicateRiskAnalysis: 'No second identity is proposed.',
      graphValueAnalysis: 'One identity avoids redundant graph structure.',
      evidenceSufficiency: 0.9,
      fragmentationCost: 0.8,
      partitionUtility: 0.1,
      reviewerStatus: 'ACCEPTABLE',
      equivalenceSignature: sha('E'),
    },
  ],
  reviewerVisibleContext: {
    allowedFields: ['sourceProvenance', 'sourceEvidenceSpans', 'evidenceContainer'],
    graphExposure: 'BLINDED',
    otherReviewerDecisionsVisible: false,
    providerOutputVisible: false,
    expectedConceptListVisible: false,
  },
  reviewerHiddenMetadata: {
    assignmentSeedHash: sha('F'),
    sourceContainerLabelsRedacted: true,
    canonicalGraphMatchesRedacted: true,
    providerOutputsExcluded: true,
    notes: [],
  },
  leakageGroupId: 'leak-generic-1',
  duplicateFamilyId: null,
  datasetAssignment: 'CALIBRATION_TRAIN',
  assignmentFreezeTimestamp: '2026-08-01T00:00:00.000Z',
  finalReviewState: 'GOLD_ELIGIBLE',
  granularityDecision: {
    decision: 'KEEP_COHERENT_CLUSTER',
    rationale: 'The explanation preserves the same invariant core and mastery state.',
    evidenceSegmentIds: ['seg-alpha'],
    sharedInvariantCore: 'One generic claim.',
    nonSplitConditions: ['CLAIM_PLUS_IMMEDIATE_EXPLANATION'],
    fragmentationRisk: 'A split would create a dependent explanatory fragment.',
  },
  acceptedPartitionIds: ['part-whole'],
  rejectedPartitions: [],
  reviewerRationales: [1, 2].map((ordinal) => ({
    reviewerAssignmentId: `review-primary-${ordinal}`,
    role: 'PRIMARY',
    submittedAt: `2026-08-01T00:0${ordinal}:00.000Z`,
    decision: 'KEEP_COHERENT_CLUSTER',
    evidenceMapping: ['seg-alpha'],
    rationale: 'The claim and immediate explanation share one competency.',
    durationSeconds: 120,
    independentSubmission: true,
  })),
  adjudicationResult: { state: 'NOT_REQUIRED', reason: 'Primary reviewers agree materially.' },
  failureLabels: { primaryOutcome: 'NONE', causeCodes: [], impactCodes: [] },
  cgcfMetricVector: metricVector,
  missingMetrics: [],
  confidenceDecomposition: confidence,
  downstreamImpactAssessment: {
    canonicalIdentity: impactAxis,
    prerequisiteTopology: impactAxis,
    masteryAccuracy: impactAxis,
    retrievalAndTutoringQuality: impactAxis,
    roadmapQuality: impactAxis,
    remediationCost: impactAxis,
    graphMaintenanceBurden: impactAxis,
    graphBlastRadius: 0,
  },
  qualityControlState: {
    state: 'PASSED',
    schemaValidated: true,
    hashesVerified: true,
    leakageChecked: true,
    independenceChecked: true,
    canonicalWriteProhibited: true,
    issues: [],
  },
};

const archetypes = design.benchmarkDesign.structuralArchetypes;
const coverageCell = { sampledCount: 1, goldEligibleCount: 1, naturalPrevalenceWeight: 0.01 };
const metricReport = {
  unweighted: 0.8,
  impactWeighted: 0.75,
  bySubject: { PHYSICS: 0.8 },
  byArchetype: { CLAIM_PLUS_EXPLANATION: 0.8 },
  sampleSize: 1,
};
const evaluationMetricNames = [
  'topLevelAccuracy',
  'splitProposalPrecision',
  'splitProposalRecall',
  'underSplitRate',
  'overSplitRate',
  'ambiguityHoldPrecision',
  'ambiguityHoldRecall',
  'childViabilityPrecision',
  'childViabilityRecall',
  'partitionAgreement',
  'acceptableAlternativePartitionAccuracy',
  'duplicateIdentityEscapeRate',
  'severeCanonicalCollisionEscapeRate',
  'splitExpectedCalibrationError',
  'keepExpectedCalibrationError',
  'brierScore',
  'prerequisitePrecisionDelta',
  'graphNodeGrowthCost',
  'masteryDiagnosticGain',
  'reviewTimeReduction',
  'reviewerDisagreement',
  'subjectTransferPerformance',
  'structuralArchetypePerformance',
  'highImpactErrorRate',
];
const hashEntry = (id, character) => ({
  pathOrLogicalId: id,
  sha256: sha(character),
  verifiedAt: '2026-08-01T00:00:00.000Z',
});
const validManifest = {
  benchmarkVersion: 'CGCF_BENCHMARK_1.0.0',
  frameworkVersion: 'CGCF_V1',
  manifestFreezeTimestamp: '2026-08-01T00:00:00.000Z',
  assignmentHash: sha('1'),
  itemInventory: [
    {
      itemId: validItem.benchmarkItemId,
      itemSha256: sha('2'),
      subject: validItem.subjectStratum,
      archetype: validItem.structuralArchetype,
      leakageGroupId: validItem.leakageGroupId,
      duplicateFamilyId: null,
      datasetAssignment: validItem.datasetAssignment,
      reviewState: validItem.finalReviewState,
      goldEligibility: true,
    },
  ],
  datasetAssignments: {
    CALIBRATION_TRAIN: {
      itemIds: [validItem.benchmarkItemId],
      itemCount: 1,
      frozen: true,
      assignmentHash: sha('3'),
    },
    DEVELOPMENT: { itemIds: [], itemCount: 0, frozen: true, assignmentHash: sha('4') },
    HELD_OUT_EVALUATION: { itemIds: [], itemCount: 0, frozen: true, assignmentHash: sha('5') },
    SUBJECT_TRANSFER_HOLDOUT: { itemIds: [], itemCount: 0, frozen: true, assignmentHash: sha('6') },
  },
  leakageGroups: [
    {
      leakageGroupId: validItem.leakageGroupId,
      itemIds: [validItem.benchmarkItemId],
      assignment: validItem.datasetAssignment,
      groupingBases: ['SOURCE_CONTAINER'],
      groupHash: sha('7'),
    },
  ],
  coverage: {
    subjects: ['MATHEMATICS', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY'].map((subject) => ({
      subject,
      coverage: coverageCell,
    })),
    archetypes: archetypes.map((archetype) => ({ archetype, coverage: coverageCell })),
    ambiguityStrata: {
      CLEAR: coverageCell,
      BORDERLINE: coverageCell,
      GENUINE_AMBIGUITY: coverageCell,
      LOW_EVIDENCE: coverageCell,
    },
    graphImpactStrata: {
      LOW: coverageCell,
      MEDIUM: coverageCell,
      HIGH: coverageCell,
      CRITICAL: coverageCell,
    },
    balancedReportingRequired: true,
    naturalPrevalenceWeightedViewRequired: true,
  },
  reviewerAssignments: [1, 2].map((ordinal) => ({
    assignmentId: `review-primary-${ordinal}`,
    itemId: validItem.benchmarkItemId,
    reviewerPseudonym: `reviewer-${ordinal}`,
    role: 'PRIMARY',
    independenceConfirmed: true,
    subjectQualification: 'Qualified subject reviewer.',
    assignedAt: '2026-08-01T00:00:00.000Z',
    status: 'SUBMITTED',
  })),
  adjudicationState: {
    materialDisagreementItemIds: [],
    completedItemIds: [],
    outcomeCounts: {
      GOLD_ACCEPTED: 0,
      GOLD_ACCEPTED_WITH_ALTERNATIVE_PARTITIONS: 0,
      REQUIRES_SOURCE_EXPANSION: 0,
      REQUIRES_SPECIALIST_REVIEW: 0,
      EXCLUDED_LOW_EVIDENCE: 0,
      EXCLUDED_UNRESOLVED_IDENTITY: 0,
    },
    unresolvedItemsExcludedFromGold: true,
  },
  agreementStatistics: {
    topLevelKrippendorffAlpha: { value: 0.8, sampleSize: 2, method: 'Krippendorff nominal alpha' },
    perStratum: [
      { stratumType: 'SUBJECT', stratumId: 'PHYSICS', alpha: 0.8, sampleSize: 2, critical: true },
    ],
    partitionAgreement: { value: 1, sampleSize: 2, method: 'Acceptable-equivalence agreement' },
    metricAgreement: { value: 0.8, sampleSize: 2, method: 'Weighted agreement' },
    childBoundaryPrecision: { value: 1, sampleSize: 2, method: 'Segment boundary precision' },
    childBoundaryRecall: { value: 1, sampleSize: 2, method: 'Segment boundary recall' },
    adjudicationRate: {
      value: 0,
      sampleSize: 2,
      method: 'Material disagreements divided by reviewed items',
    },
    reviewDurationSeconds: { median: 120, p90: 130, mean: 120 },
  },
  evaluationMetrics: Object.fromEntries(evaluationMetricNames.map((name) => [name, metricReport])),
  readinessDecision: {
    state: 'NOT_EVALUATED',
    gateResults: Array.from({ length: 17 }, (_, index) => ({
      gateId: index + 1,
      status: 'NOT_EVALUATED',
      evidence: 'Example manifest contains no readiness claim.',
    })),
    decisionTimestamp: '2026-08-01T00:00:00.000Z',
    v36Authorized: false,
  },
  hashes: {
    frameworkMarkdown: hashEntry('framework-markdown', '8'),
    frameworkJson: hashEntry('framework-json', '9'),
    benchmarkItemSchema: hashEntry('benchmark-schema', 'A'),
    manifestSchema: hashEntry('manifest-schema', 'B'),
    items: [hashEntry(validItem.benchmarkItemId, 'C')],
    assignmentHash: sha('1'),
    manifestContentHash: sha('0'),
  },
};

const validateItemCrossFields = (item) => {
  const partitionById = new Map(
    item.candidatePartitions.map((partition) => [partition.partitionId, partition])
  );
  for (const partition of item.candidatePartitions) {
    const memberships = partition.childGroups.flatMap((group) => group.segmentIds);
    assert.equal(
      new Set(memberships).size,
      memberships.length,
      'segment belongs to multiple children'
    );
  }
  if (item.granularityDecision.decision === 'PROPOSE_CONSTITUENT_SPLIT') {
    for (const partitionId of item.granularityDecision.acceptedPartitionIds) {
      assert.ok(partitionById.has(partitionId), `missing accepted partition ${partitionId}`);
      assert.ok(
        partitionById.get(partitionId).childGroups.length >= 2,
        'split partition has fewer than two children'
      );
    }
  }
  const unavailable = metricSymbols.filter(
    (symbol) => item.cgcfMetricVector[symbol].evidenceMode === 'UNAVAILABLE'
  );
  assert.deepEqual([...item.missingMetrics].sort(), unavailable.sort(), 'missingMetrics mismatch');
  const dimensions = item.confidenceDecomposition;
  assert.equal(
    dimensions.reportableConfidence,
    Math.min(
      dimensions.semanticConfidence,
      dimensions.evidenceConfidence,
      dimensions.decisionConfidence,
      dimensions.calibrationConfidence
    ),
    'reportable confidence is not the minimum'
  );
};

const validateManifestCrossFields = (manifest) => {
  const inventoryById = new Map(manifest.itemInventory.map((item) => [item.itemId, item]));
  const bucketByItem = new Map();
  for (const [assignment, bucket] of Object.entries(manifest.datasetAssignments)) {
    assert.equal(bucket.itemCount, bucket.itemIds.length, `${assignment} itemCount mismatch`);
    for (const itemId of bucket.itemIds) {
      assert.ok(!bucketByItem.has(itemId), `${itemId} occurs in more than one assignment`);
      bucketByItem.set(itemId, assignment);
    }
  }
  for (const item of manifest.itemInventory) {
    assert.equal(
      bucketByItem.get(item.itemId),
      item.datasetAssignment,
      `${item.itemId} assignment mismatch`
    );
    const primaries = manifest.reviewerAssignments.filter(
      (review) => review.itemId === item.itemId && review.role === 'PRIMARY'
    );
    assert.ok(new Set(primaries.map((review) => review.reviewerPseudonym)).size >= 2);
  }
  for (const group of manifest.leakageGroups) {
    const assignments = new Set(
      group.itemIds.map((itemId) => inventoryById.get(itemId)?.datasetAssignment)
    );
    assert.equal(assignments.size, 1, `${group.leakageGroupId} crosses assignments`);
    assert.equal(
      [...assignments][0],
      group.assignment,
      `${group.leakageGroupId} assignment mismatch`
    );
  }
  assert.deepEqual(
    manifest.readinessDecision.gateResults.map((gate) => gate.gateId).sort((a, b) => a - b),
    Array.from({ length: 17 }, (_, index) => index + 1)
  );
};

const validSplitItem = clone(validItem);
validSplitItem.benchmarkItemId = 'bmi-generic-0002';
validSplitItem.evidenceSegments.push({
  ...clone(validItem.evidenceSegments[0]),
  segmentId: 'seg-beta',
  normalizedStatement: 'A second generic invariant core.',
  claimOrOperationSummary: 'States a second generic claim.',
  sourceOrder: 1,
});
validSplitItem.candidatePartitions[0].childGroups.push({
  temporaryChildId: 'child-beta',
  segmentIds: ['seg-beta'],
});
validSplitItem.candidatePartitions[0].proposedIdentityCores.push({
  temporaryChildId: 'child-beta',
  nameableCore: 'Second generic invariant claim',
  semanticCore: 'A second claim with independent behavior.',
  competencyEnvelope: 'Explain and recognize the second generic claim.',
  reasoningOperators: ['CLASSIFY'],
  evidenceSegmentIds: ['seg-beta'],
  canonicalStatus: 'NONCANONICAL_BENCHMARK_ONLY',
});
validSplitItem.granularityDecision = {
  decision: 'PROPOSE_CONSTITUENT_SPLIT',
  rationale: 'Two generic cores have independently useful mastery behavior.',
  evidenceSegmentIds: ['seg-alpha', 'seg-beta'],
  acceptedPartitionIds: ['part-whole'],
  acceptedChildCandidateIds: ['child-whole', 'child-beta'],
  splitGateAssessments: {
    distinctCore: 'PASS',
    childViability: 'PASS',
    independentMastery: 'PASS',
    separationValue: 'PASS',
    coherenceLoss: 'PASS',
    duplicateSafety: 'PASS',
    evidence: 'PASS',
  },
};
validSplitItem.reviewerRationales = validSplitItem.reviewerRationales.map((review) => ({
  ...review,
  decision: 'PROPOSE_CONSTITUENT_SPLIT',
  evidenceMapping: ['seg-alpha', 'seg-beta'],
}));

const validAmbiguousItem = clone(validItem);
validAmbiguousItem.benchmarkItemId = 'bmi-generic-0003';
validAmbiguousItem.granularityDecision = {
  decision: 'GRANULARITY_AMBIGUOUS',
  rationale: 'The generic source lacks independent assessment evidence.',
  evidenceSegmentIds: ['seg-alpha'],
  uncertaintyReasons: ['MISSING_EVIDENCE'],
  missingEvidence: ['Independent assessment evidence.'],
  conflictingMetrics: [],
  unresolvedDuplicateRisk: false,
  competingValidPartitionIds: [],
  reviewerUncertainty: 0.5,
  graphDependentUncertainty: false,
};
validAmbiguousItem.acceptedPartitionIds = [];
validAmbiguousItem.reviewerRationales = validAmbiguousItem.reviewerRationales.map((review) => ({
  ...review,
  decision: 'GRANULARITY_AMBIGUOUS',
}));

const validUnavailableItem = clone(validItem);
validUnavailableItem.cgcfMetricVector.SI = {
  evidenceMode: 'UNAVAILABLE',
  unavailableReason: 'No retention data are available.',
  evidenceSegmentIds: [],
  uncertainty: 1,
};
validUnavailableItem.missingMetrics = ['SI'];

for (const item of [validItem, validSplitItem, validAmbiguousItem, validUnavailableItem]) {
  assert.equal(validateItem(item), true, JSON.stringify(validateItem.errors));
  validateItemCrossFields(item);
}
assert.equal(validateManifest(validManifest), true, JSON.stringify(validateManifest.errors));
validateManifestCrossFields(validManifest);

const expectItemRejected = (mutator, label) => {
  const invalid = clone(validItem);
  mutator(invalid);
  assert.equal(validateItem(invalid), false, `${label} was unexpectedly accepted`);
};

expectItemRejected((item) => {
  item.granularityDecision.acceptedChildCandidateIds = ['child-a', 'child-b'];
}, 'keep with split-only field');
expectItemRejected((item) => {
  item.granularityDecision = {
    decision: 'PROPOSE_CONSTITUENT_SPLIT',
    rationale: 'Two generic children are proposed.',
    evidenceSegmentIds: ['seg-alpha'],
    acceptedChildCandidateIds: ['child-a', 'child-b'],
    splitGateAssessments: {
      distinctCore: 'PASS',
      childViability: 'PASS',
      independentMastery: 'PASS',
      separationValue: 'PASS',
      coherenceLoss: 'PASS',
      duplicateSafety: 'PASS',
      evidence: 'PASS',
    },
  };
}, 'split without accepted partitions');
expectItemRejected((item) => {
  item.granularityDecision = {
    decision: 'GRANULARITY_AMBIGUOUS',
    rationale: 'Evidence is insufficient.',
    evidenceSegmentIds: ['seg-alpha'],
    uncertaintyReasons: [],
    missingEvidence: ['Independent assessment evidence.'],
    conflictingMetrics: [],
    unresolvedDuplicateRisk: false,
    competingValidPartitionIds: [],
    reviewerUncertainty: 0.5,
    graphDependentUncertainty: false,
  };
}, 'ambiguity without uncertainty reason');
expectItemRejected((item) => {
  item.canonicalWriteInstruction = 'CREATE_NODE';
}, 'canonical write instruction');
expectItemRejected((item) => {
  item.cgcfMetricVector.TI.value = 1.01;
}, 'metric above one');
expectItemRejected((item) => {
  item.cgcfMetricVector.TI.evidenceMode = 'INVALID_MODE';
}, 'invalid evidence mode');
expectItemRejected((item) => {
  item.cgcfMetricVector.TI.evidenceMode = 'MODEL_ESTIMATE';
}, 'model estimate in gold metric vector');
expectItemRejected((item) => {
  item.cgcfMetricVector.SI = {
    evidenceMode: 'UNAVAILABLE',
    unavailableReason: 'No retention data.',
    evidenceSegmentIds: [],
    uncertainty: 1,
    value: 0,
  };
}, 'unavailable metric serialized as zero');
expectItemRejected((item) => {
  delete item.confidenceDecomposition.calibrationConfidence;
}, 'incomplete confidence decomposition');

const wrongMinimum = clone(validItem);
wrongMinimum.confidenceDecomposition.reportableConfidence = 0.8;
assert.equal(validateItem(wrongMinimum), true);
assert.notEqual(
  wrongMinimum.confidenceDecomposition.reportableConfidence,
  Math.min(
    wrongMinimum.confidenceDecomposition.semanticConfidence,
    wrongMinimum.confidenceDecomposition.evidenceConfidence,
    wrongMinimum.confidenceDecomposition.decisionConfidence,
    wrongMinimum.confidenceDecomposition.calibrationConfidence
  ),
  'negative confidence-minimum fixture is not malformed'
);
assert.equal(
  validItem.confidenceDecomposition.reportableConfidence,
  Math.min(
    validItem.confidenceDecomposition.semanticConfidence,
    validItem.confidenceDecomposition.evidenceConfidence,
    validItem.confidenceDecomposition.decisionConfidence,
    validItem.confidenceDecomposition.calibrationConfidence
  )
);

const missingMismatch = clone(validUnavailableItem);
missingMismatch.missingMetrics = [];
assert.throws(() => validateItemCrossFields(missingMismatch), /missingMetrics mismatch/);

const leakingManifest = clone(validManifest);
leakingManifest.leakageGroups[0].assignment = 'DEVELOPMENT';
assert.throws(() => validateManifestCrossFields(leakingManifest), /assignment mismatch/);

assert.deepEqual(design.metricDefinitions.range, framework.metrics.range);
const expectedES = {
  coverage: 0.3,
  specificity: 0.3,
  consistency: 0.25,
  provenanceQuality: 0.15,
};
const expectedCV = {
  coreClarity: 0.25,
  ES: 0.2,
  TI: 0.15,
  AI: 0.15,
  RU: 0.15,
  masteryUtility: 0.1,
};
const expectedSU = {
  AI: 0.22,
  MC: 0.17,
  RI: 0.15,
  PD: 0.12,
  TD: 0.1,
  MD: 0.08,
  RV: 0.08,
  TI: 0.05,
  GD: 0.03,
};
const expectedKC = {
  IC: 0.3,
  oneMinusRI: 0.2,
  oneMinusAI: 0.15,
  oneMinusPD: 0.1,
  oneMinusMC: 0.1,
  TO: 0.1,
  ED: 0.05,
};
assert.equal(
  framework.metrics.evidenceSufficiency.formula,
  'ES = 0.30*coverage + 0.30*specificity + 0.25*consistency + 0.15*provenanceQuality'
);
assert.equal(
  framework.metrics.childViability.formula,
  'CV = 0.25*coreClarity + 0.20*ES + 0.15*TI + 0.15*AI + 0.15*RU + 0.10*masteryUtility'
);
assert.equal(
  framework.metrics.splitUtility.formula,
  'SU = 0.22*AI + 0.17*MC + 0.15*RI + 0.12*PD + 0.10*TD + 0.08*MD + 0.08*RV + 0.05*TI + 0.03*GD'
);
assert.equal(
  framework.metrics.keepCoupling.formula,
  'KC = 0.30*IC + 0.20*(1-RI) + 0.15*(1-AI) + 0.10*(1-PD) + 0.10*(1-MC) + 0.10*TO + 0.05*ED'
);
assert.deepEqual(design.metricDefinitions.weights.ES, expectedES);
assert.deepEqual(design.metricDefinitions.weights.CV, expectedCV);
assert.deepEqual(design.metricDefinitions.weights.SU, expectedSU);
assert.deepEqual(design.metricDefinitions.weights.KC, expectedKC);
assert.equal(
  design.metricDefinitions.decisionThresholds.childCoreClarityMinimum,
  framework.metrics.childViability.hardFloors.coreClarity
);
assert.equal(
  design.metricDefinitions.decisionThresholds.childESMinimum,
  framework.metrics.childViability.hardFloors.evidenceSufficiency
);
assert.equal(
  design.metricDefinitions.decisionThresholds.autoKeepCandidate.ASMinimum,
  framework.provisionalDecisionBands.autoKeepCandidate.minimumAtomicityScore
);
assert.equal(
  design.metricDefinitions.decisionThresholds.autoKeepCandidate.KCMinimum,
  framework.provisionalDecisionBands.autoKeepCandidate.minimumKeepCoupling
);
assert.equal(
  design.metricDefinitions.decisionThresholds.autoKeepCandidate.ESMinimum,
  framework.provisionalDecisionBands.autoKeepCandidate.minimumEvidenceSufficiency
);
assert.equal(
  design.metricDefinitions.decisionThresholds.splitProposalCandidate.partitionUtilityMinimum,
  framework.provisionalDecisionBands.splitProposalCandidate.minimumPartitionUtility
);
assert.equal(
  design.metricDefinitions.decisionThresholds.splitProposalCandidate.everyChildCVMinimum,
  framework.provisionalDecisionBands.splitProposalCandidate.minimumEveryChildViability
);
assert.equal(
  design.metricDefinitions.decisionThresholds.splitProposalCandidate.ESMinimum,
  framework.provisionalDecisionBands.splitProposalCandidate.minimumEvidenceSufficiency
);
assert.equal(
  design.metricDefinitions.decisionThresholds.splitProposalCandidate.AIOrMCOrRVMinimum,
  framework.provisionalDecisionBands.splitProposalCandidate.minimumOneOperationalMetric.threshold
);

for (const relativePath of [
  'docs/CGCF_V1_REVIEWER_GUIDE.md',
  'docs/cgcf-v1-benchmark-item.schema.json',
  'docs/cgcf-v1-calibration-manifest.schema.json',
  'docs/cgcf-v1-offline-calibration-design.json',
]) {
  const normativeText = fs.readFileSync(path.join(root, relativePath), 'utf8');
  for (const forbidden of ['Bài 8', 'mryhipx3-f15uuqg', '58fb0235-0f34-481c-98dd-a123f3ad6a03']) {
    assert.equal(
      normativeText.includes(forbidden),
      false,
      `${relativePath} contains lesson-specific term ${forbidden}`
    );
  }
}

const normativeDesign = fs
  .readFileSync(path.join(root, 'docs/CGCF_V1_OFFLINE_CALIBRATION_DESIGN.md'), 'utf8')
  .split('## Appendix A.')[0];
for (const forbidden of ['BÃ i 8', 'mryhipx3-f15uuqg', '58fb0235-0f34-481c-98dd-a123f3ad6a03']) {
  assert.equal(
    normativeDesign.includes(forbidden),
    false,
    `normative design contains lesson-specific term ${forbidden}`
  );
}

const jsonArtifacts = [
  'docs/concept-granularity-framework-v1.json',
  'docs/cgcf-v1-benchmark-item.schema.json',
  'docs/cgcf-v1-calibration-manifest.schema.json',
  'docs/cgcf-v1-offline-calibration-design.json',
];
for (const relativePath of jsonArtifacts) readJson(relativePath);

const summary = {
  status: 'PASS',
  jsonArtifactsParsed: jsonArtifacts.length,
  validBenchmarkExamples: 4,
  validManifestExamples: 1,
  negativeSchemaCasesRejected: 9,
  crossFieldNegativeCasesRejected: 2,
  confidenceMinimumChecks: 5,
  leakageConsistencyChecks: 2,
  cgcfWeightAndThresholdChecks: 18,
  normativeLessonLeakageFilesScanned: 5,
  benchmarkSchemaSha256: crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(root, 'docs/cgcf-v1-benchmark-item.schema.json')))
    .digest('hex')
    .toUpperCase(),
  manifestSchemaSha256: crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(root, 'docs/cgcf-v1-calibration-manifest.schema.json')))
    .digest('hex')
    .toUpperCase(),
};
console.log(JSON.stringify(summary, null, 2));
