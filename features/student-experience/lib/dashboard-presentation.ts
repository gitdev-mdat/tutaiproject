export interface DashboardCourseMeta {
  subject: string;
  completedTopics: number;
  totalTopics: number;
}

export interface ContinueLearningItem {
  subject: string;
  title: string;
  eyebrow: string;
  completedUnits: number;
  totalUnits: number;
  href: string;
}

export interface DailyGoalItem {
  id: string;
  label: string;
  completed: boolean;
}

export const COURSE_PROGRESS_META: DashboardCourseMeta[] = [
  { subject: 'Toán', completedTopics: 12, totalTopics: 29 },
  { subject: 'Vật lý', completedTopics: 9, totalTopics: 29 },
  { subject: 'Hóa học', completedTopics: 8, totalTopics: 30 },
];

export const CONTINUE_LEARNING: ContinueLearningItem = {
  subject: 'Toán',
  title: 'Bài 3. Hàm số bậc hai và đồ thị',
  eyebrow: 'Tiếp nối hành trình chinh phục 2027',
  completedUnits: 3,
  totalUnits: 6,
  href: '/student/learn/activity-monotonicity',
};

export const DAILY_GOALS: DailyGoalItem[] = [
  { id: 'watch-math', label: 'Xem 1 video bài giảng Toán', completed: true },
  { id: 'practice-physics', label: 'Làm 10 câu luyện đề Vật lý', completed: true },
  { id: 'review-chemistry', label: 'Ôn lại công thức Hóa học', completed: true },
  { id: 'review-mistakes', label: 'Xem lại bài làm sai', completed: false },
];
