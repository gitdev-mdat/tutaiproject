import { describe, expect, it } from 'vitest';
import { createDocumentImportSession, requireImportSession, saveImportSession } from './storage';
import type { ImportSession, QuestionCandidate } from './types';

describe('import session persistence and identity', () => {
  it('creates, saves, retrieves, and updates an import session accurately', async () => {
    const candidate: QuestionCandidate = {
      id: 'candidate-test-1',
      number: 1,
      sourcePageIds: [],
      sourcePages: [1],
      questionType: 'MULTIPLE_CHOICE_SINGLE',
      content: 'Cho h�m s? y = f(x). Gi� tr? c?c d?i l� g�?',
      options: [
        { key: 'A', content: '1' },
        { key: 'B', content: '2' },
        { key: 'C', content: '3' },
        { key: 'D', content: '4' },
      ],
      statements: [],
      correctAnswer: 'A',
      detectedSelectedAnswer: '',
      explanation: 'L?i gi?i chi ti?t',
      sharedContext: '',
      questionAssetDescription: '',
      difficulty: 'INTERMEDIATE',
      status: 'UNREVIEWED',
      fieldConfidence: {
        content: 'HIGH',
        options: 'HIGH',
        answer: 'HIGH',
        asset: 'HIGH',
        classification: 'REVIEW',
      },
      warnings: [],
      updatedAt: new Date().toISOString(),
      reviewLevel: 'READY',
      validationErrors: [],
    };

    const mockFile = new File(['mock pdf content'], 'de-thi-thu-toan.pdf', {
      type: 'application/pdf',
    });

    const session = await createDocumentImportSession({
      file: mockFile,
      format: 'PDF',
      candidates: [candidate],
      pageCount: 1,
      warnings: ['M?t s? c?nh b�o ki?m tra'],
    });

    expect(session.id).toBeDefined();
    expect(session.sourceFormat).toBe('PDF');
    expect(session.sourceDocument?.originalFileName).toBe('de-thi-thu-toan.pdf');
    expect(session.candidates).toHaveLength(1);
    expect(session.candidates[0].content).toBe('Cho h�m s? y = f(x). Gi� tr? c?c d?i l� g�?');

    const loaded = await requireImportSession(session.id);
    expect(loaded.id).toBe(session.id);
    expect(loaded.candidates[0].correctAnswer).toBe('A');

    const updatedSession: ImportSession = {
      ...loaded,
      candidates: [
        {
          ...loaded.candidates[0],
          status: 'APPROVED',
          correctAnswer: 'B',
        },
      ],
    };
    await saveImportSession(updatedSession);

    const reloaded = await requireImportSession(session.id);
    expect(reloaded.candidates[0].status).toBe('APPROVED');
    expect(reloaded.candidates[0].correctAnswer).toBe('B');
  });
});
