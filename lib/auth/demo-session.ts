import type { StudentProfile } from '@/lib/student/types';
import { getAuthSession } from './session';

export async function getDemoStudentSession(): Promise<StudentProfile | null> {
  const session = await getAuthSession();
  if (!session) return null;
  const numericGrade = Number.parseInt(session.profile.grade ?? '12', 10);
  return {
    id: session.profile.id,
    name:
      session.profile.fullName ||
      session.user.displayName ||
      session.user.username ||
      'Học sinh Tú Tài',
    email: session.user.email ?? '',
    grade: Number.isFinite(numericGrade) ? numericGrade : 12,
    targetScore: session.learning?.targetScore ?? 0,
    examBlock: '',
  };
}

export async function requireDemoStudentSession(): Promise<StudentProfile> {
  const session = await getDemoStudentSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  return session;
}

export async function isDemoStudentAuthenticated(): Promise<boolean> {
  const session = await getDemoStudentSession();
  return session !== null;
}
