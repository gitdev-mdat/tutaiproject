export type LearningEvidenceSource = 'diagnostic' | 'practice' | 'exam';

/** Preferences the learner reports during onboarding; these are not proficiency evidence. */
export interface OnboardingPreferenceData {
  targetScore: string;
  subjects: string[];
  selfReportedLevel: string;
  dailyStudyMinutes: number;
}

/** Verified results from student work that may support roadmap insights. */
export interface LearningEvidence {
  source: LearningEvidenceSource;
  assessmentId?: string;
  completedAt?: string;
  results?: Record<string, number>;
  [key: string]: unknown;
}

export interface FoundationalRoadmapActivity {
  id: string;
  title: string;
  detail: string;
  durationMinutes?: number;
  questionCount?: number;
}

export interface FoundationalRoadmap {
  type: 'foundational';
  title: 'Lộ trình khởi đầu';
  preference: OnboardingPreferenceData;
  activities: FoundationalRoadmapActivity[];
  evidence?: null;
}

export interface EvidenceBasedRoadmap {
  type: 'evidence-based';
  preference: OnboardingPreferenceData;
  evidence: LearningEvidence;
  strengths?: string[];
  priorities?: string[];
}

export type Roadmap = FoundationalRoadmap | EvidenceBasedRoadmap;
