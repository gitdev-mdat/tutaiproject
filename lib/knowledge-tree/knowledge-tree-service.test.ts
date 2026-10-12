import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// The service resolves data files from process.cwd() at import time, so point it
// at a scratch copy of the repository data before importing.
const realCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'tutai-kt-service-'));
type Service = typeof import('./knowledge-tree-service');
let service: Service;

beforeAll(async () => {
  for (const dir of ['knowledge-tree', 'knowledge-graph']) {
    fs.mkdirSync(path.join(scratch, 'data', dir), { recursive: true });
  }
  fs.copyFileSync(
    path.join(realCwd, 'data/knowledge-tree/tree.json'),
    path.join(scratch, 'data/knowledge-tree/tree.json')
  );
  fs.copyFileSync(
    path.join(realCwd, 'data/knowledge-graph/graph.json'),
    path.join(scratch, 'data/knowledge-graph/graph.json')
  );
  vi.spyOn(process, 'cwd').mockReturnValue(scratch);
  vi.resetModules();
  service = await import('./knowledge-tree-service');
});

afterAll(() => {
  vi.restoreAllMocks();
  fs.rmSync(scratch, { recursive: true, force: true });
});

const complete = {
  title: 'Hàm hợp',
  publishToLearning: true,
  blocks: [
    { id: '1', type: 'OBJECTIVE' as const, content: 'Nhận biết và tính đạo hàm hàm hợp.' },
    { id: '2', type: 'MAIN_CONTENT' as const, content: 'Nếu $y=f(u)$ và $u=g(x)$ thì ...' },
    { id: '3', type: 'EXAMPLE' as const, content: 'Tính đạo hàm của $y=(2x+1)^3$.' },
  ],
};

describe('knowledge article service (admin → student data flow)', () => {
  it('refuses to show an incomplete article to students and reports what is missing', async () => {
    await expect(
      service.saveKnowledgeArticle('node-8nls4j6rj', {
        ...complete,
        blocks: complete.blocks.slice(0, 1),
      })
    ).rejects.toMatchObject({ missing: ['MAIN_CONTENT', 'EXAMPLE'] });
  });

  it('saves drafts privately and READY when complete but not shown', async () => {
    const saved = await service.saveKnowledgeArticle('node-8nls4j6rj', {
      ...complete,
      publishToLearning: false,
    });
    expect(saved.status).toBe('READY');
    expect(await service.getVisibleLessonArticle('node-8nls4j6rj')).toBeNull();
  });

  it('publishes to the student catalog and persists to disk', async () => {
    const saved = await service.saveKnowledgeArticle('node-8nls4j6rj', complete);
    expect(saved.status).toBe('PUBLISHED');
    const catalog = await service.getLearningCatalog();
    const lessons = catalog.flatMap((s) =>
      s.grades.flatMap((g) => g.chapters.flatMap((c) => c.lessons))
    );
    expect(lessons.map((lesson) => lesson.id)).toContain('node-8nls4j6rj');
    const onDisk = JSON.parse(
      fs.readFileSync(path.join(scratch, 'data/knowledge-tree/articles.json'), 'utf8')
    );
    expect(onDisk.articles['node-8nls4j6rj'].publishToLearning).toBe(true);
  });

  it('cannot publish lessons inside an archived chapter', async () => {
    await expect(service.saveKnowledgeArticle('unit_1', complete)).rejects.toThrow('lưu trữ');
  });

  it('only stores articles on knowledge items', async () => {
    await expect(service.saveKnowledgeArticle('chap_3', complete)).rejects.toThrow(
      'Chỉ mục kiến thức'
    );
  });

  it('cascade-deletes a draft branch and its articles but keeps system data protected', async () => {
    const chapter = await service.createKnowledge({
      title: 'Chương thử',
      parentId: 'grade_12',
      kind: 'GROUP',
      nodeType: 'CHUONG',
    });
    expect(chapter.nodeType).toBe('CHUONG');
    const item = await service.createKnowledge({
      title: 'Mục thử',
      parentId: chapter.id,
      kind: 'KNOWLEDGE',
    });
    await service.saveKnowledgeArticle(item.id, { ...complete, publishToLearning: false });
    await expect(service.deleteKnowledge(chapter.id)).rejects.toThrow();
    await service.deleteKnowledge(chapter.id, { cascade: true });
    expect(await service.getKnowledgeArticle(item.id)).toBeNull();
    await expect(service.deleteKnowledge('chap_3', { cascade: true })).rejects.toThrow('canonical');
  });
});
