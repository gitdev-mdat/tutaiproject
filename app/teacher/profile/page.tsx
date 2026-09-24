import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Hồ sơ giáo viên',
  description: 'Quản lý hồ sơ giáo viên trên Tú Tài.',
};

export default function TeacherProfilePage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Hồ sơ" description="Quản lý hồ sơ giáo viên." />
      <Card>
        <CardContent className="p-8">
          <p className="text-sm text-muted-foreground text-center">
            Chức năng hồ sơ giáo viên sẽ sớm có mặt trên Tú Tài.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
