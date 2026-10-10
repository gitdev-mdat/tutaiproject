// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { readAuthDatabase } from './store';

describe.sequential('auth store migration', () => {
  let directory: string;

  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'tutai-auth-migration-'));
    process.env.AUTH_STORE_PATH = path.join(directory, 'auth-store.json');
    await writeFile(
      process.env.AUTH_STORE_PATH,
      JSON.stringify({
        version: 1,
        users: [],
        identities: [],
        sessions: [],
        passwordResets: [],
        communicationPreferences: [],
        studentProfiles: [
          {
            id: 'student-1',
            userId: 'user-1',
            fullName: 'Legacy Student',
            phone: null,
            province: 'Bình Dương',
            school: 'THPT A',
            grade: '12',
            acquisitionSource: 'Google',
            acquisitionSourceOther: null,
            onboardingCompletedAt: '2025-01-01T00:00:00.000Z',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        learningProfiles: [
          {
            studentId: 'student-1',
            interestedSubjects: ['Lý', 'Toán'],
            currentScores: { overall: '6.5' },
            targetScores: { overall: '8.5' },
            examGoal: '8+',
            targetExamDate: '2025-06-01',
            targetUniversity: 'Legacy University',
            targetMajor: 'Legacy Major',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      })
    );
  });

  afterAll(async () => {
    delete process.env.AUTH_STORE_PATH;
    await rm(directory, { recursive: true, force: true });
  });

  it('maps legacy profile, school, subject, scores and acquisition into the current schema', async () => {
    const database = await readAuthDatabase();
    expect(database.version).toBe(4);
    expect(database.studentProfiles[0]).toMatchObject({
      provinceCode: '74',
      provinceName: 'Bình Dương',
      schoolId: null,
      schoolName: 'THPT A',
      schoolSource: 'custom',
    });
    expect(database.learningProfiles[0]).toMatchObject({
      primarySubject: 'PHYSICS',
      currentScore: 6.5,
      targetScore: 8.5,
    });
    expect(database.studentAcquisitions[0]).toMatchObject({
      studentId: 'student-1',
      source: 'Google',
    });
    expect(database.learningProfiles[0]).not.toHaveProperty('examGoal');
    expect(database.studentProfiles[0]).not.toHaveProperty('acquisitionSource');
  });
});
