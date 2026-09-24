import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import {
  normalizeText,
  parseImportFile,
  runMatchingEngine,
  commitImportSession,
  detectCycleWithColors,
  setTestImportPaths,
} from './kg-import-service';
import { readImportData, writeImportData } from './kg-import-storage';
import { readKnowledgeGraph, writeKnowledgeGraph, setTestStoragePath } from './kg-storage';
import { KnowledgeImportFile } from './kg-import-types';
import fs from 'fs/promises';
import path from 'path';

describe('Knowledge Import Service & Registry Tests', () => {
  let graphBackup: string | null = null;
  let importBackup: string | null = null;
  let tempTestDir: string;
  let testGraphPath: string;
  let testGraphBakPath: string;

  const IMPORT_PATH = path.join(process.cwd(), 'data', 'import-data.json');

  beforeAll(async () => {
    // Backup production files
    const GRAPH_PATH = path.join(process.cwd(), 'data', 'knowledge-graph', 'graph.json');
    try {
      graphBackup = await fs.readFile(GRAPH_PATH, 'utf-8');
    } catch {}
    try {
      importBackup = await fs.readFile(IMPORT_PATH, 'utf-8');
    } catch {}

    // Create isolated test fixture directory
    tempTestDir = path.join(process.cwd(), 'data', 'test-fixtures', `kg-test-${Date.now()}`);
    await fs.mkdir(tempTestDir, { recursive: true });
    testGraphPath = path.join(tempTestDir, 'graph.json');
    testGraphBakPath = path.join(tempTestDir, 'graph.json.bak');

    // Configure services to use test directory
    setTestStoragePath(tempTestDir);
    setTestImportPaths(testGraphPath, testGraphBakPath);
  });

  afterAll(async () => {
    // Restore production configuration
    setTestStoragePath(null);
    setTestImportPaths(null, null);

    // Clean up test fixture directory
    try {
      await fs.rm(tempTestDir, { recursive: true, force: true });
    } catch {}

    // Restore production files
    const GRAPH_PATH = path.join(process.cwd(), 'data', 'knowledge-graph', 'graph.json');
    if (graphBackup !== null) {
      await fs.writeFile(GRAPH_PATH, graphBackup, 'utf-8');
    } else {
      await fs.rm(GRAPH_PATH, { force: true });
    }
    if (importBackup !== null) {
      await fs.writeFile(IMPORT_PATH, importBackup, 'utf-8');
    } else {
      await fs.rm(IMPORT_PATH, { force: true });
    }
  });

  beforeEach(async () => {
    // Clear out import-data
    await writeImportData({ sessions: [], candidates: [], audits: [] });
    // Reset graph to empty in test directory
    await writeKnowledgeGraph({
      schemaVersion: 3,
      updatedAt: new Date().toISOString(),
      subjects: [],
      learningObjectives: [],
      conceptRelations: [],
      domainMemberships: [],
    });
  });

  describe('normalizeText', () => {
    it('normalizes spaces and lowercase', () => {
      expect(normalizeText('  Hàm   Số  ')).toBe('hàm số');
    });
    it('removes punctuation safely', () => {
      expect(normalizeText('Toán (12), ')).toBe('toán 12');
    });
  });

  describe('parseImportFile Contract Checks', () => {
    it('rejects unsupported schema', async () => {
      await expect(
        parseImportFile({ schemaVersion: '2.0' } as unknown as KnowledgeImportFile, 'test.json')
      ).rejects.toThrow('Unsupported schema version');
    });

    it('rejects duplicate sourceKeys in O(N)', async () => {
      const payload: KnowledgeImportFile = {
        schemaVersion: '1.0',
        source: { title: 'Test', organization: 'Org', version: '1.0' },
        subjects: [
          { sourceKey: 'same-key', title: 'Toán', grades: [] },
          { sourceKey: 'same-key', title: 'Văn', grades: [] },
        ],
        concepts: [],
        relations: [],
      };
      await expect(parseImportFile(payload, 'test.json')).rejects.toThrow(
        'Duplicate sourceKey detected'
      );
    });

    it('rejects empty normalized titles', async () => {
      const payload: KnowledgeImportFile = {
        schemaVersion: '1.0',
        source: { title: 'Test', organization: 'Org', version: '1.0' },
        subjects: [{ sourceKey: 's1', title: '   ', grades: [] }],
        concepts: [],
        relations: [],
      };
      await expect(parseImportFile(payload, 'test.json')).rejects.toThrow('Empty normalized title');
    });

    it('rejects invalid Bloom level', async () => {
      const payload: KnowledgeImportFile = {
        schemaVersion: '1.0',
        source: { title: 'Test', organization: 'Org', version: '1.0' },
        subjects: [],
        concepts: [
          {
            sourceKey: 'c1',
            title: 'Concept 1',
            primaryDomainSourceKey: 'd1',
            learningObjectives: [
              { sourceKey: 'o1', bloomLevel: 'SUPER_APPLY', statement: 'Invalid statement' },
            ],
          },
        ],
        relations: [],
      };
      await expect(parseImportFile(payload, 'test.json')).rejects.toThrow('Invalid Bloom level');
    });

    it('rejects dangling Domain reference in Concepts', async () => {
      const payload: KnowledgeImportFile = {
        schemaVersion: '1.0',
        source: { title: 'Test', organization: 'Org', version: '1.0' },
        subjects: [],
        concepts: [
          {
            sourceKey: 'c1',
            title: 'Concept 1',
            primaryDomainSourceKey: 'dangling-domain-key',
          },
        ],
        relations: [],
      };
      await expect(parseImportFile(payload, 'test.json')).rejects.toThrow(
        'Dangling Domain reference'
      );
    });

    it('rejects dangling Concept references in Relations', async () => {
      const payload: KnowledgeImportFile = {
        schemaVersion: '1.0',
        source: { title: 'Test', organization: 'Org', version: '1.0' },
        subjects: [],
        concepts: [{ sourceKey: 'c1', title: 'Concept 1', primaryDomainSourceKey: 'd1' }],
        relations: [
          {
            sourceKey: 'r1',
            type: 'PREREQUISITE',
            sourceConceptSourceKey: 'c1',
            targetConceptSourceKey: 'dangling-concept-key',
          },
        ],
      };
      await expect(parseImportFile(payload, 'test.json')).rejects.toThrow(
        'Dangling Concept reference'
      );
    });

    it('ignores source-supplied canonical IDs', async () => {
      const payload = {
        schemaVersion: '1.0',
        source: { title: 'Test', organization: 'Org', version: '1.0' },
        subjects: [{ sourceKey: 's1', title: 'Toán', id: 'supplied-id', grades: [] }],
        concepts: [],
        relations: [],
      } as unknown as KnowledgeImportFile;
      const sid = await parseImportFile(payload, 'test.json');
      const data = await readImportData();
      const cand = data.candidates.find((c) => c.sessionId === sid)!;
      expect(cand.sourceData.id).toBeUndefined();
    });

    it('enforces repeated checksum restriction', async () => {
      const payload: KnowledgeImportFile = {
        schemaVersion: '1.0',
        source: { title: 'Test', organization: 'Org', version: '1.0' },
        subjects: [{ sourceKey: 's1', title: 'Toán', grades: [] }],
        concepts: [],
        relations: [],
      };
      await parseImportFile(payload, 'test1.json');
      await expect(parseImportFile(payload, 'test2.json')).rejects.toThrow('already been imported');
    });
  });

  describe('runMatchingEngine Logic', () => {
    it('handles exact matches and alias matches in index-based O(N) lookup', async () => {
      const doc = await readKnowledgeGraph();
      doc.subjects.push({
        id: 'canonical-s1',
        type: 'SUBJECT',
        title: 'Toán học',
        slug: 'toan-hoc',
        order: 1,
        status: 'PUBLISHED',
        createdAt: '',
        updatedAt: '',
        grades: [],
      });
      await writeKnowledgeGraph(doc);

      const payload: KnowledgeImportFile = {
        schemaVersion: '1.0',
        source: { title: 'Test', organization: 'Org', version: '1.0' },
        subjects: [
          { sourceKey: 's1', title: 'Toán học', grades: [] }, // EXACT
          { sourceKey: 's2', title: 'Vật lý', grades: [] }, // Needs review
        ],
        concepts: [],
        relations: [],
      };

      const sid = await parseImportFile(payload, 'test.json');
      await runMatchingEngine(sid);

      const data = await readImportData();
      const s1 = data.candidates.find((c) => c.sourceKey === 's1')!;
      const s2 = data.candidates.find((c) => c.sourceKey === 's2')!;

      expect(s1.status).toBe('AUTO_MATCHED');
      expect(s1.matchedCanonicalId).toBe('canonical-s1');
      expect(s2.status).toBe('NEEDS_REVIEW');
    });

    it('does not auto-merge fuzzy possible matches', async () => {
      const doc = await readKnowledgeGraph();
      doc.subjects.push({
        id: 'canonical-s1',
        type: 'SUBJECT',
        title: 'Toán học đại số',
        slug: 'toan-hoc-dai-so',
        order: 1,
        status: 'PUBLISHED',
        createdAt: '',
        updatedAt: '',
        grades: [],
      });
      await writeKnowledgeGraph(doc);

      const payload: KnowledgeImportFile = {
        schemaVersion: '1.0',
        source: { title: 'Test', organization: 'Org', version: '1.0' },
        subjects: [{ sourceKey: 's1', title: 'Toán học', grades: [] }], // Fuzzy prefix match
        concepts: [],
        relations: [],
      };

      const sid = await parseImportFile(payload, 'test.json');
      await runMatchingEngine(sid);

      const data = await readImportData();
      const s1 = data.candidates.find((c) => c.sourceKey === 's1')!;
      expect(s1.status).toBe('NEEDS_REVIEW');
      expect(s1.matchReasons[0]).toContain('Possible match');
    });
  });

  describe('Cycle Detection Algorithm', () => {
    it('detects direct loop', () => {
      const concepts = ['c1', 'c2'];
      const relations = [
        { sourceId: 'c1', targetId: 'c2' },
        { sourceId: 'c2', targetId: 'c1' },
      ];
      expect(detectCycleWithColors(concepts, relations)).toBe(true);
    });

    it('detects indirect loop', () => {
      const concepts = ['c1', 'c2', 'c3'];
      const relations = [
        { sourceId: 'c1', targetId: 'c2' },
        { sourceId: 'c2', targetId: 'c3' },
        { sourceId: 'c3', targetId: 'c1' },
      ];
      expect(detectCycleWithColors(concepts, relations)).toBe(true);
    });

    it('allows valid DAG', () => {
      const concepts = ['c1', 'c2', 'c3'];
      const relations = [
        { sourceId: 'c1', targetId: 'c2' },
        { sourceId: 'c1', targetId: 'c3' },
        { sourceId: 'c2', targetId: 'c3' },
      ];
      expect(detectCycleWithColors(concepts, relations)).toBe(false);
    });
  });

  describe('commitImportSession Atomic Commit & Rollback', () => {
    it('rolls back on cycle detection error and keeps graph unchanged', async () => {
      // 1. Seed canonical graph with Subject -> Grade -> Domain -> 2 Concepts
      const graph = await readKnowledgeGraph();
      graph.subjects.push({
        id: 's-math',
        title: 'Toán học',
        type: 'SUBJECT',
        slug: 'toan-hoc',
        order: 1,
        status: 'PUBLISHED',
        createdAt: '',
        updatedAt: '',
        grades: [
          {
            id: 'g-12',
            title: 'Lớp 12',
            type: 'GRADE',
            subjectId: 's-math',
            slug: 'lop-12',
            order: 1,
            status: 'PUBLISHED',
            createdAt: '',
            updatedAt: '',
            domains: [
              {
                id: 'd-integral',
                title: 'Tích phân',
                type: 'DOMAIN',
                subjectId: 's-math',
                gradeId: 'g-12',
                slug: 'tich-phan',
                order: 1,
                status: 'PUBLISHED',
                createdAt: '',
                updatedAt: '',
                concepts: [
                  {
                    id: 'c-basic',
                    title: 'Nguyên hàm cơ bản',
                    type: 'CONCEPT',
                    primaryDomainId: 'd-integral',
                    aliases: [],
                    slug: 'nguyen-ham-co-ban',
                    order: 1,
                    status: 'PUBLISHED',
                    createdAt: '',
                    updatedAt: '',
                  },
                  {
                    id: 'c-adv',
                    title: 'Tích phân nâng cao',
                    type: 'CONCEPT',
                    primaryDomainId: 'd-integral',
                    aliases: [],
                    slug: 'tich-phan-nang-cao',
                    order: 2,
                    status: 'PUBLISHED',
                    createdAt: '',
                    updatedAt: '',
                  },
                ],
              },
            ],
          },
        ],
      });
      await writeKnowledgeGraph(graph);

      // Create a payload importing a relation that is valid, but we will approve a cycle
      const payload: KnowledgeImportFile = {
        schemaVersion: '1.0',
        source: { title: 'Pilot', organization: 'Org', version: '1.0' },
        subjects: [],
        concepts: [],
        relations: [
          {
            sourceKey: 'r1',
            type: 'PREREQUISITE',
            sourceConceptSourceKey: 'c-adv',
            targetConceptSourceKey: 'c-basic',
          },
        ],
      };

      const sid = await parseImportFile(payload, 'test.json');
      await runMatchingEngine(sid);

      // Approve it
      const importData = await readImportData();
      const r1 = importData.candidates.find((c) => c.sourceKey === 'r1')!;
      r1.status = 'APPROVED_CREATE';
      importData.sessions[0].status = 'READY_TO_COMMIT';
      await writeImportData(importData);

      // Now introduce an existing reverse relation in the canonical graph directly to force a cycle
      const currentGraph = await readKnowledgeGraph();
      currentGraph.conceptRelations.push({
        id: 'rel-reverse',
        sourceConceptId: 'c-basic',
        targetConceptId: 'c-adv',
        type: 'PREREQUISITE',
        status: 'PUBLISHED',
        createdAt: '',
        updatedAt: '',
      });
      await writeKnowledgeGraph(currentGraph);

      // Verify commit fails and graph rolls back (meaning rel-reverse is there, but r1 was not committed)
      await expect(commitImportSession(sid)).rejects.toThrow('Cycle detected');

      const finalGraph = await readKnowledgeGraph();
      expect(finalGraph.conceptRelations.length).toBe(1); // Only rel-reverse exists
      expect(finalGraph.conceptRelations[0].id).toBe('rel-reverse');
    });

    it('succeeds on valid commit, creating backup and audit logs', async () => {
      const payload: KnowledgeImportFile = {
        schemaVersion: '1.0',
        source: { title: 'Test', organization: 'Org', version: '1.0' },
        subjects: [{ sourceKey: 's1', title: 'Hóa học', grades: [] }],
        concepts: [],
        relations: [],
      };
      const sid = await parseImportFile(payload, 'test.json');
      await runMatchingEngine(sid);

      const importData = await readImportData();
      importData.candidates[0].status = 'APPROVED_CREATE';
      importData.sessions[0].status = 'READY_TO_COMMIT';
      await writeImportData(importData);

      await commitImportSession(sid);

      const finalGraph = await readKnowledgeGraph();
      expect(finalGraph.subjects.length).toBe(1);
      expect(finalGraph.subjects[0].title).toBe('Hóa học');

      // Verify backup is created in test directory
      const backupExists = await fs
        .stat(testGraphBakPath)
        .then(() => true)
        .catch(() => false);
      expect(backupExists).toBe(true);

      // Verify audits
      const finalImportData = await readImportData();
      expect(finalImportData.sessions[0].status).toBe('COMPLETED');
      expect(finalImportData.audits.length).toBe(1);
      expect(finalImportData.audits[0].action).toBe('CREATE');
      expect(finalImportData.audits[0].entityType).toBe('SUBJECT');
    });
  });
});
