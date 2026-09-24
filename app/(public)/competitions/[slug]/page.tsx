import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { FeaturedCompetition } from '@/components/competitions/featured-competition';
import { PrizePool } from '@/components/competitions/prize-pool';
import { featuredCompetition } from '@/data/mock-competitions';

interface CompetitionDetailPageProps {
  params: {
    slug: string;
  };
}

export function generateMetadata({ params }: CompetitionDetailPageProps): Metadata {
  return {
    title: `Đấu trường ${params.slug} | Tú Tài`,
  };
}

export default function CompetitionDetailPage({ params }: CompetitionDetailPageProps) {
  // In a real implementation, fetch competition by slug
  // const competition = await fetchCompetitionBySlug(params.slug);

  // For now, we reuse the mock featured competition if it matches, or just show it anyway.
  const competition = featuredCompetition;

  if (!competition) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#020817] pt-24 pb-16">
      <div className="mx-auto max-w-5xl px-[14px] lg:px-6">
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-8">
          <Link href="/competitions" className="transition-colors hover:text-white">
            Đấu trường
          </Link>
          <span>/</span>
          <span className="text-white">{params.slug}</span>
        </div>

        <FeaturedCompetition
          competition={competition}
          prizePool={<PrizePool competition={competition} />}
        />

        <div className="rounded-[24px] bg-[#0c1a34] border border-white/5 p-8 md:p-12 mt-8">
          <h2 className="text-2xl font-bold text-white mb-6">Thông tin thêm</h2>
          <p className="text-slate-300">
            Route này hiện đóng vai trò là trang chi tiết cuộc thi. Nơi đây sẽ hiển thị toàn bộ
            thông tin đầy đủ, cơ cấu giải thưởng, thể lệ, danh sách thí sinh và bảng xếp hạng riêng
            của cuộc thi.
          </p>
        </div>
      </div>
    </main>
  );
}
