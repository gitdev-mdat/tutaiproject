import { describe, expect, it } from 'vitest';

import {
  VIETNAM_PROVINCES_LEGACY,
  findLegacyProvinceByName,
  normalizeVietnameseSearch,
} from '@/data/vietnam-provinces-legacy';

describe('legacy Vietnam province dataset', () => {
  it('contains exactly 63 uniquely coded pre-merger units', () => {
    expect(VIETNAM_PROVINCES_LEGACY).toHaveLength(63);
    expect(new Set(VIETNAM_PROVINCES_LEGACY.map(({ code }) => code)).size).toBe(63);
  });

  it.each(['Đắk Nông', 'Bình Dương', 'Bà Rịa - Vũng Tàu', 'Quảng Nam', 'Bắc Giang'])(
    'contains %s',
    (name) => expect(findLegacyProvinceByName(name)?.name).toContain(name)
  );

  it('supports accent-insensitive search terms', () => {
    const matches = VIETNAM_PROVINCES_LEGACY.filter(({ name }) =>
      normalizeVietnameseSearch(name).includes(normalizeVietnameseSearch('dak'))
    );
    expect(matches.map(({ name }) => name)).toEqual(['Đắk Lắk', 'Đắk Nông']);
  });
});
