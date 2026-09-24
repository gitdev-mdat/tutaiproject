import {
  KgConcept,
  KgDocument,
  ConceptRelation,
  LearningObjective,
  BloomLevel,
  ConceptRelationType,
  KgNode,
  KgDomain,
  KgGrade,
} from './kg-types';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { readImportData, writeImportData, clearImportCache } from './kg-import-storage';
import {
  KnowledgeImportFile,
  KnowledgeImportSession,
  ImportCandidate,
  KnowledgeImportAuditEntry,
  ImportCandidateEntity,
} from './kg-import-types';
import { readKnowledgeGraph, writeKnowledgeGraph, clearStorageCache } from './kg-storage';

let testBackupPath: string | null = null;
let testGraphPath: string | null = null;

export function setTestImportPaths(graphPath: string | null, backupPath: string | null): void {
  testGraphPath = graphPath;
  testBackupPath = backupPath;
}

function getGraphPath(): string {
  if (testGraphPath) return testGraphPath;
  return path.join(process.cwd(), 'data', 'knowledge-graph', 'graph.json');
}

function getBackupPath(): string {
  if (testBackupPath) return testBackupPath;
  return path.join(process.cwd(), 'data', 'knowledge-graph', 'graph.json.bak');
}
import { walkKgNodes } from './kg-utils';

export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFC')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,:;!?()]/g, '');
}

