import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Kiểm duyệt nội dung',
  description: 'Kiểm duyệt nội dung trên nền tảng Tú Tài.',
};

export default function ModerationPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Kiểm duyệt" description="Kiểm duyệt nội dung trên nền tảng." />
      <Card>
        <CardContent className="p-8">
          <p className="text-sm text-muted-foreground text-center">
            Chức năng kiểm duyệt sẽ sớm có mặt trên Tú Tài.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
