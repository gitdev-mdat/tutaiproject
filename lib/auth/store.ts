import 'server-only';

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  findLegacyProvinceByCode,
  findLegacyProvinceByName,
} from '@/data/vietnam-provinces-legacy';
import { findHighSchoolById, findHighSchoolByName } from '@/data/vietnam-high-schools';
import {
  isAcquisitionSource,
  legacySubjectToCode,
  parseOnboardingScore,
} from '@/lib/onboarding/onboarding-model';
import type { AuthDatabase } from './types';

const EMPTY_DATABASE: AuthDatabase = {
  version: 4,
  users: [],
  identities: [],
  studentProfiles: [],
  learningProfiles: [],
  studentAcquisitions: [],
  communicationPreferences: [],
  sessions: [],
  passwordResets: [],
  enrollments: [],
  assignmentAttempts: [],
};

type LegacyRecord = Record<string, unknown>;

/** Upgrades older auth-store.json shapes to the current one. Also used by the PostgreSQL import. */
export function migrateDatabase(parsed: Partial<AuthDatabase> & LegacyRecord): AuthDatabase {
  const profiles = Array.isArray(parsed.studentProfiles) ? parsed.studentProfiles : [];
  const learningProfiles = Array.isArray(parsed.learningProfiles) ? parsed.learningProfiles : [];
  const now = new Date().toISOString();

  const studentProfiles = profiles.map((profileValue) => {
    const profile = profileValue as unknown as LegacyRecord;
    const provinceByCode =
      typeof profile.provinceCode === 'string'
        ? findLegacyProvinceByCode(profile.provinceCode)
        : undefined;
    const legacyProvince =
      provinceByCode ??
      (typeof profile.province === 'string'
        ? findLegacyProvinceByName(profile.province)
        : undefined);
    const schoolName =
      typeof profile.schoolName === 'string'
        ? profile.schoolName
        : typeof profile.school === 'string'
          ? profile.school
          : null;
    const schoolById =
      typeof profile.schoolId === 'string' ? findHighSchoolById(profile.schoolId) : undefined;
    const canonicalSchool =
      schoolById?.provinceCode === legacyProvince?.code
        ? schoolById
        : legacyProvince && schoolName
          ? findHighSchoolByName(legacyProvince.code, schoolName)
          : undefined;
    const schoolSource =
      profile.schoolSource === 'custom' && schoolName
        ? 'custom'
        : canonicalSchool
          ? 'dataset'
          : schoolName
            ? 'custom'
            : null;
    return {
      id: String(profile.id),
      userId: String(profile.userId),
      fullName: typeof profile.fullName === 'string' ? profile.fullName : '',
      phone: typeof profile.phone === 'string' ? profile.phone : null,
      provinceCode: legacyProvince?.code ?? null,
      provinceName:
        legacyProvince?.name ??
        (typeof profile.provinceName === 'string' ? profile.provinceName : null),
      schoolId: schoolSource === 'dataset' ? canonicalSchool!.id : null,
      schoolName: schoolSource === 'dataset' ? canonicalSchool!.name : schoolName,
      schoolSource,
      grade: typeof profile.grade === 'string' ? profile.grade : null,
      onboardingCompletedAt:
        typeof profile.onboardingCompletedAt === 'string' ? profile.onboardingCompletedAt : null,
      createdAt: typeof profile.createdAt === 'string' ? profile.createdAt : now,
      updatedAt: typeof profile.updatedAt === 'string' ? profile.updatedAt : now,
    };
  });

  const migratedLearningProfiles = learningProfiles.map((learningValue) => {
    const learning = learningValue as unknown as LegacyRecord;
    const interestedSubjects = Array.isArray(learning.interestedSubjects)
      ? learning.interestedSubjects
      : [];
    const currentScores = learning.currentScores as LegacyRecord | undefined;
    const targetScores = learning.targetScores as LegacyRecord | undefined;
    return {
      studentId: String(learning.studentId),
      primarySubject:
        legacySubjectToCode(
          typeof learning.primarySubject === 'string'
            ? learning.primarySubject
            : typeof interestedSubjects[0] === 'string'
              ? interestedSubjects[0]
              : null
        ) ?? null,
      currentScore: parseOnboardingScore(learning.currentScore ?? currentScores?.overall),
      targetScore: parseOnboardingScore(learning.targetScore ?? targetScores?.overall),
      updatedAt: typeof learning.updatedAt === 'string' ? learning.updatedAt : now,
    };
  });

  const existingAcquisitions = Array.isArray(parsed.studentAcquisitions)
    ? parsed.studentAcquisitions
    : [];
  const migratedAcquisitions = [...existingAcquisitions];
  for (const profileValue of profiles) {
    const profile = profileValue as unknown as LegacyRecord;
    if (
      isAcquisitionSource(profile.acquisitionSource) &&
      !migratedAcquisitions.some((item) => item.studentId === profile.id)
    ) {
      migratedAcquisitions.push({
        studentId: String(profile.id),
        source: profile.acquisitionSource,
        sourceOther:
          typeof profile.acquisitionSourceOther === 'string'
            ? profile.acquisitionSourceOther
            : null,
        recordedAt: typeof profile.updatedAt === 'string' ? profile.updatedAt : now,
      });
    }
  }

  return {
    ...structuredClone(EMPTY_DATABASE),
    ...parsed,
    version: 4,
    studentProfiles,
    learningProfiles: migratedLearningProfiles,
    studentAcquisitions: migratedAcquisitions,
    enrollments: Array.isArray(parsed.enrollments) ? parsed.enrollments : [],
    assignmentAttempts: Array.isArray(parsed.assignmentAttempts) ? parsed.assignmentAttempts : [],
  } as AuthDatabase;
}

let writeQueue: Promise<unknown> = Promise.resolve();

function databasePath(): string {
  return (
    process.env.AUTH_STORE_PATH ?? path.join(process.cwd(), 'data', 'runtime', 'auth-store.json')
  );
}

async function readDatabase(): Promise<AuthDatabase> {
  try {
    const raw = await readFile(databasePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<AuthDatabase> & LegacyRecord;
    return migrateDatabase(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return structuredClone(EMPTY_DATABASE);
    throw error;
  }
}

async function persistDatabase(database: AuthDatabase): Promise<void> {
  const filePath = databasePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(database, null, 2)}\n`, { mode: 0o600 });
  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        await rename(temporaryPath, filePath);
        break;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        const retryable = code === 'EPERM' || code === 'EBUSY' || code === 'EACCES';
        if (!retryable || attempt >= 7) throw error;
        // Windows can briefly lock the destination while another Next worker or
        // an antivirus scanner has it open. Keep the atomic replacement and
        // retry instead of deleting the live database or writing it in place.
        await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
      }
    }
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

export async function readAuthDatabase(): Promise<AuthDatabase> {
  await writeQueue;
  return readDatabase();
}

export async function authTransaction<T>(
  callback: (database: AuthDatabase) => Promise<T> | T
): Promise<T> {
  const operation = writeQueue.then(async () => {
    const database = await readDatabase();
    const result = await callback(database);
    await persistDatabase(database);
    return result;
  });
  writeQueue = operation.catch(() => undefined);
  return operation;
}

export async function resetAuthStoreForTests(): Promise<void> {
  await authTransaction((database) => Object.assign(database, structuredClone(EMPTY_DATABASE)));
}
