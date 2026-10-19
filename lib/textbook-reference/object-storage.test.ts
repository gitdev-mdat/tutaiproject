import { documentStorageKey, safeStorageKey } from './object-storage';

describe('textbook storage key validation', () => {
  it('allows a document object key and rejects traversal and absolute paths', () => {
    expect(safeStorageKey('documents/abc123.pdf')).toBe('documents/abc123.pdf');
    for (const key of ['../secret.pdf', 'documents/../../secret.pdf', '/etc/passwd', 'C:\\secret.pdf']) {
      expect(() => safeStorageKey(key)).toThrow('Invalid textbook storage key.');
    }
  });

  it('derives the object key from the SHA-256 only', () => {
    expect(documentStorageKey('a'.repeat(64))).toBe(`documents/${'a'.repeat(64)}.pdf`);
    expect(() => documentStorageKey('../evil')).toThrow('Invalid SHA-256.');
  });
});
