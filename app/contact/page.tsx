import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Liên hệ',
  description: 'Liên hệ với đội ngũ Tú Tài.',
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader title="Liên hệ" description="Gửi tin nhắn cho đội ngũ Tú Tài" className="mb-8" />
      <Card>
        <CardContent className="p-8">
          <p className="text-muted-foreground leading-relaxed text-center">
            Thông tin liên hệ sẽ sớm có mặt trên Tú Tài.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
