import 'server-only';

import { hasActivePlus } from '@/lib/auth/entitlements';

/**
 * Whether a student may open Tú Tài Plus content right now. It reads the same
 * subscription record that checkout and the admin payment review write, keyed
 * by the student's profile id. Any failure to read it (no record, unreadable
 * store) means no access: Plus content is never served by default.
 */
export async function hasPlusAccess(studentId: string): Promise<boolean> {
  try {
    return await hasActivePlus(studentId);
  } catch (error) {
    console.error('[plus-access]', error);
    return false;
  }
}
