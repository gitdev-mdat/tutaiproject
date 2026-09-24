import { mockStudentRoadmapDashboard } from './mock-data';
import type {
  AdaptiveLearningState,
  AdaptiveQuestion,
  PracticeAttempt,
  PracticeAnalysis,
  StudentRoadmapDashboard,
} from './types';

const STORAGE_KEY = 'tutai:adaptive-learning-demo:v1';

const initialState: AdaptiveLearningState = {
  version: 1,
  stage: 'lesson',
  lessonProgress: 35,
  practiceAnswers: {},
  retryAnswers: {},
  practiceAttempts: [],
  updatedAt: new Date(0).toISOString(),
};

const PRACTICE_ANSWER_KEY: Record<string, string> = {
  q1: 'a',
  q2: 'b',
  q3: 'b',
  q4: 'a',
  q5: 'b',
};

const RETRY_ANSWER_KEY: Record<string, string> = { r1: 'a', r2: 'b', r3: 'a' };

export const completedLessonPracticeQuestions: Record<string, AdaptiveQuestion[]> = {
  'basic-derivative': [
    {
      id: 'bd1',
      prompt: 'Đạo hàm của hàm số f(x) = x³ là:',
      options: [
        { id: 'a', label: '3x²' },
        { id: 'b', label: 'x²' },
        { id: 'c', label: '3x' },
        { id: 'd', label: 'x⁴/4' },
      ],
    },
    {
      id: 'bd2',
      prompt: 'Đạo hàm của một hằng số bằng:',
      options: [
        { id: 'a', label: '1' },
        { id: 'b', label: '0' },
        { id: 'c', label: 'Chính hằng số đó' },
        { id: 'd', label: 'Không xác định' },
      ],
    },
    {
      id: 'bd3',
      prompt: 'Công thức đạo hàm của tổng hai hàm số là:',
      options: [
        { id: 'a', label: '(u + v)′ = u′ + v′' },
        { id: 'b', label: '(u + v)′ = u′v′' },
        { id: 'c', label: '(u + v)′ = u + v′' },
        { id: 'd', label: '(u + v)′ = u′/v′' },
      ],
    },
  ],
  substitution: [
    {
      id: 'sub1',
      prompt: 'Với tích phân ∫2x(x² + 1)³ dx, phép đặt ẩn phụ nào phù hợp nhất?',
      options: [
        { id: 'a', label: 'u = x² + 1' },
        { id: 'b', label: 'u = 2x' },
        { id: 'c', label: 'u = (x² + 1)³' },
        { id: 'd', label: 'u = x³' },
      ],
    },
    {
      id: 'sub2',
      prompt: 'Đặt u = x² + 1 thì vi phân du bằng:',
      options: [
        { id: 'a', label: 'x dx' },
        { id: 'b', label: '2x dx' },
        { id: 'c', label: '2 dx' },
        { id: 'd', label: 'x² dx' },
      ],
    },
    {
      id: 'sub3',
      prompt: 'Mục đích chính của đổi biến số là:',
      options: [
        { id: 'a', label: 'Đưa tích phân về dạng quen thuộc' },
        { id: 'b', label: 'Làm tăng bậc biểu thức' },
        { id: 'c', label: 'Loại bỏ mọi hệ số' },
        { id: 'd', label: 'Đổi kết quả của tích phân' },
      ],
    },
  ],
};

const COMPLETED_LESSON_ANSWER_KEYS: Record<string, Record<string, string>> = {
  'basic-derivative': { bd1: 'a', bd2: 'b', bd3: 'a' },
  substitution: { sub1: 'a', sub2: 'b', sub3: 'a' },
};

