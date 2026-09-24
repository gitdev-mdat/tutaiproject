import type { Metadata } from 'next';
import { Suspense } from 'react';
import { QuestionBankPage } from '@/components/admin/question-bank/qb-page';

export const metadata: Metadata = {
  title: 'Ngân hàng câu hỏi | Tú Tài Admin',
  description:
    'Quản lý, nhập liệu và phân loại câu hỏi dùng cho bộ đề mở, Tú Tài Plus và lộ trình cá nhân hóa.',
};

export default function QuestionBankAdminPage() {
  return (
    <div className="flex min-h-full flex-col">
      <Suspense fallback={<p className="p-6 text-sm text-slate-500">Đang tải…</p>}>
        <QuestionBankPage />
      </Suspense>
    </div>
  );
}
