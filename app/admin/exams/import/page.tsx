import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Nhập đề chính thức | Tú Tài Admin' };

export default function ExamImportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Button nativeButton={false} variant="ghost" size="sm" render={<Link href="/admin/exams" />}>
        <ArrowLeft /> Quay lại danh sách đề
      </Button>
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Nhập đề chính thức</h1>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Quy trình hiện tại nhận nhiều ảnh của cùng một đề, trích xuất câu hỏi vào kho nội dung
          chuẩn rồi tạo một bản nháp đề để tiếp tục biên soạn.
        </p>
      </div>
      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
          <FileImage className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">Ảnh đề và đáp án</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Tải nhiều trang, sắp xếp, phân loại và kiểm duyệt từng câu trước khi hoàn tất.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/admin/exams/import/images" />}>
          Bắt đầu
        </Button>
      </div>
    </div>
  );
}
