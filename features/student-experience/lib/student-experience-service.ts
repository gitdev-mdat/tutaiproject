import { getTodayRoadmap } from '@/features/roadmap/lib/adaptive-learning-service';
import { RANKING_LEADERS, STUDENT_ENROLLMENTS } from './mock-data';
import type {
  AssessmentSubmissionInput,
  OverviewPeriod,
  RankingSnapshot,
  StudentAssessmentAttempt,
  StudentDashboardOverview,
  StudentExperienceState,
} from './types';

const STORAGE_KEY = 'tutai:student-experience:v1';

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function seedState(): StudentExperienceState {
  const attempts: StudentAssessmentAttempt[] = [
    {
      id: 'seed-practice-today',
      kind: 'practice',
      activityId: 'lesson-monotonic-foundation',
      title: 'Tính đơn điệu · Kiến thức nền',
      status: 'submitted',
      correct: 5,
      total: 6,
      submittedAt: hoursAgo(3),
      rankingEligible: false,
      evidence: [
        {
          knowledgePointId: 'node-calculus-monotonicity',
          title: 'Tính đơn điệu của hàm số',
          correct: 5,
          total: 6,
          sourceAttemptId: 'seed-practice-today',
        },
      ],
    },
    {
      id: 'seed-practice-week',
      kind: 'practice',
      activityId: 'lesson-extrema-foundation',
      title: 'Cực trị · Nhận diện',
      status: 'submitted',
      correct: 4,
      total: 6,
      submittedAt: hoursAgo(72),
      rankingEligible: false,
      evidence: [],
    },
    {
      id: 'seed-exam-week',
      kind: 'exam',
      activityId: 'semester-1-foundation',
      title: 'Đề giữa kỳ I · Số 01',
      status: 'submitted',
      correct: 31,
      total: 40,
      submittedAt: hoursAgo(96),
      rankingEligible: false,
      evidence: [],
    },
    {
      id: 'seed-practice-month',
      kind: 'practice',
      activityId: 'chapter-derivative-foundation',
      title: 'Ứng dụng đạo hàm · Tổng hợp',
      status: 'submitted',
      correct: 16,
      total: 20,
      submittedAt: hoursAgo(240),
      rankingEligible: false,
      evidence: [],
    },
    {
      id: 'seed-exam-month',
      kind: 'exam',
      activityId: 'national-structure-01',
      title: 'Đề tổng hợp THPT Quốc Gia · Số 01',
      status: 'submitted',
      correct: 34,
      total: 40,
      submittedAt: hoursAgo(360),
      rankingEligible: false,
      evidence: [],
    },
    {
      id: 'seed-arena-result',
      kind: 'arena',
      activityId: 'arena-derivative-07',
      title: 'Đấu trường Đạo hàm #07',
      status: 'submitted',
      correct: 5,
      total: 6,
      submittedAt: hoursAgo(192),
      rankingEligible: true,
      evidence: [],
      competitiveResult: { rank: 46, participantCount: 1284, percentile: 4 },
    },
  ];

  return {
    version: 1,
    attempts,
    registeredCompetitionIds: ['arena-derivative-08'],
    rewards: [
      {
        id: 'reward-arena-top-50',
        title: 'Top 50',
        description: 'Đấu trường Đạo hàm #07',
        sourceEventId: 'arena-derivative-07',
        sourceAttemptId: 'seed-arena-result',
        awardedAt: hoursAgo(191),
      },
    ],
  };
}

export function getInitialStudentExperienceState(): StudentExperienceState {
  return seedState();
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getStudentExperienceState(): StudentExperienceState {
  if (!canUseStorage()) return seedState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as StudentExperienceState;
    if (parsed.version === 1 && Array.isArray(parsed.attempts) && Array.isArray(parsed.rewards)) {
      return {
        ...parsed,
        registeredCompetitionIds: Array.isArray(parsed.registeredCompetitionIds)
          ? parsed.registeredCompetitionIds
          : [],
      };
    }
  } catch {
    // Fall through to a recoverable seed snapshot.
  }
  return seedState();
}

