import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';

interface Props {
  params: Promise<{ subjectSlug: string; practiceSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { practiceSlug } = await params;
  return {
    title: `Luyện tập: ${practiceSlug}`,
    description: `Luyện tập ${practiceSlug} trên Tú Tài.`,
  };
}

export default async function PracticePage({ params }: Props) {
  const { practiceSlug } = await params;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader title={`Luyện tập: ${practiceSlug}`} className="mb-8" />
      <EmptyState
        title="Bài luyện tập đang được phát triển"
        description="Hệ thống luyện tập sẽ sớm có mặt trên Tú Tài."
      />
    </div>
  );
}
