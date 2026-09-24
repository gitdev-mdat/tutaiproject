import type {
  ContentRef,
  DailyLearningActivity,
  RoadmapActivityType,
  RoadmapMilestone,
  StudentRoadmapDashboard,
} from './types';

export type RoadmapDefinitionStatus = 'draft' | 'published';
export type RoadmapStepState = 'completed' | 'current' | 'next' | 'locked';

export interface RoadmapDefinitionStep {
  id: string;
  order: number;
  title: string;
  type: RoadmapActivityType;
  contentRef?: ContentRef;
  required: boolean;
  estimatedMinutes: number;
  prerequisiteStepIds: string[];
  unlock: 'after_prerequisites' | 'always';
  completion: 'content_completed' | 'minimum_score';
  minimumScore?: number;
  milestone?: boolean;
  recommendationTag?: string;
}

export interface RoadmapDefinitionStage {
  id: string;
  order: number;
  title: string;
  description?: string;
  steps: RoadmapDefinitionStep[];
}

export interface RoadmapDefinition {
  id: string;
  name: string;
  subject: string;
  grade: number;
  target: string;
  targetScore?: number;
  status: RoadmapDefinitionStatus;
  updatedAt: string;
  stages: RoadmapDefinitionStage[];
}

export interface RoadmapStudentState {
  id: string;
  label: string;
  completedStepIds: string[];
  inProgressStepId?: string;
  weakTags?: string[];
}

export interface SimulatedRoadmapStep extends RoadmapDefinitionStep {
  state: RoadmapStepState;
  recommended: boolean;
}

export interface SimulatedRoadmapStage extends Omit<RoadmapDefinitionStage, 'steps'> {
  steps: SimulatedRoadmapStep[];
  progress: number;
}

export interface RoadmapSimulation {
  stages: SimulatedRoadmapStage[];
  overallProgress: number;
}

export interface RoadmapValidationIssue {
  path: string;
  message: string;
}

export const ROADMAP_CONTENT_CATALOG: Array<ContentRef & { title: string }> = [
  { type: 'lesson', id: 'lesson-derivative-basic', title: 'Đạo hàm cơ bản' },
  { type: 'lesson', id: 'lesson-substitution', title: 'Phương pháp đổi biến số' },
  { type: 'practice_set', id: 'practice-monotonicity', title: 'Luyện tính đơn điệu' },
  { type: 'practice_set', id: 'practice-extrema', title: 'Luyện cực trị hàm số' },
  { type: 'quiz', id: 'quiz-derivative', title: 'Kiểm tra nhanh: Ứng dụng đạo hàm' },
  { type: 'lesson', id: 'lesson-variation', title: 'Bảng biến thiên' },
  { type: 'practice_set', id: 'practice-graph', title: 'Đồ thị hàm số' },
  { type: 'quiz', id: 'quiz-functions', title: 'Kiểm tra: Khảo sát hàm số' },
  { type: 'lesson', id: 'lesson-logarithm', title: 'Hàm số mũ và logarit' },
  { type: 'mock_exam', id: 'mock-math-12', title: 'Thi thử Toán 12' },
];

export const ROADMAP_STUDENT_FIXTURES: RoadmapStudentState[] = [
  { id: 'new', label: 'Học sinh mới', completedStepIds: [] },
  {
    id: 'current',
    label: 'Tiến độ hiện tại',
    completedStepIds: ['step-derivative'],
    inProgressStepId: 'step-substitution',
  },
  {
    id: 'weak',
    label: 'Hổng kiến thức tiên quyết',
    completedStepIds: ['step-derivative'],
    weakTags: ['dao-ham'],
  },
  {
    id: 'stage-complete',
    label: 'Đã hoàn thành giai đoạn hiện tại',
    completedStepIds: [
      'step-derivative',
      'step-substitution',
      'step-monotonicity',
      'step-extrema',
      'step-check',
    ],
  },
];

