/**
 * Mapping Service — Links Extracted Textbook Items to Canonical Curriculum
 *
 * Business rules:
 *   - The canonical curriculum is NEVER modified here.
 *   - All mapping data is stored in the PipelineDocument JSON.
 *   - Auto-approval only for confidence >= CONFIDENCE_AUTO_APPROVE.
 *   - Everything else goes into SUGGESTED or NEEDS_REVIEW.
 *
 * Matching algorithm (deterministic first, AI as fallback):
 *   1. Exact normalized title match
 *   2. Fuzzy title match (Levenshtein similarity)
 *   3. Parent-context match (chapter/lesson title similarity)
 *   4. AI/semantic (not implemented yet — placeholder for future sprint)
 */
import 'server-only';

import type {
  KnowledgeItem,
  PipelineDocument,
  TextbookMapping,
  MappingStatus,
  MappingRelationType,
  MappingMatchMethod,
  MappingSuggestion,
  MappingProgress,
  MappingValidationResult,
  ExtractedChapter,
  ExtractedLesson,
} from '@/lib/pipeline/types';
import {
  getAllConceptsWithBreadcrumb,
  kgNodeExists,
  getKgNodeBreadcrumb,
  type KgBreadcrumb,
} from '@/lib/knowledge-graph/kg-service';

/** Generate a short unique ID without external dependencies. */
function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Thresholds ───────────────────────────────────────────────────────────────
// Easy to adjust. These are the only place confidence thresholds live.

export const MAPPING_THRESHOLDS = {
  /** >= this → SUGGESTED (high confidence, pre-approved suggestion) */
  SUGGEST: 0.9,
  /** >= this, < SUGGEST → NEEDS_REVIEW */
  NEEDS_REVIEW: 0.7,
  /** < NEEDS_REVIEW → UNMAPPED (don't auto-suggest) */
} as const;

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * Normalize a title for comparison:
 * lowercase, remove accents (NFD decompose + strip combining), collapse whitespace.
 */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Similarity score [0, 1] between two strings using Levenshtein.
 */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

/**
 * Infer the most likely MappingRelationType from a node type string.
 */
function inferRelationType(nodeType: string): MappingRelationType {
  switch (nodeType) {
    case 'DEFINITION':
      return 'DEFINES';
    case 'FORMULA':
      return 'FORMULA_FOR';
    case 'EXAMPLE':
      return 'EXAMPLE_OF';
    case 'EXERCISE':
      return 'EXERCISE_FOR';
    case 'THEOREM':
      return 'EXPLAINS';
    default:
      return 'EXPLAINS';
  }
}

// ─── Suggestion Algorithm ─────────────────────────────────────────────────────

/**
 * Suggest curriculum mappings for a single extracted KnowledgeItem.
 *
 * Steps (deterministic, best-confidence first):
 *   1. Exact normalized title → confidence 1.0
 *   2. High fuzzy similarity (>= 0.85) → confidence = similarity
 *   3. Medium fuzzy (>= 0.65) → confidence = similarity * 0.9 (context bonus)
 *
 * Returns sorted by confidence DESC, max 5 suggestions.
 */
export async function suggestMappings(item: KnowledgeItem): Promise<MappingSuggestion[]> {
  const allUnits = await getAllConceptsWithBreadcrumb();
  const relationType = inferRelationType(item.nodeType);

  const scored: Array<{ bc: KgBreadcrumb; score: number; method: MappingMatchMethod }> = [];

  for (const bc of allUnits) {
    const sim = similarity(item.title, bc.concept.title);

    if (sim === 1) {
      scored.push({ bc, score: 1.0, method: 'EXACT' });
    } else if (sim >= 0.85) {
      scored.push({ bc, score: sim, method: 'FUZZY' });
    } else if (sim >= 0.65) {
      // Context boost: check if the extracted item's description contains the unit title
      const descMatch = normalize(item.description).includes(normalize(bc.concept.title));
      scored.push({ bc, score: sim * (descMatch ? 1.05 : 0.9), method: 'CONTEXT' });
    }
  }

  // Sort by score descending, cap at 5
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 5);

  return top.map(({ bc, score, method }) => ({
    kgConceptId: bc.concept.id,
    kgTitle: bc.concept.title,
    breadcrumb: `${bc.subject.title} / ${bc.grade.title} / ${bc.domain.title}`,
    confidence: Math.min(score, 1),
    relationType,
    matchMethod: method,
  }));
}

