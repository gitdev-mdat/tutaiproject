import type { KnowledgeTreeImportDraft, KnowledgeNodeType } from './knowledge-tree-types';

export interface ImportPreviewNode {
  temporaryId: string;
  title: string;
  description?: string;
  parentTemporaryId: string | null;
  order: number;
  kind: 'GROUP' | 'KNOWLEDGE';
  nodeType?: KnowledgeNodeType;
  depth: number;
}

export interface ImportPreviewResult {
  nodes: ImportPreviewNode[];
  warnings: string[];
}

const LIST_MARKER =
  /^(?:(?:[-*+•●▪◦‣∙·]|\d+[.)])\s*|(?:[\uF000-\uF0FF]|�)+\s*(?:[-*+•●▪◦‣∙·]\s*)?)/u;

/** Makes clipboard text predictable without changing its meaningful content. */
export function normalizeCurriculumImport(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[\u200b\ufeff]/g, '')
    .split('\n')
    .map((line) => {
      // Tabs are formatting in copied outlines; hierarchy is defined only by headings.
      let normalized = line.replace(/\t/g, '  ').trim();
      if (!/^#{1,2}\s+/u.test(normalized)) normalized = normalized.replace(LIST_MARKER, '').trim();
      return normalized.trimEnd();
    })
    .join('\n');
}

/** Parses normalized curriculum text: headings are chapters, all following lines are items. */
export function parseOutlineText(text: string): ImportPreviewResult {
  const lines = normalizeCurriculumImport(text).split('\n');
  const warnings: string[] = [];
  const nodes: ImportPreviewNode[] = [];
  let currentChapter: ImportPreviewNode | null = null;
  let tempIdCounter = 1;
  let contentBeforeChapter = 0;
  const chapterTitles = new Set<string>();
  const itemTitlesByChapter = new Map<string, Set<string>>();

  lines.forEach((line, index) => {
    if (!line) return;
    const heading = line.match(/^#{1,2}\s+(.+)$/u);

    if (heading) {
      const title = heading[1].trim();
      if (!title) return;
      const temporaryId = `temp-${tempIdCounter++}`;
      const normalizedTitle = title.toLocaleLowerCase('vi');
      if (chapterTitles.has(normalizedTitle)) {
        warnings.push(`Phát hiện tên chương có thể trùng lặp: "${title}" (dòng ${index + 1})`);
      }
      chapterTitles.add(normalizedTitle);
      currentChapter = {
        temporaryId,
        title,
        parentTemporaryId: null,
        order: nodes.filter((node) => node.parentTemporaryId === null).length + 1,
        kind: 'GROUP',
        nodeType: 'CHUONG',
        depth: 0,
      };
      nodes.push(currentChapter);
      itemTitlesByChapter.set(temporaryId, new Set());
      return;
    }

    if (!currentChapter) {
      contentBeforeChapter += 1;
      return;
    }

    const titles = itemTitlesByChapter.get(currentChapter.temporaryId)!;
    const normalizedTitle = line.toLocaleLowerCase('vi');
    if (titles.has(normalizedTitle)) {
      warnings.push(`Phát hiện tên nội dung có thể trùng lặp: "${line}" (dòng ${index + 1})`);
    }
    titles.add(normalizedTitle);
    nodes.push({
      temporaryId: `temp-${tempIdCounter++}`,
      title: line,
      parentTemporaryId: currentChapter.temporaryId,
      order:
        nodes.filter((node) => node.parentTemporaryId === currentChapter!.temporaryId).length + 1,
      kind: 'KNOWLEDGE',
      nodeType: 'KIEN_THUC',
      depth: 1,
    });
  });

  if (contentBeforeChapter > 0) {
    warnings.unshift('Có nội dung nằm trước tiêu đề chương và chưa được nhập.');
  }
  return { nodes, warnings };
}

export function createImportDraft(preview: ImportPreviewResult): KnowledgeTreeImportDraft {
  return {
    id: `draft-${Date.now()}`,
    format: 'MARKDOWN',
    status: 'REVIEWED',
    createdAt: new Date().toISOString(),
    nodes: preview.nodes.map((n) => ({
      temporaryId: n.temporaryId,
      title: n.title,
      description: n.description,
      parentTemporaryId: n.parentTemporaryId,
      order: n.order,
      kind: n.kind,
      nodeType: n.nodeType,
    })),
  };
}
