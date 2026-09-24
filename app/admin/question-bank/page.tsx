import type { Metadata } from 'next';
import { QuestionBankPage } from '@/components/admin/question-bank/qb-page';

export const metadata: Metadata = {
  title: 'Ngân hàng câu hỏi | Tú Tài Admin',
  description:
    'Quản lý, nhập liệu và phân loại câu hỏi dùng cho bộ đề mở, Tú Tài Plus và lộ trình cá nhân hóa.',
};

export default function QuestionBankAdminPage() {
  return (
    <div className="flex min-h-full flex-col">
      <QuestionBankPage />
    </div>
  );
}
