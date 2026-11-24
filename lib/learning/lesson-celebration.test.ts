import { describe, expect, it } from 'vitest';
import {
  afterNavigation,
  isFirstCompletion,
  NO_CELEBRATION,
  soundSettingOn,
} from './lesson-celebration';

describe('isFirstCompletion', () => {
  const base = { next: 5, last: 5, opened: 4, learned: false, celebrated: false };

  it('celebrates the first arrival on the last part', () => {
    expect(isFirstCompletion(base)).toBe(true);
  });

  it('does not celebrate a part before the last', () => {
    expect(isFirstCompletion({ ...base, next: 4, opened: 3 })).toBe(false);
  });

  it('does not celebrate a lesson already learned (refresh, reopen)', () => {
    expect(isFirstCompletion({ ...base, learned: true })).toBe(false);
  });

  it('does not celebrate when the last part was already open (back and return)', () => {
    expect(isFirstCompletion({ ...base, opened: 5 })).toBe(false);
  });

  it('celebrates at most once per page view', () => {
    expect(isFirstCompletion({ ...base, celebrated: true })).toBe(false);
  });
});

describe('afterNavigation', () => {
  const playing = { run: 1, at: 1000 };

  it('keeps the celebration while the student stays on the last part', () => {
    expect(afterNavigation(playing, 5, 5)).toBe(playing);
  });

  it('spends it once the student leaves the last part', () => {
    expect(afterNavigation(playing, 0, 5)).toEqual(NO_CELEBRATION);
    // Coming back finds nothing to play.
    expect(afterNavigation(afterNavigation(playing, 3, 5), 5, 5)).toEqual(NO_CELEBRATION);
  });
});

describe('soundSettingOn', () => {
  it('is on by default', () => {
    expect(soundSettingOn(null)).toBe(true);
    expect(soundSettingOn('on')).toBe(true);
  });

  it('respects a student who turned it off', () => {
    expect(soundSettingOn('off')).toBe(false);
  });
});
