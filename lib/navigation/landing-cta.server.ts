import 'server-only';

import { getAuthSession } from '@/lib/auth/session';
import { resolveStudentLifecycle } from '@/lib/student/lifecycle';
import type { StudentLandingContext } from './landing-cta';

export async function getStudentLandingContext(): Promise<StudentLandingContext> {
  const lifecycle = await resolveStudentLifecycle(await getAuthSession());
  return { state: lifecycle.state, displayName: lifecycle.displayName };
}