export const practiceQuestions: AdaptiveQuestion[] = [
  {
    id: 'q1',
    prompt: 'Với tích phân ∫2x(x² + 1)³ dx, phép đặt ẩn phụ nào phù hợp nhất?',
    options: [
      { id: 'a', label: 'u = x² + 1' },
      { id: 'b', label: 'u = 2x' },
      { id: 'c', label: 'u = (x² + 1)³' },
      { id: 'd', label: 'u = x³' },
    ],
  },
  {
    id: 'q2',
    prompt: 'Nếu f′(x) < 0 trên khoảng (a; b), kết luận đúng là gì?',
    options: [
      { id: 'a', label: 'Hàm số đồng biến trên (a; b)' },
      { id: 'b', label: 'Hàm số nghịch biến trên (a; b)' },
      { id: 'c', label: 'Hàm số không đổi trên (a; b)' },
      { id: 'd', label: 'Chưa thể kết luận' },
    ],
  },
  {
    id: 'q3',
    prompt: 'Đặt u = x² + 1 thì vi phân du bằng:',
    options: [
      { id: 'a', label: 'x dx' },
      { id: 'b', label: '2x dx' },
      { id: 'c', label: '2 dx' },
      { id: 'd', label: 'x² dx' },
    ],
  },
  {
    id: 'q4',
    prompt: 'Đạo hàm đổi dấu từ dương sang âm tại x₀ cho biết:',
    options: [
      { id: 'a', label: 'x₀ là điểm cực đại' },
      { id: 'b', label: 'x₀ là điểm cực tiểu' },
      { id: 'c', label: 'Hàm số luôn đồng biến' },
      { id: 'd', label: 'Không có cực trị' },
    ],
  },
  {
    id: 'q5',
    prompt: 'Trên khoảng f′(x) > 0, chiều biến thiên của hàm số là:',
    options: [
      { id: 'a', label: 'Nghịch biến' },
      { id: 'b', label: 'Đồng biến' },
      { id: 'c', label: 'Không đổi' },
      { id: 'd', label: 'Không xác định' },
    ],
  },
];

export const retryQuestions: AdaptiveQuestion[] = [
  {
    id: 'r1',
    prompt: 'Nếu g′(x) mang dấu dương trên (1; 4), hàm số g biến thiên thế nào?',
    options: [
      { id: 'a', label: 'Đồng biến' },
      { id: 'b', label: 'Nghịch biến' },
      { id: 'c', label: 'Không đổi' },
      { id: 'd', label: 'Có cực đại' },
    ],
  },
  {
    id: 'r2',
    prompt: 'Khi h′(x) đổi dấu từ âm sang dương tại x = 2, x = 2 là:',
    options: [
      { id: 'a', label: 'Điểm cực đại' },
      { id: 'b', label: 'Điểm cực tiểu' },
      { id: 'c', label: 'Điểm uốn' },
      { id: 'd', label: 'Không phải điểm đặc biệt' },
    ],
  },
  {
    id: 'r3',
    prompt: 'Dấu của đạo hàm chuyển từ “+” sang “−” tương ứng với:',
    options: [
      { id: 'a', label: 'Tăng rồi giảm' },
      { id: 'b', label: 'Giảm rồi tăng' },
      { id: 'c', label: 'Luôn tăng' },
      { id: 'd', label: 'Luôn giảm' },
    ],
  },
];

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readState(): AdaptiveLearningState {
  if (!isBrowser()) return structuredClone(initialState);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(initialState);
    const parsed = JSON.parse(raw) as AdaptiveLearningState;
    return parsed.version === 1
      ? {
          ...structuredClone(initialState),
          ...parsed,
          practiceAttempts: parsed.practiceAttempts ?? [],
        }
      : structuredClone(initialState);
  } catch {
    return structuredClone(initialState);
  }
}

function writeState(patch: Partial<AdaptiveLearningState>): AdaptiveLearningState {
  const next = { ...readState(), ...patch, updatedAt: new Date().toISOString() };
  if (isBrowser()) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return structuredClone(next);
}

export async function getAdaptiveLearningState(): Promise<AdaptiveLearningState> {
  return structuredClone(readState());
}

export async function saveLessonProgress(progress: number): Promise<AdaptiveLearningState> {
  return writeState({ lessonProgress: Math.min(100, Math.max(35, progress)), stage: 'lesson' });
}

export async function completeLesson(): Promise<AdaptiveLearningState> {
  return writeState({
    lessonProgress: 100,
    stage: 'lesson_complete',
    outcome: {
      id: `lesson-completed-${Date.now()}`,
      type: 'lesson_completed',
      firstTime: true,
      lessonTitle: 'Phương pháp đổi biến số',
      nextActivityId: 'daily-focused-practice',
    },
  });
}

export async function startPractice(): Promise<AdaptiveLearningState> {
  return writeState({ stage: 'practice', practiceAnswers: {}, outcome: undefined });
}

export async function savePracticeAnswers(
  answers: Record<string, string>
): Promise<AdaptiveLearningState> {
  return writeState({ practiceAnswers: answers, stage: 'practice' });
}

function scoreAnswers(answers: Record<string, string>, answerKey: Record<string, string>) {
  const questionIds = Object.keys(answerKey);
  const correct = questionIds.filter((id) => answers[id] === answerKey[id]).length;
  return { correct, total: questionIds.length };
}

