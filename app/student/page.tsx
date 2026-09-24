import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Trang chủ',
  description: 'Trang chủ học tập cá nhân của bạn trên Tú Tài.',
};

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Trang chủ"
        description="Chào mừng bạn quay trở lại. Hôm nay mình học tiếp nhé."
      />

      <section aria-labelledby="today-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="today-heading" className="text-lg font-semibold text-foreground">
              Phiên học hôm nay
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Một phiên ngắn giúp bạn duy trì nhịp học đều đặn.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            Chưa bắt đầu
          </span>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold text-foreground">Luyện tập đề xuất</p>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                Ôn lại những phần bạn đang cần củng cố để tiến bộ rõ ràng hơn.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>10 câu hỏi</span>
                <span>Khoảng 15 phút</span>
                <span>Mức độ vừa</span>
              </div>
            </div>
            <Link href="/student/practice" className={`${buttonVariants()} shrink-0`}>
              Luyện ngay
            </Link>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="progress-heading">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="progress-heading" className="text-lg font-semibold text-foreground">
            Tiến độ của bạn
          </h2>
          <Link
            href="/student/roadmap"
            className="text-sm font-medium text-blue-700 hover:text-blue-800"
          >
            Xem lộ trình
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Chuỗi ngày học</p>
              <p className="mt-2 text-2xl font-bold text-foreground">0 ngày</p>
              <p className="mt-1 text-xs text-muted-foreground">Bắt đầu phiên học đầu tiên</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Câu đã luyện</p>
              <p className="mt-2 text-2xl font-bold text-foreground">0</p>
              <p className="mt-1 text-xs text-muted-foreground">Mục tiêu tuần này: 30 câu</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Lộ trình</p>
              <p className="mt-2 text-2xl font-bold text-foreground">Chưa tạo</p>
              <p className="mt-1 text-xs text-muted-foreground">Tạo lộ trình để học đúng hướng</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
