import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuestionCandidate } from './types';

const originalCwd = process.cwd();
let sandbox = '';

beforeEach(async () => {
  sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'qb-assets-'));
  process.chdir(sandbox);
  vi.resetModules();
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.rm(sandbox, { recursive: true, force: true });
  vi.resetModules();
});

describe('durable question assets', () => {
  it('survives import-session cleanup after materialization', async () => {
    const storage = await import('./storage');
    const file = new File([Buffer.from('not-a-real-png')], 'source.png', { type: 'image/png' });
    const session = await storage.createImageImportSession({
      domain: 'QUESTION_BANK',
      files: [file],
      manifest: [{ name: file.name, width: 1200, height: 1600 }],
    });
    const candidate: QuestionCandidate = {
      id: 'candidate-1',
      number: 1,
      sourcePageIds: [session.pages[0].id],
      questionType: 'SHORT_ANSWER',
      content: 'Question',
      options: [],
      statements: [],
      correctAnswer: 'Answer',
      detectedSelectedAnswer: '',
      explanation: '',
      sharedContext: '',
      questionAssetDescription: 'diagram',
      chapter: '',
      lesson: '',
      concept: '',
      difficulty: 'INTERMEDIATE',
      status: 'EDITED',
      fieldConfidence: {
        content: 'HIGH',
        options: 'HIGH',
        answer: 'HIGH',
        asset: 'HIGH',
        classification: 'REVIEW',
      },
      warnings: [],
      updatedAt: new Date().toISOString(),
    };
    const assets = await storage.materializeQuestionAssets(
      session,
      candidate,
      '11111111-1111-1111-1111-111111111111'
    );
    expect(assets).toHaveLength(1);
    const durablePath = storage.questionAssetFile(
      '11111111-1111-1111-1111-111111111111',
      path.basename(assets[0].storageKey)
    );
    await storage.deleteImportSession(session.id);
    await expect(fs.readFile(durablePath, 'utf8')).resolves.toBe('not-a-real-png');
  });
});