function createAttempt(
  activityId: string,
  type: PracticeAttempt['type'],
  correct: number,
  total: number,
  passed: boolean
): PracticeAttempt {
  return {
    id: `${activityId}-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    activityId,
    type,
    correct,
    total,
    passed,
    completedAt: new Date().toISOString(),
  };
}

export async function submitPractice(
  answers: Record<string, string>
): Promise<AdaptiveLearningState> {
  const score = scoreAnswers(answers, PRACTICE_ANSWER_KEY);
  const passed = score.correct >= 4;
  const attempt = createAttempt(
    'daily-focused-practice',
    'progression',
    score.correct,
    score.total,
    passed
  );
  const practiceAttempts = [...readState().practiceAttempts, attempt];

  if (passed) {
    return writeState({
      practiceAnswers: answers,
      practiceAttempts,
      analysis: undefined,
      stage: 'practice_passed',
      outcome: {
        id: `practice-passed-${attempt.id}`,
        type: 'practice_passed',
        masteryBefore: 52,
        masteryAfter: 78,
        attempt,
      },
    });
  }

  const incorrectQuestionIds = Object.keys(PRACTICE_ANSWER_KEY).filter(
    (id) => answers[id] !== PRACTICE_ANSWER_KEY[id]
  );
  const analysis: PracticeAnalysis = {
    attemptId: attempt.id,
    score: {
      ...score,
      percentage: Math.round((score.correct / score.total) * 100),
    },
    masteryResult: { passed: false, previousMastery: 52, currentMastery: 52 },
    detectedWeaknesses: [
      {
        id: 'weakness-derivative-sign',
        title: 'Quy tắc dấu của đạo hàm',
        description: 'Em thường nhầm dấu khi xét đạo hàm trên các khoảng xác định.',
        evidenceQuestionIds: incorrectQuestionIds,
      },
    ],
    nextAction: { type: 'targeted_review', activityId: 'daily-sign-review' },
  };
  return writeState({
    practiceAnswers: answers,
    practiceAttempts,
    analysis,
    stage: 'analysis',
    outcome: {
      id: `practice-needs-review-${attempt.id}`,
      type: 'practice_needs_review',
      analysisId: attempt.id,
    },
  });
}

export async function submitLessonRetake(
  lessonId: string,
  answers: Record<string, string>
): Promise<PracticeAttempt> {
  const answerKey = COMPLETED_LESSON_ANSWER_KEYS[lessonId];
  if (!answerKey) throw new Error('Bài luyện ôn tập không tồn tại');
  const score = scoreAnswers(answers, answerKey);
  const attempt = createAttempt(
    `retake-${lessonId}`,
    'retake',
    score.correct,
    score.total,
    score.correct >= Math.ceil(score.total * 0.8)
  );
  const current = readState();
  writeState({ practiceAttempts: [...current.practiceAttempts, attempt] });
  return structuredClone(attempt);
}

export async function startTargetedReview(): Promise<AdaptiveLearningState> {
  return writeState({ stage: 'review' });
}

export async function startRetry(): Promise<AdaptiveLearningState> {
  return writeState({ stage: 'retry', retryAnswers: {}, outcome: undefined });
}

export async function saveRetryAnswers(
  answers: Record<string, string>
): Promise<AdaptiveLearningState> {
  return writeState({ retryAnswers: answers, stage: 'retry' });
}

export async function submitRetry(answers: Record<string, string>): Promise<AdaptiveLearningState> {
  const score = scoreAnswers(answers, RETRY_ANSWER_KEY);
  const passed = score.correct === score.total;
  const attempt = createAttempt('daily-sign-retry', 'retry', score.correct, score.total, passed);
  const practiceAttempts = [...readState().practiceAttempts, attempt];

  if (!passed) {
    return writeState({
      retryAnswers: answers,
      practiceAttempts,
      stage: 'retry_needs_review',
      outcome: undefined,
    });
  }

  return writeState({
    retryAnswers: answers,
    practiceAttempts,
    stage: 'mastery_complete',
    outcome: {
      id: `retry-passed-${attempt.id}`,
      type: 'retry_passed',
      masteryBefore: 52,
      masteryAfter: 78,
      attempt,
    },
  });
}

export async function resetAdaptiveDemo(): Promise<AdaptiveLearningState> {
  if (isBrowser()) window.localStorage.removeItem(STORAGE_KEY);
  return structuredClone(initialState);
}

function activity(
  id: string,
  order: number,
  type: 'lesson' | 'practice' | 'review' | 'retry',
  status: 'in_progress' | 'ready' | 'locked' | 'completed' | 'recommended' | 'needs_review',
  title: string,
  description: string,
  progress: number,
  action?: { label: string; href: string },
  dependencyLabel?: string
) {
  return {
    id,
    order,
    type,
    status,
    title,
    description,
    subject: 'Toán',
    grade: 12,
    estimatedMinutes: type === 'review' ? 6 : 12,
    progress,
    action,
    dependencyLabel,
  } as const;
}

export function deriveTodayRoadmap(state: AdaptiveLearningState): StudentRoadmapDashboard {
  const dashboard = structuredClone(mockStudentRoadmapDashboard);

  if (state.stage === 'lesson') {
    dashboard.today.activities[0].progress = state.lessonProgress;
    return dashboard;
  }

  if (state.stage === 'lesson_complete' || state.stage === 'practice') {
    dashboard.today.activities = [
      activity(
        'daily-substitution-method',
        1,
        'lesson',
        'completed',
        'Phương pháp đổi biến số',
        'Đã hoàn thành bài học trọng tâm.',
        100
      ),
      activity(
        'daily-focused-practice',
        2,
        'practice',
        state.stage === 'practice' ? 'in_progress' : 'ready',
        '5 câu luyện trọng tâm',
        'Kiểm tra mức độ vận dụng ngay sau bài học.',
        0,
        {
          label: state.stage === 'practice' ? 'Làm tiếp' : 'Luyện ngay',
          href: '/student/learn/daily-focused-practice',
        }
      ),
    ];
    return dashboard;
  }

  if (
    state.stage === 'analysis' ||
    state.stage === 'review' ||
    state.stage === 'retry' ||
    state.stage === 'retry_needs_review'
  ) {
    dashboard.today.activities = [
      activity(
        'daily-sign-review',
        1,
        'review',
        state.stage === 'review'
          ? 'in_progress'
          : state.stage === 'retry' || state.stage === 'retry_needs_review'
            ? 'completed'
            : 'needs_review',
        'Ôn nhanh: Quy tắc dấu của đạo hàm',
        'Tú Tài vừa thêm từ kết quả bài luyện của em.',
        state.stage === 'retry' || state.stage === 'retry_needs_review' ? 100 : 0,
        state.stage === 'retry' || state.stage === 'retry_needs_review'
          ? undefined
          : {
              label: state.stage === 'analysis' ? 'Ôn đúng chỗ yếu' : 'Ôn tiếp',
              href: '/student/learn/daily-sign-review',
            }
      ),
      activity(
        'daily-sign-retry',
        2,
        'retry',
        state.stage === 'retry'
          ? 'in_progress'
          : state.stage === 'retry_needs_review'
            ? 'ready'
            : 'locked',
        '3 câu luyện lại tương tự',
        'Kiểm tra khả năng áp dụng vào câu hỏi mới.',
        0,
        state.stage === 'retry' || state.stage === 'retry_needs_review'
          ? {
              label: state.stage === 'retry' ? 'Làm tiếp' : 'Luyện lại',
              href: '/student/learn/daily-sign-retry',
            }
          : undefined,
        'Mở khóa sau khi hoàn thành ôn nhanh'
      ),
    ];
    dashboard.recommendationExplanation.message =
      'Tú Tài vừa thêm phần ôn đúng vào quy tắc dấu em đang nhầm.';
    return dashboard;
  }

  dashboard.today.activities = [
    activity(
      'daily-monotonicity',
      1,
      'lesson',
      'recommended',
      'Tính đơn điệu của hàm số',
      'Bài học tiếp theo phù hợp với mức năng lực vừa cập nhật.',
      0,
      { label: 'Học tiếp', href: '/student/learn/daily-monotonicity' }
    ),
    activity(
      'daily-monotonicity-check',
      2,
      'practice',
      'locked',
      '5 câu kiểm tra nhanh',
      'Củng cố bài học tiếp theo.',
      0,
      undefined,
      'Mở khóa sau bài Tính đơn điệu của hàm số'
    ),
  ];
  dashboard.progress.masteredTopics = 5;
  dashboard.progress.roadmapPercentage = 42;
  dashboard.recommendationExplanation.message =
    'Đổi biến số đã vững. Tiếp theo: tính đơn điệu của hàm số.';
  dashboard.stages[0].items = dashboard.stages[0].items.map((item) =>
    item.id === 'step-substitution'
      ? { ...item, status: 'completed', href: '/student/learn/lesson-substitution' }
      : item.id === 'step-monotonicity'
        ? { ...item, status: 'current' }
        : item
  );
  return dashboard;
}

export async function getTodayRoadmap(): Promise<StudentRoadmapDashboard> {
  return deriveTodayRoadmap(readState());
}
