import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';

export const metadata: Metadata = {
  title: 'Đề thi thử',
  description: 'Mô phỏng kỳ thi tốt nghiệp THPT 2026 trên Tú Tài.',
};

export default function MockExamsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Đề thi thử"
        description="Mô phỏng kỳ thi tốt nghiệp THPT 2026"
        className="mb-8"
      />
      <EmptyState
        title="Đề thi thử đang được phát triển"
        description="Hệ thống thi thử sẽ sớm có mặt trên Tú Tài."
      />
    </div>
  );
}
