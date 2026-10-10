import 'server-only';

import { createHash } from 'node:crypto';
import { getOwnedRoadmap, initializeOwnedRoadmap } from '@/features/roadmap/lib/roadmap-storage';
import { authTransaction, readAuthDatabase } from '@/lib/auth/store';
import type { StudentLearningProfile, StoredStudentProfile } from '@/lib/auth/types';

export type StudentLifecycleState =
  | 'GUEST'
  | 'AUTHENTICATED_ONBOARDING_INCOMPLETE'
  | 'AUTHENTICATED_READY_FOR_ASSIGNMENT'
  | 'AUTHENTICATED_PROGRAM_ASSIGNED'
  | 'AUTHENTICATED_ACTIVE_STUDENT'
  | 'ASSIGNMENT_BLOCKED';

export interface StudentLifecycle {
  state: StudentLifecycleState;
  studentId: string | null;
  displayName?: string;
  enrollmentId?: string;
  programVersionId?: string;
  roadmapId?: string;
  blocked?: {
    code:
      | 'NO_ELIGIBLE_PROGRAM'
      | 'ASSIGNMENT_CONFLICT'
      | 'INVALID_ONBOARDING_PROFILE'
      | 'ENROLLMENT_INITIALIZATION_FAILED';
    retryable: boolean;
    incidentId: string;
  };
}

type Session = {
  user: { displayName: string | null; username: string | null };
  profile: StoredStudentProfile;
  learning: StudentLearningProfile | null;
} | null;

export function isOnboardingComplete(
  profile: StoredStudentProfile,
  learning: StudentLearningProfile | null
): boolean {
  return Boolean(
    profile.onboardingCompletedAt &&
    profile.fullName &&
    profile.grade &&
    profile.provinceCode &&
    learning?.primarySubject &&
    learning.currentScore !== null &&
    learning.targetScore !== null
  );
}

const fingerprint = (profile: StoredStudentProfile, learning: StudentLearningProfile) =>
  createHash('sha256')
    .update(
      JSON.stringify([
        profile.grade,
        learning.primarySubject,
        learning.currentScore,
        learning.targetScore,
      ])
    )
    .digest('hex');

/** Deterministic, idempotent assignment. The currently published curriculum is Mathematics grade 12. */
export async function ensureStudentAssignment(studentId: string) {
  const result = await authTransaction((db) => {
    const profile = db.studentProfiles.find((item) => item.id === studentId);
    const learning = db.learningProfiles.find((item) => item.studentId === studentId) ?? null;
    if (!profile || !isOnboardingComplete(profile, learning))
      throw new Error('INVALID_ONBOARDING_PROFILE');
    const existing = db.enrollments.find(
      (item) => item.studentId === studentId && item.status === 'active'
    );
    if (existing) return { enrollment: existing, targetScore: learning!.targetScore! };
    const key = fingerprint(profile, learning!);
    db.assignmentAttempts = db.assignmentAttempts.filter(
      (item) => item.studentId !== studentId || item.profileFingerprint === key
    );
    if (profile.grade !== '12' || learning!.primarySubject !== 'MATH') {
      let blocked = db.assignmentAttempts.find(
        (item) => item.studentId === studentId && item.profileFingerprint === key
      );
      if (!blocked) {
        blocked = {
          studentId,
          profileFingerprint: key,
          status: 'blocked',
          code: 'NO_ELIGIBLE_PROGRAM',
          retryable: false,
          incidentId: `assignment:${studentId}:${key.slice(0, 12)}`,
          attemptedAt: new Date().toISOString(),
        };
        db.assignmentAttempts.push(blocked);
      }
      return { blocked };
    }
    const enrollment = {
      id: `enrollment:${studentId}:math-12-v1`,
      studentId,
      programVersionId: 'math-12-v1',
      status: 'active' as const,
      assignedAt: new Date().toISOString(),
    };
    db.enrollments.push(enrollment);
    db.assignmentAttempts = db.assignmentAttempts.filter((item) => item.studentId !== studentId);
    return { enrollment, targetScore: learning!.targetScore! };
  });
  if ('blocked' in result) return result;
  try {
    const roadmap = await initializeOwnedRoadmap({ studentId, targetScore: result.targetScore });
    return { ...result, roadmap };
  } catch {
    return result;
  }
}

export async function resolveStudentLifecycle(session: Session): Promise<StudentLifecycle> {
  if (!session) return { state: 'GUEST', studentId: null };
  const { profile, learning } = session;
  const displayName =
    profile.fullName || session.user.displayName || session.user.username || undefined;
  if (!isOnboardingComplete(profile, learning))
    return { state: 'AUTHENTICATED_ONBOARDING_INCOMPLETE', studentId: profile.id, displayName };
  const db = await readAuthDatabase();
  const enrollment = db.enrollments.find(
    (item) => item.studentId === profile.id && item.status === 'active'
  );
  if (!enrollment) {
    const blocked = db.assignmentAttempts.filter((item) => item.studentId === profile.id).at(-1);
    if (blocked)
      return {
        state: 'ASSIGNMENT_BLOCKED',
        studentId: profile.id,
        displayName,
        blocked: {
          code: blocked.code,
          retryable: blocked.retryable,
          incidentId: blocked.incidentId,
        },
      };
    return { state: 'AUTHENTICATED_READY_FOR_ASSIGNMENT', studentId: profile.id, displayName };
  }
  const roadmap = await getOwnedRoadmap(profile.id);
  return {
    state: roadmap ? 'AUTHENTICATED_ACTIVE_STUDENT' : 'AUTHENTICATED_PROGRAM_ASSIGNED',
    studentId: profile.id,
    displayName,
    enrollmentId: enrollment.id,
    programVersionId: enrollment.programVersionId,
    roadmapId: roadmap?.id,
  };
}

export async function resolveAndEnsureStudentLifecycle(
  session: Session
): Promise<StudentLifecycle> {
  let lifecycle = await resolveStudentLifecycle(session);
  if (
    session &&
    (lifecycle.state === 'AUTHENTICATED_READY_FOR_ASSIGNMENT' ||
      lifecycle.state === 'AUTHENTICATED_PROGRAM_ASSIGNED')
  ) {
    await ensureStudentAssignment(session.profile.id);
    lifecycle = await resolveStudentLifecycle(session);
  }
  return lifecycle;
}

export function isOnboardingLifecycle(state: StudentLifecycleState): boolean {
  return state === 'AUTHENTICATED_ONBOARDING_INCOMPLETE' || state === 'ASSIGNMENT_BLOCKED';
}

export function lifecycleDestination(state: StudentLifecycleState): string {
  if (state === 'GUEST') return '/auth/login';
  if (state === 'AUTHENTICATED_ONBOARDING_INCOMPLETE') return '/onboarding/profile';
  if (state === 'ASSIGNMENT_BLOCKED') return '/onboarding/profile?assignment=blocked';
  return '/student/roadmap';
}
