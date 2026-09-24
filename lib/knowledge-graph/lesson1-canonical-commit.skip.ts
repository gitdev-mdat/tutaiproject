import { createHash } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import type { KgImportData } from './kg-import-storage';
import {
  LESSON_1_CANONICAL_COMMIT_SESSION_ID_FIXTURE,
  buildFixtureIdFactory,
  preCommitFixtureFromDisk,
} from './lesson1-canonical-commit.test-fixture';
import {
  buildLesson1CanonicalCommit,
  commitPersistedLesson1CanonicalImport,
  type Lesson1CanonicalCommitInputs,
  type Lesson1CanonicalCommitPaths,
} from './lesson1-canonical-commit';

const temporaryDirectories: string[] = [];
const fixedTime = '2026-07-25T09:00:00.000Z';

function commitFixture(inputs = preCommitFixtureFromDisk()) {
  return buildLesson1CanonicalCommit(inputs, {
    clock: () => fixedTime,
    idFactory: buildFixtureIdFactory(),
  });
}

async function writeFixture(
  inputs: Lesson1CanonicalCommitInputs
): Promise<Lesson1CanonicalCommitPaths> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tutai-lesson1-commit-'));
  temporaryDirectories.push(directory);
  const paths = {
    graph: path.join(directory, 'graph.json'),
    imports: path.join(directory, 'import-data.json'),
    semantic: path.join(directory, 'semantic-proposals.json'),
    mappings: path.join(directory, 'textbook-mappings.json'),
  };
  await Promise.all([
    fs.writeFile(paths.graph, JSON.stringify(inputs.graph, null, 2)),
    fs.writeFile(paths.imports, JSON.stringify(inputs.importData, null, 2)),
    fs.writeFile(paths.semantic, JSON.stringify(inputs.semantic, null, 2)),
    fs.writeFile(paths.mappings, JSON.stringify(inputs.textbookMappings, null, 2)),
  ]);
  const graphRaw = await fs.readFile(paths.graph);
  const imports = JSON.parse(await fs.readFile(paths.imports, 'utf8')) as KgImportData;
  const session = imports.sessions.find(
    (item) => item.id === LESSON_1_CANONICAL_COMMIT_SESSION_ID_FIXTURE
  )!;
  const canonicalReview = session.provenance?.canonicalReview as Record<string, unknown>;
  canonicalReview.graphChecksum = createHash('sha256').update(graphRaw).digest('hex');
  await fs.writeFile(paths.imports, JSON.stringify(imports, null, 2));
  return paths;
}

async function fileHashes(paths: Lesson1CanonicalCommitPaths) {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(paths).map(async ([key, filePath]) => [
        key,
        createHash('sha256')
          .update(await fs.readFile(filePath))
          .digest('hex'),
      ])
    )
  );
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true }))
  );
});

