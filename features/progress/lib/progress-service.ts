import {
  getAdaptiveLearningState,
  getTodayRoadmap,
} from '@/features/roadmap/lib/adaptive-learning-service';
import type { PracticeAttempt } from '@/features/roadmap/lib/types';
import type { StudentProgressDashboard } from './types';

function newestPassedRetry(attempts: PracticeAttempt[]): PracticeAttempt | undefined {
  return [...attempts].reverse().find((attempt) => attempt.type === 'retry' && attempt.passed);
}

/**
 * Frontend data boundary for the future progress endpoint. The UI consumes one
 * evidence-oriented read model; replacing this mock only requires changing
 * this function, not the page components.
 */
export async function getStudentProgressDashboard(): Promise<StudentProgressDashboard> {
  const [roadmap, adaptiveState] = await Promise.all([
    getTodayRoadmap(),
    getAdaptiveLearningState(),
  ]);
  const passedRetry =
    newestPassedRetry(adaptiveState.practiceAttempts) ??
    (adaptiveState.outcome?.type === 'retry_passed' ? adaptiveState.outcome.attempt : undefined);
  const retryEvidence = passedRetry
    ? `Luyện lại gần nhất: ${passedRetry.correct}/${passedRetry.total} câu đúng`
    : 'Bài luyện gần nhất: 3/5 câu đúng';
  const hasMasteryUpdate = Boolean(passedRetry);

  return {
    subject: 'Toán 12',
    targetScore: roadmap.targetScore,
    overall: {
      roadmapPercentage: roadmap.progress.roadmapPercentage,
      masteredTopics: roadmap.progress.masteredTopics,
      totalTopics: roadmap.progress.totalTopics,
    },
    recentImprovements: hasMasteryUpdate
      ? [
          {
            id: 'derivative-sign-improvement',
            knowledgePoint: 'Quy tắc dấu của đạo hàm',
            before: 52,
            after: 78,
            evidence: {
              kind: 'retry_attempt',
              label: retryEvidence,
              recordedAt: passedRetry?.completedAt ?? adaptiveState.updatedAt,
            },
          },
        ]
      : [
          {
            id: 'substitution-improvement',
            knowledgePoint: 'Phương pháp đổi biến số',
            before: 48,
            after: 64,
            evidence: {
              kind: 'practice_attempt',
              label: 'Bài luyện gần nhất: 4/5 câu đúng',
            },
          },
        ],
    weakKnowledgePoints: [
      {
        id: 'derivative-sign',
        title: 'Quy tắc dấu của đạo hàm',
        mastery: hasMasteryUpdate ? 78 : 52,
        evidence: {
          kind: hasMasteryUpdate ? 'retry_attempt' : 'practice_attempt',
          label: retryEvidence,
          recordedAt: passedRetry?.completedAt,
        },
        action: {
          label: 'Ôn đúng chỗ yếu',
          href: '/student/learn/daily-sign-review',
        },
      },
      {
        id: 'extrema',
        title: 'Cực trị hàm số',
        mastery: null,
        evidence: {
          kind: 'insufficient_data',
          label: 'Chưa đủ dữ liệu để đánh giá',
        },
      },
    ],
    recentActivity: [
      {
        id: 'completed-basic-derivative',
        title: 'Đã hoàn thành Đạo hàm cơ bản',
        detail: 'Kiến thức nền của chương Ứng dụng đạo hàm',
        evidence: { kind: 'lesson_completion', label: 'Bài học đã hoàn thành' },
      },
      ...(adaptiveState.stage === 'lesson'
        ? []
        : [
            {
              id: 'completed-substitution',
              title: 'Đã hoàn thành Phương pháp đổi biến số',
              detail: 'Bài học trọng tâm trong lộ trình hiện tại',
              evidence: {
                kind: 'lesson_completion' as const,
                label: 'Bài học đã hoàn thành',
              },
            },
          ]),
      ...(passedRetry
        ? [
            {
              id: passedRetry.id,
              title: 'Đã luyện lại Quy tắc dấu của đạo hàm',
              detail: `${passedRetry.correct}/${passedRetry.total} câu đúng`,
              evidence: {
                kind: 'retry_attempt' as const,
                label: 'Lượt luyện lại đã lưu',
                recordedAt: passedRetry.completedAt,
              },
            },
          ]
        : []),
    ],
  };
}
