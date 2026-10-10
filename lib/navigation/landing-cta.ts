import type { StudentLifecycleState } from '@/lib/student/lifecycle';

export type StudentLandingState = StudentLifecycleState;
export interface StudentLandingContext {
  state: StudentLandingState;
  displayName?: string;
}
export interface LandingCta {
  label: string;
  path: string;
}
export interface LandingCtaModel {
  state: StudentLandingState;
  displayName?: string;
  header: { secondary: LandingCta | null; primary: LandingCta };
  hero: { primary: LandingCta };
}

export function resolveStudentLandingState(input: {
  authenticated: boolean;
  onboardingComplete?: boolean;
  hasEnrollment?: boolean;
  hasRoadmap?: boolean;
  assignmentBlocked?: boolean;
}): StudentLandingState {
  if (!input.authenticated) return 'GUEST';
  if (!input.onboardingComplete) return 'AUTHENTICATED_ONBOARDING_INCOMPLETE';
  if (input.assignmentBlocked) return 'ASSIGNMENT_BLOCKED';
  if (!input.hasEnrollment) return 'AUTHENTICATED_READY_FOR_ASSIGNMENT';
  return input.hasRoadmap ? 'AUTHENTICATED_ACTIVE_STUDENT' : 'AUTHENTICATED_PROGRAM_ASSIGNED';
}

export function resolveProfileDestination(state: StudentLandingState): string {
  if (state === 'AUTHENTICATED_ACTIVE_STUDENT') return '/student/profile';
  if (state === 'ASSIGNMENT_BLOCKED') return '/onboarding/profile?assignment=blocked';
  return '/onboarding/profile';
}

export function resolveLandingCtas(context: StudentLandingContext): LandingCtaModel {
  const { state, displayName } = context;
  if (state === 'GUEST')
    return {
      state,
      header: {
        secondary: { label: 'Đăng nhập', path: '/auth/login' },
        primary: { label: 'Đăng ký miễn phí', path: '/auth/register' },
      },
      hero: { primary: { label: 'Xây lộ trình của em', path: '/auth/register' } },
    };
  let primary: LandingCta;
  if (state === 'AUTHENTICATED_ONBOARDING_INCOMPLETE')
    primary = { label: 'Tiếp tục thiết lập', path: '/onboarding/profile' };
  else if (state === 'ASSIGNMENT_BLOCKED')
    primary = { label: 'Kiểm tra hồ sơ', path: '/onboarding/profile?assignment=blocked' };
  else if (state === 'AUTHENTICATED_READY_FOR_ASSIGNMENT')
    primary = { label: 'Tạo lộ trình', path: '/api/student/assignment' };
  else primary = { label: 'Tiếp tục học', path: '/student/roadmap' };
  return {
    state,
    displayName,
    header: { secondary: null, primary },
    hero: {
      primary: {
        ...primary,
        label: state === 'ASSIGNMENT_BLOCKED' ? primary.label : 'Xây lộ trình của em',
      },
    },
  };
}
