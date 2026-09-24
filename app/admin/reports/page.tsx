import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Báo cáo',
  description: 'Báo cáo và thống kê nền tảng Tú Tài.',
};

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Báo cáo" description="Báo cáo và thống kê nền tảng." />
      <Card>
        <CardContent className="p-8">
          <p className="text-sm text-muted-foreground text-center">
            Chức năng báo cáo sẽ sớm có mặt trên Tú Tài.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
