import fs from 'fs';
import path from 'path';
import {
  KgDocument,
  ConceptDomainMembership,
  KgSubject,
  KgGrade,
  KgDomain,
  KgConcept,
  LearningObjective,
  ConceptRelation,
  EntityProvenance,
  KgNode,
} from './kg-types';

let DATA_DIR = path.join(process.cwd(), 'data', 'knowledge-graph');
let FILE_PATH = path.join(DATA_DIR, 'graph.json');
const LEGACY_FILE_PATH = path.join(process.cwd(), 'data', 'curriculum', 'curriculum.json');

export function setTestStoragePath(testDir: string | null): void {
  if (testDir) {
    DATA_DIR = testDir;
    FILE_PATH = path.join(DATA_DIR, 'graph.json');
  } else {
    DATA_DIR = path.join(process.cwd(), 'data', 'knowledge-graph');
    FILE_PATH = path.join(DATA_DIR, 'graph.json');
  }
  cachedData = null;
}

const INITIAL_DATA: KgDocument = {
  schemaVersion: 3,
  updatedAt: new Date().toISOString(),
  subjects: [],
  learningObjectives: [],
  conceptRelations: [],
  domainMemberships: [],
};

let cachedData: KgDocument | null = null;

export function clearStorageCache(): void {
  cachedData = null;
}

export async function readKnowledgeGraph(): Promise<KgDocument> {
  if (cachedData) return cachedData;

  // Ensure new directory exists
  try {
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }

  try {
    const raw = await fs.promises.readFile(FILE_PATH, 'utf-8');
    let data = JSON.parse(raw) as KgDocument;

    // Migrate V2 to V3
    if (data.schemaVersion === 2 || !data.schemaVersion) {
      data = migrateV2ToV3(data);
      await writeKnowledgeGraph(data);
    }

    ensureProvenanceMigration(data);

    cachedData = data;
    return cachedData;
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      // Attempt migration from old curriculum.json if it exists
      try {
        const legacyRaw = await fs.promises.readFile(LEGACY_FILE_PATH, 'utf-8');
        const legacyData = JSON.parse(legacyRaw);
        const v2Data = migrateCurriculumToKg(legacyData);
        const v3Data = migrateV2ToV3(v2Data);
        ensureProvenanceMigration(v3Data);
        await writeKnowledgeGraph(v3Data); // Save as new format
        return v3Data;
      } catch {
        // No legacy data, return initial
        cachedData = INITIAL_DATA;
        return INITIAL_DATA;
      }
    }
    throw err;
  }
}

export function ensureProvenanceMigration(doc: KgDocument): void {
  const migrateProvenance = (entity: { _isFixture?: boolean; provenance?: EntityProvenance }) => {
    if (entity && entity._isFixture && !entity.provenance) {
      entity.provenance = {
        sourceType: 'FIXTURE',
        sourceId: 'kg-v1-math12-pilot',
      };
    }
  };

  const migrateNodes = (nodes: KgNode[]) => {
    for (const node of nodes) {
      migrateProvenance(node);
      if (node.type === 'SUBJECT' && node.grades) migrateNodes(node.grades);
      if (node.type === 'GRADE' && node.domains) migrateNodes(node.domains);
      if (node.type === 'DOMAIN' && node.concepts) migrateNodes(node.concepts);
    }
  };

  if (doc.subjects) migrateNodes(doc.subjects);
  if (doc.learningObjectives) doc.learningObjectives.forEach(migrateProvenance);
  if (doc.conceptRelations) doc.conceptRelations.forEach(migrateProvenance);
  if (doc.domainMemberships) doc.domainMemberships.forEach(migrateProvenance);
}

async function safeRename(src: string, dest: string): Promise<void> {
  let retries = 10;
  while (retries > 0) {
    try {
      await fs.promises.rename(src, dest);
      return;
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'EPERM' || nodeErr.code === 'EBUSY') {
        retries--;
        await new Promise((resolve) => setTimeout(resolve, 100));
      } else {
        throw err;
      }
    }
  }
  await fs.promises.rename(src, dest);
}

export async function writeKnowledgeGraph(data: KgDocument): Promise<void> {
  cachedData = data;
  data.updatedAt = new Date().toISOString();

  await fs.promises.mkdir(DATA_DIR, { recursive: true });

  const tempFile = `${FILE_PATH}.tmp`;
  await fs.promises.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf-8');
  await safeRename(tempFile, FILE_PATH);
}

// ─── Migration Logic ─────────────────────────────────────────────────────────

type LegacyConceptV2 = Omit<KgConcept, 'primaryDomainId'> & {
  description?: string;
  prerequisiteIds?: string[];
  learningObjectives?: unknown[];
};
type LegacyDomainV2 = KgDomain & { description?: string; concepts?: LegacyConceptV2[] };
type LegacyGradeV2 = KgGrade & { description?: string; domains?: LegacyDomainV2[] };
type LegacySubjectV2 = KgSubject & { description?: string; grades?: LegacyGradeV2[] };

