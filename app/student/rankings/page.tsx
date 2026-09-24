'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getInitialStudentExperienceState,
  getRankingSnapshot,
  getRankingSnapshotFromState,
} from '@/features/student-experience/lib/student-experience-service';
import { StudentRankingsOverview } from '@/features/student-experience/components/student-rankings-overview';

function RankingsContent() {
  const searchParams = useSearchParams();
  const competitionId = searchParams.get('competition') ?? undefined;
  const [ranking, setRanking] = React.useState(() =>
    getRankingSnapshotFromState(getInitialStudentExperienceState(), competitionId)
  );
  React.useEffect(() => {
    const hydration = window.setTimeout(() => setRanking(getRankingSnapshot(competitionId)), 0);
    return () => window.clearTimeout(hydration);
  }, [competitionId]);
  return <StudentRankingsOverview snapshot={ranking} />;
}

export default function StudentRankingsPage() {
  return (
    <React.Suspense>
      <RankingsContent />
    </React.Suspense>
  );
}
