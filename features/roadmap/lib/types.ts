export type RoadmapStatus = 'not_started' | 'active' | 'completed' | 'paused';
export type RoadmapPhaseStatus = 'locked' | 'available' | 'active' | 'completed';
export type RoadmapWeekStatus = 'locked' | 'available' | 'active' | 'completed';
export type RoadmapActivityStatus =
  'locked' | 'available' | 'in_progress' | 'completed' | 'skipped';
export type RoadmapActivityType = 'lesson' | 'practice' | 'review' | 'quiz' | 'mock_exam';

export type DailyLearningActivityType = 'lesson' | 'practice' | 'review' | 'retry' | 'assessment';

export type DailyLearningActivityStatus =
  'recommended' | 'in_progress' | 'ready' | 'locked' | 'completed' | 'needs_review';

export type RecommendationReasonType =
  'low_mastery' | 'recent_mistake' | 'prerequisite_gap' | 'target_score' | 'roadmap';

export interface DailyLearningActivity {
  id: string;
  order: number;
  type: DailyLearningActivityType;
  status: DailyLearningActivityStatus;
  title: string;
  description?: string;
  subject: string;
  grade?: number;
  estimatedMinutes?: number;
  progress?: number;
  dependencyActivityId?: string;
  dependencyLabel?: string;
  recommendationReason?: {
    type: RecommendationReasonType;
    message: string;
  };
  action?: {
    label: string;
    href?: string;
  };
}

export interface RoadmapMilestone {
  id: string;
  order: number;
  title: string;
  status: 'in_progress' | 'next' | 'later' | 'completed';
}

export interface RoadmapStageItem {
  id: string;
  title: string;
  status: 'completed' | 'current' | 'upcoming' | 'locked' | 'needs_review';
  /** Opens the lesson without changing the learner's roadmap position. */
  href?: string;
}

export interface RoadmapStage {
  id: string;
  order: number;
  title: string;
  items: RoadmapStageItem[];
}

/**
 * View model for the adaptive daily roadmap endpoint. It deliberately keeps the
 * queue separate from the legacy week model so the backend can insert review or
 * retry activities without changing the page structure.
 */
export interface StudentRoadmapDashboard {
  targetScore: number;
  today: {
    date: string;
    activities: DailyLearningActivity[];
  };
  progress: {
    masteredTopics: number;
    totalTopics: number;
    reviewTopics: number;
    roadmapPercentage: number;
  };
  recommendationExplanation: {
    title: string;
    message: string;
  };
  upcomingMilestones: RoadmapMilestone[];
  stages: RoadmapStage[];
}

export type AdaptiveFlowStage =
  | 'lesson'
  | 'lesson_complete'
  | 'practice'
  | 'practice_passed'
  | 'analysis'
  | 'review'
  | 'retry'
  | 'retry_needs_review'
  | 'mastery_complete';

export type PracticeAttemptType = 'progression' | 'retake' | 'retry';

export interface PracticeAttempt {
  id: string;
  activityId: string;
  type: PracticeAttemptType;
  correct: number;
  total: number;
  passed: boolean;
  completedAt: string;
}

export type CompletionOutcome =
  | {
      id: string;
      type: 'lesson_completed';
      firstTime: true;
      lessonTitle: string;
      nextActivityId: string;
    }
  | { id: string; type: 'lesson_review_completed'; lessonId: string }
  | {
      id: string;
      type: 'practice_passed';
      masteryBefore: number;
      masteryAfter: number;
      attempt: PracticeAttempt;
    }
  | { id: string; type: 'practice_needs_review'; analysisId: string }
  | {
      id: string;
      type: 'retry_passed';
      masteryBefore: number;
      masteryAfter: number;
      attempt: PracticeAttempt;
    }
  | { id: string; type: 'chapter_completed'; chapterId: string };

export interface AdaptiveQuestion {
  id: string;
  prompt: string;
  options: { id: string; label: string }[];
}

