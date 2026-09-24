export type ProgressEvidenceKind =
  'practice_attempt' | 'retry_attempt' | 'lesson_completion' | 'insufficient_data';

export interface ProgressEvidence {
  kind: ProgressEvidenceKind;
  label: string;
  recordedAt?: string;
}

export interface MasteryChange {
  id: string;
  knowledgePoint: string;
  before: number;
  after: number;
  evidence: ProgressEvidence;
}

export interface WeakKnowledgePoint {
  id: string;
  title: string;
  mastery: number | null;
  evidence: ProgressEvidence;
  action?: {
    label: string;
    href: string;
  };
}

export interface CompletedLearningItem {
  id: string;
  title: string;
  detail: string;
  evidence: ProgressEvidence;
}

/** API-ready read model used by the student progress page. */
export interface StudentProgressDashboard {
  subject: string;
  targetScore: number;
  overall: {
    roadmapPercentage: number;
    masteredTopics: number;
    totalTopics: number;
  };
  recentImprovements: MasteryChange[];
  weakKnowledgePoints: WeakKnowledgePoint[];
  recentActivity: CompletedLearningItem[];
}
