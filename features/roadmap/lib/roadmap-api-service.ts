import type {
  CompleteActivityInput,
  RoadmapActivity,
  RoadmapService,
  RoadmapWeek,
  StudentRoadmap,
  StudentRoadmapDashboard,
  StudentRoadmapSnapshot,
} from './types';

type RoadmapResponse = StudentRoadmapSnapshot;

let snapshotRequest: Promise<RoadmapResponse> | null = null;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const body = (await response.json().catch(() => null)) as T | { error?: string } | null;
  if (!response.ok) {
    throw new Error((body as { error?: string } | null)?.error ?? 'Không thể tải lộ trình');
  }
  return body as T;
}

export class ApiRoadmapService implements RoadmapService {
  getStudentRoadmapSnapshot(force = false): Promise<StudentRoadmapSnapshot> {
    if (!force && snapshotRequest) return snapshotRequest;

    const pending = request<RoadmapResponse>('/api/student/roadmap');
    snapshotRequest = pending;
    void pending.then(
      () => {
        if (snapshotRequest === pending) snapshotRequest = null;
      },
      () => {
        if (snapshotRequest === pending) snapshotRequest = null;
      }
    );
    return pending;
  }

  async getStudentRoadmap(): Promise<StudentRoadmap | null> {
    return (await this.getStudentRoadmapSnapshot()).roadmap;
  }

  async getStudentRoadmapDashboard(): Promise<StudentRoadmapDashboard> {
    const dashboard = (await this.getStudentRoadmapSnapshot()).dashboard;
    if (!dashboard) throw new Error('Chưa có lộ trình');
    return dashboard;
  }

  async getRoadmapWeek(roadmapId: string, weekId: string): Promise<RoadmapWeek> {
    const roadmap = await this.getStudentRoadmap();
    if (!roadmap || roadmap.id !== roadmapId) throw new Error('Roadmap không tồn tại');
    const week = roadmap.phases.flatMap((phase) => phase.weeks).find((item) => item.id === weekId);
    if (!week) throw new Error('Tuần học không tồn tại');
    return week;
  }

  startActivity(roadmapId: string, activityId: string): Promise<RoadmapActivity> {
    return request(`/api/student/roadmap/activities/${encodeURIComponent(activityId)}/start`, {
      method: 'POST',
      body: JSON.stringify({ roadmapId }),
    });
  }

  completeActivity(
    roadmapId: string,
    activityId: string,
    payload: CompleteActivityInput = {}
  ): Promise<RoadmapActivity> {
    return request(`/api/student/roadmap/activities/${encodeURIComponent(activityId)}/complete`, {
      method: 'POST',
      body: JSON.stringify({ roadmapId, ...payload }),
    });
  }
}

export const roadmapService: RoadmapService = new ApiRoadmapService();