export function generateKnowledgeGraphEntityId(prefix: 'node' | 'lo' | 'rel'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 11)}`;
}

export function detectSemanticWarnings(title: string, type: 'DOMAIN' | 'CONCEPT'): string[] {
  const warnings: string[] = [];
  const lowerTitle = title.toLowerCase();

  if (type === 'DOMAIN') {
    if (/^(chương|bài|lesson|unit)\s+\d+/i.test(title)) {
      warnings.push('Chứa mẫu định dạng theo SGK (Chương/Bài/Unit).');
    }
  }

  if (type === 'CONCEPT') {
    const actionWords = ['hiểu', 'biết', 'nhận biết', 'tính', 'giải', 'vận dụng', 'chứng minh'];
    if (actionWords.some((w) => lowerTitle.startsWith(w + ' '))) {
      warnings.push(
        'Bắt đầu bằng động từ hành động, có thể phù hợp làm Mục tiêu học tập hơn là Khái niệm (Danh từ).'
      );
    }
  }

  return warnings;
}

export async function parseImportFile(
  payload: KnowledgeImportFile,
  filename: string
): Promise<string> {
  clearImportCache();
  // Validate schema version
  if (!payload || payload.schemaVersion !== '1.0') {
    throw new Error('Unsupported schema version');
  }

  // 1. Structural/Contract Validation
  const sourceKeysSet = new Set<string>();
  const validationErrors: string[] = [];

  const checkSourceKey = (key: string, context: string) => {
    if (!key || key.trim() === '') {
      validationErrors.push(`Missing sourceKey in context: ${context}`);
      return false;
    }
    if (sourceKeysSet.has(key)) {
      validationErrors.push(`Duplicate sourceKey detected: '${key}' in context: ${context}`);
      return false;
    }
    sourceKeysSet.add(key);
    return true;
  };

  const VALID_BLOOM_LEVELS = new Set([
    'REMEMBER',
    'UNDERSTAND',
    'APPLY',
    'ANALYZE',
    'EVALUATE',
    'CREATE',
  ]);
  const VALID_RELATION_TYPES = new Set(['PREREQUISITE', 'RELATED', 'PART_OF', 'EQUIVALENT']);

  const domainsInPayload = new Set<string>();
  const conceptsInPayload = new Set<string>();

  // Collect subjects, grades, domains
  for (const subj of payload.subjects || []) {
    checkSourceKey(subj.sourceKey, `Subject '${subj.title}'`);
    if (!normalizeText(subj.title)) {
      validationErrors.push(`Empty normalized title for Subject '${subj.title}'`);
    }

    for (const grade of subj.grades || []) {
      checkSourceKey(grade.sourceKey, `Grade '${grade.title}'`);
      if (!normalizeText(grade.title)) {
        validationErrors.push(`Empty normalized title for Grade '${grade.title}'`);
      }

      for (const domain of grade.domains || []) {
        checkSourceKey(domain.sourceKey, `Domain '${domain.title}'`);
        if (!normalizeText(domain.title)) {
          validationErrors.push(`Empty normalized title for Domain '${domain.title}'`);
        }
        domainsInPayload.add(domain.sourceKey);
      }
    }
  }

  // Collect concepts
  for (const c of payload.concepts || []) {
    checkSourceKey(c.sourceKey, `Concept '${c.title}'`);
    if (!normalizeText(c.title)) {
      validationErrors.push(`Empty normalized title for Concept '${c.title}'`);
    }
    conceptsInPayload.add(c.sourceKey);

    // Validate objectives
    for (const obj of c.learningObjectives || []) {
      checkSourceKey(obj.sourceKey, `Objective in Concept '${c.title}'`);
      if (!VALID_BLOOM_LEVELS.has(obj.bloomLevel)) {
        validationErrors.push(
          `Invalid Bloom level '${obj.bloomLevel}' for objective '${obj.statement}'`
        );
      }
    }
  }

  // Validate relations
  for (const r of payload.relations || []) {
    checkSourceKey(
      r.sourceKey,
      `Relation from ${r.sourceConceptSourceKey} to ${r.targetConceptSourceKey}`
    );
    if (!VALID_RELATION_TYPES.has(r.type)) {
      validationErrors.push(`Invalid relation type '${r.type}'`);
    }
  }

  // Read current graph to check references
  const graphDoc = await readKnowledgeGraph();
  const canonicalNodes = Array.from(walkKgNodes(graphDoc));
  const canonicalConceptsSet = new Set(
    canonicalNodes.filter((n) => n.node.type === 'CONCEPT').map((n) => n.node.id)
  );
  const canonicalDomainsSet = new Set(
    canonicalNodes.filter((n) => n.node.type === 'DOMAIN').map((n) => n.node.id)
  );

  // Check dangling primary domain references
  for (const c of payload.concepts || []) {
    const domainKey = c.primaryDomainSourceKey;
    if (!domainsInPayload.has(domainKey) && !canonicalDomainsSet.has(domainKey)) {
      validationErrors.push(
        `Dangling Domain reference: Domain '${domainKey}' not found in payload or canonical graph for Concept '${c.title}'`
      );
    }
  }

  // Check dangling concept references in relations
  for (const r of payload.relations || []) {
    if (
      !conceptsInPayload.has(r.sourceConceptSourceKey) &&
      !canonicalConceptsSet.has(r.sourceConceptSourceKey)
    ) {
      validationErrors.push(
        `Dangling Concept reference: Source concept '${r.sourceConceptSourceKey}' not found in payload or canonical graph`
      );
    }
    if (
      !conceptsInPayload.has(r.targetConceptSourceKey) &&
      !canonicalConceptsSet.has(r.targetConceptSourceKey)
    ) {
      validationErrors.push(
        `Dangling Concept reference: Target concept '${r.targetConceptSourceKey}' not found in payload or canonical graph`
      );
    }
  }

  if (validationErrors.length > 0) {
    throw new Error(`Validation Schema Contract Violation:\n- ${validationErrors.join('\n- ')}`);
  }

  const checksum = Buffer.from(JSON.stringify(payload)).toString('base64');
  const data = await readImportData();

  const existing = data.sessions.find(
    (s) => s.sourceChecksum === checksum && s.status !== 'CANCELLED' && s.status !== 'FAILED'
  );
  if (existing) {
    throw new Error('This file has already been imported or is currently in an active session.');
  }

  const sessionId = uuidv4();
  const session: KnowledgeImportSession = {
    id: sessionId,
    title: payload.source.title || 'Untitled Import',
    sourceType: 'JSON_FILE',
    sourceName: filename,
    sourceChecksum: checksum,
    status: 'PARSING',
    parserVersion: '1.0',
    targetGraphVersion: '3',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    summary: {
      totalCandidates: 0,
      approved: 0,
      rejected: 0,
      unresolved: 0,
      warnings: 0,
      errors: 0,
    },
  };

  data.sessions.push(session);
  await writeImportData(data);

  const candidates: ImportCandidate[] = [];

  const addCandidate = (
    entityType: ImportCandidateEntity,
    sourceKey: string,
    sourceData: Record<string, unknown>,
    normalizedData: Record<string, unknown>
  ) => {
    // Strip user-supplied canonical IDs if present
    const cleanSourceData = { ...sourceData };
    delete cleanSourceData.id;

    const warnings = detectSemanticWarnings(
      (sourceData.title as string) || '',
      entityType as 'DOMAIN' | 'CONCEPT'
    );
    candidates.push({
      id: uuidv4(),
      sessionId,
      entityType,
      sourceKey,
      sourceData: cleanSourceData,
      normalizedData,
      status: 'PENDING',
      matchReasons: [],
      validationErrors: [],
      validationWarnings: warnings,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  for (const subj of payload.subjects || []) {
    addCandidate('SUBJECT', subj.sourceKey, subj as unknown as Record<string, unknown>, {
      title: normalizeText(subj.title),
    });
    for (const grade of subj.grades || []) {
      addCandidate(
        'GRADE',
        grade.sourceKey,
        { ...grade, parentSubjectKey: subj.sourceKey } as unknown as Record<string, unknown>,
        { title: normalizeText(grade.title) }
      );
      for (const domain of grade.domains || []) {
        addCandidate(
          'DOMAIN',
          domain.sourceKey,
          { ...domain, parentGradeKey: grade.sourceKey } as unknown as Record<string, unknown>,
          { title: normalizeText(domain.title) }
        );
      }
    }
  }

  for (const c of payload.concepts || []) {
    addCandidate('CONCEPT', c.sourceKey, c as unknown as Record<string, unknown>, {
      title: normalizeText(c.title),
      aliases: (c.aliases || []).map(normalizeText),
    });
    for (const obj of c.learningObjectives || []) {
      addCandidate(
        'LEARNING_OBJECTIVE',
        obj.sourceKey,
        { ...obj, parentConceptKey: c.sourceKey } as unknown as Record<string, unknown>,
        { statement: normalizeText(obj.statement) }
      );
    }
  }

  for (const r of payload.relations || []) {
    addCandidate('CONCEPT_RELATION', r.sourceKey, r as unknown as Record<string, unknown>, {
      sourceConceptSourceKey: r.sourceConceptSourceKey,
      targetConceptSourceKey: r.targetConceptSourceKey,
      type: r.type,
    });
  }

  data.candidates.push(...candidates);

  session.status = 'REVIEW_REQUIRED';
  session.summary.totalCandidates = candidates.length;
  session.summary.unresolved = candidates.length;
  session.summary.warnings = candidates.reduce((acc, c) => acc + c.validationWarnings.length, 0);

  await writeImportData(data);

  return sessionId;
}

export async function runMatchingEngine(sessionId: string) {
  clearImportCache();
  const importData = await readImportData();
  const session = importData.sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error('Session not found');

  clearStorageCache();
  const candidates = importData.candidates.filter((c) => c.sessionId === sessionId);
  const graphDoc = await readKnowledgeGraph();
  const allCanonicalNodes = Array.from(walkKgNodes(graphDoc));
  type CanonicalItem = { node: KgNode; parent: KgNode | null; level: number };

  // Build deterministic indexes for O(N) lookup
  const canonicalTitleMap = new Map<string, CanonicalItem[]>();
  const canonicalAliasMap = new Map<string, CanonicalItem[]>();

  for (const item of allCanonicalNodes) {
    const normTitle = normalizeText(item.node.title);
    if (!canonicalTitleMap.has(normTitle)) {
      canonicalTitleMap.set(normTitle, []);
    }
    canonicalTitleMap.get(normTitle)!.push(item);

    if (item.node.type === 'CONCEPT') {
      const conceptNode = item.node as KgConcept;
      if (conceptNode.aliases) {
        for (const alias of conceptNode.aliases) {
          const normAlias = normalizeText(alias);
          if (!canonicalAliasMap.has(normAlias)) {
            canonicalAliasMap.set(normAlias, []);
          }
          canonicalAliasMap.get(normAlias)!.push(item);
        }
      }
    }
  }

  for (const c of candidates) {
    if (c.status !== 'PENDING') continue;

    const cTitle = c.normalizedData.title as string;

    if (
      c.entityType === 'SUBJECT' ||
      c.entityType === 'GRADE' ||
      c.entityType === 'DOMAIN' ||
      c.entityType === 'CONCEPT'
    ) {
      // 1. EXACT TITLE MATCH (O(1))
      const sameTitleNodes = canonicalTitleMap.get(cTitle) || [];
      const exactMatch = sameTitleNodes.find((item) => item.node.type === c.entityType);

      if (exactMatch) {
        c.matchedCanonicalId = exactMatch.node.id;
        c.matchConfidence = 1.0;
        c.matchReasons = ['Khớp chính xác tên chuẩn hóa (Exact match).'];
        c.status = 'AUTO_MATCHED';
        continue;
      }

      // 2. ALIAS MATCH FOR CONCEPT (O(1))
      if (c.entityType === 'CONCEPT') {
        const aliasMatchItems = canonicalAliasMap.get(cTitle) || [];
        const aliasMatch = aliasMatchItems.find((item) => item.node.type === 'CONCEPT');

        if (aliasMatch) {
          c.matchedCanonicalId = aliasMatch.node.id;
          c.matchConfidence = 0.9;
          c.matchReasons = ['Khớp qua từ khóa (Alias match).'];
          c.status = 'AUTO_MATCHED';
          continue;
        }

        // Also check if candidate concept's aliases match canonical concept titles
        const candidateAliases = (c.normalizedData.aliases || []) as string[];
        let foundAliasMatch = false;
        for (const alias of candidateAliases) {
          const matchedNodes = canonicalTitleMap.get(alias) || [];
          const matchedConcept = matchedNodes.find((item) => item.node.type === 'CONCEPT');
          if (matchedConcept) {
            c.matchedCanonicalId = matchedConcept.node.id;
            c.matchConfidence = 0.9;
            c.matchReasons = [`Khớp bí danh '${alias}' với tên chuẩn hóa.`];
            c.status = 'AUTO_MATCHED';
            foundAliasMatch = true;
            break;
          }
        }
        if (foundAliasMatch) continue;
      }

      // 3. STRUCTURAL MATCH (Same title under same parent hierarchy context)
      // E.g. Domain under Grade under Subject
      if (c.entityType === 'DOMAIN') {
        const parentGradeKey = c.sourceData.parentGradeKey as string;
        const parentGradeCandidate = candidates.find((cand) => cand.sourceKey === parentGradeKey);
        if (parentGradeCandidate && parentGradeCandidate.matchedCanonicalId) {
          const matchingDomainNode = sameTitleNodes.find(
            (item) =>
              item.node.type === 'DOMAIN' &&
              (item.node as KgDomain).gradeId === parentGradeCandidate.matchedCanonicalId
          );
          if (matchingDomainNode) {
            c.matchedCanonicalId = matchingDomainNode.node.id;
            c.matchConfidence = 0.85;
            c.matchReasons = ['Khớp cấu trúc theo cấp cha (Structural Grade match).'];
            c.status = 'AUTO_MATCHED';
            continue;
          }
        }
      }

      // 4. FUZZY POSSIBLE MATCH (only on narrowed set)
      // For demonstration, if title starts with the target title or vice versa (fuzzy similarity)
      const possibleMatch = allCanonicalNodes.find(
        (item) =>
          item.node.type === c.entityType &&
          (item.node.title.toLowerCase().startsWith(cTitle) ||
            cTitle.startsWith(item.node.title.toLowerCase()))
      );

      if (possibleMatch) {
        c.matchedCanonicalId = possibleMatch.node.id;
        c.matchConfidence = 0.5;
        c.matchReasons = [`Khớp gần đúng (Possible match: ${possibleMatch.node.title}).`];
        c.status = 'NEEDS_REVIEW'; // Needs review, fuzzy must never auto-merge
      } else {
        c.status = 'NEEDS_REVIEW';
        c.matchReasons = ['Không tìm thấy khớp chính xác. Yêu cầu kiểm duyệt.'];
      }
    } else {
      c.status = 'NEEDS_REVIEW';
    }
  }

  // Update summary
  const sessionCandidates = importData.candidates.filter((c) => c.sessionId === session.id);
  session.summary.approved = sessionCandidates.filter(
    (c) => c.status.startsWith('APPROVED') || c.status === 'AUTO_MATCHED'
  ).length;
  session.summary.rejected = sessionCandidates.filter((c) => c.status === 'REJECTED').length;
  session.summary.unresolved = sessionCandidates.filter(
    (c) => c.status === 'PENDING' || c.status === 'NEEDS_REVIEW'
  ).length;

  if (session.summary.unresolved === 0) {
    session.status = 'READY_TO_COMMIT';
  } else {
    session.status = 'REVIEW_REQUIRED';
  }

  await writeImportData(importData);
}

export function detectCycleWithColors(
  concepts: string[],
  relations: { sourceId: string; targetId: string }[]
): boolean {
  const adj = new Map<string, string[]>();
  for (const c of concepts) {
    adj.set(c, []);
  }
  for (const r of relations) {
    const list = adj.get(r.sourceId);
    if (list) {
      list.push(r.targetId);
    }
  }

  const colors = new Map<string, number>(); // 0=White, 1=Gray, 2=Black
  for (const c of concepts) {
    colors.set(c, 0);
  }

  function dfs(u: string): boolean {
    colors.set(u, 1); // Gray

    const neighbors = adj.get(u) || [];
    for (const v of neighbors) {
      const colorV = colors.get(v) ?? 0;
      if (colorV === 1) {
        return true; // Cycle found
      }
      if (colorV === 0) {
        if (dfs(v)) return true;
      }
    }

    colors.set(u, 2); // Black
    return false;
  }

  for (const c of concepts) {
    if ((colors.get(c) ?? 0) === 0) {
      if (dfs(c)) return true;
    }
  }

  return false;
}

export async function commitImportSession(sessionId: string) {
  clearStorageCache();
  clearImportCache();
  const importData = await readImportData();
  const session = importData.sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error('Session not found');

  if (session.status === 'COMPLETED') {
    throw new Error('Session already completed');
  }

  // Pre-commit validation
  const candidates = importData.candidates.filter((c) => c.sessionId === sessionId);

  if (candidates.some((c) => c.status === 'NEEDS_REVIEW' || c.status === 'PENDING')) {
    throw new Error('Cannot commit with unresolved candidates');
  }

  if (candidates.some((c) => c.validationErrors.length > 0)) {
    throw new Error('Cannot commit with validation errors');
  }

  session.status = 'COMMITTING';
  await writeImportData(importData);

  // Load latest graph
  const graphDoc = await readKnowledgeGraph();

  // Create recovery backup
  const backupPath = getBackupPath();
  const graphPath = getGraphPath();
  try {
    const raw = await fs.readFile(/* turbopackIgnore: true */ graphPath, 'utf-8');
    await fs.writeFile(/* turbopackIgnore: true */ backupPath, raw, 'utf-8');
  } catch {
    // Ignore backup write failure if graph.json does not exist yet
  }

  const idMap = new Map<string, string>();
  const audits: KnowledgeImportAuditEntry[] = [];
  const createdConceptIdsByCandidate = new Map<string, string>();

  // Initialize mapping with pre-existing canonical IDs
  const allNodes = Array.from(walkKgNodes(graphDoc));
  for (const item of allNodes) {
    idMap.set(item.node.title, item.node.id);
    idMap.set(item.node.id, item.node.id);
  }

  const FIXTURE_PROVENANCE = {
    sourceType: 'IMPORT' as const,
    sourceId: sessionId,
  };

  try {
    // Build projected structures
    const projectedGraph = JSON.parse(JSON.stringify(graphDoc)) as KgDocument;

    const findProjectedNode = (id: string) => {
      for (const s of projectedGraph.subjects) {
        if (s.id === id) return s;
        for (const g of s.grades) {
          if (g.id === id) return g;
          for (const d of g.domains) {
            if (d.id === id) return d;
            for (const c of d.concepts) {
              if (c.id === id) return c;
            }
          }
        }
      }
      return undefined;
    };

    const createSlug = (title: string) =>
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    // First commit Approved Creates and match mappings
    for (const c of candidates) {
      if (
        c.status === 'APPROVED_LINK' ||
        c.status === 'APPROVED_UPDATE' ||
        c.status === 'AUTO_MATCHED'
      ) {
        if (c.matchedCanonicalId) {
          idMap.set(c.sourceKey, c.matchedCanonicalId);
        }
      }

      if (
        c.status === 'APPROVED_CREATE' &&
        (c.entityType === 'SUBJECT' ||
          c.entityType === 'GRADE' ||
          c.entityType === 'DOMAIN' ||
          c.entityType === 'CONCEPT')
      ) {
        const title = c.sourceData.title as string;
        const newId = generateKnowledgeGraphEntityId('node');
        const baseNode = {
          id: newId,
          title,
          slug: createSlug(title),
          order: 0,
          status: 'PUBLISHED' as const,
          provenance: FIXTURE_PROVENANCE,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (c.entityType === 'SUBJECT') {
          projectedGraph.subjects.push({
            ...baseNode,
            type: 'SUBJECT',
            grades: [],
            order: projectedGraph.subjects.length + 1,
          });
          idMap.set(c.sourceKey, newId);
        } else if (c.entityType === 'GRADE') {
          const parentId = idMap.get(c.sourceData.parentSubjectKey as string);
          if (!parentId) throw new Error('Missing parent Subject for Grade');
          const parent = projectedGraph.subjects.find((s) => s.id === parentId);
          if (!parent) throw new Error('Parent Subject not found');
          parent.grades.push({
            ...baseNode,
            type: 'GRADE',
            subjectId: parentId,
            domains: [],
            order: parent.grades.length + 1,
          });
          idMap.set(c.sourceKey, newId);
        } else if (c.entityType === 'DOMAIN') {
          const parentId = idMap.get(c.sourceData.parentGradeKey as string);
          if (!parentId) throw new Error('Missing parent Grade for Domain');
          let parentGrade: KgGrade | undefined;
          for (const s of projectedGraph.subjects) {
            const found = s.grades.find((g) => g.id === parentId);
            if (found) {
              parentGrade = found;
              break;
            }
          }
          if (!parentGrade) throw new Error('Parent Grade not found');
          parentGrade.domains.push({
            ...baseNode,
            type: 'DOMAIN',
            subjectId: parentGrade.subjectId,
            gradeId: parentId,
            concepts: [],
            order: parentGrade.domains.length + 1,
          });
          idMap.set(c.sourceKey, newId);
        } else if (c.entityType === 'CONCEPT') {
          const parentId = idMap.get(c.sourceData.primaryDomainSourceKey as string);
          if (!parentId) throw new Error('Missing primary Domain for Concept');
          let parentDomain: KgDomain | undefined;
          for (const s of projectedGraph.subjects) {
            for (const g of s.grades) {
              const found = g.domains.find((d) => d.id === parentId);
              if (found) {
                parentDomain = found;
                break;
              }
            }
          }
          if (!parentDomain) throw new Error('Parent Domain not found');
          const newConcept: KgConcept = {
            ...baseNode,
            type: 'CONCEPT',
            primaryDomainId: parentId,
            shortDescription: (c.sourceData.shortDescription as string) || '',
            detailedDescription: (c.sourceData.detailedDescription as string) || '',
            aliases: (c.sourceData.aliases as string[]) || [],
            order: parentDomain.concepts.length + 1,
          };
          parentDomain.concepts.push(newConcept);
          projectedGraph.domainMemberships.push({
            id: `mem-${newConcept.id}-${parentId}`,
            conceptId: newConcept.id,
            domainId: parentId,
            role: 'PRIMARY',
            provenance: FIXTURE_PROVENANCE,
            createdAt: new Date().toISOString(),
          });
          idMap.set(c.sourceKey, newId);
          createdConceptIdsByCandidate.set(c.id, newId);
        }

        audits.push({
          id: uuidv4(),
          sessionId,
          candidateId: c.id,
          action: 'CREATE',
          entityType: c.entityType,
          canonicalEntityId: newId,
          after: baseNode,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Process APPROVED_UPDATE
    for (const c of candidates) {
      if (c.status === 'APPROVED_UPDATE') {
        const canonicalId = c.matchedCanonicalId;
        if (!canonicalId) throw new Error('No matched canonical ID for UPDATE decision');

        const existingNode = findProjectedNode(canonicalId);
        if (!existingNode) throw new Error(`Node ${canonicalId} not found for UPDATE`);

        const before = JSON.parse(JSON.stringify(existingNode));

        // Enforce safe updates: never silently replace canonical title, primary identity, etc.
        // Allowed: descriptions, aliases
        if (existingNode.type === 'CONCEPT') {
          const conceptNode = existingNode as KgConcept;

          if (
            c.sourceData.title &&
            normalizeText(c.sourceData.title as string) !== normalizeText(conceptNode.title)
          ) {
            throw new Error(
              `Cannot modify canonical title during UPDATE: '${c.sourceData.title}' vs '${conceptNode.title}'`
            );
          }

          if (c.sourceData.primaryDomainSourceKey) {
            const resolvedDomainId =
              idMap.get(c.sourceData.primaryDomainSourceKey as string) ||
              c.sourceData.primaryDomainSourceKey;
            if (resolvedDomainId !== conceptNode.primaryDomainId) {
              throw new Error(
                `Cannot modify primaryDomainId during UPDATE: '${resolvedDomainId}' vs '${conceptNode.primaryDomainId}'`
              );
            }
          }
          conceptNode.shortDescription =
            (c.sourceData.shortDescription as string) || conceptNode.shortDescription;
          conceptNode.detailedDescription =
            (c.sourceData.detailedDescription as string) || conceptNode.detailedDescription;
          conceptNode.aliases = Array.from(
            new Set([...conceptNode.aliases, ...((c.sourceData.aliases as string[]) || [])])
          );
        }

        audits.push({
          id: uuidv4(),
          sessionId,
          candidateId: c.id,
          action: 'UPDATE',
          entityType: c.entityType,
          canonicalEntityId: canonicalId,
          before,
          after: existingNode,
          createdAt: new Date().toISOString(),
        });
      }

      // CONVERT_TO_OBJECTIVE decision
      if (c.status === 'CONVERT_TO_OBJECTIVE') {
        const targetConceptSourceKey = c.adminNote || (c.sourceData.parentConceptKey as string);
        let targetConceptId = idMap.get(targetConceptSourceKey);
        if (!targetConceptId) {
          // Fallback check: maybe targetConceptSourceKey is already a canonical ID
          const existingConcept = findProjectedNode(targetConceptSourceKey);
          if (existingConcept && existingConcept.type === 'CONCEPT') {
            targetConceptId = existingConcept.id;
          }
        }
        if (!targetConceptId) throw new Error(`Missing target Concept ID for Objective conversion`);

        const bloomLevel = (c.sourceData.bloomLevel as string) || 'UNDERSTAND';
        const statement = (c.sourceData.title as string) || (c.sourceData.statement as string);

        // Check duplicate objective validation
        const hasDuplicate = projectedGraph.learningObjectives.some(
          (lo) => lo.conceptId === targetConceptId && lo.statement.trim() === statement.trim()
        );
        if (hasDuplicate) {
          throw new Error(
            `Duplicate learning objective statement: '${statement}' in Concept '${targetConceptId}'`
          );
        }

        const newObj: LearningObjective = {
          id: generateKnowledgeGraphEntityId('lo'),
          conceptId: targetConceptId,
          bloomLevel: bloomLevel as BloomLevel,
          statement,
          order:
            projectedGraph.learningObjectives.filter((lo) => lo.conceptId === targetConceptId)
              .length + 1,
          status: 'PUBLISHED',
          provenance: FIXTURE_PROVENANCE,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        projectedGraph.learningObjectives.push(newObj);

        audits.push({
          id: uuidv4(),
          sessionId,
          candidateId: c.id,
          action: 'CONVERT_TO_OBJECTIVE',
          entityType: 'LEARNING_OBJECTIVE',
          canonicalEntityId: newObj.id,
          after: newObj,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Process Learning Objectives (approved creates)
    for (const c of candidates) {
      if (c.entityType === 'LEARNING_OBJECTIVE' && c.status === 'APPROVED_CREATE') {
        const conceptId = idMap.get(c.sourceData.parentConceptKey as string);
        if (!conceptId) throw new Error('Missing parent Concept for Objective');

        const statement = c.sourceData.statement as string;
        // Check duplicate objective validation
        const hasDuplicate = projectedGraph.learningObjectives.some(
          (lo) => lo.conceptId === conceptId && lo.statement.trim() === statement.trim()
        );
        if (hasDuplicate) {
          throw new Error(
            `Duplicate learning objective statement: '${statement}' in Concept '${conceptId}'`
          );
        }

        const newObj: LearningObjective = {
          id: generateKnowledgeGraphEntityId('lo'),
          conceptId,
          bloomLevel: c.sourceData.bloomLevel as BloomLevel,
          statement,
          order:
            projectedGraph.learningObjectives.filter((lo) => lo.conceptId === conceptId).length + 1,
          status: 'PUBLISHED',
          provenance: FIXTURE_PROVENANCE,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        projectedGraph.learningObjectives.push(newObj);

        audits.push({
          id: uuidv4(),
          sessionId,
          candidateId: c.id,
          action: 'CREATE',
          entityType: 'LEARNING_OBJECTIVE',
          canonicalEntityId: newObj.id,
          after: newObj,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Process Relations (approved creates) & Prerequisite cycle detection
    const projectedRelations: { sourceId: string; targetId: string }[] = [];
    // Load existing prerequisite relations
    for (const r of projectedGraph.conceptRelations) {
      if (r.type === 'PREREQUISITE') {
        projectedRelations.push({ sourceId: r.sourceConceptId, targetId: r.targetConceptId });
      }
    }

    const conceptsList: string[] = [];
    const collectConceptIds = (nodes: KgNode[]) => {
      for (const node of nodes) {
        if (node.type === 'CONCEPT') {
          conceptsList.push(node.id);
        }
        if (node.type === 'SUBJECT' && node.grades) collectConceptIds(node.grades);
        if (node.type === 'GRADE' && node.domains) collectConceptIds(node.domains);
        if (node.type === 'DOMAIN' && node.concepts) collectConceptIds(node.concepts);
      }
    };
    collectConceptIds(projectedGraph.subjects);

    for (const c of candidates) {
      if (c.entityType === 'CONCEPT_RELATION' && c.status === 'APPROVED_CREATE') {
        const sourceId = idMap.get(c.sourceData.sourceConceptSourceKey as string);
        const targetId = idMap.get(c.sourceData.targetConceptSourceKey as string);
        if (!sourceId || !targetId) {
          throw new Error('Missing source or target Concept for Relation');
        }

        const newRel: ConceptRelation = {
          id: generateKnowledgeGraphEntityId('rel'),
          sourceConceptId: sourceId,
          targetConceptId: targetId,
          type: c.sourceData.type as ConceptRelationType,
          status: 'PUBLISHED',
          provenance: FIXTURE_PROVENANCE,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (newRel.type === 'PREREQUISITE') {
          projectedRelations.push({ sourceId, targetId });
        }

        projectedGraph.conceptRelations.push(newRel);

        audits.push({
          id: uuidv4(),
          sessionId,
          candidateId: c.id,
          action: 'CREATE',
          entityType: 'CONCEPT_RELATION',
          canonicalEntityId: newRel.id,
          after: newRel,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Perform prerequisite cycle detection
    if (detectCycleWithColors(conceptsList, projectedRelations)) {
      throw new Error('Cycle detected in projected prerequisite graph');
    }

    // Failure injection point for testing/development rollback
    if (process.env.NODE_ENV !== 'production' && process.env.SIMULATE_COMMIT_FAIL === 'true') {
      throw new Error('SIMULATED_COMMIT_FAILURE');
    }

    // Atomic write
    await writeKnowledgeGraph(projectedGraph);

    // Persist the candidate-to-canonical mapping only after the graph write succeeds.
    for (const [candidateId, canonicalConceptId] of createdConceptIdsByCandidate) {
      const candidate = candidates.find((item) => item.id === candidateId);
      if (!candidate) continue;
      candidate.matchedCanonicalId = canonicalConceptId;
      const canonicalReview = candidate.sourceData.canonicalReview as
        Record<string, unknown> | undefined;
      const resolution = canonicalReview?.canonicalResolution as
        Record<string, unknown> | undefined;
      if (resolution) resolution.committedConceptId = canonicalConceptId;
    }

    // Save audits and retained resolution mappings to import-data.json
    session.status = 'COMPLETED';
    session.committedAt = new Date().toISOString();
    importData.audits.push(...audits);
    await writeImportData(importData);
  } catch (error: unknown) {
    // Rollback to backup
    try {
      const exists = await fs
        .stat(/* turbopackIgnore: true */ backupPath)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        const backupData = await fs.readFile(/* turbopackIgnore: true */ backupPath, 'utf-8');
        await fs.writeFile(/* turbopackIgnore: true */ graphPath, backupData, 'utf-8');
      }
    } catch {
      // Ignore rollback failure
    }

    session.status = 'FAILED';
    if (error instanceof Error) {
      session.errorMessage = error.message;
    } else {
      session.errorMessage = String(error);
    }
    await writeImportData(importData);
    throw error;
  }
}
