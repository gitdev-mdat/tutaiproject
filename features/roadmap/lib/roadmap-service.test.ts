import { describe, expect, it } from 'vitest';
import { MockRoadmapService } from './roadmap-service';
import { calculateRoadmapProgress, getNextRecommendedActivity } from './types';
import { mockStudentRoadmap } from './mock-data';

describe('roadmap domain', () => {
  it('calculates progress from activity statuses', () => {
    expect(calculateRoadmapProgress(mockStudentRoadmap.phases)).toEqual({
      completedActivities: 2,
      totalActivities: 5,
      percentage: 40,
    });
  });
  it('derives the in-progress activity before available activities', () => {
    expect(getNextRecommendedActivity(mockStudentRoadmap)?.id).toBe('activity-monotonicity');
  });
  it('mutates activity state through the service boundary', async () => {
    const service = new MockRoadmapService();
    const activity = await service.completeActivity('roadmap-math-2025', 'activity-monotonicity', {
      accuracy: 0.9,
    });
    expect(activity.status).toBe('completed');
    expect((await service.getStudentRoadmap()).progress.percentage).toBe(60);
  });
});
