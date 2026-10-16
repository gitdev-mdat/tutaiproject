/** 7.5 → "7,5"; 8 → "8". */
export function formatScore(score: number): string {
  return score.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
}

/** Whole minutes left until the deadline, never below zero. */
export function minutesLeft(deadlineAt: string, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(deadlineAt) - now) / 60_000));
}

/** "16/10/2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

/** "12:05". */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const mm = String(minutes).padStart(hours ? 2 : 1, '0');
  const ss = String(rest).padStart(2, '0');
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
