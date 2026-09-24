import type { Metadata } from 'next';

import { EmptyState } from '@/components/shared/empty-state';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '404 — Trang không tồn tại',
  description: 'Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.',
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
      <EmptyState
        title="Trang không tồn tại"
        description="Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển."
        action={{
          label: 'Về trang chủ',
          href: '/',
        }}
      />
      <div className="mt-8 flex justify-center">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Quay lại trang chủ
        </Link>
      </div>
    </div>
  );
}
