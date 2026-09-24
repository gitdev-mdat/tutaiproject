import type { Metadata } from 'next';
import { requireDemoStudentSession } from '@/lib/auth/demo-session';
import { ProfileClient } from './profile-client';

export const metadata: Metadata = {
  title: 'Hồ sơ',
  description: 'Quản lý hồ sơ cá nhân và mục tiêu học tập trên Tú Tài.',
};

export default async function ProfilePage() {
  const profile = await requireDemoStudentSession();
  return <ProfileClient initialProfile={profile} />;
}
