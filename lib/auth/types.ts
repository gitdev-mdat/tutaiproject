import type { AcquisitionSource, PrimarySubjectCode } from '@/lib/onboarding/onboarding-model';

export type AuthProvider = 'password' | 'google';

export interface AuthUser {
  id: string;
  username: string | null;
  email: string | null;
  emailVerifiedAt: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthIdentity {
  id: string;
  userId: string;
  provider: AuthProvider;
  providerAccountId: string;
  passwordHash: string | null;
  createdAt: string;
}

export interface StoredStudentProfile {
  id: string;
  userId: string;
  fullName: string;
  phone: string | null;
  provinceCode: string | null;
  provinceName: string | null;
  schoolId: string | null;
  schoolName: string | null;
  schoolSource: 'dataset' | 'custom' | null;
  grade: string | null;
  onboardingCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentLearningProfile {
  studentId: string;
  primarySubject: PrimarySubjectCode | null;
  currentScore: number | null;
  targetScore: number | null;
  updatedAt: string;
}

export interface StudentAcquisition {
  studentId: string;
  source: AcquisitionSource;
  sourceOther: string | null;
  recordedAt: string;
}

export interface CommunicationPreference {
  studentId: string;
  consultationConsent: boolean;
  marketingConsent: boolean;
  consentUpdatedAt: string;
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}

export interface PasswordResetRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export interface StudentEnrollment {
  id: string;
  studentId: string;
  programVersionId: string;
  status: 'active';
  assignedAt: string;
}

export interface AssignmentAttempt {
  studentId: string;
  profileFingerprint: string;
  status: 'blocked';
  code:
    | 'NO_ELIGIBLE_PROGRAM'
    | 'ASSIGNMENT_CONFLICT'
    | 'INVALID_ONBOARDING_PROFILE'
    | 'ENROLLMENT_INITIALIZATION_FAILED';
  retryable: boolean;
  incidentId: string;
  attemptedAt: string;
}

export interface AuthDatabase {
  version: 4;
  users: AuthUser[];
  identities: AuthIdentity[];
  studentProfiles: StoredStudentProfile[];
  learningProfiles: StudentLearningProfile[];
  studentAcquisitions: StudentAcquisition[];
  /** Legacy communication choices are preserved, but onboarding no longer creates or changes them. */
  communicationPreferences: CommunicationPreference[];
  sessions: AuthSessionRecord[];
  passwordResets: PasswordResetRecord[];
  enrollments: StudentEnrollment[];
  assignmentAttempts: AssignmentAttempt[];
}
