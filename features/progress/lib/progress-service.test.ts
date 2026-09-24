import { describe, expect, it } from 'vitest';
import { getStudentProgressDashboard } from './progress-service';

describe('getStudentProgressDashboard', () => {
  it('returns evidence for every learning signal', async () => {
    const dashboard = await getStudentProgressDashboard();

    expect(dashboard.overall.roadmapPercentage).toBeGreaterThanOrEqual(0);
    expect(dashboard.recentImprovements.every((item) => item.evidence.label.length > 0)).toBe(true);
    expect(dashboard.weakKnowledgePoints.every((item) => item.evidence.label.length > 0)).toBe(
      true
    );
  });

  it('routes an actionable weakness into the existing adaptive review flow', async () => {
    const dashboard = await getStudentProgressDashboard();
    const actionableWeakness = dashboard.weakKnowledgePoints.find((item) => item.action);

    expect(actionableWeakness?.action).toEqual({
      label: 'Ôn đúng chỗ yếu',
      href: '/student/learn/daily-sign-review',
    });
  });

  it('does not invent mastery when there is not enough evidence', async () => {
    const dashboard = await getStudentProgressDashboard();
    const extrema = dashboard.weakKnowledgePoints.find((item) => item.id === 'extrema');

    expect(extrema?.mastery).toBeNull();
    expect(extrema?.evidence.kind).toBe('insufficient_data');
  });
});
