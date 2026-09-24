import type { Metadata } from 'next';
import { ExamImageImport } from '@/components/admin/exams/exam-image-import';

export const metadata: Metadata = { title: 'Import đề từ ảnh | Tú Tài Admin' };

export default function ExamImageImportPage() {
  return <ExamImageImport />;
}
