import { describe, expect, it } from 'vitest';
import { buildRankingPresentation } from './ranking-presentation';
import type { RankingSnapshot } from './types';

const snapshot: RankingSnapshot = {
  sourceLabel: 'Bảng xếp hạng tổng hợp',
  leaders: [
    { rank: 1, studentName: 'Trần Gia Huy', school: 'THPT A', score: 9.75 },
    { rank: 2, studentName: 'Nguyễn Minh Anh', school: 'THPT B', score: 9.5 },
    { rank: 3, studentName: 'Lê Hoàng Nam', school: 'THPT C', score: 9.5 },
  ],
  currentStudent: {
    rank: 46,
    participantCount: 1284,
    percentile: 4,
    score: 8.33,
    sourceAttemptId: 'attempt-1',
  },
};

describe('ranking presentation', () => {
  it('keeps live ranking values and builds the next academic milestone', () => {
    const result = buildRankingPresentation(snapshot);

    expect(result.summary).toMatchObject({ rank: 46, percentile: 4, score: 8.33, rankDelta: 6 });
    expect(result.milestone).toEqual({
      targetPercentile: 3,
      targetScore: 8.51,
      scoreRemaining: 0.18,
    });
    expect(result.nearbyStudents.map((student) => student.score)).toEqual([
      9.25, 9, 8.9, 8.45, 8.4, 8.33, 8.3, 8.28,
    ]);
    expect(result.nearbyStudents.find((student) => student.isCurrentUser)?.rank).toBe(46);
  });

  it('does not fabricate a personal rank when no eligible result exists', () => {
    const result = buildRankingPresentation({ ...snapshot, currentStudent: undefined });

    expect(result.summary).toBeUndefined();
    expect(result.milestone).toBeUndefined();
    expect(result.nearbyStudents).toEqual([]);
  });
});
