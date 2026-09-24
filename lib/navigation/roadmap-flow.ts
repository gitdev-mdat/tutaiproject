export type OnboardingProgress =
  'goal' | 'subjects' | 'assessment' | 'study-time' | 'analyzing' | 'roadmap' | null | undefined;

export interface RoadmapUserState {
  authenticated: boolean;
  hasRoadmap?: boolean;
  onboardingProgress?: OnboardingProgress;
  pathname?: string;
  returnTo?: unknown;
}

export interface RoadmapDestination {
  path: string;
  label: string;
}

const ONBOARDING_STEPS: Record<Exclude<OnboardingProgress, null | undefined>, string> = {
  goal: '/onboarding/goal',
  subjects: '/onboarding/subjects',
  assessment: '/onboarding/assessment',
  'study-time': '/onboarding/study-time',
  analyzing: '/onboarding/analyzing',
  roadmap: '/onboarding/roadmap',
};

function safeReturnPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  if (value.includes('\\') || /[\u0000-\u001f]/.test(value)) {
    return null;
  }

  try {
    const parsed = new URL(value, 'https://tutai.local');
    return parsed.origin === 'https://tutai.local'
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : null;
  } catch {
    return null;
  }
}

export function getOnboardingPath(progress: OnboardingProgress): string {
  if (progress && progress in ONBOARDING_STEPS) {
    return ONBOARDING_STEPS[progress];
  }

  return ONBOARDING_STEPS.goal;
}

export function resolveRoadmapDestination(userState: RoadmapUserState): RoadmapDestination {
  const { authenticated, hasRoadmap = false, onboardingProgress, pathname, returnTo } = userState;

  if (authenticated && (pathname === '/auth/login' || pathname === '/auth/register')) {
    return {
      path:
        safeReturnPath(returnTo) ??
        (hasRoadmap ? '/student/roadmap' : getOnboardingPath(onboardingProgress)),
      label: hasRoadmap ? 'Xem lộ trình của em' : 'Tiếp tục lộ trình',
    };
  }

  if (authenticated && (hasRoadmap || pathname === '/onboarding/roadmap')) {
    return {
      path: '/student/roadmap',
      label: 'Bắt đầu học',
    };
  }

  if (onboardingProgress) {
    return {
      path: getOnboardingPath(onboardingProgress),
      label: 'Tiếp tục lộ trình',
    };
  }

  return {
    path: '/onboarding/goal',
    label: 'Xây lộ trình của em',
  };
}

export function getRoadmapCta(userState: RoadmapUserState): RoadmapDestination {
  return resolveRoadmapDestination(userState);
}

export function getClientRoadmapUserState(
  onboardingProgress?: OnboardingProgress
): RoadmapUserState {
  const authenticated =
    typeof document !== 'undefined' &&
    document.cookie.split(';').some((cookie) => cookie.trim().startsWith('tutai_demo_session='));

  return {
    authenticated,
    onboardingProgress,
    hasRoadmap: false,
    pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
  };
}
