import { Suspense } from 'react';
import type { Metadata } from 'next';

import { PricingPreview } from '@/components/home/pricing-preview';
import { PublicFooter, PublicHeader } from '@/components/layout';

export const metadata: Metadata = {
  title: 'Bảng giá',
  description:
    'So sánh Tú Tài Free và Tú Tài Plus để lựa chọn trải nghiệm học tập phù hợp với mục tiêu của em.',
};

export default function PricingPage() {
  return (
    <div className="bg-[#06152b]">
      <PublicHeader />

      <main id="main-content" tabIndex={-1}>
        <Suspense fallback={<div className="h-[800px]" />}>
          <PricingPreview variant="page" />
        </Suspense>
      </main>

      <PublicFooter />
    </div>
  );
}
