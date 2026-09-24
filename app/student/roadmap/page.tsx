'use client';

import { useStudentRoadmap } from '@/features/roadmap/hooks/use-student-roadmap';
import {
  RoadmapCompletedView,
  RoadmapEmptyView,
  RoadmapErrorView,
  RoadmapLoadingView,
} from '@/features/roadmap/components/roadmap-status-views';
import { StudentRoadmapOverview } from '@/features/roadmap/components/student-roadmap-overview';

export default function RoadmapPage() {
  const roadmapState = useStudentRoadmap();

  if (roadmapState.state === 'loading') {
    return <RoadmapLoadingView />;
  }

  if (roadmapState.error) {
    return <RoadmapErrorView onRetry={roadmapState.reload} />;
  }

  if (!roadmapState.roadmap || !roadmapState.dashboard) {
    return <RoadmapEmptyView />;
  }

  const { roadmap } = roadmapState;

  if (roadmap.status === 'completed') {
    return <RoadmapCompletedView />;
  }

  const dashboard = roadmapState.dashboard;

  return <StudentRoadmapOverview roadmap={roadmap} dashboard={dashboard} />;
}
