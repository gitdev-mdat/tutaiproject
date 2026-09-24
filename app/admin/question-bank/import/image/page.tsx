import type { Metadata } from 'next';
import { QuestionImageImport } from '@/components/admin/question-bank/question-image-import';

export const metadata: Metadata = { title: 'Import câu hỏi từ ảnh | Tú Tài Admin' };

export default function QuestionImageImportPage() {
  return <QuestionImageImport />;
}
