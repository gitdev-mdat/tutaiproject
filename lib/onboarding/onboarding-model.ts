export const PRIMARY_SUBJECTS = [
  { code: 'MATH', label: 'Toán' },
  { code: 'PHYSICS', label: 'Vật lý' },
  { code: 'CHEMISTRY', label: 'Hóa học' },
  { code: 'BIOLOGY', label: 'Sinh học' },
] as const;

export type PrimarySubjectCode = (typeof PRIMARY_SUBJECTS)[number]['code'];

export const ACQUISITION_SOURCES = [
  'TikTok',
  'Facebook',
  'Google',
  'Bạn bè',
  'Giáo viên',
  'Trường học',
  'Khác',
] as const;

export type AcquisitionSource = (typeof ACQUISITION_SOURCES)[number];

export function isPrimarySubjectCode(value: unknown): value is PrimarySubjectCode {
  return PRIMARY_SUBJECTS.some((subject) => subject.code === value);
}

export function isAcquisitionSource(value: unknown): value is AcquisitionSource {
  return ACQUISITION_SOURCES.some((source) => source === value);
}

export function legacySubjectToCode(value: string | null | undefined): PrimarySubjectCode | null {
  const normalized = value?.trim().toLocaleLowerCase('vi');
  if (!normalized) return null;
  if (['math', 'toán', 'toan'].includes(normalized)) return 'MATH';
  if (['physics', 'lý', 'vật lý', 'ly', 'vat ly'].includes(normalized)) return 'PHYSICS';
  if (['chemistry', 'hóa', 'hóa học', 'hoa', 'hoa hoc'].includes(normalized)) return 'CHEMISTRY';
  if (['biology', 'sinh', 'sinh học', 'sinh hoc'].includes(normalized)) return 'BIOLOGY';
  return null;
}

export function parseOnboardingScore(value: unknown): number | null {
  if (typeof value === 'number')
    return Number.isFinite(value) && value >= 0 && value <= 10 ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 10 ? parsed : null;
}