export function validateRoadmap(definition: RoadmapDefinition): RoadmapValidationIssue[] {
  const issues: RoadmapValidationIssue[] = [];
  if (!definition.name.trim()) issues.push({ path: 'name', message: 'Cần nhập tên lộ trình.' });
  if (!definition.target.trim())
    issues.push({ path: 'target', message: 'Cần nhập mục tiêu lộ trình.' });
  if (
    !definition.subject.trim() ||
    !definition.grade ||
    definition.grade < 1 ||
    definition.grade > 12
  )
    issues.push({ path: 'subject', message: 'Cần chọn môn và lớp từ 1 đến 12.' });
  if (
    definition.targetScore !== undefined &&
    (definition.targetScore < 0 || definition.targetScore > 10)
  )
    issues.push({ path: 'targetScore', message: 'Điểm mục tiêu phải từ 0 đến 10.' });
  if (!definition.stages.length)
    issues.push({ path: 'stages', message: 'Lộ trình cần ít nhất một giai đoạn.' });
  const stageIds = definition.stages.map((stage) => stage.id);
  const stageOrders = definition.stages.map((stage) => stage.order);
  if (new Set(stageIds).size !== stageIds.length)
    issues.push({ path: 'stages', message: 'Mã giai đoạn bị trùng.' });
  if (new Set(stageOrders).size !== stageOrders.length || stageOrders.some((order) => order < 1))
    issues.push({ path: 'stages.order', message: 'Thứ tự giai đoạn không hợp lệ.' });
  const steps = definition.stages.flatMap((stage) => stage.steps);
  const ids = new Set(steps.map((step) => step.id));
  if (ids.size !== steps.length)
    issues.push({ path: 'stages.steps', message: 'Mã hoạt động bị trùng.' });
  definition.stages.forEach((stage, stageIndex) => {
    if (!stage.title.trim())
      issues.push({
        path: `stages.${stageIndex}.title`,
        message: `Cần nhập tên giai đoạn ${stageIndex + 1}.`,
      });
    if (!stage.steps.length)
      issues.push({
        path: `stages.${stageIndex}`,
        message: `Giai đoạn “${stage.title}” chưa có hoạt động.`,
      });
    const orders = stage.steps.map((step) => step.order);
    if (new Set(orders).size !== orders.length || orders.some((order) => order < 1))
      issues.push({
        path: `stages.${stageIndex}.order`,
        message: `Thứ tự hoạt động trong “${stage.title}” không hợp lệ.`,
      });
    stage.steps.forEach((step) => {
      if (!step.title.trim()) issues.push({ path: step.id, message: 'Cần nhập tên hoạt động.' });
      if (!step.contentRef)
        issues.push({ path: step.id, message: `“${step.title}” chưa liên kết nội dung.` });
      else {
        const expectedType: ContentRef['type'] =
          step.type === 'practice' || step.type === 'review'
            ? 'practice_set'
            : step.type === 'mock_exam'
              ? 'mock_exam'
              : step.type;
        if (step.contentRef.type !== expectedType)
          issues.push({
            path: step.id,
            message: `Nội dung liên kết của “${step.title}” không đúng loại hoạt động.`,
          });
        if (
          !ROADMAP_CONTENT_CATALOG.some(
            (content) => content.id === step.contentRef?.id && content.type === step.contentRef.type
          )
        ) {
          issues.push({
            path: step.id,
            message: `Nội dung liên kết của “${step.title}” không tồn tại.`,
          });
        }
      }
      if (step.estimatedMinutes < 1)
        issues.push({ path: step.id, message: `Thời lượng của “${step.title}” phải lớn hơn 0.` });
      if (
        step.completion === 'minimum_score' &&
        (!step.minimumScore || step.minimumScore < 1 || step.minimumScore > 100)
      )
        issues.push({
          path: step.id,
          message: `Ngưỡng điểm của “${step.title}” phải từ 1 đến 100.`,
        });
      if (step.prerequisiteStepIds.includes(step.id))
        issues.push({ path: step.id, message: `“${step.title}” không thể phụ thuộc chính nó.` });
      step.prerequisiteStepIds
        .filter((id) => !ids.has(id))
        .forEach(() =>
          issues.push({
            path: step.id,
            message: `“${step.title}” có điều kiện tiên quyết không tồn tại.`,
          })
        );
    });
  });
  if (
    steps.length &&
    !steps.some((step) => step.unlock === 'always' || !step.prerequisiteStepIds.length)
  )
    issues.push({ path: 'stages', message: 'Không có hoạt động mở đầu để học sinh bắt đầu.' });
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(steps.map((step) => [step.id, step]));
  const cycles = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const found = (byId.get(id)?.prerequisiteStepIds ?? []).some(cycles);
    visiting.delete(id);
    visited.add(id);
    return found;
  };
  if (steps.some((step) => cycles(step.id)))
    issues.push({ path: 'stages', message: 'Các điều kiện tiên quyết tạo thành vòng lặp.' });
  return issues;
}

