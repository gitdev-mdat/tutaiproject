import type { Metadata } from 'next';
import { StudentRoadmapsAdmin } from '@/components/admin/student-roadmaps';
import { getLearningOverview } from '@/lib/admin/learning-overview';
import { requireAdminPage } from '@/lib/auth/admin';

export const metadata: Metadata = { title: 'Lộ trình học sinh | Tú Tài Admin' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireAdminPage('/admin/roadmaps');
  return <StudentRoadmapsAdmin overview={await getLearningOverview()} />;
}