function migrateV2ToV3(v2Data: unknown): KgDocument {
  const data = v2Data as {
    subjects?: LegacySubjectV2[];
    learningObjectives?: unknown[];
    conceptRelations?: unknown[];
  };
  const domainMemberships: ConceptDomainMembership[] = [];

  const traverseAndMigrate = (subjects: LegacySubjectV2[]) => {
    for (const subject of subjects) {
      subject.description = subject.description || '';
      for (const grade of subject.grades || []) {
        grade.subjectId = subject.id;
        grade.description = grade.description || '';
        for (const domain of grade.domains || []) {
          domain.subjectId = subject.id;
          domain.gradeId = grade.id;
          domain.description = domain.description || '';

          for (const concept of domain.concepts || []) {
            (concept as KgConcept).primaryDomainId = domain.id;
            concept.aliases = concept.aliases || [];

            if (concept.description !== undefined) {
              concept.detailedDescription = concept.description;
              delete concept.description;
            }
            concept.shortDescription = concept.shortDescription || '';

            // Prerequisite mapping to relations will be skipped since V2 prerequisiteIds were loose.
            // But if we want to migrate them:
            delete concept.prerequisiteIds;
            delete concept.learningObjectives; // Legacy arrays

            // Add primary membership explicitly
            domainMemberships.push({
              id: `mem-${concept.id}-${domain.id}`,
              conceptId: concept.id,
              domainId: domain.id,
              role: 'PRIMARY',
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    }
  };

  traverseAndMigrate(data.subjects || []);

  return {
    schemaVersion: 3,
    updatedAt: new Date().toISOString(),
    subjects: (data.subjects || []) as KgSubject[],
    learningObjectives: (data.learningObjectives || []) as unknown as LearningObjective[],
    conceptRelations: (data.conceptRelations || []) as unknown as ConceptRelation[],
    domainMemberships: domainMemberships,
  };
}

type LegacyKu = {
  id: string;
  title: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  content?: string;
  prerequisiteIds?: string[];
};
type LegacyLesson = { knowledgeUnits?: LegacyKu[] };
type LegacyChapter = {
  id: string;
  title: string;
  slug: string;
  order: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  lessons?: LegacyLesson[];
};
type LegacyGradeCurriculum = {
  id: string;
  title: string;
  slug: string;
  order: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  chapters?: LegacyChapter[];
};
type LegacySubjectCurriculum = {
  id: string;
  title: string;
  slug: string;
  order: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  grades?: LegacyGradeCurriculum[];
};

function migrateCurriculumToKg(legacyData: unknown): unknown {
  const data = legacyData as { subjects?: LegacySubjectCurriculum[] };
  const newSubjects = (data.subjects || []).map((subj: LegacySubjectCurriculum) => ({
    id: subj.id,
    title: subj.title,
    slug: subj.slug,
    order: subj.order,
    status: subj.status as 'PUBLISHED',
    createdAt: subj.createdAt,
    updatedAt: subj.updatedAt,
    type: 'SUBJECT',
    grades: (subj.grades || []).map((grade: LegacyGradeCurriculum) => ({
      id: grade.id,
      title: grade.title,
      slug: grade.slug,
      order: grade.order,
      status: grade.status as 'PUBLISHED',
      createdAt: grade.createdAt,
      updatedAt: grade.updatedAt,
      type: 'GRADE',
      subjectId: subj.id,
      domains: (grade.chapters || []).map((chapter: LegacyChapter) => ({
        id: chapter.id,
        title: chapter.title,
        slug: chapter.slug,
        order: chapter.order,
        status: chapter.status as 'PUBLISHED',
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
        type: 'DOMAIN',
        subjectId: subj.id,
        gradeId: grade.id,
        concepts: flattenLessonsToConcepts(chapter.lessons || []),
      })),
    })),
  })) as unknown as KgSubject[];

  return {
    schemaVersion: 2, // 2 = Knowledge Graph
    updatedAt: new Date().toISOString(),
    subjects: newSubjects,
  };
}

function flattenLessonsToConcepts(lessons: LegacyLesson[]): unknown[] {
  const concepts: unknown[] = [];
  let orderCounter = 1;
  for (const lesson of lessons) {
    const kus = lesson.knowledgeUnits || [];
    for (const ku of kus) {
      concepts.push({
        id: ku.id,
        title: ku.title,
        slug: ku.slug,
        order: orderCounter++,
        status: ku.status as 'PUBLISHED',
        createdAt: ku.createdAt,
        updatedAt: ku.updatedAt,
        type: 'CONCEPT',
        description: ku.content || '',
        prerequisiteIds: ku.prerequisiteIds || [],
        learningObjectives: [],
      } as unknown);
    }
  }
  return concepts;
}
