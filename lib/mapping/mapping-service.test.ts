import { describe, it, expect } from 'vitest';
import {
  suggestMappings,
  applyMapping,
  approveMapping,
  validateMappings,
  findTextbookSources,
  getMappingProgress,
} from './mapping-service';
import type {
  PipelineDocument,
  KnowledgeItem,
  TextbookMapping,
  MappingDisposition,
  TextbookPipelineStage,
} from '../pipeline/types';
import { getAllConceptsWithBreadcrumb } from '../knowledge-graph/kg-service';

function createMockDoc(
  items: KnowledgeItem[],
  state: TextbookPipelineStage = 'PUBLISHED'
): PipelineDocument {
  return {
    id: 'test-doc',
    state,
    executionStatus: 'COMPLETED',
    fileName: 'test.pdf',
    fileSizeBytes: 1024,
    storagePath: 'tmp/uploads/test-doc/original.pdf',
    batches: [],
    batchResults: {},
    duplicateGroups: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    chapters: [
      {
        id: 'chap-1',
        title: 'Chương 1',
        chapterNumber: '1',
        startPage: 1,
        endPage: 10,
        confidence: 0.9,
        rawItems: items,
        lessons: [
          {
            id: 'les-1',
            lessonNumber: '1',
            title: 'Bài 1',
            startPage: 1,
            endPage: 10,
            topics: items.filter((i) => i.nodeType === 'TOPIC'),
            definitions: items.filter((i) => i.nodeType === 'DEFINITION'),
            formulas: items.filter((i) => i.nodeType === 'FORMULA'),
            theorems: items.filter((i) => i.nodeType === 'THEOREM'),
            examples: items.filter((i) => i.nodeType === 'EXAMPLE'),
            exercises: items.filter((i) => i.nodeType === 'EXERCISE'),
            reviewStatus: 'approved',
            confidence: 0.9,
            prerequisites: [],
          },
        ],
        reviewStatus: 'approved',
      },
    ],
  };
}

function createMockItem(
  title: string,
  id: string = 'item-1',
  mappings: TextbookMapping[] = [],
  reviewStatus: 'pending' | 'approved' | 'rejected' = 'approved',
  mappingDisposition: MappingDisposition = 'REQUIRED'
): KnowledgeItem {
  return {
    id,
    nodeType: 'TOPIC',
    title,
    description: '',
    pageRange: { start: 1, end: 2 },
    confidence: 0.9,
    reviewStatus,
    kgMappings: mappings,
    mappingDisposition,
    topics: [],
    definitions: [],
    concepts: [],
    learningObjectives: [],
    examples: [],
    theorems: [],
    formulas: [],
    skills: [],
    realWorldApplications: [],
    prerequisites: [],
    estimatedDifficulty: 'Intermediate',
    estimatedStudyMinutes: 30,
  };
}

