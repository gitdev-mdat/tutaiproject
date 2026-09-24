import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Flashcards',
  description: 'Ôn tập với flashcards trên Tú Tài.',
};

export default function FlashcardsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Flashcards" description="Ôn tập với flashcards." />
      <Card>
        <CardContent className="p-8">
          <p className="text-sm text-muted-foreground text-center">
            Chức năng flashcards sẽ sớm có mặt trên Tú Tài.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
