import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Quản lý người dùng',
  description: 'Quản lý tài khoản người dùng trên Tú Tài.',
};

export default function UsersPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Người dùng" description="Quản lý tài khoản người dùng." />
      <Card>
        <CardContent className="p-8">
          <p className="text-sm text-muted-foreground text-center">
            Chức năng quản lý người dùng sẽ sớm có mặt trên Tú Tài.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
