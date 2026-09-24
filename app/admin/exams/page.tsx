import type { Metadata } from 'next';
import { ExamsPage } from '@/components/admin/exams/exams-page';

export const metadata: Metadata = { title: 'Quản lý đề thi | Tú Tài Admin' };

export default function AdminExamsPage() {
  return <ExamsPage />;
}
