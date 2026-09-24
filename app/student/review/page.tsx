import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Ôn tập',
  description: 'Phiên ôn tập theo lịch trên Tú Tài.',
};

export default function ReviewPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Ôn tập" description="Phiên ôn tập theo lịch." />
      <Card>
        <CardContent className="p-8">
          <p className="text-sm text-muted-foreground text-center">
            Chức năng ôn tập sẽ sớm có mặt trên Tú Tài.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
