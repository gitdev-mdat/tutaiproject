import 'server-only';

import { getAuthSession } from '@/lib/auth/session';
import { resolveStudentLifecycle } from '@/lib/student/lifecycle';
import type { StudentLandingContext } from './landing-cta';

export async function getStudentLandingContext(): Promise<StudentLandingContext> {
  try {
    const lifecycle = await resolveStudentLifecycle(await getAuthSession());
    return { state: lifecycle.state, displayName: lifecycle.displayName };
  } catch (error) {
    // The landing page must render even when the account store is unreachable;
    // it then shows the signed-out call to action. Sign-in itself still fails.
    console.error('Landing could not read the session', error);
    return { state: 'GUEST' };
  }
}
