import { cookies } from 'next/headers';
import { DEMO_STUDENT, StudentProfile } from '@/lib/mock-data/demo-student';

const DEMO_COOKIE_NAME = 'tutai_demo_session';
const DEMO_COOKIE_VALUE = 'demo-student-session';

export async function getDemoStudentSession(): Promise<StudentProfile | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(DEMO_COOKIE_NAME);

  if (session?.value === DEMO_COOKIE_VALUE) {
    return DEMO_STUDENT;
  }

  return null;
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
