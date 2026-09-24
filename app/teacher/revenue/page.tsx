import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Doanh thu',
  description: 'Xem và rút doanh thu từ nội dung trên Tú Tài.',
};

export default function RevenuePage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Doanh thu" description="Xem và rút doanh thu từ nội dung." />
      <Card>
        <CardContent className="p-8">
          <p className="text-sm text-muted-foreground text-center">
            Chức năng doanh thu sẽ sớm có mặt trên Tú Tài.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
