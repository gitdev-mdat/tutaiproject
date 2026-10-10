import { describe, expect, it } from 'vitest';

import {
  isOnboardingLifecycle,
  lifecycleDestination,
  type StudentLifecycleState,
} from '@/lib/student/lifecycle';

const states: StudentLifecycleState[] = [
  'GUEST',
  'AUTHENTICATED_ONBOARDING_INCOMPLETE',
  'AUTHENTICATED_READY_FOR_ASSIGNMENT',
  'AUTHENTICATED_PROGRAM_ASSIGNED',
  'AUTHENTICATED_ACTIVE_STUDENT',
  'ASSIGNMENT_BLOCKED',
];

describe('student lifecycle navigation', () => {
  it.each([
    ['AUTHENTICATED_ONBOARDING_INCOMPLETE', '/onboarding/profile'],
    ['ASSIGNMENT_BLOCKED', '/onboarding/profile?assignment=blocked'],
    ['AUTHENTICATED_READY_FOR_ASSIGNMENT', '/student/roadmap'],
    ['AUTHENTICATED_PROGRAM_ASSIGNED', '/student/roadmap'],
    ['AUTHENTICATED_ACTIVE_STUDENT', '/student/roadmap'],
  ] satisfies Array<[StudentLifecycleState, string]>)(
    'maps %s to its canonical destination',
    (state, destination) => {
      expect(lifecycleDestination(state)).toBe(destination);
    }
  );

  it('keeps incomplete and blocked students within the onboarding boundary', () => {
    expect(isOnboardingLifecycle('AUTHENTICATED_ONBOARDING_INCOMPLETE')).toBe(true);
    expect(isOnboardingLifecycle('ASSIGNMENT_BLOCKED')).toBe(true);
    expect(isOnboardingLifecycle('AUTHENTICATED_ACTIVE_STUDENT')).toBe(false);
  });

  it('does not produce an onboarding/student redirect cycle for any lifecycle state', () => {
    for (const state of states) {
      const destination = lifecycleDestination(state);
      const onboardingAcceptsDestination =
        destination.startsWith('/onboarding/') && isOnboardingLifecycle(state);
      const studentAcceptsDestination =
        destination.startsWith('/student/') && state === 'AUTHENTICATED_ACTIVE_STUDENT';

      if (state === 'AUTHENTICATED_ONBOARDING_INCOMPLETE' || state === 'ASSIGNMENT_BLOCKED') {
        expect(onboardingAcceptsDestination).toBe(true);
      }
      if (state === 'AUTHENTICATED_ACTIVE_STUDENT') {
        expect(studentAcceptsDestination).toBe(true);
      }
    }
  });
});
