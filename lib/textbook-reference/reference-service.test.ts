import { approvedReferencesForNode } from './reference-service';

describe('approved textbook reference retrieval', () => {
  const artifacts = [
    {
      id: 'approved',
      documentId: 'book-1',
      entryId: 'toc-1',
      reviewStatus: 'APPROVED' as const,
    },
    {
      id: 'unreviewed',
      documentId: 'book-1',
      entryId: 'toc-1',
      reviewStatus: 'NEEDS_REVIEW' as const,
    },
    {
      id: 'rejected',
      documentId: 'book-1',
      entryId: 'toc-1',
      reviewStatus: 'REJECTED' as const,
    },
  ];
  const mapping = {
    documentId: 'book-1',
    entryId: 'toc-1',
    knowledgeNodeId: 'node-mono',
    status: 'CONFIRMED',
  };

  it('returns only approved artifacts through confirmed Knowledge Tree mappings', () => {
    expect(
      approvedReferencesForNode(artifacts, [mapping], 'node-mono').map((item) => item.id)
    ).toEqual(['approved']);
    expect(
      approvedReferencesForNode(artifacts, [{ ...mapping, status: 'REJECTED' }], 'node-mono')
    ).toEqual([]);
    expect(approvedReferencesForNode(artifacts, [mapping], 'other-node')).toEqual([]);
  });
});
