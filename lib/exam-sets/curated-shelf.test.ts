import { describe, expect, it } from 'vitest';

import {
  getCuratedShelfMaxIndex,
  getCuratedShelfPageSize,
  getNextCuratedShelfIndex,
  hasCuratedShelfNavigation,
} from './curated-shelf';

describe('curated exam shelf', () => {
  it.each([1, 2, 3])('keeps %i curated exams in the static layout', (totalItems) => {
    expect(hasCuratedShelfNavigation(totalItems)).toBe(false);
  });

  it.each([4, 8])('enables navigation for %i curated exams', (totalItems) => {
    expect(hasCuratedShelfNavigation(totalItems)).toBe(true);
  });

  it('uses three desktop cards, two tablet cards, and one mobile card per view', () => {
    expect(getCuratedShelfPageSize(false, false)).toBe(3);
    expect(getCuratedShelfPageSize(true, false)).toBe(2);
    expect(getCuratedShelfPageSize(true, true)).toBe(1);
  });

  it('moves one card at a time and clamps at both ends', () => {
    expect(getCuratedShelfMaxIndex(8, 3)).toBe(5);
    expect(getNextCuratedShelfIndex(0, -1, 8, 3)).toBe(0);
    expect(getNextCuratedShelfIndex(0, 1, 8, 3)).toBe(1);
    expect(getNextCuratedShelfIndex(1, 1, 8, 3)).toBe(2);
    expect(getNextCuratedShelfIndex(5, 1, 8, 3)).toBe(5);
  });

  it('keeps a later featured position reachable without changing shelf geometry', () => {
    const featuredIndex = 6;
    const pageSize = 3;
    const finalStart = getCuratedShelfMaxIndex(8, pageSize);

    expect(featuredIndex).toBeGreaterThanOrEqual(finalStart);
    expect(featuredIndex).toBeLessThan(finalStart + pageSize);
  });
});