function saveState(state: StudentExperienceState): void {
  if (canUseStorage()) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function competitiveResult(correct: number, total: number) {
  const score = total > 0 ? (correct / total) * 10 : 0;
  if (score >= 9) return { rank: 18, participantCount: 1368, percentile: 2 };
  if (score >= 8) return { rank: 74, participantCount: 1368, percentile: 6 };
  return { rank: 214, participantCount: 1368, percentile: 16 };
}

export function recordAssessmentSubmission(input: AssessmentSubmissionInput) {
  const state = getStudentExperienceState();
  const id = `${input.kind}-${input.activityId}-${Date.now()}`;
  const attempt: StudentAssessmentAttempt = {
    id,
    kind: input.kind,
    activityId: input.activityId,
    title: input.title,
    status: 'submitted',
    correct: input.correct,
    total: input.total,
    submittedAt: new Date().toISOString(),
    rankingEligible: input.rankingEligible ?? false,
    evidence: input.evidence.map((item) => ({ ...item, sourceAttemptId: id })),
    competitiveResult:
      input.kind === 'arena' && input.rankingEligible
        ? competitiveResult(input.correct, input.total)
        : undefined,
  };
  const earnedReward =
    attempt.kind === 'arena' && attempt.competitiveResult && attempt.competitiveResult.rank <= 50
      ? {
          id: `reward-${attempt.id}`,
          title: 'Top 50',
          description: attempt.title,
          sourceEventId: attempt.activityId,
          sourceAttemptId: attempt.id,
          awardedAt: attempt.submittedAt,
        }
      : undefined;
  const next = {
    ...state,
    attempts: [...state.attempts, attempt],
    rewards: earnedReward ? [...state.rewards, earnedReward] : state.rewards,
  };
  saveState(next);
  return attempt;
}

export function registerForCompetition(competitionId: string): StudentExperienceState {
  const state = getStudentExperienceState();
  if (state.registeredCompetitionIds.includes(competitionId)) return state;
  const next = {
    ...state,
    registeredCompetitionIds: [...state.registeredCompetitionIds, competitionId],
  };
  saveState(next);
  return next;
}

function startOfPeriod(period: OverviewPeriod): number {
  const now = new Date();
  if (period === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (period === 'week') {
    const daysSinceMonday = (now.getDay() + 6) % 7;
    return today - daysSinceMonday * 24 * 60 * 60 * 1000;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

function answerAccuracy(attempts: StudentAssessmentAttempt[]): number | undefined {
  const answered = attempts.reduce((total, attempt) => total + attempt.total, 0);
  if (!answered) return undefined;
  const correct = attempts.reduce((total, attempt) => total + attempt.correct, 0);
  return Math.round((correct / answered) * 100);
}

function activitySeries(
  period: OverviewPeriod,
  attempts: StudentAssessmentAttempt[]
): StudentDashboardOverview['activitySeries'] {
  const start = startOfPeriod(period);
  const day = 24 * 60 * 60 * 1000;
  const bucketCount = period === 'day' ? 4 : period === 'week' ? 7 : 5;
  const bucketSize = period === 'day' ? day / 4 : period === 'week' ? day : 7 * day;
  const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'short' });

  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = start + index * bucketSize;
    const bucketEnd = index === bucketCount - 1 ? Date.now() + 1 : bucketStart + bucketSize;
    const included = attempts.filter((attempt) => {
      const submittedAt = Date.parse(attempt.submittedAt);
      return submittedAt >= bucketStart && submittedAt < bucketEnd;
    });
    const label =
      period === 'day'
        ? `${index * 6}–${(index + 1) * 6}h`
        : period === 'week'
          ? weekday.format(new Date(bucketStart)).replace('Thứ ', 'T').replace('Chủ Nhật', 'CN')
          : `Tuần ${index + 1}`;
    return {
      label,
      practice: included.filter((attempt) => attempt.kind === 'practice').length,
      exams: included.filter((attempt) => attempt.kind === 'exam').length,
    };
  });
}

function performanceTrend(
  attempts: StudentAssessmentAttempt[],
  kind: Extract<StudentAssessmentAttempt['kind'], 'practice' | 'exam'>
): StudentDashboardOverview['practiceTrend'] {
  const formatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' });
  return attempts
    .filter((attempt) => attempt.kind === kind)
    .sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt))
    .slice(-6)
    .map((attempt) => ({
      label: formatter.format(new Date(attempt.submittedAt)),
      value: Number(
        (kind === 'practice'
          ? (attempt.correct / attempt.total) * 100
          : (attempt.correct / attempt.total) * 10
        ).toFixed(kind === 'practice' ? 0 : 2)
      ),
      title: attempt.title,
    }));
}

