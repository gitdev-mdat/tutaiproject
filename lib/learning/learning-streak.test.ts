import { describe, expect, it } from 'vitest';
import {
  completionResult,
  learningDay,
  learningStreakEnabled,
  previousDay,
  streakEndingOn,
  summarizeStreak,
} from './learning-streak';

describe('learningDay', () => {
  it('uses the calendar day in Vietnam (UTC+7), not the server clock', () => {
    expect(learningDay(new Date('2026-10-24T16:59:00Z'))).toBe('2026-10-24'); // 23:59 in Hà Nội
    expect(learningDay(new Date('2026-10-24T17:00:00Z'))).toBe('2026-10-25'); // 00:00 in Hà Nội
    expect(learningDay(new Date('2026-12-31T18:30:00Z'))).toBe('2027-01-01');
  });
});

describe('previousDay', () => {
  it('crosses months, years and leap days', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(previousDay('2028-03-01')).toBe('2028-02-29');
    expect(previousDay('2027-01-01')).toBe('2026-12-31');
  });
});

describe('summarizeStreak', () => {
  const days = ['2026-10-22', '2026-10-23', '2026-10-24'];

  it('counts consecutive days ending today', () => {
    expect(summarizeStreak([...days, '2026-10-25'], '2026-10-25')).toEqual({
      current: 4,
      today: true,
    });
  });

  it('keeps yesterday’s streak alive until today is over', () => {
    expect(summarizeStreak(days, '2026-10-25')).toEqual({ current: 3, today: false });
  });

  it('is broken by a missed day', () => {
    expect(summarizeStreak(days, '2026-10-26')).toEqual({ current: 0, today: false });
    expect(summarizeStreak([...days, '2026-10-26'], '2026-10-26')).toEqual({
      current: 1,
      today: true,
    });
  });

  it('ignores gaps further back', () => {
    expect(streakEndingOn(new Set(['2026-10-01', '2026-10-24', '2026-10-25']), '2026-10-25')).toBe(
      2
    );
  });
});

describe('completionResult', () => {
  it('awards a new day: from yesterday’s streak to today’s', () => {
    expect(
      completionResult(true, true, ['2026-10-23', '2026-10-24', '2026-10-25'], '2026-10-25')
    ).toEqual({ status: 'awarded', previous: 2, current: 3, today: true });
  });

  it('starts over at 1 after a missed day', () => {
    expect(completionResult(true, true, ['2026-10-20', '2026-10-25'], '2026-10-25')).toEqual({
      status: 'awarded',
      previous: 0,
      current: 1,
      today: true,
    });
  });

  it('keeps the streak for a second lesson the same day', () => {
    expect(completionResult(true, false, ['2026-10-24', '2026-10-25'], '2026-10-25')).toEqual({
      status: 'kept',
      current: 2,
      today: true,
    });
  });

  it('never awards a repeated lesson', () => {
    expect(completionResult(false, false, ['2026-10-24'], '2026-10-25')).toEqual({
      status: 'repeat',
      current: 1,
      today: false,
    });
  });
});

describe('learningStreakEnabled', () => {
  it('is off unless turned on', () => {
    expect(learningStreakEnabled(undefined)).toBe(false);
    expect(learningStreakEnabled('')).toBe(false);
    expect(learningStreakEnabled('off')).toBe(false);
    expect(learningStreakEnabled('on')).toBe(true);
    expect(learningStreakEnabled(' TRUE ')).toBe(true);
  });
});
