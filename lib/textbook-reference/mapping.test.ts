import { describe, expect, it } from 'vitest';
import { mappingCoversEntries } from './extraction-service';

describe('confirmed textbook mappings', () => {
  const tocEntries = [
    { id: 'root', parentId: null },
    { id: 'theory', parentId: 'root' },
    { id: 'examples', parentId: 'root' },
  ];

  it('allows extraction from a selected subsection covered by a confirmed mapped parent', () => {
    expect(
      mappingCoversEntries(
        { tocEntries },
        [{ documentId: 'doc', knowledgeNodeId: 'node', entryId: 'root', status: 'CONFIRMED' }],
        'doc',
        'node',
        [tocEntries[1]]
      )
    ).toBe(true);
  });

  it('does not treat a confirmed sibling as a mapping for the requested section', () => {
    expect(
      mappingCoversEntries(
        { tocEntries },
        [{ documentId: 'doc', knowledgeNodeId: 'node', entryId: 'theory', status: 'CONFIRMED' }],
        'doc',
        'node',
        [tocEntries[2]]
      )
    ).toBe(false);
  });
});