export function getRankingSnapshotFromState(
  state: StudentExperienceState,
  competitionId?: string
): RankingSnapshot {
  const eligible = state.attempts
    .filter(
      (attempt) =>
        attempt.rankingEligible &&
        attempt.competitiveResult &&
        (!competitionId || attempt.activityId === competitionId)
    )
    .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))[0];
  return {
    sourceLabel: competitionId
      ? (eligible?.title ?? 'Kết quả của sự kiện đã chọn')
      : 'Kết quả Đấu trường và đề thi có bật xếp hạng',
    leaders: RANKING_LEADERS,
    currentStudent: eligible?.competitiveResult
      ? {
          ...eligible.competitiveResult,
          score: Number(((eligible.correct / eligible.total) * 10).toFixed(2)),
          sourceAttemptId: eligible.id,
        }
      : undefined,
  };
}

export function getRankingSnapshot(competitionId?: string): RankingSnapshot {
  return getRankingSnapshotFromState(getStudentExperienceState(), competitionId);
}

export async function getStudentHomeOverview(
  period: OverviewPeriod
): Promise<StudentDashboardOverview> {
  const [roadmap, state] = await Promise.all([
    getTodayRoadmap(),
    Promise.resolve(getStudentExperienceState()),
  ]);
  const since = startOfPeriod(period);
  const reportingAttempts = state.attempts.filter(
    (attempt) => attempt.kind === 'practice' || attempt.kind === 'exam'
  );
  const attempts = reportingAttempts.filter((attempt) => Date.parse(attempt.submittedAt) >= since);
  const currentDuration = Date.now() - since;
  const previousAttempts = reportingAttempts.filter((attempt) => {
    const submittedAt = Date.parse(attempt.submittedAt);
    return submittedAt >= since - currentDuration && submittedAt < since;
  });
  const accuracy = answerAccuracy(attempts);
  const previousAccuracy = answerAccuracy(previousAttempts);
  const ranking = getRankingSnapshotFromState(state).currentStudent;
  const kindLabels = { practice: 'Luyện đề', exam: 'Luyện thi', arena: 'Đấu trường' } as const;

  return {
    program: {
      title: STUDENT_ENROLLMENTS[0]?.program ?? 'Chương trình đang học',
      enrolledCourses: STUDENT_ENROLLMENTS,
    },
    period,
    summary: {
      enrolledCourses: STUDENT_ENROLLMENTS.length,
      practiceCompleted: attempts.filter((attempt) => attempt.kind === 'practice').length,
      examsCompleted: attempts.filter((attempt) => attempt.kind === 'exam').length,
      accuracy,
      accuracyDelta:
        accuracy !== undefined && previousAccuracy !== undefined
          ? accuracy - previousAccuracy
          : undefined,
    },
    activitySeries: activitySeries(period, attempts),
    courseProgress: STUDENT_ENROLLMENTS.map((course) => ({
      courseId: course.id,
      name: course.subject,
      progress: course.current ? roadmap.progress.roadmapPercentage : course.progress,
    })),
    practiceTrend: performanceTrend(state.attempts, 'practice'),
    examTrend: performanceTrend(state.attempts, 'exam'),
    ranking,
    recentReward: [...state.rewards].sort(
      (a, b) => Date.parse(b.awardedAt) - Date.parse(a.awardedAt)
    )[0],
    recentActivity: [...state.attempts]
      .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))
      .slice(0, 6)
      .map((attempt) => ({
        id: attempt.id,
        title: attempt.title,
        kind: attempt.kind,
        kindLabel: kindLabels[attempt.kind],
        result:
          attempt.kind === 'arena' && attempt.competitiveResult
            ? `#${attempt.competitiveResult.rank}`
            : attempt.kind === 'exam'
              ? `${((attempt.correct / attempt.total) * 10).toFixed(2)} điểm`
              : `${attempt.correct}/${attempt.total} · ${Math.round((attempt.correct / attempt.total) * 100)}%`,
        submittedAt: attempt.submittedAt,
      })),
  };
}

export function getLatestAttempt(kind: 'practice' | 'exam', activityId: string) {
  return getStudentExperienceState()
    .attempts.filter((attempt) => attempt.kind === kind && attempt.activityId === activityId)
    .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))[0];
}
