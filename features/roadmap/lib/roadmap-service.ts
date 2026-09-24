import {
  calculateRoadmapProgress,
  type CompleteActivityInput,
  type RoadmapActivity,
  type RoadmapService,
  type StudentRoadmap,
  type StudentRoadmapDashboard,
  type RoadmapWeek,
} from './types';
import { mockStudentRoadmap } from './mock-data';
import { getTodayRoadmap } from './adaptive-learning-service';

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

export class MockRoadmapService implements RoadmapService {
  private roadmap: StudentRoadmap = structuredClone(mockStudentRoadmap);

  async getStudentRoadmap(): Promise<StudentRoadmap> {
    await delay();
    return structuredClone(this.roadmap);
  }
  async getStudentRoadmapDashboard(): Promise<StudentRoadmapDashboard> {
    await delay();
    return getTodayRoadmap();
  }
  async getRoadmapWeek(roadmapId: string, weekId: string): Promise<RoadmapWeek> {
    await delay();
    if (roadmapId !== this.roadmap.id) throw new Error('Roadmap không tồn tại');
    const week = this.roadmap.phases
      .flatMap((phase) => phase.weeks)
      .find((item) => item.id === weekId);
    if (!week) throw new Error('Tuần học không tồn tại');
    return structuredClone(week);
  }
  async startActivity(roadmapId: string, activityId: string): Promise<RoadmapActivity> {
    return this.mutateActivity(roadmapId, activityId, (activity) => {
      if (activity.status === 'locked') throw new Error('Hoạt động đang bị khóa');
      activity.status = 'in_progress';
      activity.progress = {
        ...activity.progress,
        startedAt: activity.progress?.startedAt ?? new Date().toISOString(),
      };
    });
  }
  async completeActivity(
    roadmapId: string,
    activityId: string,
    payload: CompleteActivityInput = {}
  ): Promise<RoadmapActivity> {
    return this.mutateActivity(roadmapId, activityId, (activity) => {
      activity.status = 'completed';
      activity.progress = {
        ...activity.progress,
        ...payload,
        completedAt: new Date().toISOString(),
      };
    });
  }
  private async mutateActivity(
    roadmapId: string,
    activityId: string,
    mutation: (activity: RoadmapActivity) => void
  ): Promise<RoadmapActivity> {
    await delay();
    if (roadmapId !== this.roadmap.id) throw new Error('Roadmap không tồn tại');
    const activity = this.roadmap.phases
      .flatMap((phase) => phase.weeks)
      .flatMap((week) => week.activities)
      .find((item) => item.id === activityId);
    if (!activity) throw new Error('Hoạt động không tồn tại');
    mutation(activity);
    this.roadmap.progress = calculateRoadmapProgress(this.roadmap.phases);
    this.roadmap.currentActivityId =
      this.roadmap.phases
        .flatMap((phase) => phase.weeks)
        .flatMap((week) => week.activities)
        .find((item) => item.status === 'in_progress' || item.status === 'available')?.id ?? null;
    this.roadmap.updatedAt = new Date().toISOString();
    return structuredClone(activity);
  }
}

// Future API boundary: GET /api/student/roadmap, /weeks/{weekId}; POST activities/{id}/start|complete.
export const roadmapService: RoadmapService = new MockRoadmapService();
