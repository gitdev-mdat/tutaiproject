import { getHighSchoolsByProvince, type HighSchool } from '@/data/vietnam-high-schools';

export interface HighSchoolDirectory {
  listByProvince(provinceCode: string): Promise<readonly HighSchool[]>;
}

/** Local implementation of the same async boundary an API-backed directory can implement later. */
export const localHighSchoolDirectory: HighSchoolDirectory = {
  async listByProvince(provinceCode) {
    return getHighSchoolsByProvince(provinceCode);
  },
};
