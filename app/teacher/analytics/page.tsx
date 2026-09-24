import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Phân tích',
  description: 'Xem phân tích hiệu suất nội dung trên Tú Tài.',
};

export default function AnalyticsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Phân tích" description="Xem phân tích hiệu suất nội dung." />
      <Card>
        <CardContent className="p-8">
          <p className="text-sm text-muted-foreground text-center">
            Chức năng phân tích sẽ sớm có mặt trên Tú Tài.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
