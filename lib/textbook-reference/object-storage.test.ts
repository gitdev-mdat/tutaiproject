import { safeStorageKey } from './object-storage';
import { textbookPrivateFile } from './repository';

describe('textbook storage key validation', () => {
  it('allows a document object key and rejects traversal and absolute paths', () => {
    expect(safeStorageKey('documents/abc123.pdf')).toBe('documents/abc123.pdf');
    for (const key of [
      '../secret.pdf',
      'documents/../../secret.pdf',
      '/etc/passwd',
      'C:\\secret.pdf',
    ]) {
      expect(() => safeStorageKey(key)).toThrow('Invalid textbook storage key.');
      expect(() => textbookPrivateFile(key)).toThrow('Invalid textbook storage key.');
    }
  });
});
