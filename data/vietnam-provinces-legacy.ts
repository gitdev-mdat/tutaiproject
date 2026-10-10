export type LegacyProvinceType = 'province' | 'city';

export interface LegacyVietnamProvince {
  code: string;
  name: string;
  type: LegacyProvinceType;
}

/**
 * Vietnam's 63 province-level administrative units at the 2024 cutoff,
 * before the 2025 provincial merger. Codes are the stable two-digit
 * province codes used by the national administrative classification.
 */
export const VIETNAM_PROVINCES_LEGACY: readonly LegacyVietnamProvince[] = [
  { code: '01', name: 'TP. Hà Nội', type: 'city' },
  { code: '02', name: 'Hà Giang', type: 'province' },
  { code: '04', name: 'Cao Bằng', type: 'province' },
  { code: '06', name: 'Bắc Kạn', type: 'province' },
  { code: '08', name: 'Tuyên Quang', type: 'province' },
  { code: '10', name: 'Lào Cai', type: 'province' },
  { code: '11', name: 'Điện Biên', type: 'province' },
  { code: '12', name: 'Lai Châu', type: 'province' },
  { code: '14', name: 'Sơn La', type: 'province' },
  { code: '15', name: 'Yên Bái', type: 'province' },
  { code: '17', name: 'Hòa Bình', type: 'province' },
  { code: '19', name: 'Thái Nguyên', type: 'province' },
  { code: '20', name: 'Lạng Sơn', type: 'province' },
  { code: '22', name: 'Quảng Ninh', type: 'province' },
  { code: '24', name: 'Bắc Giang', type: 'province' },
  { code: '25', name: 'Phú Thọ', type: 'province' },
  { code: '26', name: 'Vĩnh Phúc', type: 'province' },
  { code: '27', name: 'Bắc Ninh', type: 'province' },
  { code: '30', name: 'Hải Dương', type: 'province' },
  { code: '31', name: 'TP. Hải Phòng', type: 'city' },
  { code: '33', name: 'Hưng Yên', type: 'province' },
  { code: '34', name: 'Thái Bình', type: 'province' },
  { code: '35', name: 'Hà Nam', type: 'province' },
  { code: '36', name: 'Nam Định', type: 'province' },
  { code: '37', name: 'Ninh Bình', type: 'province' },
  { code: '38', name: 'Thanh Hóa', type: 'province' },
  { code: '40', name: 'Nghệ An', type: 'province' },
  { code: '42', name: 'Hà Tĩnh', type: 'province' },
  { code: '44', name: 'Quảng Bình', type: 'province' },
  { code: '45', name: 'Quảng Trị', type: 'province' },
  { code: '46', name: 'Thừa Thiên Huế', type: 'province' },
  { code: '48', name: 'TP. Đà Nẵng', type: 'city' },
  { code: '49', name: 'Quảng Nam', type: 'province' },
  { code: '51', name: 'Quảng Ngãi', type: 'province' },
  { code: '52', name: 'Bình Định', type: 'province' },
  { code: '54', name: 'Phú Yên', type: 'province' },
  { code: '56', name: 'Khánh Hòa', type: 'province' },
  { code: '58', name: 'Ninh Thuận', type: 'province' },
  { code: '60', name: 'Bình Thuận', type: 'province' },
  { code: '62', name: 'Kon Tum', type: 'province' },
  { code: '64', name: 'Gia Lai', type: 'province' },
  { code: '66', name: 'Đắk Lắk', type: 'province' },
  { code: '67', name: 'Đắk Nông', type: 'province' },
  { code: '68', name: 'Lâm Đồng', type: 'province' },
  { code: '70', name: 'Bình Phước', type: 'province' },
  { code: '72', name: 'Tây Ninh', type: 'province' },
  { code: '74', name: 'Bình Dương', type: 'province' },
  { code: '75', name: 'Đồng Nai', type: 'province' },
  { code: '77', name: 'Bà Rịa - Vũng Tàu', type: 'province' },
  { code: '79', name: 'TP. Hồ Chí Minh', type: 'city' },
  { code: '80', name: 'Long An', type: 'province' },
  { code: '82', name: 'Tiền Giang', type: 'province' },
  { code: '83', name: 'Bến Tre', type: 'province' },
  { code: '84', name: 'Trà Vinh', type: 'province' },
  { code: '86', name: 'Vĩnh Long', type: 'province' },
  { code: '87', name: 'Đồng Tháp', type: 'province' },
  { code: '89', name: 'An Giang', type: 'province' },
  { code: '91', name: 'Kiên Giang', type: 'province' },
  { code: '92', name: 'TP. Cần Thơ', type: 'city' },
  { code: '93', name: 'Hậu Giang', type: 'province' },
  { code: '94', name: 'Sóc Trăng', type: 'province' },
  { code: '95', name: 'Bạc Liêu', type: 'province' },
  { code: '96', name: 'Cà Mau', type: 'province' },
] as const;

export function normalizeVietnameseSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function findLegacyProvinceByCode(code: string): LegacyVietnamProvince | undefined {
  return VIETNAM_PROVINCES_LEGACY.find((province) => province.code === code);
}

export function findLegacyProvinceByName(name: string): LegacyVietnamProvince | undefined {
  const query = normalizeVietnameseSearch(name).replace(/^tp\s+/, '');
  return VIETNAM_PROVINCES_LEGACY.find(
    (province) => normalizeVietnameseSearch(province.name).replace(/^tp\s+/, '') === query
  );
}