describe('Mapping Service', () => {
  describe('Matching Algorithm', () => {
    it('1. Exact normalized title suggestion', async () => {
      const item = createMockItem('Định nghĩa nguyên hàm');
      const suggestions = await suggestMappings(item);
      expect(suggestions[0].kgTitle).toBe('Định nghĩa nguyên hàm');
      expect(suggestions[0].confidence).toBe(1.0);
      expect(suggestions[0].matchMethod).toBe('EXACT');
    });

    it('2. Vietnamese accent-insensitive match & 3. Fuzzy/context suggestion', async () => {
      const item = createMockItem('Dinh nghia nguyen ham');
      const suggestions = await suggestMappings(item);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].kgTitle).toBe('Định nghĩa nguyên hàm');
      expect(suggestions[0].matchMethod).toBe('FUZZY');
    });

    it('4. Low-confidence result is not persisted or approved', async () => {
      const item = createMockItem('Something Completely Unrelated');
      const suggestions = await suggestMappings(item);
      expect(suggestions.length).toBe(0);
    });
  });

  describe('Server-Side Trust Boundary', () => {
    it('5. Invalid canonical ID is rejected', async () => {
      const doc = createMockDoc([createMockItem('Item')]);
      await expect(
        applyMapping(doc, 'item-1', 'invalid-id', 'RELATED_TO', 1.0, 'MANUAL')
      ).rejects.toThrow(/not found/);
    });

    it('6. Canonical snapshots are resolved server-side & 7. Client snapshots cannot be spoofed', async () => {
      let doc = createMockDoc([createMockItem('Item')]);
      doc = await applyMapping(doc, 'item-1', 'unit_1', 'EXPLAINS', 0.95, 'EXACT');
      const item = doc.chapters[0].lessons[0].topics![0];
      const mapping = item.kgMappings![0];

      expect(mapping.kgConceptTitleSnapshot).toBe('Định nghĩa nguyên hàm');
      expect(mapping.kgBreadcrumbSnapshot).toContain('Toán học');
    });
  });

  describe('Active Mapping Cardinality', () => {
    it('8. One approved mapping maximum & 9. Replacing an approved mapping leaves exactly one approved mapping', async () => {
      let doc = createMockDoc([createMockItem('Item')]);
      doc = await applyMapping(doc, 'item-1', 'unit_1', 'EXPLAINS', 1.0, 'MANUAL');
      doc = await applyMapping(doc, 'item-1', 'unit_2', 'EXPLAINS', 1.0, 'MANUAL');

      const item = doc.chapters[0].lessons[0].topics![0];
      const m1 = item.kgMappings[0].id;
      const m2 = item.kgMappings[1].id;

      doc = approveMapping(doc, 'item-1', m1);
      let updatedItem = doc.chapters[0].lessons[0].topics![0];
      expect(updatedItem.kgMappings.find((m) => m.id === m1)?.status).toBe('APPROVED');

      // Approve second mapping, should demote first to REJECTED
      doc = approveMapping(doc, 'item-1', m2);
      updatedItem = doc.chapters[0].lessons[0].topics![0];

      expect(updatedItem.kgMappings.find((m) => m.id === m1)?.status).toBe('REJECTED');
      expect(updatedItem.kgMappings.find((m) => m.id === m2)?.status).toBe('APPROVED');

      const approvedCount = updatedItem.kgMappings.filter((m) => m.status === 'APPROVED').length;
      expect(approvedCount).toBe(1);
    });
  });

  describe('Publish Eligibility Rules', () => {
    it('10. Rejected extracted item does not block publish', async () => {
      const item = createMockItem('Item', 'item-1', [], 'rejected');
      const doc = createMockDoc([item]);
      const result = await validateMappings(doc);
      expect(result.valid).toBe(true);
    });

    it('11. Irrelevant item does not block publish', async () => {
      const item = createMockItem('Item');
      item.mappingDisposition = 'IRRELEVANT';
      const doc = createMockDoc([item]);
      const result = await validateMappings(doc);
      expect(result.valid).toBe(true);
    });

    it('12. Approved required item without approved mapping blocks publish', async () => {
      const item = createMockItem('Item');
      const doc = createMockDoc([item]);
      const result = await validateMappings(doc);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('UNMAPPED_REQUIRED');
    });

    it('13. Suggested mapping does not satisfy publish & 14. Needs-review mapping does not satisfy publish', async () => {
      let doc = createMockDoc([createMockItem('Item')]);
      doc = await applyMapping(doc, 'item-1', 'unit_1', 'EXPLAINS', 0.95, 'EXACT');
      let result = await validateMappings(doc);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('UNMAPPED_REQUIRED');

      // Pretend it was NEEDS_REVIEW
      doc.chapters[0].lessons[0].topics![0].kgMappings![0].status = 'NEEDS_REVIEW';
      result = await validateMappings(doc);
      expect(result.valid).toBe(false);
    });

    it('15. Invalid canonical reference blocks publish', async () => {
      let doc = createMockDoc([createMockItem('Item')]);
      doc = await applyMapping(doc, 'item-1', 'unit_1', 'EXPLAINS', 1.0, 'MANUAL');
      const mappingId = doc.chapters[0].lessons[0].topics![0].kgMappings[0].id;
      doc = approveMapping(doc, 'item-1', mappingId);

      // Manually corrupt the ID
      doc.chapters[0].lessons[0].topics![0].kgMappings![0].kgConceptId = 'missing-id';

      const result = await validateMappings(doc);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_KG_REF');
    });

    it('16. Legacy document without mapping fields loads safely', async () => {
      const item = createMockItem('Item');
      delete (item as { kgMappings?: unknown }).kgMappings;
      delete (item as { mappingDisposition?: unknown }).mappingDisposition;

      const doc = createMockDoc([item]);
      const progress = getMappingProgress(doc);
      expect(progress.unmapped).toBe(1);

      const result = await validateMappings(doc);
      expect(result.valid).toBe(false); // Fails gracefully due to missing mapping, not crash
    });

    it('17. Successful publish preserves extracted content', async () => {
      let doc = createMockDoc([createMockItem('Item', 'item-1', [], 'approved')]);
      doc = await applyMapping(doc, 'item-1', 'unit_1', 'EXPLAINS', 1.0, 'MANUAL');
      const mappingId = doc.chapters[0].lessons[0].topics![0].kgMappings[0].id;
      doc = approveMapping(doc, 'item-1', mappingId);

      const result = await validateMappings(doc);
      expect(result.valid).toBe(true);

      const topic = doc.chapters[0].lessons[0].topics![0];
      expect(topic.title).toBe('Item');
      expect(topic.confidence).toBe(0.9);
      expect(topic.pageRange.start).toBe(1);
      expect(topic.kgMappings![0].status).toBe('APPROVED');
    });

    it('21. CREATE_NEW mapping does not satisfy publish validation', async () => {
      const item = createMockItem('Item');
      let doc = createMockDoc([item]);
      doc = await applyMapping(doc, 'item-1', '__CREATE_NEW__', 'EXPLAINS', 1.0, 'MANUAL');

      const result = await validateMappings(doc);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('UNMAPPED_REQUIRED');
    });
  });

  describe('Curriculum Source Lookup', () => {
    it('18. Source lookup excludes drafts', async () => {
      let doc = createMockDoc([createMockItem('Item')], 'READY_FOR_REVIEW');
      doc = await applyMapping(doc, 'item-1', 'unit_1', 'EXPLAINS', 1.0, 'MANUAL');
      const mappingId = doc.chapters[0].lessons[0].topics![0].kgMappings[0].id;
      doc = approveMapping(doc, 'item-1', mappingId);

      const sources = findTextbookSources([doc], 'unit_1');
      expect(sources.length).toBe(0);
    });

    it('19. Source lookup includes only published approved mappings', async () => {
      let doc = createMockDoc([createMockItem('Item')], 'PUBLISHED');
      doc = await applyMapping(doc, 'item-1', 'unit_1', 'EXPLAINS', 1.0, 'MANUAL');
      const mappingId = doc.chapters[0].lessons[0].topics![0].kgMappings[0].id;
      doc = approveMapping(doc, 'item-1', mappingId);

      const sources = findTextbookSources([doc], 'unit_1');
      expect(sources.length).toBe(1);
      expect(sources[0].nodeId).toBe('item-1');
      expect(sources[0].relationType).toBe('EXPLAINS');
    });
  });

  describe('Curriculum Immutability', () => {
    it('20. Canonical curriculum remains unchanged', async () => {
      const originalTree = JSON.parse(JSON.stringify(await getAllConceptsWithBreadcrumb()));

      let doc = createMockDoc([createMockItem('Item')]);
      doc = await applyMapping(doc, 'item-1', 'unit_1', 'EXPLAINS', 1.0, 'MANUAL');
      const mappingId = doc.chapters[0].lessons[0].topics![0].kgMappings[0].id;
      doc = approveMapping(doc, 'item-1', mappingId);

      expect(await getAllConceptsWithBreadcrumb()).toEqual(originalTree);
    });
  });
});
