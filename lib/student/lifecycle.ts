import 'server-only';

import { createHash } from 'node:crypto';
import { getOwnedRoadmap, initializeOwnedRoadmap } from '@/features/roadmap/lib/roadmap-storage';
import {
  getAuthRepository,
  type AssignmentPlan,
  type AssignmentState,
} from '@/lib/auth/repository';
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

/** Decides the assignment from the student's current state. Pure; the repository applies it atomically. */
export function planStudentAssignment(
  studentId: string,
  { profile, learning, enrollment, attempts }: AssignmentState,
  now = new Date().toISOString()
): AssignmentPlan {
  if (!profile || !isOnboardingComplete(profile, learning))
    throw new Error('INVALID_ONBOARDING_PROFILE');
  if (enrollment) return { kind: 'existing', enrollment, targetScore: learning!.targetScore! };
  const key = fingerprint(profile, learning!);
  if (profile.grade !== '12' || learning!.primarySubject !== 'MATH') {
    const blocked = attempts.find((item) => item.profileFingerprint === key) ?? {
      studentId,
      profileFingerprint: key,
      status: 'blocked' as const,
      code: 'NO_ELIGIBLE_PROGRAM' as const,
      retryable: false,
      incidentId: `assignment:${studentId}:${key.slice(0, 12)}`,
      attemptedAt: now,
    };
    return { kind: 'blocked', blocked };
  }
  return {
    kind: 'enroll',
    enrollment: {
      id: `enrollment:${studentId}:math-12-v1`,
      studentId,
      programVersionId: 'math-12-v1',
      status: 'active',
      assignedAt: now,
    },
    targetScore: learning!.targetScore!,
  };
}

/** Deterministic, idempotent assignment. The currently published curriculum is Mathematics grade 12. */
export async function ensureStudentAssignment(studentId: string) {
  const plan = await (
    await getAuthRepository()
  ).ensureAssignment(studentId, (state) => planStudentAssignment(studentId, state));
  if (plan.kind === 'blocked') return { blocked: plan.blocked };
  const result = { enrollment: plan.enrollment, targetScore: plan.targetScore };
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
  const { enrollment, latestAttempt: blocked } = await (
    await getAuthRepository()
  ).findAssignment(profile.id);
  if (!enrollment) {
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
