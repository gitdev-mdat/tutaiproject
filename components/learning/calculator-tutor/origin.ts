import type { StepOrigin } from '@/lib/calculator-tutor/types';

/** What the student is told about where a step comes from. */
export const ORIGIN_LABEL: Record<StepOrigin, { label: string; className: string }> = {
  SOURCE: { label: 'Theo lời giải', className: 'bg-slate-100 text-slate-700' },
  CORRECTED: { label: 'Tú Tài đã sửa lỗi của nguồn', className: 'bg-rose-100 text-rose-800' },
  MODEL: { label: 'Cách máy hoạt động', className: 'bg-sky-100 text-sky-800' },
  FROM_QUESTION: { label: 'Lấy từ đề bài', className: 'bg-indigo-100 text-indigo-800' },
  PROPOSED: { label: 'Tú Tài đề xuất', className: 'bg-violet-100 text-violet-800' },
  COMPUTED: { label: 'Tú Tài tính từ công thức', className: 'bg-emerald-100 text-emerald-800' },
  MISSING: { label: 'Nguồn thiếu phần này', className: 'bg-amber-100 text-amber-900' },
  UNCERTAIN: { label: 'Nguồn chưa rõ', className: 'bg-amber-100 text-amber-900' },
};