/**
 * Determine the initial MappingStatus from a confidence score.
 */
export function confidenceToStatus(confidence: number): MappingStatus {
  if (confidence >= MAPPING_THRESHOLDS.SUGGEST) return 'SUGGESTED';
  if (confidence >= MAPPING_THRESHOLDS.NEEDS_REVIEW) return 'NEEDS_REVIEW';
  return 'UNMAPPED';
}

// ─── Mutation Helpers (operate on PipelineDocument immutably) ─────────────────

/** Walk all KnowledgeItems in a document. */
function* walkItems(doc: PipelineDocument): Generator<KnowledgeItem> {
  for (const chapter of doc.chapters) {
    for (const lesson of chapter.lessons) {
      for (const item of [
        ...lesson.topics,
        ...lesson.definitions,
        ...lesson.formulas,
        ...lesson.theorems,
        ...lesson.examples,
        ...lesson.exercises,
      ]) {
        yield item;
      }
    }
  }
}

/** Deep-clone doc and apply a mutation to a single KnowledgeItem by ID. */
function mutateItem(
  doc: PipelineDocument,
  nodeId: string,
  mutator: (item: KnowledgeItem) => KnowledgeItem
): PipelineDocument {
  const cloneLesson = (lesson: ExtractedLesson): ExtractedLesson => ({
    ...lesson,
    topics: lesson.topics.map((i) => (i.id === nodeId ? mutator(i) : i)),
    definitions: lesson.definitions.map((i) => (i.id === nodeId ? mutator(i) : i)),
    formulas: lesson.formulas.map((i) => (i.id === nodeId ? mutator(i) : i)),
    theorems: lesson.theorems.map((i) => (i.id === nodeId ? mutator(i) : i)),
    examples: lesson.examples.map((i) => (i.id === nodeId ? mutator(i) : i)),
    exercises: lesson.exercises.map((i) => (i.id === nodeId ? mutator(i) : i)),
  });

  const cloneChapter = (chapter: ExtractedChapter): ExtractedChapter => ({
    ...chapter,
    lessons: chapter.lessons.map(cloneLesson),
  });

  return {
    ...doc,
    updatedAt: new Date().toISOString(),
    chapters: doc.chapters.map(cloneChapter),
  };
}

/** Find a KnowledgeItem by ID within a document. */
export function findItemInDoc(doc: PipelineDocument, nodeId: string): KnowledgeItem | null {
  for (const item of walkItems(doc)) {
    if (item.id === nodeId) return item;
  }
  return null;
}

// ─── Public Mutation API ──────────────────────────────────────────────────────

/**
 * Add or replace a mapping on a KnowledgeItem.
 * If a mapping to the same kgConceptId already exists, it is replaced.
 */
