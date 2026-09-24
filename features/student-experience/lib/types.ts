import type { Competition } from '@/data/mock-competitions';

export type StudentActivityKind = 'practice' | 'exam' | 'arena';
export type AttemptStatus = 'not_started' | 'in_progress' | 'submitted';
export type OverviewPeriod = 'day' | 'week' | 'month';
export type StudentCompetitionStatus =
  'upcoming' | 'registration_open' | 'registered' | 'live' | 'completed';
export type CompetitionEligibility = 'eligible' | 'plus_required' | 'not_eligible';

export interface CourseEnrollment {
  id: string;
  program: string;
  subject: 'Toán' | 'Vật lý' | 'Hóa học';
  grade: 12;
  targetScore?: number;
  current: boolean;
  progress: number;
}

export interface KnowledgeEvidence {
  knowledgePointId: string;
  title: string;
  correct: number;
  total: number;
  sourceAttemptId: string;
}

export interface StudentAssessmentAttempt {
  id: string;
  kind: StudentActivityKind;
  activityId: string;
  title: string;
  status: Extract<AttemptStatus, 'submitted'>;
  correct: number;
  total: number;
  submittedAt: string;
  rankingEligible: boolean;
  evidence: KnowledgeEvidence[];
  competitiveResult?: {
    rank: number;
    participantCount: number;
    percentile: number;
  };
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  sourceEventId: string;
  sourceAttemptId: string;
  awardedAt: string;
}

export interface StudentCompetition extends Pick<
  Competition,
  | 'id'
  | 'slug'
  | 'title'
  | 'subject'
  | 'description'
  | 'startAt'
  | 'endAt'
  | 'durationMinutes'
  | 'questionCount'
  | 'participantCount'
  | 'plusRequired'
  | 'prizePool'
  | 'prizes'
  | 'rankingRules'
> {
  status: StudentCompetitionStatus;
  eligibility: CompetitionEligibility;
  registrationDeadline?: string;
  examSetSlug: string;
  featured?: boolean;
  initiallyRegistered?: boolean;
}

export interface StudentExperienceState {
  version: 1;
  attempts: StudentAssessmentAttempt[];
  rewards: Reward[];
  registeredCompetitionIds: string[];
}

export interface RankingEntry {
  rank: number;
  studentName: string;
  school: string;
  score: number;
}

export interface RankingSnapshot {
  sourceLabel: string;
  leaders: RankingEntry[];
  currentStudent?: {
    rank: number;
    participantCount: number;
    percentile: number;
    score: number;
    sourceAttemptId: string;
  };
}

export interface DashboardActivityPoint {
  label: string;
  practice: number;
  exams: number;
}

export interface DashboardPerformancePoint {
  label: string;
  value: number;
  title: string;
}

export interface DashboardRecentActivity {
  id: string;
  title: string;
  kind: StudentActivityKind;
  kindLabel: string;
  result: string;
  submittedAt: string;
}

export interface StudentDashboardOverview {
  program: {
    title: string;
    enrolledCourses: CourseEnrollment[];
  };
  period: OverviewPeriod;
  summary: {
    enrolledCourses: number;
    practiceCompleted: number;
    examsCompleted: number;
    accuracy?: number;
    accuracyDelta?: number;
  };
  activitySeries: DashboardActivityPoint[];
  courseProgress: { courseId: string; name: string; progress: number }[];
  practiceTrend: DashboardPerformancePoint[];
  examTrend: DashboardPerformancePoint[];
  ranking?: RankingSnapshot['currentStudent'];
  recentReward?: Reward;
  recentActivity: DashboardRecentActivity[];
}

export interface AssessmentSubmissionInput {
  kind: StudentActivityKind;
  activityId: string;
  title: string;
  correct: number;
  total: number;
  rankingEligible?: boolean;
  evidence: Omit<KnowledgeEvidence, 'sourceAttemptId'>[];
}
