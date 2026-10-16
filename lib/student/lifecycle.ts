import 'server-only';

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

/** Decides the assignment from the student's current state. Pure; the repository applies it atomically. */
export function planStudentAssignment(
  studentId: string,
  { profile, learning, enrollment }: AssignmentState,
  now = new Date().toISOString()
): AssignmentPlan {
  if (!profile || !isOnboardingComplete(profile, learning))
    throw new Error('INVALID_ONBOARDING_PROFILE');
  if (enrollment) return { kind: 'existing', enrollment, targetScore: learning!.targetScore! };
  return {
    kind: 'enroll',
    enrollment: {
      id: `enrollment:${studentId}:${programVersionFor(profile, learning!)}`,
      studentId,
      programVersionId: programVersionFor(profile, learning!),
      status: 'active',
      assignedAt: now,
    },
    targetScore: learning!.targetScore!,
  };
}

/**
 * The program a student is enrolled in: their declared subject and grade.
 * Mathematics grade 12 keeps its original id. The Roadmap reads the published
 * Knowledge Tree for the matching program on every visit (program-match), so
 * a student whose program is not published yet is enrolled anyway and gets it
 * as soon as the admin publishes it, instead of being blocked at onboarding.
 */
export function programVersionFor(
  profile: Pick<StoredStudentProfile, 'grade'>,
  learning: Pick<StudentLearningProfile, 'primarySubject'>
): string {
  const subject = (learning.primarySubject ?? 'unknown').toLowerCase();
  const grade = /^\d+$/.test(profile.grade ?? '') ? profile.grade : 'other';
  return subject === 'math' && grade === '12' ? 'math-12-v1' : `${subject}-${grade}`;
}

/** Deterministic, idempotent assignment of every student with a complete onboarding. */
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
      lifecycle.state === 'AUTHENTICATED_PROGRAM_ASSIGNED' ||
      // Students blocked by the former Mathematics-12-only rule are enrolled now.
      (lifecycle.state === 'ASSIGNMENT_BLOCKED' &&
        lifecycle.blocked?.code === 'NO_ELIGIBLE_PROGRAM'))
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
