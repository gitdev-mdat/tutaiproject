import type { Metadata } from 'next';
import { AdminRoadmapEditor } from '@/features/roadmap/components/admin-roadmaps';
export const metadata: Metadata = { title: 'Chỉnh sửa lộ trình | Tú Tài Admin' };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ roadmapId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const [{ roadmapId }, query] = await Promise.all([params, searchParams]);
  return <AdminRoadmapEditor roadmapId={roadmapId} initialPreview={query.preview === '1'} />;
}
