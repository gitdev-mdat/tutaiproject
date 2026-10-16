import { redirect } from 'next/navigation';

/**
 * Onboarding is the three-step profile form. This earlier pre-registration
 * step kept answers in the browser only and showed a sample roadmap that no
 * student received, so it opens the form instead.
 */
export default function Page() {
  redirect('/onboarding/profile');
}
