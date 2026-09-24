import { BookOpen, Target } from 'lucide-react';

export function LoginDashboardPreview() {
  return (
    <div
      className="hidden w-full max-w-[500px] lg:block"
      aria-label="Minh họa màn hình học tập sau khi đăng nhập"
    >
      <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        Minh họa trải nghiệm sau đăng nhập
      </p>
      <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-[13px] font-semibold text-slate-500">Toán 12 · Mục tiêu thi THPT</p>
            <h3 className="mt-1 text-[20px] font-bold tracking-tight text-[#091224]">
              Lộ trình phù hợp với năng lực
            </h3>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-600">
            Ví dụ
          </span>
        </div>

        <div className="rounded-[14px] border border-blue-200 bg-blue-50/60 p-4">
          <div className="flex gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-white text-blue-600 shadow-sm">
              <BookOpen size={19} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-blue-700">
                Một hành động tiếp theo rõ ràng
              </p>
              <p className="mt-1 text-[17px] font-bold text-[#091224]">Bài học được đề xuất</p>
              <p className="mt-1 text-[14px] leading-5 text-slate-600">
                Sau bài chẩn đoán, em sẽ thấy lý do đề xuất dựa trên kết quả theo từng chủ đề.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-[12px] border border-slate-200 px-4 py-3">
          <Target className="shrink-0 text-slate-500" size={18} aria-hidden="true" />
          <p className="text-[14px] leading-5 text-slate-600">
            <span className="font-semibold text-slate-800">Học liền mạch:</span> bài đang học và kết
            quả của em được lưu để tiếp tục khi quay lại.
          </p>
        </div>
      </div>
    </div>
  );
}
