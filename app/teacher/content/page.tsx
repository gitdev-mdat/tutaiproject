import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Quản lý nội dung',
  description: 'Quản lý nội dung giảng dạy trên Tú Tài.',
};

export default function ContentPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Nội dung" description="Quản lý nội dung giảng dạy." />
      <Card>
        <CardContent className="p-8">
          <p className="text-sm text-muted-foreground text-center">
            Chức năng quản lý nội dung sẽ sớm có mặt trên Tú Tài.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
