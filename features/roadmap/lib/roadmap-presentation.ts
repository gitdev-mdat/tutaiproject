import type {
  DailyLearningActivity,
  RoadmapStageItem,
  StudentRoadmap,
  StudentRoadmapDashboard,
} from './types';

export interface RoadmapJourneyCard {
  id: string;
  order: number;
  title: string;
  description: string;
}

export interface StudentRoadmapPresentation {
  subject: string;
  targetScore: number;
  percentage: number;
  currentLesson: DailyLearningActivity;
  quickCheck?: DailyLearningActivity;
  reason: string;
  chapterTitle: string;
  chapterItems: RoadmapStageItem[];
  journey: RoadmapJourneyCard[];
}

const JOURNEY_DESCRIPTIONS: Record<string, string> = {
  'Cực trị': 'Tìm điểm cực trị, xét tính cực trị của hàm số.',
  'Giá trị lớn nhất - nhỏ nhất': 'Tìm GTLN - GTNN trên một khoảng, đoạn.',
  'Khảo sát hàm số': 'Tổng hợp kiến thức để vẽ và khảo sát hàm số.',
  'Bảng biến thiên': 'Đọc và hoàn thiện bảng biến thiên của hàm số.',
  'Đồ thị hàm số': 'Nhận diện và phác họa các dạng đồ thị thường gặp.',
};

function isCurrentActivity(activity: DailyLearningActivity) {
  return ['recommended', 'in_progress', 'needs_review'].includes(activity.status);
}

export function buildRoadmapPresentation(
  roadmap: StudentRoadmap,
  dashboard: StudentRoadmapDashboard
): StudentRoadmapPresentation {
  const activities = [...dashboard.today.activities].sort((a, b) => a.order - b.order);
  const currentLesson =
    activities.find(isCurrentActivity) ??
    activities.find((item) => item.status !== 'locked') ??
    activities[0];

  if (!currentLesson) {
    throw new Error('Roadmap dashboard requires at least one daily activity.');
  }

  const activeStage =
    dashboard.stages.find((stage) => stage.items.some((item) => item.status === 'current')) ??
    dashboard.stages[0];
  const currentIndex = activeStage?.items.findIndex((item) => item.status === 'current') ?? -1;
  const upcomingItems = [
    ...(activeStage?.items.slice(Math.max(0, currentIndex + 1)) ?? []),
    ...dashboard.stages.slice(1).flatMap((stage) => stage.items),
  ].filter((item) => item.status !== 'completed');

  const journeySource = upcomingItems
    .map(({ id, title }) => ({ id, title }))
    .filter(
      (item, index, items) =>
        items.findIndex((candidate) => candidate.title === item.title) === index
    )
    .slice(0, 3);

  return {
    subject: roadmap.subject.name,
    targetScore: dashboard.targetScore,
    percentage: dashboard.progress.roadmapPercentage,
    currentLesson,
    quickCheck:
      activities.find((item) => item.id !== currentLesson.id && item.status === 'locked') ??
      activities[1],
    reason:
      currentLesson.recommendationReason?.message ?? dashboard.recommendationExplanation.message,
    chapterTitle: activeStage?.title ?? 'Chặng học hiện tại',
    chapterItems: activeStage?.items ?? [],
    journey: journeySource.map((item, index) => ({
      ...item,
      order: index + 3,
      description:
        JOURNEY_DESCRIPTIONS[item.title] ??
        `Tiếp tục củng cố ${item.title.toLocaleLowerCase('vi-VN')}.`,
    })),
  };
}
