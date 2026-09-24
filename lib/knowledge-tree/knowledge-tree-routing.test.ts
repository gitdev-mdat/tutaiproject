import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function source(file: string) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

describe('Knowledge Tree routing and safety surface', () => {
  it('owns /admin/knowledge without the retired textbook routes', () => {
    expect(source('app/admin/knowledge/page.tsx')).toContain('KnowledgeTreeManager');
    expect(fs.existsSync(path.join(root, 'app/admin/knowledge-graph/page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'app/admin/textbooks/page.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'app/admin/textbooks/[docId]/page.tsx'))).toBe(false);
  });

  it('contains no provider, review-session, Controlled Import, or graph-write dependency', () => {
    const files = [
      'lib/knowledge-tree/knowledge-tree.ts',
      'lib/knowledge-tree/knowledge-tree-storage.ts',
      'lib/knowledge-tree/knowledge-tree-service.ts',
      'app/api/knowledge-tree/route.ts',
      'app/api/knowledge-tree/[nodeId]/route.ts',
      'app/api/knowledge-tree/[nodeId]/move/route.ts',
    ];
    const combined = files
      .filter((file) => fs.existsSync(path.join(root, file)))
      .map(source)
      .join('\n');
    expect(combined).not.toMatch(
      /gemini|ai-gateway|knowledge-auto-review|review session|Controlled Import/i
    );
    expect(combined).not.toContain('writeKnowledgeGraph');
    expect(combined).not.toContain('saveMapping');
  });
});