describe('Phase 4.4.4 Lesson 1 canonical commit', () => {
  it('creates exactly two Concepts with canonical IDs and preserves reviewed content', () => {
    const result = commitFixture();
    const created = result.graph.subjects
      .flatMap((subject) => subject.grades)
      .flatMap((grade) => grade.domains)
      .flatMap((domain) => domain.concepts)
      .filter(
        (concept) => concept.provenance?.sourceId === LESSON_1_CANONICAL_COMMIT_SESSION_ID_FIXTURE
      );
    expect(created).toHaveLength(2);
    expect(created.map((concept) => concept.title)).toEqual([
      'Tính đơn điệu của hàm số',
      'Cực trị của hàm số',
    ]);
    expect(created.every((concept) => concept.aliases.length === 0)).toBe(true);
    expect(
      created.every(
        (concept) =>
          ![
            '29dfa0a2-60f8-420f-a320-8f1b4cad47fd',
            'd489d6d1-ac0a-4321-a1e5-1e72ff2d23bf',
          ].includes(concept.id)
      )
    ).toBe(true);
  });

  it('persists candidate and merged-proposal canonical ID resolution', () => {
    const result = commitFixture();
    expect(Object.keys(result.candidateToConceptId)).toHaveLength(2);
    expect(Object.keys(result.mergedProposalToConceptId)).toHaveLength(2);
    const candidates = result.importData.candidates.filter(
      (candidate) => candidate.sessionId === LESSON_1_CANONICAL_COMMIT_SESSION_ID_FIXTURE
    );
    for (const candidate of candidates) {
      expect(candidate.matchedCanonicalId).toBe(result.candidateToConceptId[candidate.id]);
      expect(
        (candidate.sourceData.mergedProposalResolution as Record<string, unknown>)
          .committedConceptId
      ).toBe(candidate.matchedCanonicalId);
    }
    expect(
      result.semantic.mergedConceptProposals
        ?.filter((proposal) => proposal.status === 'CANONICALIZED')
        .every((proposal) => Boolean(proposal.canonicalConceptId))
    ).toBe(true);
  });

  it('creates four unique Learning Objectives with resolved targets and protected replay keys', () => {
    const result = commitFixture();
    const objectives = result.graph.learningObjectives.filter(
      (objective) => objective.provenance?.sourceId === LESSON_1_CANONICAL_COMMIT_SESSION_ID_FIXTURE
    );
    expect(objectives).toHaveLength(4);
    expect(new Set(objectives.map((objective) => objective.statement)).size).toBe(4);
    expect(
      objectives.every((objective) =>
        Object.values(result.candidateToConceptId).includes(objective.conceptId)
      )
    ).toBe(true);
    expect(
      result.semantic.learningObjectives
        .filter((objective) => objective.canonicalLearningObjectiveId)
        .every((objective) => objective.targetReference?.kind === 'CANONICAL_CONCEPT')
    ).toBe(true);

    const duplicate = preCommitFixtureFromDisk();
    const proposal = duplicate.semantic.learningObjectives.find(
      (objective) => objective.id === 'lo-a1fbae5ebb45f1'
    )!;
    duplicate.graph.learningObjectives.push({
      id: 'lo-existing-duplicate',
      conceptId: 'node-test-1',
      bloomLevel: proposal.bloomLevel,
      statement: proposal.statement,
      order: 1,
      status: 'PUBLISHED',
      createdAt: fixedTime,
      updatedAt: fixedTime,
    });
    expect(() => commitFixture(duplicate)).toThrow('Duplicate Learning Objective');
  });

  it('creates exactly three unique prerequisite edges and rejects duplicates or cycles', () => {
    const result = commitFixture();
    const relations = result.graph.conceptRelations.filter(
      (relation) => relation.provenance?.sourceId === LESSON_1_CANONICAL_COMMIT_SESSION_ID_FIXTURE
    );
    expect(relations).toHaveLength(3);
    expect(relations.every((relation) => relation.type === 'PREREQUISITE')).toBe(true);
    expect(
      result.semantic.prerequisites.filter((relation) => relation.canonicalRelationId)
    ).toHaveLength(3);

    const duplicate = preCommitFixtureFromDisk();
    duplicate.graph.conceptRelations.push({
      id: 'rel-existing-duplicate',
      sourceConceptId: 'node-v13e6bhcm',
      targetConceptId: 'node-test-1',
      type: 'PREREQUISITE',
      status: 'PUBLISHED',
      createdAt: fixedTime,
      updatedAt: fixedTime,
    });
    expect(() => commitFixture(duplicate)).toThrow('Duplicate prerequisite edge');

    const cyclic = preCommitFixtureFromDisk();
    cyclic.graph.conceptRelations.push({
      id: 'rel-future-reverse',
      sourceConceptId: 'node-test-2',
      targetConceptId: 'node-test-1',
      type: 'PREREQUISITE',
      status: 'PUBLISHED',
      createdAt: fixedTime,
      updatedAt: fixedTime,
    });
    expect(() => commitFixture(cyclic)).toThrow('Cycle detected');
  });

  it('resolves two PRIMARY and two PREREQUISITE mappings while preserving ontology hold', () => {
    const result = commitFixture();
    const mappings = result.textbookMappings.filter(
      (mapping) => mapping.lessonId === 'mryhipx2-eh6ke0j'
    );
    expect(mappings.filter((mapping) => mapping.role === 'PRIMARY')).toHaveLength(2);
    expect(mappings.filter((mapping) => mapping.role === 'PREREQUISITE')).toHaveLength(2);
    expect(
      result.semantic.mappingIntents?.filter((intent) => intent.status === 'CANONICALIZED')
    ).toHaveLength(4);
    expect(
      result.semantic.conceptCandidates.find((candidate) => candidate.title === 'Bảng biến thiên')
    ).toMatchObject({
      status: 'NEEDS_ONTOLOGY_DECISION',
      ontologyDecisionTerminal: false,
    });
  });

  it('marks the session COMPLETED only in the fully validated result', () => {
    const before = preCommitFixtureFromDisk();
    expect(
      before.importData.sessions.find(
        (session) => session.id === LESSON_1_CANONICAL_COMMIT_SESSION_ID_FIXTURE
      )?.status
    ).toBe('READY_TO_COMMIT');
    const result = commitFixture(before);
    expect(
      result.importData.sessions.find(
        (session) => session.id === LESSON_1_CANONICAL_COMMIT_SESSION_ID_FIXTURE
      )
    ).toMatchObject({
      status: 'COMPLETED',
      committedAt: fixedTime,
    });
    expect(
      result.importData.audits.filter(
        (audit) => audit.sessionId === LESSON_1_CANONICAL_COMMIT_SESSION_ID_FIXTURE
      )
    ).toHaveLength(9);
  });

  it('rolls back all coordinated files on a simulated downstream failure', async () => {
    const paths = await writeFixture(preCommitFixtureFromDisk());
    const before = await fileHashes(paths);
    await expect(
      commitPersistedLesson1CanonicalImport(LESSON_1_CANONICAL_COMMIT_SESSION_ID_FIXTURE, {
        paths,
        clock: () => fixedTime,
        idFactory: buildFixtureIdFactory(),
        simulateFailureAt: 'AFTER_SEMANTIC_WRITE',
      })
    ).rejects.toThrow('SIMULATED_DOWNSTREAM_FAILURE');
    expect(await fileHashes(paths)).toEqual(before);
    const imports = JSON.parse(await fs.readFile(paths.imports, 'utf8')) as KgImportData;
    expect(
      imports.sessions.find(
        (session) => session.id === LESSON_1_CANONICAL_COMMIT_SESSION_ID_FIXTURE
      )?.status
    ).toBe('READY_TO_COMMIT');
  });

  it('returns the completed result on recommit without changing files or audits', async () => {
    const paths = await writeFixture(preCommitFixtureFromDisk());
    const first = await commitPersistedLesson1CanonicalImport(
      LESSON_1_CANONICAL_COMMIT_SESSION_ID_FIXTURE,
      {
        paths,
        clock: () => fixedTime,
        idFactory: buildFixtureIdFactory(),
      }
    );
    const hashesAfterFirst = await fileHashes(paths);
    const auditsAfterFirst = first.importData.audits.length;
    const second = await commitPersistedLesson1CanonicalImport(
      LESSON_1_CANONICAL_COMMIT_SESSION_ID_FIXTURE,
      { paths }
    );
    expect(second.alreadyCompleted).toBe(true);
    expect(await fileHashes(paths)).toEqual(hashesAfterFirst);
    expect(second.importData.audits).toHaveLength(auditsAfterFirst);
  });

  it('creates reverse textbook references with page evidence and no child aliases', () => {
    const result = commitFixture();
    const newConceptIds = Object.values(result.candidateToConceptId);
    const reverseMappings = result.textbookMappings.filter((mapping) =>
      newConceptIds.includes(mapping.conceptId)
    );
    expect(reverseMappings).toHaveLength(2);
    expect(
      reverseMappings.every(
        (mapping) =>
          mapping.textbookId === 'mryei32t-0fybu39' &&
          mapping.lessonTitle === 'Bài 1. Tính đơn điệu và cực trị của hàm số' &&
          mapping.sourcePageStart === 10
      )
    ).toBe(true);
    const concepts = result.graph.subjects
      .flatMap((subject) => subject.grades)
      .flatMap((grade) => grade.domains)
      .flatMap((domain) => domain.concepts)
      .filter((concept) => newConceptIds.includes(concept.id));
    expect(concepts.every((concept) => concept.aliases.length === 0)).toBe(true);
    expect(
      concepts.every((concept) => concept.provenance?.sourcePageEvidence?.length)
    ).toBeTruthy();
  });
});
