import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';

interface Props {
  params: Promise<{ subjectSlug: string; lessonSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lessonSlug } = await params;
  return {
    title: lessonSlug,
    description: `Bài học ${lessonSlug} trên Tú Tài.`,
  };
}

export default async function LessonPage({ params }: Props) {
  const { lessonSlug } = await params;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader title={lessonSlug} className="mb-8" />
      <EmptyState
        title="Bài học đang được phát triển"
        description="Nội dung bài học sẽ sớm có mặt trên Tú Tài."
      />
    </div>
  );
}