export function simulateRoadmap(
  definition: RoadmapDefinition,
  student: RoadmapStudentState
): RoadmapSimulation {
  const complete = new Set(student.completedStepIds);
  const orderedStages = [...definition.stages].sort((a, b) => a.order - b.order);
  const ordered = orderedStages.flatMap((stage) =>
    [...stage.steps].sort((a, b) => a.order - b.order)
  );
  const available = ordered.filter(
    (step) =>
      !complete.has(step.id) &&
      (step.unlock === 'always' || step.prerequisiteStepIds.every((id) => complete.has(id)))
  );
  const currentId =
    student.inProgressStepId && available.some((step) => step.id === student.inProgressStepId)
      ? student.inProgressStepId
      : available[0]?.id;
  // “Tiếp theo” is the first activity that becomes available after the current
  // one. It remains non-actionable, but lets both preview and Student UI explain
  // the immediate journey without marking all future content simply as locked.
  const nextId =
    ordered.find(
      (step) =>
        !complete.has(step.id) &&
        step.id !== currentId &&
        step.unlock === 'after_prerequisites' &&
        step.prerequisiteStepIds.length > 0 &&
        step.prerequisiteStepIds.every((id) => complete.has(id) || id === currentId)
    )?.id ?? available.find((step) => step.id !== currentId)?.id;
  const stateById = new Map<string, RoadmapStepState>();
  ordered.forEach((step) => {
    if (complete.has(step.id)) stateById.set(step.id, 'completed');
    else if (step.id === currentId) stateById.set(step.id, 'current');
    else if (step.id === nextId) stateById.set(step.id, 'next');
    else stateById.set(step.id, 'locked');
  });
  const stages = [...definition.stages]
    .sort((a, b) => a.order - b.order)
    .map((stage): SimulatedRoadmapStage => {
      const requiredSteps = stage.steps.filter((step) => step.required);
      return {
        ...stage,
        steps: [...stage.steps]
          .sort((a, b) => a.order - b.order)
          .map((step): SimulatedRoadmapStep => ({
            ...step,
            state: stateById.get(step.id) ?? 'locked',
            recommended: Boolean(
              step.recommendationTag && student.weakTags?.includes(step.recommendationTag)
            ),
          })),
        progress: requiredSteps.length
          ? Math.round(
              (requiredSteps.filter((step) => complete.has(step.id)).length /
                requiredSteps.length) *
                100
            )
          : 100,
      };
    });
  const required = ordered.filter((step) => step.required);
  return {
    stages,
    overallProgress: required.length
      ? Math.round(
          (required.filter((step) => complete.has(step.id)).length / required.length) * 100
        )
      : 100,
  };
}

