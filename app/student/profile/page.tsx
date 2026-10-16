import type { Metadata } from 'next';
import { requireDemoStudentSession } from '@/lib/auth/demo-session';
import { GOOGLE_LINK_ERRORS } from '@/lib/auth/errors';
import { getAuthSession } from '@/lib/auth/session';
import { ProfileClient, type GoogleLinkState, type LearningGoals } from './profile-client';

export const metadata: Metadata = {
  title: 'Hồ sơ',
  description: 'Quản lý hồ sơ cá nhân và mục tiêu học tập trên Tú Tài.',
};

const GOOGLE_FLOW_ERRORS: Record<string, string> = {
  state_expired:
    'Lượt liên kết Google đã hết hạn hoặc được mở ở tab khác. Vui lòng bấm “Liên kết Google” lần nữa.',
  cancelled: 'Bạn đã huỷ liên kết Google.',
  unverified_google: 'Google chưa xác minh email của tài khoản này, nên chưa thể liên kết.',
  account_exists:
    'Email Google này thuộc một tài khoản khác chưa xác minh, nên không thể liên kết.',
};

function googleErrorMessage(code: string): string {
  if (code in GOOGLE_LINK_ERRORS)
    return GOOGLE_LINK_ERRORS[code as keyof typeof GOOGLE_LINK_ERRORS];
  return GOOGLE_FLOW_ERRORS[code] ?? 'Không thể liên kết Google lúc này. Vui lòng thử lại.';
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireDemoStudentSession();
  const session = await getAuthSession();
  const params = await searchParams;
  const errorCode = typeof params.googleError === 'string' ? params.googleError : null;
  // Only a Google sign-in or link sets a verified email on an account.
  const google: GoogleLinkState = {
    linked: Boolean(session?.user.emailVerifiedAt),
    email: session?.user.emailVerifiedAt ? session.user.email : null,
    notice: params.google === 'linked' ? 'Đã liên kết Google với tài khoản của em.' : null,
    error: errorCode ? googleErrorMessage(errorCode) : null,
  };
  const learning: LearningGoals = {
    grade: session?.profile.grade ?? '',
    primarySubject: session?.learning?.primarySubject ?? null,
    currentScore: session?.learning?.currentScore ?? null,
    targetScore: session?.learning?.targetScore ?? null,
  };
  return <ProfileClient initialProfile={profile} google={google} learning={learning} />;
}
