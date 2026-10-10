import { normalizeVietnameseSearch } from './vietnam-provinces-legacy';

export interface HighSchool {
  id: string;
  name: string;
  provinceCode: string;
  districtName?: string;
  type: 'THPT';
}

/**
 * Canonical, curated THPT directory for the first product phase.
 *
 * Names follow the `THPT [proper name]` display convention. Province codes
 * intentionally use the same pre-2025 codes as vietnam-provinces-legacy.ts.
 * The custom-school path remains available while nationwide coverage grows.
 */
export const VIETNAM_HIGH_SCHOOLS: readonly HighSchool[] = [
  // Đắk Nông — Sở GD&ĐT Đắk Nông public school directory.
  {
    id: 'vn-67-chu-van-an',
    name: 'THPT Chu Văn An',
    provinceCode: '67',
    districtName: 'Gia Nghĩa',
    type: 'THPT',
  },
  {
    id: 'vn-67-gia-nghia',
    name: 'THPT Gia Nghĩa',
    provinceCode: '67',
    districtName: 'Gia Nghĩa',
    type: 'THPT',
  },
  {
    id: 'vn-67-chuyen-nguyen-chi-thanh',
    name: 'THPT Chuyên Nguyễn Chí Thanh',
    provinceCode: '67',
    districtName: 'Gia Nghĩa',
    type: 'THPT',
  },
  {
    id: 'vn-67-pham-van-dong',
    name: 'THPT Phạm Văn Đồng',
    provinceCode: '67',
    districtName: 'Đắk R’lấp',
    type: 'THPT',
  },
  {
    id: 'vn-67-nguyen-tat-thanh',
    name: 'THPT Nguyễn Tất Thành',
    provinceCode: '67',
    districtName: 'Đắk R’lấp',
    type: 'THPT',
  },
  {
    id: 'vn-67-nguyen-dinh-chieu',
    name: 'THPT Nguyễn Đình Chiểu',
    provinceCode: '67',
    districtName: 'Đắk R’lấp',
    type: 'THPT',
  },
  {
    id: 'vn-67-truong-chinh',
    name: 'THPT Trường Chinh',
    provinceCode: '67',
    districtName: 'Đắk R’lấp',
    type: 'THPT',
  },
  {
    id: 'vn-67-dak-mil',
    name: 'THPT Đắk Mil',
    provinceCode: '67',
    districtName: 'Đắk Mil',
    type: 'THPT',
  },
  {
    id: 'vn-67-tran-hung-dao',
    name: 'THPT Trần Hưng Đạo',
    provinceCode: '67',
    districtName: 'Đắk Mil',
    type: 'THPT',
  },
  {
    id: 'vn-67-quang-trung',
    name: 'THPT Quang Trung',
    provinceCode: '67',
    districtName: 'Đắk Mil',
    type: 'THPT',
  },
  {
    id: 'vn-67-dak-song',
    name: 'THPT Đắk Song',
    provinceCode: '67',
    districtName: 'Đắk Song',
    type: 'THPT',
  },
  {
    id: 'vn-67-phan-dinh-phung',
    name: 'THPT Phan Đình Phùng',
    provinceCode: '67',
    districtName: 'Đắk Song',
    type: 'THPT',
  },
  {
    id: 'vn-67-phan-chu-trinh',
    name: 'THPT Phan Chu Trinh',
    provinceCode: '67',
    districtName: 'Cư Jút',
    type: 'THPT',
  },
  {
    id: 'vn-67-phan-boi-chau',
    name: 'THPT Phan Bội Châu',
    provinceCode: '67',
    districtName: 'Cư Jút',
    type: 'THPT',
  },
  {
    id: 'vn-67-nguyen-binh-khiem',
    name: 'THPT Nguyễn Bỉnh Khiêm',
    provinceCode: '67',
    districtName: 'Cư Jút',
    type: 'THPT',
  },
  {
    id: 'vn-67-krong-no',
    name: 'THPT Krông Nô',
    provinceCode: '67',
    districtName: 'Krông Nô',
    type: 'THPT',
  },
  {
    id: 'vn-67-hung-vuong',
    name: 'THPT Hùng Vương',
    provinceCode: '67',
    districtName: 'Krông Nô',
    type: 'THPT',
  },
  {
    id: 'vn-67-tran-phu',
    name: 'THPT Trần Phú',
    provinceCode: '67',
    districtName: 'Krông Nô',
    type: 'THPT',
  },
  {
    id: 'vn-67-dak-glong',
    name: 'THPT Đắk Glong',
    provinceCode: '67',
    districtName: 'Đắk Glong',
    type: 'THPT',
  },
  {
    id: 'vn-67-le-duan',
    name: 'THPT Lê Duẩn',
    provinceCode: '67',
    districtName: 'Đắk Glong',
    type: 'THPT',
  },
  {
    id: 'vn-67-le-quy-don',
    name: 'THPT Lê Quý Đôn',
    provinceCode: '67',
    districtName: 'Tuy Đức',
    type: 'THPT',
  },

  // Bình Dương — curated initial coverage; custom entry covers schools not listed yet.
  {
    id: 'vn-74-chuyen-hung-vuong',
    name: 'THPT Chuyên Hùng Vương',
    provinceCode: '74',
    districtName: 'Thủ Dầu Một',
    type: 'THPT',
  },
  {
    id: 'vn-74-vo-minh-duc',
    name: 'THPT Võ Minh Đức',
    provinceCode: '74',
    districtName: 'Thủ Dầu Một',
    type: 'THPT',
  },
  {
    id: 'vn-74-trinh-hoai-duc',
    name: 'THPT Trịnh Hoài Đức',
    provinceCode: '74',
    districtName: 'Thuận An',
    type: 'THPT',
  },
  {
    id: 'vn-74-nguyen-trai',
    name: 'THPT Nguyễn Trãi',
    provinceCode: '74',
    districtName: 'Thuận An',
    type: 'THPT',
  },
  {
    id: 'vn-74-di-an',
    name: 'THPT Dĩ An',
    provinceCode: '74',
    districtName: 'Dĩ An',
    type: 'THPT',
  },
  {
    id: 'vn-74-nguyen-an-ninh',
    name: 'THPT Nguyễn An Ninh',
    provinceCode: '74',
    districtName: 'Dĩ An',
    type: 'THPT',
  },
  {
    id: 'vn-74-ben-cat',
    name: 'THPT Bến Cát',
    provinceCode: '74',
    districtName: 'Bến Cát',
    type: 'THPT',
  },
  {
    id: 'vn-74-tan-phuoc-khanh',
    name: 'THPT Tân Phước Khánh',
    provinceCode: '74',
    districtName: 'Tân Uyên',
    type: 'THPT',
  },
  {
    id: 'vn-74-huynh-van-nghe',
    name: 'THPT Huỳnh Văn Nghệ',
    provinceCode: '74',
    districtName: 'Tân Uyên',
    type: 'THPT',
  },
  {
    id: 'vn-74-phuoc-vinh',
    name: 'THPT Phước Vĩnh',
    provinceCode: '74',
    districtName: 'Phú Giáo',
    type: 'THPT',
  },

  // TP. Hồ Chí Minh — Sở GD&ĐT public THPT unit directory.
  {
    id: 'vn-79-nguyen-thi-minh-khai',
    name: 'THPT Nguyễn Thị Minh Khai',
    provinceCode: '79',
    districtName: 'Quận 3',
    type: 'THPT',
  },
  {
    id: 'vn-79-tran-phu',
    name: 'THPT Trần Phú',
    provinceCode: '79',
    districtName: 'Tân Phú',
    type: 'THPT',
  },
  {
    id: 'vn-79-nguyen-hien',
    name: 'THPT Nguyễn Hiền',
    provinceCode: '79',
    districtName: 'Quận 11',
    type: 'THPT',
  },
  {
    id: 'vn-79-nguyen-huu-canh',
    name: 'THPT Nguyễn Hữu Cảnh',
    provinceCode: '79',
    districtName: 'Bình Thạnh',
    type: 'THPT',
  },
  {
    id: 'vn-79-bui-thi-xuan',
    name: 'THPT Bùi Thị Xuân',
    provinceCode: '79',
    districtName: 'Quận 1',
    type: 'THPT',
  },
  {
    id: 'vn-79-le-hong-phong',
    name: 'THPT Chuyên Lê Hồng Phong',
    provinceCode: '79',
    districtName: 'Quận 5',
    type: 'THPT',
  },
  {
    id: 'vn-79-gia-dinh',
    name: 'THPT Gia Định',
    provinceCode: '79',
    districtName: 'Bình Thạnh',
    type: 'THPT',
  },
  {
    id: 'vn-79-tran-van-giau',
    name: 'THPT Trần Văn Giàu',
    provinceCode: '79',
    districtName: 'Bình Thạnh',
    type: 'THPT',
  },
  {
    id: 'vn-79-tran-huu-trang',
    name: 'THPT Trần Hữu Trang',
    provinceCode: '79',
    districtName: 'Quận 5',
    type: 'THPT',
  },
  {
    id: 'vn-79-binh-khanh',
    name: 'THPT Bình Khánh',
    provinceCode: '79',
    districtName: 'Cần Giờ',
    type: 'THPT',
  },
] as const;

export function getHighSchoolsByProvince(provinceCode: string): readonly HighSchool[] {
  return VIETNAM_HIGH_SCHOOLS.filter((school) => school.provinceCode === provinceCode);
}

export function findHighSchoolById(id: string): HighSchool | undefined {
  return VIETNAM_HIGH_SCHOOLS.find((school) => school.id === id);
}

export function findHighSchoolByName(provinceCode: string, name: string): HighSchool | undefined {
  const normalized = normalizeVietnameseSearch(name).replace(/^truong\s+/, '');
  return getHighSchoolsByProvince(provinceCode).find(
    (school) => normalizeVietnameseSearch(school.name).replace(/^truong\s+/, '') === normalized
  );
}

export function normalizeCustomHighSchoolName(value: string): string {
  const compact = value.trim().replace(/\s+/g, ' ');
  const properName = compact
    .replace(/^(?:trường\s+)?(?:trung\s+học\s+phổ\s+thông|thpt)\s*/iu, '')
    .trim();
  return properName ? `THPT ${properName}` : '';
}
