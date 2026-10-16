import type { Metadata } from 'next';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { getLearningOverview } from '@/lib/admin/learning-overview';
import { requireAdminPage } from '@/lib/auth/admin';

export const metadata: Metadata = {
  title: 'Tổng quan | Admin',
  description: 'Nội dung học sinh đang nhận và việc cần làm trên Tú Tài.',
};
export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  await requireAdminPage('/admin');
  return <AdminDashboard overview={await getLearningOverview()} />;
}
