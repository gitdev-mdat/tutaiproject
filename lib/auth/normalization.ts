export function normalizeUsername(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

export function normalizePhone(value: string): string {
  const compact = value.trim().replace(/[\s.()-]/g, '');
  if (/^0\d{9}$/.test(compact)) return `+84${compact.slice(1)}`;
  if (/^84\d{9}$/.test(compact)) return `+${compact}`;
  return compact;
}

export function isValidVietnamesePhone(value: string): boolean {
  return /^\+84(3[2-9]|5[2-9]|7[06-9]|8\d|9\d)\d{7}$/.test(normalizePhone(value));
}

export function isValidUsername(value: string): boolean {
  return /^[a-z0-9_]{4,24}$/.test(normalizeUsername(value));
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}
