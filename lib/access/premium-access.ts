import 'server-only';

import { evaluateAdminAccess } from '@/lib/auth/admin';
import { getAuthSession } from '@/lib/auth/session';
import { hasPlusAccess } from './plus-access';
import { resolvePremiumAccess, type PremiumAccess } from './premium-access-rules';

export type { PremiumAccess, PremiumAccessVia } from './premium-access-rules';

/** Premium access for a student profile, decided on the server. Fails closed. */
export async function getPremiumAccess(studentId: string): Promise<PremiumAccess> {
  try {
    const [plus, session] = await Promise.all([hasPlusAccess(studentId), getAuthSession()]);
    return resolvePremiumAccess({
      plus,
      admin: evaluateAdminAccess(session?.user ?? null),
      ownProfile: session?.profile.id === studentId,
    });
  } catch (error) {
    console.error('[premium-access]', error);
    return { allowed: false, via: null };
  }
}
