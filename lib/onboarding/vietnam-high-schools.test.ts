import { describe, expect, it } from 'vitest';

import {
  VIETNAM_HIGH_SCHOOLS,
  findHighSchoolById,
  getHighSchoolsByProvince,
  normalizeCustomHighSchoolName,
} from '@/data/vietnam-high-schools';
import {
  VIETNAM_PROVINCES_LEGACY,
  normalizeVietnameseSearch,
} from '@/data/vietnam-provinces-legacy';

describe('canonical high-school directory', () => {
  it('uses unique stable IDs and legacy province codes only', () => {
    expect(new Set(VIETNAM_HIGH_SCHOOLS.map((school) => school.id)).size).toBe(
      VIETNAM_HIGH_SCHOOLS.length
    );
    const provinceCodes = new Set(VIETNAM_PROVINCES_LEGACY.map((province) => province.code));
    expect(VIETNAM_HIGH_SCHOOLS.every((school) => provinceCodes.has(school.provinceCode))).toBe(
      true
    );
    expect(VIETNAM_HIGH_SCHOOLS.every((school) => school.type === 'THPT')).toBe(true);
  });

  it('Fixture A: returns only Đắk Nông schools for province 67', () => {
    const schools = getHighSchoolsByProvince('67');
    expect(schools.length).toBeGreaterThan(10);
    expect(schools).toContainEqual(expect.objectContaining({ name: 'THPT Gia Nghĩa' }));
    expect(schools.every((school) => school.provinceCode === '67')).toBe(true);
  });

  it('Fixture B: never includes Đắk Nông schools in Hồ Chí Minh results', () => {
    const schools = getHighSchoolsByProvince('79');
    expect(schools.length).toBeGreaterThan(0);
    expect(schools.some((school) => school.id === 'vn-67-gia-nghia')).toBe(false);
  });

  it('supports accent-insensitive partial matching', () => {
    const query = normalizeVietnameseSearch('gia nghia');
    expect(
      getHighSchoolsByProvince('67')
        .filter((school) => normalizeVietnameseSearch(school.name).includes(query))
        .map((school) => school.name)
    ).toContain('THPT Gia Nghĩa');
  });

  it('looks schools up by stable ID', () => {
    expect(findHighSchoolById('vn-74-di-an')).toMatchObject({
      name: 'THPT Dĩ An',
      provinceCode: '74',
    });
  });

  it('normalizes custom school names to one display convention', () => {
    expect(normalizeCustomHighSchoolName(' Trường Trung học phổ thông Tương Lai ')).toBe(
      'THPT Tương Lai'
    );
    expect(normalizeCustomHighSchoolName('THPT   Tương Lai')).toBe('THPT Tương Lai');
    expect(normalizeCustomHighSchoolName('Tương Lai')).toBe('THPT Tương Lai');
  });
});
