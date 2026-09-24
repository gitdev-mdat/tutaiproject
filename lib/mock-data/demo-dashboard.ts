export interface TodayTask {
  id: string;
  title: string;
  subtitle: string;
  lessonCount: number;
  durationMinutes: number;
  impactLevel: 'high' | 'medium' | 'low';
  reasoning: string;
  completedLessons: number;
}

export interface DashboardSummary {
  targetScore: string;
  weeklyProgressPercent: number;
  strongTopicsCount: number;
  weakTopicsCount: number;
  streakDays: number;
}

export interface RecentActivity {
  id: string;
  type: 'completed' | 'practice' | 'result';
  title: string;
  timestamp?: string;
  score?: string;
}

export const DEMO_TODAY_TASK: TodayTask = {
  id: 'task-1',
  title: 'Tích phân cơ bản',
  subtitle: 'BƯỚC NÊN HỌC TIẾP',
  lessonCount: 3,
  durationMinutes: 45,
  impactLevel: 'high',
  reasoning: 'Em đã vững Hàm số nhưng còn thiếu nền tảng tích phân để bắt đầu luyện đề tổng hợp.',
  completedLessons: 0,
};

export const DEMO_DASHBOARD_SUMMARY: DashboardSummary = {
  targetScore: '9+',
  weeklyProgressPercent: 32,
  strongTopicsCount: 3,
  weakTopicsCount: 6,
  streakDays: 5,
};

export const DEMO_RECENT_ACTIVITIES: RecentActivity[] = [
  { id: 'act-1', type: 'completed', title: 'Hoàn thành Đạo hàm', timestamp: '2 giờ trước' },
  { id: 'act-2', type: 'practice', title: 'Bắt đầu Hàm số', timestamp: 'Hôm qua' },
  { id: 'act-3', type: 'result', title: 'Thi thử số 2', timestamp: '3 ngày trước' },
];
