import type { Metadata } from 'next';
import { ExamComposer } from '@/components/admin/exams/exam-composer';

export const metadata: Metadata = { title: 'Tạo đề | Tú Tài Admin' };

export default function NewExamPage() {
  return <ExamComposer />;
}
