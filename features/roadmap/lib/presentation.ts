import type {
  RoadmapActivityStatus,
  RoadmapActivityType,
  RoadmapPhaseStatus,
  RoadmapWeekStatus,
} from './types';

export const activityStatusPresentation: Record<
  RoadmapActivityStatus,
  { label: string; tone: 'muted' | 'blue' | 'green' | 'amber' }
> = {
  locked: { label: 'Đang khóa', tone: 'muted' },
  available: { label: 'Sẵn sàng', tone: 'blue' },
  in_progress: { label: 'Đang học', tone: 'blue' },
  completed: { label: 'Đã hoàn thành', tone: 'green' },
  skipped: { label: 'Đã bỏ qua', tone: 'amber' },
};

export const activityTypeLabels: Record<RoadmapActivityType, string> = {
  lesson: 'Bài học',
  practice: 'Luyện tập',
  review: 'Ôn tập',
  quiz: 'Kiểm tra',
  mock_exam: 'Thi thử',
};

export const phaseStatusPresentation: Record<RoadmapPhaseStatus, string> = {
  locked: 'Chưa mở',
  available: 'Sắp tới',
  active: 'Đang học',
  completed: 'Đã hoàn thành',
};

export const weekStatusPresentation: Record<RoadmapWeekStatus, string> = {
  locked: 'Đang khóa',
  available: 'Sẵn sàng',
  active: 'Tuần hiện tại',
  completed: 'Đã hoàn thành',
};