export interface PracticeAnalysis {
  attemptId: string;
  score: { correct: number; total: number; percentage: number };
  masteryResult: { passed: boolean; previousMastery: number; currentMastery: number };
  detectedWeaknesses: {
    id: string;
    title: string;
    description: string;
    evidenceQuestionIds: string[];
  }[];
  nextAction: {
    type: 'continue' | 'targeted_review' | 'retry' | 'next_topic';
    activityId: string;
  };
}

export interface AdaptiveLearningState {
  version: 1;
  stage: AdaptiveFlowStage;
  lessonProgress: number;
  practiceAnswers: Record<string, string>;
  retryAnswers: Record<string, string>;
  practiceAttempts: PracticeAttempt[];
  analysis?: PracticeAnalysis;
  outcome?: CompletionOutcome;
  updatedAt: string;
}

export interface KnowledgeRef {
  knowledgeNodeId: string;
  label: string;
}

export interface ContentRef {
  type: 'lesson' | 'practice_set' | 'quiz' | 'mock_exam';
  id: string;
}

export interface RoadmapActivityProgress {
  startedAt?: string;
  completedAt?: string;
  score?: number;
  accuracy?: number;
}

export interface RoadmapActivity {
  id: string;
  weekId: string;
  order: number;
  type: RoadmapActivityType;
  title: string;
  description?: string;
  estimatedMinutes: number;
  status: RoadmapActivityStatus;
  contentRef?: ContentRef;
  knowledgeRefs?: KnowledgeRef[];
  progress?: RoadmapActivityProgress;
}

export interface RoadmapWeek {
  id: string;
  phaseId: string;
  order: number;
  title: string;
  description?: string;
  status: RoadmapWeekStatus;
  completedActivities: number;
  totalActivities: number;
  activities: RoadmapActivity[];
}

export interface RoadmapPhase {
  id: string;
  roadmapId: string;
  order: number;
  title: string;
  description: string;
  topics: string[];
  outcome: string;
  status: RoadmapPhaseStatus;
  weeks: RoadmapWeek[];
}

export interface StudentRoadmapProgress {
  completedActivities: number;
  totalActivities: number;
  percentage: number;
}

export interface StudentRoadmap {
  id: string;
  studentId: string;
  subject: { id: string; code: string; name: string };
  targetScore: number;
  baselineScore?: number;
  dailyStudyMinutes: number;
  estimatedWeeks: number;
  status: RoadmapStatus;
  currentPhaseId: string | null;
  currentWeekId: string | null;
  currentActivityId: string | null;
  phases: RoadmapPhase[];
  progress: StudentRoadmapProgress;
  createdAt: string;
  updatedAt: string;
}

export interface CompleteActivityInput {
  score?: number;
  accuracy?: number;
}

export interface RoadmapService {
  getStudentRoadmap(): Promise<StudentRoadmap | null>;
  getStudentRoadmapDashboard(): Promise<StudentRoadmapDashboard>;
  getRoadmapWeek(roadmapId: string, weekId: string): Promise<RoadmapWeek>;
  startActivity(roadmapId: string, activityId: string): Promise<RoadmapActivity>;
  completeActivity(
    roadmapId: string,
    activityId: string,
    payload?: CompleteActivityInput
  ): Promise<RoadmapActivity>;
}

export function getNextRecommendedActivity(roadmap: StudentRoadmap): RoadmapActivity | null {
  const activities = roadmap.phases.flatMap((phase) =>
    phase.weeks.flatMap((week) => week.activities)
  );
  return (
    activities.find((activity) => activity.status === 'in_progress') ??
    activities.find((activity) => activity.status === 'available') ??
    null
  );
}

export function calculateRoadmapProgress(phases: RoadmapPhase[]): StudentRoadmapProgress {
  const activities = phases.flatMap((phase) => phase.weeks.flatMap((week) => week.activities));
  const completedActivities = activities.filter(
    (activity) => activity.status === 'completed'
  ).length;
  const totalActivities = activities.length;
  return {
    completedActivities,
    totalActivities,
    percentage: totalActivities ? Math.round((completedActivities / totalActivities) * 100) : 0,
  };
}
