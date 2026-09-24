import type { Metadata } from 'next';
import { AdminRoadmapEditor } from '@/features/roadmap/components/admin-roadmaps';
export const metadata: Metadata = { title: 'Tạo lộ trình | Tú Tài Admin' };
export default function Page() {
  return <AdminRoadmapEditor />;
}
