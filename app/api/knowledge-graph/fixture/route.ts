import { NextResponse } from 'next/server';
import {
  addKgNode,
  addLearningObjective,
  addConceptRelation,
  updateKgNode,
} from '@/lib/knowledge-graph/kg-service';
import {
  readKnowledgeGraph,
  writeKnowledgeGraph,
  clearStorageCache,
} from '@/lib/knowledge-graph/kg-storage';
import {
  KgSubject,
  KgGrade,
  KgDomain,
  KgConcept,
  BloomLevel,
  KgNode,
} from '@/lib/knowledge-graph/kg-types';

const FIXTURE_PROVENANCE = {
  sourceType: 'FIXTURE' as const,
  sourceId: 'kg-v1-math12-pilot',
};

export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Fixture can only be seeded in development mode' },
      { status: 403 }
    );
  }

  try {
    clearStorageCache();
    const doc = await readKnowledgeGraph();

    // 1. Subject
    let mathSubj = doc.subjects.find(
      (s: KgSubject) => s.title === 'Toán học' || s.slug === 'toan-hoc'
    );
    if (!mathSubj) {
      mathSubj = (await addKgNode(null, 'SUBJECT', 'Toán học')) as KgSubject;
    }
    await updateKgNode(mathSubj!.id, { _isFixture: true, provenance: FIXTURE_PROVENANCE });

    // 2. Grade
    // Need to re-read to get populated grades
    const doc2 = await readKnowledgeGraph();
    const updatedMathSubj = doc2.subjects.find((s) => s.id === mathSubj!.id)!;
    let grade12 = updatedMathSubj.grades?.find(
      (g: KgGrade) => g.title === 'Lớp 12' || g.slug === 'lop-12'
    );
    if (!grade12) {
      grade12 = (await addKgNode(mathSubj!.id, 'GRADE', 'Lớp 12')) as KgGrade;
    }
    await updateKgNode(grade12!.id, { _isFixture: true, provenance: FIXTURE_PROVENANCE });

    // 3. Domains
    const ensureDomain = async (title: string) => {
      const currentDoc = await readKnowledgeGraph();
      const currentMathSubj = currentDoc.subjects.find((s) => s.id === mathSubj!.id)!;
      const currentGrade12 = currentMathSubj.grades.find((g) => g.id === grade12!.id)!;
      let d = currentGrade12.domains.find((d: KgDomain) => d.title === title);
      if (!d) {
        d = (await addKgNode(grade12!.id, 'DOMAIN', title)) as KgDomain;
      }
      await updateKgNode(d!.id, { _isFixture: true, provenance: FIXTURE_PROVENANCE });
      return d;
    };

    const d1 = await ensureDomain('Đại số nền tảng');
    const d2 = await ensureDomain('Hàm số và ứng dụng đạo hàm');
    const d3 = await ensureDomain('Nguyên hàm và tích phân');

    // 4. Concepts
    const ensureConcept = async (domainId: string, title: string) => {
      const currentDoc = await readKnowledgeGraph();
      let found: KgConcept | undefined;
      const g = currentDoc.subjects
        .find((s) => s.id === mathSubj!.id)
        ?.grades.find((g) => g.id === grade12!.id);
      g?.domains.forEach((d) => {
        const c = d.concepts.find((c) => c.title === title);
        if (c) found = c;
      });

      if (!found) {
        found = (await addKgNode(domainId, 'CONCEPT', title)) as KgConcept;
      }
      await updateKgNode(found!.id, { _isFixture: true, provenance: FIXTURE_PROVENANCE });
      return found!;
    };

    const cHamSo = await ensureConcept(d1.id, 'Hàm số');
    const cBienDoi = await ensureConcept(d1.id, 'Biến đổi biểu thức đại số');
    const cHamHop = await ensureConcept(d2.id, 'Hàm hợp');
    const cDaoHam = await ensureConcept(d2.id, 'Đạo hàm');
    const cNguyenHam = await ensureConcept(d3.id, 'Nguyên hàm');
    await ensureConcept(d3.id, 'Tích phân');
    const cPhuongPhap = await ensureConcept(d3.id, 'Phương pháp đổi biến');

    // 5. Learning Objectives
    const ensureObjective = async (
      conceptId: string,
      bloomLevel: BloomLevel,
      statement: string
    ) => {
      const currentDoc = await readKnowledgeGraph();
      const exists = currentDoc.learningObjectives.find(
        (o) => o.conceptId === conceptId && o.statement === statement
      );
      if (!exists) {
        const obj = await addLearningObjective({
          conceptId,
          bloomLevel,
          statement,
          status: 'PUBLISHED',
          provenance: FIXTURE_PROVENANCE,
        });
        // Set _isFixture on objective directly in storage
        const docObj = await readKnowledgeGraph();
        const foundObj = docObj.learningObjectives.find((o) => o.id === obj.id);
        if (foundObj) {
          foundObj._isFixture = true;
          foundObj.provenance = FIXTURE_PROVENANCE;
          await writeKnowledgeGraph(docObj);
        }
      }
    };

    await ensureObjective(
      cNguyenHam.id,
      'REMEMBER',
      'Nhận biết được một hàm số là nguyên hàm của hàm số đã cho.'
    );
    await ensureObjective(
      cNguyenHam.id,
      'UNDERSTAND',
      'Giải thích được mối quan hệ giữa nguyên hàm và đạo hàm.'
    );
    await ensureObjective(
      cNguyenHam.id,
      'APPLY',
      'Áp dụng bảng nguyên hàm cơ bản để tính các nguyên hàm trực tiếp.'
    );

    await ensureObjective(
      cPhuongPhap.id,
      'UNDERSTAND',
      'Nhận biết được cấu trúc biểu thức phù hợp với phương pháp đổi biến.'
    );
    await ensureObjective(
      cPhuongPhap.id,
      'APPLY',
      'Lựa chọn được biểu thức đổi biến phù hợp trong các nguyên hàm cơ bản.'
    );

    // 6. Prerequisite Relations (sourceConceptId is learned before targetConceptId)
    const ensureRelation = async (sourceId: string, targetId: string) => {
      const currentDoc = await readKnowledgeGraph();
      const exists = currentDoc.conceptRelations.find(
        (r) =>
          r.sourceConceptId === sourceId &&
          r.targetConceptId === targetId &&
          r.type === 'PREREQUISITE'
      );
      if (!exists) {
        const rel = await addConceptRelation({
          sourceConceptId: sourceId,
          targetConceptId: targetId,
          type: 'PREREQUISITE',
          status: 'PUBLISHED',
          provenance: FIXTURE_PROVENANCE,
        });
        const docRel = await readKnowledgeGraph();
        const foundRel = docRel.conceptRelations.find((r) => r.id === rel.id);
        if (foundRel) {
          foundRel._isFixture = true;
          foundRel.provenance = FIXTURE_PROVENANCE;
          await writeKnowledgeGraph(docRel);
        }
      }
    };

    await ensureRelation(cHamSo.id, cDaoHam.id);
    await ensureRelation(cHamHop.id, cPhuongPhap.id);
    await ensureRelation(cDaoHam.id, cPhuongPhap.id);
    await ensureRelation(cNguyenHam.id, cPhuongPhap.id);
    await ensureRelation(cBienDoi.id, cPhuongPhap.id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Fixture can only be reset in development mode' },
      { status: 403 }
    );
  }

  try {
    clearStorageCache();
    const doc = await readKnowledgeGraph();

    // 1. Identify all fixture entities to be deleted
    const fixtureNodeIds = new Set<string>();
    const fixtureObjectives = new Set<string>();
    const fixtureRelations = new Set<string>();
    const fixtureMemberships = new Set<string>();

    const findFixtureNodes = (nodes: KgNode[]) => {
      for (const node of nodes) {
        if (
          node.provenance?.sourceType === 'FIXTURE' &&
          node.provenance?.sourceId === 'kg-v1-math12-pilot'
        ) {
          fixtureNodeIds.add(node.id);
        }
        if (node.type === 'SUBJECT' && node.grades) findFixtureNodes(node.grades);
        if (node.type === 'GRADE' && node.domains) findFixtureNodes(node.domains);
        if (node.type === 'DOMAIN' && node.concepts) findFixtureNodes(node.concepts);
      }
    };
    findFixtureNodes(doc.subjects);

    doc.learningObjectives.forEach((o) => {
      if (
        o.provenance?.sourceType === 'FIXTURE' &&
        o.provenance?.sourceId === 'kg-v1-math12-pilot'
      ) {
        fixtureObjectives.add(o.id);
      }
    });

    doc.conceptRelations.forEach((r) => {
      if (
        r.provenance?.sourceType === 'FIXTURE' &&
        r.provenance?.sourceId === 'kg-v1-math12-pilot'
      ) {
        fixtureRelations.add(r.id);
      }
    });

    doc.domainMemberships.forEach((m) => {
      if (
        m.provenance?.sourceType === 'FIXTURE' &&
        m.provenance?.sourceId === 'kg-v1-math12-pilot'
      ) {
        fixtureMemberships.add(m.id);
      }
    });

    // 2. Scan for non-fixture dependencies on fixture nodes
    const blockingReasons: string[] = [];

    const checkNodeDependencies = (nodes: KgNode[], parentNode: KgNode | null) => {
      for (const node of nodes) {
        const isFixture = fixtureNodeIds.has(node.id);
        if (!isFixture) {
          if (parentNode && fixtureNodeIds.has(parentNode.id)) {
            blockingReasons.push(
              `Non-fixture node '${node.title}' (${node.id}) depends on parent fixture node '${parentNode.title}' (${parentNode.id})`
            );
          }
        }
        if (node.type === 'SUBJECT' && node.grades) checkNodeDependencies(node.grades, node);
        if (node.type === 'GRADE' && node.domains) checkNodeDependencies(node.domains, node);
        if (node.type === 'DOMAIN' && node.concepts) checkNodeDependencies(node.concepts, node);
      }
    };
    checkNodeDependencies(doc.subjects, null);

    // Check non-fixture learning objectives
    doc.learningObjectives.forEach((o) => {
      if (!fixtureObjectives.has(o.id)) {
        if (fixtureNodeIds.has(o.conceptId)) {
          blockingReasons.push(
            `Non-fixture Learning Objective '${o.statement}' (${o.id}) depends on fixture Concept (${o.conceptId})`
          );
        }
      }
    });

    // Check non-fixture concept relations
    doc.conceptRelations.forEach((r) => {
      if (!fixtureRelations.has(r.id)) {
        if (fixtureNodeIds.has(r.sourceConceptId)) {
          blockingReasons.push(
            `Non-fixture Concept Relation (${r.id}) has source Concept (${r.sourceConceptId}) which is a fixture`
          );
        }
        if (fixtureNodeIds.has(r.targetConceptId)) {
          blockingReasons.push(
            `Non-fixture Concept Relation (${r.id}) has target Concept (${r.targetConceptId}) which is a fixture`
          );
        }
      }
    });

    // If there are blocking dependencies, reject the reset
    if (blockingReasons.length > 0) {
      return NextResponse.json(
        {
          error: 'Reset blocked due to manual/imported dependencies on fixture entities.',
          details: blockingReasons,
        },
        { status: 400 }
      );
    }

    // 3. Remove fixture objectives, relations, domainMemberships
    doc.learningObjectives = doc.learningObjectives.filter((o) => !fixtureObjectives.has(o.id));
    doc.conceptRelations = doc.conceptRelations.filter((r) => !fixtureRelations.has(r.id));
    doc.domainMemberships = doc.domainMemberships.filter((m) => !fixtureMemberships.has(m.id));

    // Helper to filter nodes recursively
    const filterNodes = <T extends KgNode>(nodes: T[]): T[] => {
      return nodes
        .filter((n) => !fixtureNodeIds.has(n.id))
        .map((n) => {
          const clone = { ...n };
          if (clone.type === 'SUBJECT' && clone.grades) {
            clone.grades = filterNodes(clone.grades) as KgGrade[];
          }
          if (clone.type === 'GRADE' && clone.domains) {
            clone.domains = filterNodes(clone.domains) as KgDomain[];
          }
          if (clone.type === 'DOMAIN' && clone.concepts) {
            clone.concepts = filterNodes(clone.concepts) as KgConcept[];
          }
          return clone;
        });
    };

    doc.subjects = filterNodes(doc.subjects);

    await writeKnowledgeGraph(doc);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
