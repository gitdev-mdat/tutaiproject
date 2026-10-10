import { NextResponse } from 'next/server';
import { destinationFor, getAuthSession } from '@/lib/auth/session';

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ authenticated: false });
  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.user.id,
      username: session.user.username,
      email: session.user.email,
      displayName: session.user.displayName,
    },
    profile: {
      fullName: session.profile.fullName,
      phone: session.profile.phone,
      grade: session.profile.grade,
      provinceCode: session.profile.provinceCode,
      provinceName: session.profile.provinceName,
      schoolId: session.profile.schoolId,
      schoolName: session.profile.schoolName,
      schoolSource: session.profile.schoolSource,
    },
    learning: session.learning,
    onboardingComplete: Boolean(session.profile.onboardingCompletedAt),
    redirectTo: destinationFor(session.profile),
  });
}
