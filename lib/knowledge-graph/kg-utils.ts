import { KgDocument, KgBaseNode, KgNode } from './kg-types';

export function* walkKgNodes(
  doc: KgDocument
): Generator<{ node: KgNode; parent: KgNode | null; level: number }> {
  for (const subject of doc.subjects) {
    yield { node: subject, parent: null, level: 0 };
    for (const grade of subject.grades) {
      yield { node: grade, parent: subject, level: 1 };
      for (const domain of grade.domains) {
        yield { node: domain, parent: grade, level: 2 };
        for (const concept of domain.concepts) {
          yield { node: concept, parent: domain, level: 3 };
        }
      }
    }
  }
}

export function sortKgNodes<T extends KgBaseNode>(nodes: T[]): T[] {
  return [...nodes].sort((a, b) => a.order - b.order);
}
