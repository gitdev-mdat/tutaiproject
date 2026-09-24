import { QuestionBankNewClient } from '@/components/admin/question-bank/qb-new-client';

export default function QuestionBankNewPage() {
  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b bg-white px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight">Tạo câu hỏi mới</h1>
        <p className="text-sm text-slate-500">
          Biên soạn câu hỏi và phân loại theo Knowledge Tree.
        </p>
      </div>
      <div className="flex-1 bg-slate-50 p-6">
        <QuestionBankNewClient />
      </div>
    </div>
  );
}
