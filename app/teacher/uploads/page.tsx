import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Tải lên',
  description: 'Tải lên tài liệu và nội dung giảng dạy trên Tú Tài.',
};

export default function UploadsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Tải lên" description="Tải lên tài liệu và nội dung giảng dạy." />
      <Card>
        <CardContent className="p-8">
          <p className="text-sm text-muted-foreground text-center">
            Chức năng tải lên sẽ sớm có mặt trên Tú Tài.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
