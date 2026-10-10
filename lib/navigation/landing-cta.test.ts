import { describe, expect, it } from 'vitest';

import { resolveLandingCtas, resolveStudentLandingState } from './landing-cta';

describe('resolveStudentLandingState', () => {
  it.each([
    [{ authenticated: false }, 'GUEST'],
    [{ authenticated: true, onboardingComplete: false }, 'AUTHENTICATED_ONBOARDING_INCOMPLETE'],
    [
      { authenticated: true, onboardingComplete: true, hasRoadmap: false },
      'AUTHENTICATED_READY_FOR_ASSIGNMENT',
    ],
    [
      { authenticated: true, onboardingComplete: true, hasEnrollment: true },
      'AUTHENTICATED_PROGRAM_ASSIGNED',
    ],
    [
      {
        authenticated: true,
        onboardingComplete: true,
        hasEnrollment: true,
        hasRoadmap: true,
      },
      'AUTHENTICATED_ACTIVE_STUDENT',
    ],
    [
      { authenticated: true, onboardingComplete: true, assignmentBlocked: true },
      'ASSIGNMENT_BLOCKED',
    ],
  ] as const)('resolves %o to %s', (input, expected) => {
    expect(resolveStudentLandingState(input)).toBe(expected);
  });
});

describe('resolveLandingCtas', () => {
  it('shows only login and registration actions to guests', () => {
    const ctas = resolveLandingCtas({ state: 'GUEST' });

    expect(ctas.header.secondary).toEqual({ label: 'Đăng nhập', path: '/auth/login' });
    expect(ctas.header.primary).toEqual({
      label: 'Đăng ký miễn phí',
      path: '/auth/register',
    });
    expect(ctas.hero.primary).toEqual({
      label: 'Xây lộ trình của em',
      path: '/auth/register',
    });
  });

  it.each([
    ['AUTHENTICATED_ONBOARDING_INCOMPLETE', 'Tiếp tục thiết lập', '/onboarding/profile'],
    ['AUTHENTICATED_READY_FOR_ASSIGNMENT', 'Tạo lộ trình', '/api/student/assignment'],
    ['AUTHENTICATED_PROGRAM_ASSIGNED', 'Tiếp tục học', '/student/roadmap'],
    ['AUTHENTICATED_ACTIVE_STUDENT', 'Tiếp tục học', '/student/roadmap'],
    ['ASSIGNMENT_BLOCKED', 'Kiểm tra hồ sơ', '/onboarding/profile?assignment=blocked'],
  ] as const)('resolves authenticated state %s', (state, label, path) => {
    const ctas = resolveLandingCtas({ state, displayName: 'Minh Đạt' });

    expect(ctas.header.secondary).toBeNull();
    expect(ctas.header.primary).toEqual({ label, path });
    expect(ctas.hero.primary).toEqual({
      label: state === 'ASSIGNMENT_BLOCKED' ? label : 'Xây lộ trình của em',
      path,
    });
    expect(ctas.displayName).toBe('Minh Đạt');
  });
});
