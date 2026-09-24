export function safeReturnPath(value: unknown, fallback = '/student/dashboard'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  if (value.includes('\\') || /[\u0000-\u001f]/.test(value)) {
    return fallback;
  }

  try {
    const parsed = new URL(value, 'https://tutai.local');
    if (parsed.origin !== 'https://tutai.local') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