export async function applyMapping(
  doc: PipelineDocument,
  nodeId: string,
  kgConceptId: string,
  relationType: MappingRelationType,
  confidence: number,
  matchMethod: MappingMatchMethod = 'EXACT'
): Promise<PipelineDocument> {
  const status = confidenceToStatus(confidence);
  const now = new Date().toISOString();

  // Retrieve canonical snapshots from Curriculum Service
  const bc = await getKgNodeBreadcrumb(kgConceptId);
  if (!bc && kgConceptId !== '__CREATE_NEW__') {
    throw new Error(`Curriculum unit not found: ${kgConceptId}`);
  }
  const titleSnapshot = bc ? bc.concept.title : 'Đơn vị kiến thức';
  const breadcrumbSnapshot = bc
    ? `${bc.subject.title} / ${bc.grade.title} / ${bc.domain.title}`
    : 'Đường dẫn không xác định';

  const newMapping: TextbookMapping = {
    id: genId(),
    kgConceptId,
    kgConceptTitleSnapshot: titleSnapshot,
    kgBreadcrumbSnapshot: breadcrumbSnapshot,
    relationType,
    confidence,
    status,
    matchMethod,
    createdAt: now,
    updatedAt: now,
  };

  return mutateItem(doc, nodeId, (item) => {
    // Determine the final status of this new mapping. If we are applying a manual mapping,
    // we often want it to be APPROVED or NEEDS_REVIEW, but we stick to the confidence calculation.
    // If it's a manual mapping (matchMethod === 'MANUAL'), confidence is usually 1.0 -> SUGGESTED.
    // We will let the route handle explicit approval.

    // Deactivate/remove existing mappings to the same unit, or if it's an explicit manual mapping,
    // we might want to clear suggestions. For simplicity, we just append or replace the exact unit.
    const mappings = item.kgMappings || [];
    const existing = mappings.filter((m) => m.kgConceptId !== kgConceptId);
    return {
      ...item,
      kgMappings: [...existing, newMapping],
    };
  });
}

/**
 * Apply a batch of suggestions as initial mappings for ALL items in the document.
 * Only applied where kgMappings is empty.
 * Does not overwrite existing mappings.
 */
export async function applySuggestionsToDocument(doc: PipelineDocument): Promise<PipelineDocument> {
  let result = doc;
  for (const item of walkItems(doc)) {
    if (item.kgMappings.length > 0) continue; // already has mapping
    const suggestions = await suggestMappings(item);
    if (suggestions.length === 0) continue;
    const best = suggestions[0];
    result = await applyMapping(
      result,
      item.id,
      best.kgConceptId,
      best.relationType,
      best.confidence,
      best.matchMethod
    );
  }
  return result;
}

/** Approve a specific mapping by ID on a node. Enforces at most one APPROVED mapping. */
export function approveMapping(
  doc: PipelineDocument,
  nodeId: string,
  mappingId: string
): PipelineDocument {
  return mutateItem(doc, nodeId, (item) => ({
    ...item,
    kgMappings: (item.kgMappings || []).map((m) => {
      if (m.id === mappingId) {
        return { ...m, status: 'APPROVED' as MappingStatus, updatedAt: new Date().toISOString() };
      }
      // If we approve one, we demote any other APPROVED mappings to REJECTED
      // to avoid multiple active approved mappings for the same item.
      if (m.status === 'APPROVED') {
        return { ...m, status: 'REJECTED' as MappingStatus, updatedAt: new Date().toISOString() };
      }
      return m;
    }),
  }));
}

/** Reject a specific mapping by ID on a node. Does NOT delete the extracted item. */
export function rejectMapping(
  doc: PipelineDocument,
  nodeId: string,
  mappingId: string
): PipelineDocument {
  return mutateItem(doc, nodeId, (item) => ({
    ...item,
    kgMappings: (item.kgMappings || []).map((m) =>
      m.id === mappingId
        ? { ...m, status: 'REJECTED' as MappingStatus, updatedAt: new Date().toISOString() }
        : m
    ),
  }));
}

/** Remove a mapping entirely. The extracted item is NOT deleted. */
export function removeMapping(
  doc: PipelineDocument,
  nodeId: string,
  mappingId: string
): PipelineDocument {
  return mutateItem(doc, nodeId, (item) => ({
    ...item,
    kgMappings: (item.kgMappings || []).filter((m) => m.id !== mappingId),
  }));
}

