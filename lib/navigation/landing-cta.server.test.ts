import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DynamicServerError } from 'next/dist/client/components/hooks-server-context';

const getAuthSession = vi.fn();
vi.mock('@/lib/auth/session', () => ({ getAuthSession: () => getAuthSession() }));
vi.mock('@/lib/student/lifecycle', () => ({
  resolveStudentLifecycle: async () => ({ state: 'GUEST', displayName: null }),
}));

import { getStudentLandingContext } from './landing-cta.server';

describe('getStudentLandingContext', () => {
  beforeEach(() => {
    getAuthSession.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('lets the dynamic-rendering signal from cookies() reach Next.js', async () => {
    getAuthSession.mockRejectedValue(new DynamicServerError('Route / used `cookies`'));
    await expect(getStudentLandingContext()).rejects.toBeInstanceOf(DynamicServerError);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('falls back to the signed-out call to action when the account store fails', async () => {
    getAuthSession.mockRejectedValue(new Error('connection refused'));
    await expect(getStudentLandingContext()).resolves.toEqual({ state: 'GUEST' });
  });
});
