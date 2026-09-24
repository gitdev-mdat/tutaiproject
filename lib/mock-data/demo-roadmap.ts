export type RoadmapStepStatus = 'completed' | 'current' | 'locked' | 'goal';

export interface RoadmapStep {
  id: string;
  title: string;
  status: RoadmapStepStatus;
}

export const DEMO_ROADMAP_STEPS: RoadmapStep[] = [
  { id: 'step-1', title: 'Đạo hàm', status: 'completed' },
  { id: 'step-2', title: 'Hàm số cơ bản', status: 'completed' },
  { id: 'step-3', title: 'Tích phân cơ bản', status: 'current' },
  { id: 'step-4', title: 'Ứng dụng tích phân', status: 'locked' },
  { id: 'step-5', title: 'Luyện đề 9+', status: 'goal' },
];

/**
 * Returns a fresh, independent copy of the centralized roadmap step
 * fixtures. Callers (including persisted-state seeding) must never mutate
 * the returned array or its entries in place, keeping the module-level
 * fixture immutable across requests/tests.
 */
export function getDemoRoadmapSteps(): RoadmapStep[] {
  return DEMO_ROADMAP_STEPS.map((step) => ({ ...step }));
}