export function deriveStudentDashboard(
  definition: RoadmapDefinition,
  student: RoadmapStudentState
): StudentRoadmapDashboard {
  const simulation = simulateRoadmap(definition, student);
  const steps = simulation.stages.flatMap((stage) => stage.steps);
  const active =
    steps.find((step) => step.state === 'current') ?? steps.find((step) => step.state === 'next');
  const queue = steps
    .filter((step) => step.state === 'current' || step.state === 'next')
    .slice(0, 2);
  const toActivity = (step: SimulatedRoadmapStep, order: number): DailyLearningActivity => ({
    id: step.id,
    order,
    type: step.type === 'quiz' || step.type === 'mock_exam' ? 'assessment' : step.type,
    status: step.state === 'current' ? 'in_progress' : step.state === 'next' ? 'ready' : 'locked',
    title: step.title,
    subject: definition.subject,
    grade: definition.grade,
    estimatedMinutes: step.estimatedMinutes,
    progress: step.state === 'completed' ? 100 : 0,
    dependencyActivityId: step.prerequisiteStepIds[0],
    dependencyLabel: step.prerequisiteStepIds.length
      ? `Mở khóa sau khi hoàn thành ${step.prerequisiteStepIds
          .map((id) => steps.find((candidate) => candidate.id === id)?.title)
          .filter(Boolean)
          .join(', ')}`
      : undefined,
    recommendationReason: step.recommended
      ? { type: 'prerequisite_gap', message: 'Ưu tiên để củng cố kiến thức tiên quyết còn yếu.' }
      : undefined,
    action: {
      label: step.state === 'current' ? 'Học tiếp' : 'Bắt đầu',
      href: step.contentRef ? `/student/learn/${step.contentRef.id}` : undefined,
    },
  });
  const milestones: RoadmapMilestone[] = simulation.stages.map((stage, index) => ({
    id: stage.id,
    order: stage.order,
    title: stage.title,
    status:
      stage.progress === 100
        ? 'completed'
        : stage.steps.some((step) => step.state === 'current')
          ? 'in_progress'
          : index ===
              simulation.stages.findIndex((candidate) =>
                candidate.steps.some((step) => step.state === 'current')
              ) +
                1
            ? 'next'
            : 'later',
  }));
  return {
    targetScore: definition.targetScore ?? 10,
    today: { date: new Date().toISOString().slice(0, 10), activities: queue.map(toActivity) },
    progress: {
      masteredTopics: steps.filter((step) => step.state === 'completed').length,
      totalTopics: steps.length,
      reviewTopics: steps.filter((step) => step.recommended).length,
      roadmapPercentage: simulation.overallProgress,
    },
    recommendationExplanation: {
      title: 'Vì sao Tú Tài đề xuất bài này?',
      message: active?.recommended
        ? 'Ưu tiên để củng cố kiến thức tiên quyết còn yếu.'
        : 'Hoạt động tiếp theo theo lộ trình đã được thiết kế.',
    },
    upcomingMilestones: milestones,
    stages: simulation.stages.map((stage) => ({
      id: stage.id,
      order: stage.order,
      title: stage.title,
      items: stage.steps.map((step) => ({
        id: step.id,
        title: step.title,
        status: step.state === 'next' ? 'upcoming' : step.state,
        href: step.contentRef ? `/student/learn/${step.contentRef.id}` : undefined,
      })),
    })),
  };
}

