import type { Metadata } from 'next';
import { requireDemoStudentSession } from '@/lib/auth/demo-session';
import { GOOGLE_LINK_ERRORS } from '@/lib/auth/errors';
import { getAuthSession } from '@/lib/auth/session';
import { ProfileClient, type GoogleLinkState } from './profile-client';

export const metadata: Metadata = {
  title: 'Hồ sơ',
  description: 'Quản lý hồ sơ cá nhân và mục tiêu học tập trên Tú Tài.',
};

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
    error:
      errorCode && errorCode in GOOGLE_LINK_ERRORS
        ? GOOGLE_LINK_ERRORS[errorCode as keyof typeof GOOGLE_LINK_ERRORS]
        : null,
  };
  return <ProfileClient initialProfile={profile} google={google} />;
}
