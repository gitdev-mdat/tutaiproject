import type { Metadata } from 'next';
import { AdminRoadmapList } from '@/features/roadmap/components/admin-roadmaps';
export const metadata: Metadata = { title: 'Lộ trình học | Tú Tài Admin' };
export default function Page() {
  return <AdminRoadmapList />;
}