/** Mark all mappings on a node as CREATE_NEW (admin wants a new curriculum unit). */
export function markAsCreateNew(doc: PipelineDocument, nodeId: string): PipelineDocument {
  const now = new Date().toISOString();
  const placeholder: TextbookMapping = {
    id: genId(),
    kgConceptId: '__CREATE_NEW__',
    kgConceptTitleSnapshot: 'Tạo đơn vị kiến thức mới',
    kgBreadcrumbSnapshot: 'Tạo mới',
    relationType: 'EXPLAINS',
    confidence: 1,
    status: 'CREATE_NEW',
    createdAt: now,
    updatedAt: now,
  };
  return mutateItem(doc, nodeId, (item) => ({
    ...item,
    kgMappings: [placeholder],
  }));
}

/** Mark an item as IRRELEVANT (admin wants to ignore this item). */
export function markAsIrrelevant(doc: PipelineDocument, nodeId: string): PipelineDocument {
  return mutateItem(doc, nodeId, (item) => ({
    ...item,
    mappingDisposition: 'IRRELEVANT',
  }));
}

/** Revert an item back to REQUIRED. */
export function markAsRequired(doc: PipelineDocument, nodeId: string): PipelineDocument {
  return mutateItem(doc, nodeId, (item) => ({
    ...item,
    mappingDisposition: 'REQUIRED',
  }));
}

// ─── Progress & Validation ────────────────────────────────────────────────────

/** Requires topic-level items (TOPIC, DEFINITION, FORMULA, THEOREM) to have at least one mapping. */
const REQUIRED_NODE_TYPES = new Set(['TOPIC', 'DEFINITION', 'FORMULA', 'THEOREM']);

/**
 * Compute mapping // progress for an entire document.
 */
export function getMappingProgress(doc: PipelineDocument): MappingProgress {
  let total = 0;
  let mapped = 0;
  let approved = 0;
  let needsReview = 0;
  let unmapped = 0;

  for (const item of walkItems(doc)) {
    if (item.reviewStatus === 'rejected') continue;
    if (!REQUIRED_NODE_TYPES.has(item.nodeType)) continue;

    // Legacy fallback: if mappingDisposition is undefined, it's REQUIRED
    const isIrrelevant = item.mappingDisposition === 'IRRELEVANT';
    if (isIrrelevant) {
      continue; // Doesn't count towards total required mappings
    }

    total++;

    const mappings = item.kgMappings || [];
    const hasMappings = mappings.length > 0;
    const hasApproved = mappings.some((m) => m.status === 'APPROVED');
    const hasNeedsReview = mappings.some((m) => m.status === 'NEEDS_REVIEW');
    const hasCreateNew = mappings.some((m) => m.status === 'CREATE_NEW');

    if (hasApproved) {
      mapped++;
      approved++;
    } else if (hasNeedsReview || hasCreateNew) {
      mapped++;
      needsReview++;
    } else if (hasMappings) {
      mapped++;
    } else {
      unmapped++;
    }
  }

  return {
    total,
    mapped,
    approved,
    needsReview,
    unmapped,
    completionPct: total === 0 ? 100 : Math.round((approved / total) * 100),
  };
}

/**
 * Validate all mappings in a document before publish.
 *
 * Rules:
 *   1. All REQUIRED_NODE_TYPES must have at least one non-rejected mapping.
 *   2. APPROVED mappings must reference an existing curriculum unit.
 *   3. No two items may have APPROVED mappings to the same unit with the same relationType.
 */
