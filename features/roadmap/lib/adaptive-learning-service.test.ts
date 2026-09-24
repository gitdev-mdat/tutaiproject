import { describe, expect, it } from 'vitest';
import {
  deriveTodayRoadmap,
  submitLessonRetake,
  submitPractice,
  submitRetry,
} from './adaptive-learning-service';
import type { AdaptiveLearningState } from './types';

function state(stage: AdaptiveLearningState['stage']): AdaptiveLearningState {
  return {
    version: 1,
    stage,
    lessonProgress: 35,
    practiceAnswers: {},
    retryAnswers: {},
    practiceAttempts: [],
    updatedAt: '2026-09-09T00:00:00.000Z',
  };
}

describe('adaptive roadmap decisions', () => {
  it('resumes the initial lesson and keeps practice locked', () => {
    const dashboard = deriveTodayRoadmap(state('lesson'));

    expect(dashboard.today.activities.map((activity) => activity.status)).toEqual([
      'in_progress',
      'locked',
    ]);
    expect(dashboard.today.activities[0].progress).toBe(35);
  });

  it('inserts a targeted review after practice analysis', () => {
    const dashboard = deriveTodayRoadmap(state('analysis'));

    expect(dashboard.today.activities.map((activity) => activity.type)).toEqual([
      'review',
      'retry',
    ]);
    expect(dashboard.today.activities[0].status).toBe('needs_review');
    expect(dashboard.recommendationExplanation.message).toContain('phần ôn đúng');
  });

  it('recommends the next topic and updates progress after mastery', () => {
    const dashboard = deriveTodayRoadmap(state('mastery_complete'));

    expect(dashboard.today.activities[0]).toMatchObject({
      title: 'Tính đơn điệu của hàm số',
      status: 'recommended',
    });
    expect(dashboard.progress.masteredTopics).toBe(5);
    expect(dashboard.progress.roadmapPercentage).toBe(42);
  });

  it('separates passed practice from the needs-review outcome', async () => {
    const passed = await submitPractice({ q1: 'a', q2: 'b', q3: 'b', q4: 'a', q5: 'b' });
    const needsReview = await submitPractice({ q1: 'b', q2: 'a', q3: 'a', q4: 'b', q5: 'a' });

    expect(passed.stage).toBe('practice_passed');
    expect(passed.outcome?.type).toBe('practice_passed');
    expect(needsReview.stage).toBe('analysis');
    expect(needsReview.outcome?.type).toBe('practice_needs_review');
  });

  it('records retakes as new attempts without changing the roadmap stage', async () => {
    const attempt = await submitLessonRetake('basic-derivative', {
      bd1: 'a',
      bd2: 'b',
      bd3: 'a',
    });

    expect(attempt).toMatchObject({ type: 'retake', passed: true, correct: 3, total: 3 });
  });

  it('celebrates only a successful retry outcome', async () => {
    const passed = await submitRetry({ r1: 'a', r2: 'b', r3: 'a' });
    const needsAnotherTry = await submitRetry({ r1: 'b', r2: 'a', r3: 'b' });

    expect(passed.stage).toBe('mastery_complete');
    expect(passed.outcome?.type).toBe('retry_passed');
    expect(needsAnotherTry.stage).toBe('retry_needs_review');
    expect(needsAnotherTry.outcome).toBeUndefined();
  });
});
