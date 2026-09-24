import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Cổng giáo viên',
  description: 'Quản lý nội dung và xem phân tích trên Tú Tài.',
};

export default function TeacherHomePage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Cổng giáo viên" description="Quản lý nội dung và xem phân tích." />
      <Card>
        <CardContent className="p-8">
          <p className="text-sm text-muted-foreground text-center">
            Nội dung cổng giáo viên sẽ sớm có mặt trên Tú Tài.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
