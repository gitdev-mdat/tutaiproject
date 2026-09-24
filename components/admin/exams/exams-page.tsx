'use client';

import * as React from 'react';
import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ExamRecord } from '@/lib/exams/exam-types';
import { EXAM_PUBLISH_STATUS_LABELS } from '@/lib/exams/exam-types';
import { SUBJECT_LABELS } from '@/lib/question-bank/qb-types';

function StatusBadge({ status }: { status: ExamRecord['publishStatus'] }) {
  const published = status === 'PUBLISHED';
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
        published
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-50 text-slate-600'
      }`}
    >
      {EXAM_PUBLISH_STATUS_LABELS[status]}
    </span>
  );
}

export function ExamsPage() {
  const [exams, setExams] = React.useState<ExamRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    void fetch('/api/exams')
      .then(async (response) => {
        if (!response.ok) throw new Error('Không tải được danh sách đề thi.');
        setExams((await response.json()) as ExamRecord[]);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Không tải được danh sách đề thi.')
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start gap-4 sm:items-center">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Đề thi</h1>
          <p className="mt-1 text-sm text-slate-500">
            Biên soạn, sắp xếp và xuất bản đề từ các câu hỏi chuẩn hóa trong ngân hàng.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/admin/exams/new" />}>
          <Plus /> Tạo đề
        </Button>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Tên đề</th>
                <th className="px-3 py-3">Môn / Lớp</th>
                <th className="px-3 py-3">Cấu trúc</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Cập nhật</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="h-64 px-4 text-center text-sm text-slate-500">
                    Đang tải danh sách đề…
                  </td>
                </tr>
              ) : exams.length === 0 ? (
                <tr>
                  <td colSpan={5} className="h-64 px-4 text-center">
                    <span className="mx-auto grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-500">
                      <FileText className="size-5" aria-hidden="true" />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-slate-800">Chưa có bộ đề</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Tạo đề đầu tiên từ các câu hỏi đã xuất bản trong ngân hàng.
                    </p>
                    <Button
                      className="mt-4"
                      nativeButton={false}
                      size="sm"
                      render={<Link href="/admin/exams/new" />}
                    >
                      <Plus /> Tạo đề
                    </Button>
                    <Button
                      className="mt-4 ml-2"
                      nativeButton={false}
                      variant="outline"
                      size="sm"
                      render={<Link href="/admin/question-bank" />}
                    >
                      Xem Ngân hàng câu hỏi
                    </Button>
                  </td>
                </tr>
              ) : (
                exams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/exams/${exam.id}`}
                        className="font-semibold text-blue-700 hover:underline"
                      >
                        {exam.name}
                      </Link>
                      {exam.importSessionId && (
                        <p className="mt-0.5 text-xs text-slate-400">Đề nhập từ nguồn chính thức</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {exam.subjectId ? SUBJECT_LABELS[exam.subjectId] : 'Chưa chọn'}
                      {exam.grade ? ` · Lớp ${exam.grade}` : ''}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {exam.questionIds.length} câu
                      {exam.durationMinutes ? ` · ${exam.durationMinutes} phút` : ''}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={exam.publishStatus} />
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500">
                      {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(
                        new Date(exam.updatedAt)
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
