import { describe, expect, it } from 'vitest';
import { getOnboardingPath, resolveRoadmapDestination } from '@/lib/navigation/roadmap-flow';

describe('resolveRoadmapDestination', () => {
  it('sends guests to onboarding rather than authentication', () => {
    expect(resolveRoadmapDestination({ authenticated: false })).toEqual({
      path: '/onboarding/goal',
      label: 'Xây lộ trình của em',
    });
  });

  it('keeps the roadmap preview available to guests until the save boundary', () => {
    expect(
      resolveRoadmapDestination({
        authenticated: false,
        onboardingProgress: 'roadmap',
        pathname: '/onboarding/roadmap',
      })
    ).toEqual({
      path: '/onboarding/roadmap',
      label: 'Tiếp tục lộ trình',
    });
  });

  it('sends authenticated users without a roadmap to onboarding', () => {
    expect(resolveRoadmapDestination({ authenticated: true, hasRoadmap: false })).toMatchObject({
      path: '/onboarding/goal',
    });
  });

  it('resumes an onboarding draft at its active step', () => {
    expect(
      resolveRoadmapDestination({ authenticated: true, onboardingProgress: 'assessment' })
    ).toEqual({
      path: '/onboarding/assessment',
      label: 'Tiếp tục lộ trình',
    });
  });

  it('takes users with an existing roadmap to the student roadmap', () => {
    expect(resolveRoadmapDestination({ authenticated: true, hasRoadmap: true })).toEqual({
      path: '/student/roadmap',
      label: 'Bắt đầu học',
    });
  });

  it('uses a safe return path instead of auth for authenticated auth-page access', () => {
    const destination = resolveRoadmapDestination({
      authenticated: true,
      pathname: '/auth/login',
      returnTo: '/student/roadmap?from=auth',
    });

    expect(destination.path).toBe('/student/roadmap?from=auth');
    expect(destination.path).not.toMatch(/^\/auth\/(?:login|register)/);
  });

  it('rejects external return paths', () => {
    expect(
      resolveRoadmapDestination({
        authenticated: true,
        pathname: '/auth/register',
        returnTo: 'https://evil.example',
      }).path
    ).toBe('/onboarding/goal');
  });
});

describe('getOnboardingPath', () => {
  it('defaults to the first onboarding step', () => {
    expect(getOnboardingPath(undefined)).toBe('/onboarding/goal');
  });
});
