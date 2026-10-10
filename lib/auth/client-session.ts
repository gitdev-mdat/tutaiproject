'use client';

export interface ClientAuthSession {
  authenticated: boolean;
  redirectTo?: string;
  profile?: {
    fullName?: string;
    phone?: string;
    grade?: string;
    provinceCode?: string;
    schoolId?: string;
    schoolName?: string;
    schoolSource?: 'dataset' | 'custom' | '';
  };
  learning?: {
    primarySubject?: string;
    currentScore?: number;
    targetScore?: number;
  };
}

let inFlightSessionRequest: Promise<ClientAuthSession | null> | null = null;

/** Shares only concurrent reads; session data is never retained after the request settles. */
export function fetchAuthSession(): Promise<ClientAuthSession | null> {
  if (inFlightSessionRequest) return inFlightSessionRequest;

  const pending = fetch('/api/auth/session', {
    cache: 'no-store',
    credentials: 'same-origin',
  }).then(async (response): Promise<ClientAuthSession | null> => {
    if (!response.ok) return null;
    return (await response.json()) as ClientAuthSession;
  });

  inFlightSessionRequest = pending;
  void pending.then(
    () => {
      if (inFlightSessionRequest === pending) inFlightSessionRequest = null;
    },
    () => {
      if (inFlightSessionRequest === pending) inFlightSessionRequest = null;
    }
  );
  return pending;
}
