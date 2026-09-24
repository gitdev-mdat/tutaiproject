import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';

interface Props {
  params: Promise<{ subjectSlug: string; topicSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subjectSlug, topicSlug } = await params;
  const name = topicSlug.charAt(0).toUpperCase() + topicSlug.slice(1);
  return {
    title: `${name} — ${subjectSlug}`,
    description: `Học về chủ đề ${name} trên Tú Tài.`,
  };
}

export default async function TopicPage({ params }: Props) {
  const { topicSlug } = await params;
  const name = topicSlug.charAt(0).toUpperCase() + topicSlug.slice(1);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader title={name} className="mb-8" />
      <EmptyState
        title="Nội dung đang được phát triển"
        description="Chủ đề này sẽ sớm có bài học và luyện tập."
      />
    </div>
  );
}
