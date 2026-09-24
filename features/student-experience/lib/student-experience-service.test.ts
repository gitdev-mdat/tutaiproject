import { beforeEach, describe, expect, it } from 'vitest';
import {
  getRankingSnapshot,
  getStudentExperienceState,
  getStudentHomeOverview,
  registerForCompetition,
  recordAssessmentSubmission,
} from './student-experience-service';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('connected student experience state', () => {
  beforeEach(() => {
    Object.assign(globalThis, { window: { localStorage: new MemoryStorage() } });
  });

  it('changes completed-work counts when the selected period changes', async () => {
    const day = await getStudentHomeOverview('day');
    const week = await getStudentHomeOverview('week');
    const month = await getStudentHomeOverview('month');

    expect(day.summary.practiceCompleted).toBeLessThan(week.summary.practiceCompleted);
    expect(week.summary.examsCompleted).toBeLessThan(month.summary.examsCompleted);
    expect(week.activitySeries.reduce((total, point) => total + point.practice, 0)).toBe(
      week.summary.practiceCompleted
    );
  });

  it('aggregates course progress, separate performance trends, ranking, and recent history', async () => {
    const overview = await getStudentHomeOverview('month');

    expect(overview.courseProgress).toHaveLength(3);
    expect(overview.practiceTrend.map((point) => point.value)).toEqual([80, 67, 83]);
    expect(overview.examTrend.map((point) => point.value)).toEqual([8.5, 7.75]);
    expect(overview.ranking?.rank).toBe(46);
    expect(overview.recentReward?.sourceEventId).toBe('arena-derivative-07');
    expect(overview.recentActivity.some((activity) => activity.kind === 'arena')).toBe(true);
  });

  it('stores knowledge evidence from a completed practice submission', () => {
    const attempt = recordAssessmentSubmission({
      kind: 'practice',
      activityId: 'practice-new',
      title: 'Cực trị · Luyện tập',
      correct: 2,
      total: 3,
      evidence: [
        { knowledgePointId: 'node-calculus-extrema', title: 'Cực trị', correct: 2, total: 3 },
      ],
    });
    const state = getStudentExperienceState();

    expect(state.attempts.at(-1)?.id).toBe(attempt.id);
    expect(state.attempts.at(-1)?.evidence[0]?.sourceAttemptId).toBe(attempt.id);
  });

  it('only creates ranking and rewards from explicitly eligible competitive attempts', () => {
    recordAssessmentSubmission({
      kind: 'exam',
      activityId: 'casual-exam',
      title: 'Đề luyện tập',
      correct: 3,
      total: 3,
      rankingEligible: false,
      evidence: [],
    });
    const rankingBeforeArena = getRankingSnapshot().currentStudent;

    const arena = recordAssessmentSubmission({
      kind: 'arena',
      activityId: 'arena-derivative-08',
      title: 'Đấu trường Đạo hàm #08',
      correct: 6,
      total: 6,
      rankingEligible: true,
      evidence: [],
    });
    const state = getStudentExperienceState();
    const rankingAfterArena = getRankingSnapshot().currentStudent;

    expect(rankingBeforeArena?.sourceAttemptId).not.toContain('casual-exam');
    expect(rankingAfterArena?.sourceAttemptId).toBe(arena.id);
    expect(state.rewards.some((reward) => reward.sourceAttemptId === arena.id)).toBe(true);
  });

  it('persists competition registration without duplicates', () => {
    registerForCompetition('arena-integral-09');
    registerForCompetition('arena-integral-09');

    expect(
      getStudentExperienceState().registeredCompetitionIds.filter(
        (id) => id === 'arena-integral-09'
      )
    ).toHaveLength(1);
  });
});