export async function validateMappings(doc: PipelineDocument): Promise<MappingValidationResult> {
  const result: MappingValidationResult = {
    valid: true,
    errors: [],
    // progress: getMappingProgress(doc),
  };
  const seenApproved = new Map<string, string>(); // `${unitId}:${relationType}` → nodeId

  for (const item of walkItems(doc)) {
    // Rule: Ignore rejected extracted items
    if (item.reviewStatus === 'rejected') continue;

    // Rule: Ignore pure container nodes
    if (!REQUIRED_NODE_TYPES.has(item.nodeType)) continue;

    // Rule: Ignore items explicitly marked IRRELEVANT
    if (item.mappingDisposition === 'IRRELEVANT') continue;

    const mappings = item.kgMappings || [];
    const activeMappings = mappings.filter((m) => m.status !== 'REJECTED');
    const hasApproved = activeMappings.some((m) => m.status === 'APPROVED');

    // Rule 1: Must have at least one approved mapping
    if (!hasApproved) {
      result.valid = false;
      result.errors.push({
        nodeId: item.id,
        nodeTitle: item.title,
        code: 'UNMAPPED_REQUIRED',
        message: `"${item.title}" chưa được liên kết với đơn vị kiến thức nào trong chương trình.`,
      });
      continue;
    }

    // Rule 2 & 3: For each approved mapping
    for (const mapping of activeMappings) {
      if (mapping.status === 'APPROVED') {
        // Rule 2: Must reference existing unit
        const exists = await kgNodeExists(mapping.kgConceptId);
        if (mapping.kgConceptId && mapping.kgConceptId !== '__CREATE_NEW__' && !exists) {
          result.valid = false;
          result.errors.push({
            nodeId: item.id,
            nodeTitle: item.title,
            code: 'INVALID_KG_REF',
            message: `"${item.title}" liên kết đến một đơn vị kiến thức không còn tồn tại.`,
          });
        }

        // Rule 3: No duplicate approved mappings
        const key = `${mapping.kgConceptId}:${mapping.relationType}`;
        const existingNodeId = seenApproved.get(key);
        if (existingNodeId && existingNodeId !== item.id) {
          result.valid = false;
          result.errors.push({
            nodeId: item.id,
            nodeTitle: item.title,
            code: 'DUPLICATE_MAPPING',
            message: `"${item.title}" có liên kết trùng lặp với một mục khác đến cùng đơn vị kiến thức.`,
          });
        } else {
          seenApproved.set(key, item.id);
        }
      }
    }

    // Rule: All mappings rejected = effectively unmapped
    const allRejected = mappings.every((m) => m.status === 'REJECTED');
    if (allRejected && mappings.length > 0) {
      result.valid = false;
      result.errors.push({
        nodeId: item.id,
        nodeTitle: item.title,
        code: 'REJECTED_MAPPING',
        message: `"${item.title}" có tất cả liên kết bị từ chối. Vui lòng chọn liên kết mới hoặc tạo đơn vị kiến thức mới.`,
      });
    }
  }

  return result;
}

/**
 * Find all documents that have an APPROVED mapping to a given curriculum unit.
 * Used for the "Related Textbook Sources" panel in the curriculum module.
 *
 * NOTE: In a DB-backed system this would be a query. Currently we scan
 * the given docs array (caller loads relevant docs).
 */
export interface TextbookSource {
  documentId: string;
  fileName: string;
  nodeId: string;
  nodeTitle: string;
  pageRange: { start: number; end: number };
  relationType: MappingRelationType;
  mappingStatus: MappingStatus;
  confidence: number;
}

export function findTextbookSources(
  docs: PipelineDocument[],
  kgConceptId: string
): TextbookSource[] {
  const sources: TextbookSource[] = [];
  for (const doc of docs) {
    if (doc.state !== 'PUBLISHED') continue;
    for (const item of walkItems(doc)) {
      if (item.reviewStatus === 'rejected') continue;
      if (item.mappingDisposition === 'IRRELEVANT') continue;
      for (const mapping of item.kgMappings || []) {
        if (mapping.kgConceptId === kgConceptId && mapping.status === 'APPROVED') {
          sources.push({
            documentId: doc.id,
            fileName: doc.fileName,
            nodeId: item.id,
            nodeTitle: item.title,
            pageRange: item.pageRange,
            relationType: mapping.relationType,
            mappingStatus: mapping.status,
            confidence: mapping.confidence,
          });
        }
      }
    }
  }
  return sources;
}
