import { describe, expect, it } from 'vitest';
import type { AttemptSummary, LessonPracticeOverview } from '@/lib/practice/practice-service';
import { practiceState } from './practice-state';

const attempt = (patch: Partial<AttemptSummary>): AttemptSummary => ({
  id: 'a1',
  lessonId: 'l1',
  mode: 'LESSON',
  status: 'IN_PROGRESS',
  correctCount: null,
  totalCount: 10,
  answeredCount: 0,
  startedAt: '2026-11-24T00:00:00Z',
  completedAt: null,
  passed: false,
  ...patch,
});

const overview = (patch: Partial<LessonPracticeOverview>): LessonPracticeOverview => ({
  lessonId: 'l1',
  questionCount: 10,
  inProgress: null,
  lastCompleted: null,
  best: null,
  completedCount: 0,
  ...patch,
});

describe('practiceState', () => {
  it('is unavailable without an overview', () => {
    expect(practiceState(null)).toBe('unavailable');
  });

  it('is empty when the lesson has no practice questions', () => {
    expect(practiceState(overview({ questionCount: 0 }))).toBe('empty');
  });

  it('is ready when questions exist and nothing was started', () => {
    expect(practiceState(overview({}))).toBe('ready');
  });

  it('is opened, not "in progress", for a session with no answer yet', () => {
    expect(practiceState(overview({ inProgress: attempt({ answeredCount: 0 }) }))).toBe('opened');
  });

  it('is in progress once a question of the open session is answered', () => {
    expect(practiceState(overview({ inProgress: attempt({ answeredCount: 3 }) }))).toBe(
      'in-progress'
    );
  });

  it('is passed or retry from the best finished session', () => {
    const done = attempt({ status: 'COMPLETED', answeredCount: 10, correctCount: 9, passed: true });
    expect(practiceState(overview({ best: done, completedCount: 1 }))).toBe('passed');
    const low = { ...done, correctCount: 4, passed: false };
    expect(practiceState(overview({ best: low, completedCount: 1 }))).toBe('retry');
  });

  it('prefers the open session over earlier finished ones', () => {
    const done = attempt({ status: 'COMPLETED', answeredCount: 10, correctCount: 9, passed: true });
    expect(
      practiceState(overview({ best: done, inProgress: attempt({ id: 'a2', answeredCount: 0 }) }))
    ).toBe('opened');
  });
});
