import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Cài đặt',
  description: 'Cài đặt quản trị trên Tú Tài.',
};

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Cài đặt" description="Cài đặt quản trị nền tảng." />
      <Card>
        <CardContent className="p-8">
          <p className="text-sm text-muted-foreground text-center">
            Chức năng cài đặt sẽ sớm có mặt trên Tú Tài.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
