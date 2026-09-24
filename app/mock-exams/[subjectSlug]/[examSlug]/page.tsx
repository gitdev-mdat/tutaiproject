import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';

interface Props {
  params: Promise<{ subjectSlug: string; examSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { examSlug } = await params;
  return {
    title: `Đề thi thử: ${examSlug}`,
    description: `Làm đề thi thử ${examSlug} trên Tú Tài.`,
  };
}

export default async function MockExamPage({ params }: Props) {
  const { examSlug } = await params;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader title={`Đề thi thử: ${examSlug}`} className="mb-8" />
      <EmptyState
        title="Đề thi thử đang được phát triển"
        description="Đề thi sẽ sớm có mặt trên Tú Tài."
      />
    </div>
  );
}
