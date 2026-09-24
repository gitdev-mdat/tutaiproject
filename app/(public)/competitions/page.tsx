import * as React from 'react';
import { Metadata } from 'next';
import { CompetitionHero } from '@/components/competitions/competition-hero';
import { Leaderboard } from '@/components/competitions/leaderboard';
import { CompetitionArchive } from '@/components/competitions/competition-archive';
import { CompetitionRules } from '@/components/competitions/competition-rules';
import { HowItWorks } from '@/components/competitions/how-it-works';
import { PlusCTA } from '@/components/competitions/plus-cta';

import {
  featuredCompetition,
  mockLeaderboard,
  currentUserRank,
  competitionArchive,
} from '@/data/mock-competitions';

export const metadata: Metadata = {
  title: 'Đấu trường Tú Tài | Cuộc thi học thuật',
  description:
    'Thử sức cùng những học sinh có cùng mục tiêu, leo bảng xếp hạng và chinh phục những phần thưởng xứng đáng với năng lực của em.',
};

export default function CompetitionsPage() {
  return (
    <main className="min-h-screen bg-[#020817]">
      <CompetitionHero competition={featuredCompetition} />

      {/* Leaderboard */}
      <section className="relative bg-[#051024]">
        <div className="absolute inset-0 bg-gradient-to-b from-[#020817] to-transparent h-32" />
        <Leaderboard entries={mockLeaderboard} currentUserRank={currentUserRank} />
      </section>

      {/* Archive */}
      <section>
        <CompetitionArchive competitions={competitionArchive} />
      </section>

      {/* How it works & Rules */}
      <section>
        <HowItWorks />
        <CompetitionRules />
      </section>

      {/* Conversion CTA */}
      <PlusCTA />
    </main>
  );
}