export const seededRoadmapDefinition: RoadmapDefinition = {
  id: 'roadmap-math-12',
  name: 'Chinh phục Toán 12',
  subject: 'Toán',
  grade: 12,
  target: 'Ôn thi tốt nghiệp · mục tiêu 8.5+',
  targetScore: 8.5,
  status: 'published',
  updatedAt: '2026-09-09T08:00:00.000Z',
  stages: [
    {
      id: 'stage-derivative',
      order: 1,
      title: 'Ứng dụng đạo hàm',
      description: 'Củng cố nền tảng trước khi khảo sát hàm số.',
      steps: [
        {
          id: 'step-derivative',
          order: 1,
          title: 'Đạo hàm cơ bản',
          type: 'lesson',
          contentRef: { type: 'lesson', id: 'lesson-derivative-basic' },
          required: true,
          estimatedMinutes: 15,
          prerequisiteStepIds: [],
          unlock: 'always',
          completion: 'content_completed',
          recommendationTag: 'dao-ham',
        },
        {
          id: 'step-substitution',
          order: 2,
          title: 'Phương pháp đổi biến số',
          type: 'lesson',
          contentRef: { type: 'lesson', id: 'lesson-substitution' },
          required: true,
          estimatedMinutes: 18,
          prerequisiteStepIds: ['step-derivative'],
          unlock: 'after_prerequisites',
          completion: 'content_completed',
          recommendationTag: 'dao-ham',
        },
        {
          id: 'step-monotonicity',
          order: 3,
          title: 'Tính đơn điệu của hàm số',
          type: 'practice',
          contentRef: { type: 'practice_set', id: 'practice-monotonicity' },
          required: true,
          estimatedMinutes: 20,
          prerequisiteStepIds: ['step-substitution'],
          unlock: 'after_prerequisites',
          completion: 'minimum_score',
          minimumScore: 70,
        },
        {
          id: 'step-extrema',
          order: 4,
          title: 'Cực trị hàm số',
          type: 'practice',
          contentRef: { type: 'practice_set', id: 'practice-extrema' },
          required: false,
          estimatedMinutes: 15,
          prerequisiteStepIds: ['step-substitution'],
          unlock: 'after_prerequisites',
          completion: 'minimum_score',
          minimumScore: 70,
        },
        {
          id: 'step-check',
          order: 5,
          title: 'Kiểm tra nhanh',
          type: 'quiz',
          contentRef: { type: 'quiz', id: 'quiz-derivative' },
          required: true,
          estimatedMinutes: 15,
          prerequisiteStepIds: ['step-monotonicity'],
          unlock: 'after_prerequisites',
          completion: 'minimum_score',
          minimumScore: 70,
          milestone: true,
        },
      ],
    },
    {
      id: 'stage-functions',
      order: 2,
      title: 'Khảo sát hàm số',
      steps: [
        {
          id: 'step-variation',
          order: 1,
          title: 'Bảng biến thiên',
          type: 'lesson',
          contentRef: { type: 'lesson', id: 'lesson-variation' },
          required: true,
          estimatedMinutes: 20,
          prerequisiteStepIds: ['step-check'],
          unlock: 'after_prerequisites',
          completion: 'content_completed',
        },
        {
          id: 'step-graph',
          order: 2,
          title: 'Đồ thị hàm số',
          type: 'practice',
          contentRef: { type: 'practice_set', id: 'practice-graph' },
          required: true,
          estimatedMinutes: 20,
          prerequisiteStepIds: ['step-variation'],
          unlock: 'after_prerequisites',
          completion: 'minimum_score',
          minimumScore: 70,
        },
      ],
    },
    {
      id: 'stage-log',
      order: 3,
      title: 'Mũ và Logarit',
      steps: [
        {
          id: 'step-log',
          order: 1,
          title: 'Hàm số mũ và logarit',
          type: 'lesson',
          contentRef: { type: 'lesson', id: 'lesson-logarithm' },
          required: true,
          estimatedMinutes: 25,
          prerequisiteStepIds: ['step-graph'],
          unlock: 'after_prerequisites',
          completion: 'content_completed',
        },
      ],
    },
  ],
};

const clone = <T>(value: T): T => structuredClone(value);
let definitions: RoadmapDefinition[] = [clone(seededRoadmapDefinition)];
export const roadmapDefinitionService = {
  async list() {
    return clone(definitions);
  },
  async get(id: string) {
    return clone(definitions.find((item) => item.id === id) ?? null);
  },
  async create(definition: RoadmapDefinition) {
    definitions = [...definitions, clone(definition)];
    return clone(definition);
  },
  async update(definition: RoadmapDefinition) {
    const saved = { ...definition, updatedAt: new Date().toISOString() };
    definitions = definitions.map((item) => (item.id === saved.id ? clone(saved) : item));
    return clone(saved);
  },
  validate: validateRoadmap,
  async publish(id: string, published: boolean) {
    const item = definitions.find((entry) => entry.id === id);
    if (!item) throw new Error('Không tìm thấy lộ trình.');
    if (published && validateRoadmap(item).length)
      throw new Error('Cần xử lý lỗi trước khi xuất bản.');
    item.status = published ? 'published' : 'draft';
    item.updatedAt = new Date().toISOString();
    return clone(item);
  },
  simulate: simulateRoadmap,
};

export function createEmptyRoadmap(): RoadmapDefinition {
  const id = `roadmap-${Date.now()}`;
  return {
    id,
    name: '',
    subject: 'Toán',
    grade: 12,
    target: '',
    status: 'draft',
    updatedAt: new Date().toISOString(),
    stages: [],
  };
}

export const countRoadmapSteps = (definition: RoadmapDefinition) =>
  definition.stages.reduce((sum, stage) => sum + stage.steps.length, 0);
export const activityLabel: Record<RoadmapActivityType, string> = {
  lesson: 'Bài học',
  practice: 'Luyện tập',
  review: 'Ôn tập',
  quiz: 'Kiểm tra nhanh',
  mock_exam: 'Đánh giá',
};
