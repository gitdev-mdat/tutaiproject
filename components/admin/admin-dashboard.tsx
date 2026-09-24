import Link from 'next/link';
import {
  FolderTree,
  FileQuestion,
  BookOpen,
  Users,
  AlertCircle,
  Activity,
  ChevronRight,
  ShieldAlert,
  FileText,
} from 'lucide-react';

export interface AdminDashboardMetrics {
  knowledgeCount: number;
  questionCount: number;
  examCount: number;
  studentCount: number;
  pendingReviewCount: number;
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between shadow-sm">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value.toLocaleString('vi-VN')}</p>
      </div>
      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
        {icon}
      </div>
    </div>
  );
}

export function AdminDashboard({ metrics }: { metrics: AdminDashboardMetrics }) {
  return (
    <div className="flex flex-col gap-8 max-w-6xl">
      {/* 1. Header */}
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">Tổng quan</h1>
        <p className="text-slate-500 text-sm">
          Theo dõi nội dung, vận hành và những việc cần xử lý trên Tú Tài.
        </p>
      </header>

      {/* 2. System Summary Metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Kiến thức"
          value={metrics.knowledgeCount}
          icon={<FolderTree size={24} strokeWidth={1.5} />}
        />
        <StatCard
          label="Câu hỏi"
          value={metrics.questionCount}
          icon={<FileQuestion size={24} strokeWidth={1.5} />}
        />
        <StatCard
          label="Đề thi"
          value={metrics.examCount}
          icon={<BookOpen size={24} strokeWidth={1.5} />}
        />
        <StatCard
          label="Học sinh"
          value={metrics.studentCount}
          icon={<Users size={24} strokeWidth={1.5} />}
        />
      </section>

      {/* 3. Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Column A: Attention & Activity */}
        <div className="flex flex-col gap-8">
          {/* Cần xử lý */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="text-orange-500" size={20} />
              <h2 className="text-lg font-bold text-slate-900">Cần xử lý</h2>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <Link
                href="/admin/payments"
                className="flex items-center justify-between p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
                    <ShieldAlert size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Giao dịch chờ duyệt</p>
                    <p className="text-sm text-slate-500">Thanh toán chuyển khoản Tú Tài Plus</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {metrics.pendingReviewCount > 0 ? (
                    <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2.5 py-1 rounded-full">
                      {metrics.pendingReviewCount} yêu cầu
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-slate-400">Đã xong</span>
                  )}
                  <ChevronRight size={18} className="text-slate-400" />
                </div>
              </Link>

              <Link
                href="/admin/knowledge"
                className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                    <FileText size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Nội dung chưa rà soát</p>
                    <p className="text-sm text-slate-500">Bài viết từ AI cần admin duyệt</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">
                    12 bài viết
                  </span>
                  <ChevronRight size={18} className="text-slate-400" />
                </div>
              </Link>
            </div>
          </section>

          {/* Hoạt động gần đây */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="text-slate-500" size={20} />
              <h2 className="text-lg font-bold text-slate-900">Hoạt động gần đây</h2>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="relative pl-6 border-l-2 border-slate-100 space-y-6">
                <div className="relative">
                  <div className="absolute -left-[31px] bg-white p-1 rounded-full">
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    Admin Hưng{' '}
                    <span className="font-normal text-slate-500">
                      vừa duyệt thanh toán cho TT-843B2A
                    </span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">12 phút trước</p>
                </div>

                <div className="relative">
                  <div className="absolute -left-[31px] bg-white p-1 rounded-full">
                    <div className="w-2.5 h-2.5 bg-slate-300 rounded-full"></div>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    Admin Đạt{' '}
                    <span className="font-normal text-slate-500">
                      cập nhật cây chương trình Toán 12
                    </span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">3 giờ trước</p>
                </div>

                <div className="relative">
                  <div className="absolute -left-[31px] bg-white p-1 rounded-full">
                    <div className="w-2.5 h-2.5 bg-slate-300 rounded-full"></div>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    Admin Đạt{' '}
                    <span className="font-normal text-slate-500">
                      thêm 45 câu hỏi mới vào Vật Lý 11
                    </span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Hôm qua</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Column B: Content Coverage */}
        <div>
          <section>
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="text-slate-500" size={20} />
              <h2 className="text-lg font-bold text-slate-900">Độ bao phủ nội dung</h2>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-6">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Toán 12</h3>
                    <p className="text-xs text-slate-500 mt-0.5">1.240 / 1.500 câu hỏi</p>
                  </div>
                  <span className="text-sm font-bold text-blue-600">82%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: '82%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Vật Lý 12</h3>
                    <p className="text-xs text-slate-500 mt-0.5">850 / 1.000 câu hỏi</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">85%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Hóa Học 12</h3>
                    <p className="text-xs text-slate-500 mt-0.5">420 / 1.000 câu hỏi</p>
                  </div>
                  <span className="text-sm font-bold text-amber-500">42%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-amber-400 h-2 rounded-full" style={{ width: '42%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Tiếng Anh 12</h3>
                    <p className="text-xs text-slate-500 mt-0.5">150 / 1.200 câu hỏi</p>
                  </div>
                  <span className="text-sm font-bold text-rose-500">12%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-rose-500 h-2 rounded-full" style={{ width: '12%' }}></div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
