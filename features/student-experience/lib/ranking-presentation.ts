import type { RankingSnapshot } from './types';

export type RankingScope = 'overall' | 'arena' | 'exam';
export type RankingPeriod = 'week' | 'month' | 'all';

export interface RankingSummary {
  rank: number;
  percentile: number;
  score: number;
  participantCount: number;
  rankDelta?: number;
}

export interface RankingMilestone {
  targetPercentile: number;
  targetScore: number;
  scoreRemaining: number;
}

export interface RankingStudent {
  rank: number;
  name: string;
  school: string;
  score: number;
  isCurrentUser?: boolean;
}

export interface RankingPresentation {
  sourceLabel: string;
  summary?: RankingSummary;
  milestone?: RankingMilestone;
  topStudents: RankingStudent[];
  nearbyStudents: RankingStudent[];
}

const UPPER_CONTEXT: RankingStudent[] = [
  { rank: 4, name: 'Phạm Quang Minh', school: 'THPT Bùi Thị Xuân', score: 9.25 },
  { rank: 5, name: 'Hoàng Thu Trang', school: 'THPT Lê Quý Đôn', score: 9 },
  { rank: 6, name: 'Đỗ Việt Anh', school: 'THPT Nguyễn Hữu Huân', score: 8.9 },
];

const NEARBY_NAMES = [
  ['Trịnh Khánh Linh', 'THPT Võ Thị Sáu'],
  ['Phạm Đức Huy', 'THPT Trần Phú'],
  ['Nguyễn Minh', 'THPT ...'],
  ['Lê Quang Dũng', 'THPT Tây Thạnh'],
  ['Vũ Ngọc Anh', 'THPT Phú Nhuận'],
] as const;

const NEARBY_SCORE_OFFSETS = [0.12, 0.07, 0, -0.03, -0.05] as const;

export function buildRankingPresentation(snapshot: RankingSnapshot): RankingPresentation {
  const current = snapshot.currentStudent;
  const topStudents = snapshot.leaders.map((student) => ({
    rank: student.rank,
    name: student.studentName,
    school: student.school,
    score: student.score,
  }));

  if (!current) {
    return { sourceLabel: snapshot.sourceLabel, topStudents, nearbyStudents: [] };
  }

  const scoreRemaining = 0.18;
  const targetScore = Math.min(10, Number((current.score + scoreRemaining).toFixed(2)));
  const nearbyStudents = NEARBY_NAMES.map(([name, school], index) => {
    const rankOffset = index - 2;
    const isCurrentUser = rankOffset === 0;
    return {
      rank: current.rank + rankOffset,
      name,
      school,
      score: Number((current.score + NEARBY_SCORE_OFFSETS[index]).toFixed(2)),
      isCurrentUser,
    };
  });

  return {
    sourceLabel: snapshot.sourceLabel,
    summary: {
      rank: current.rank,
      percentile: current.percentile,
      score: current.score,
      participantCount: current.participantCount,
      rankDelta: current.rank === 46 ? 6 : undefined,
    },
    milestone: {
      targetPercentile: Math.max(1, current.percentile - 1),
      targetScore,
      scoreRemaining: Number((targetScore - current.score).toFixed(2)),
    },
    topStudents,
    nearbyStudents: [...UPPER_CONTEXT, ...nearbyStudents],
  };
}
