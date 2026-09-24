export const FREE_DAILY_EXAM_LIMIT = 3;

export interface DailyExamUsage {
  date: string;
  examIds: string[];
}

export function currentUsageDate(now = new Date()): string {
  const vietnamTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return vietnamTime.toISOString().slice(0, 10);
}

export function parseDailyExamUsage(value: string | undefined, now = new Date()): DailyExamUsage {
  const today = currentUsageDate(now);
  if (!value) return { date: today, examIds: [] };

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<DailyExamUsage>;
    if (parsed.date !== today || !Array.isArray(parsed.examIds)) {
      return { date: today, examIds: [] };
    }

    return {
      date: today,
      examIds: parsed.examIds.filter((examId): examId is string => typeof examId === 'string'),
    };
  } catch {
    return { date: today, examIds: [] };
  }
}

export function recordExamStart(
  usage: DailyExamUsage,
  examId: string
): { usage: DailyExamUsage; limitReached: boolean } {
  if (usage.examIds.includes(examId)) {
    return { usage, limitReached: false };
  }

  if (usage.examIds.length >= FREE_DAILY_EXAM_LIMIT) {
    return { usage, limitReached: true };
  }

  return {
    usage: { ...usage, examIds: [...usage.examIds, examId] },
    limitReached: false,
  };
}

export function serializeDailyExamUsage(usage: DailyExamUsage): string {
  return encodeURIComponent(JSON.stringify(usage));
}
