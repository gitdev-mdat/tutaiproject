export type RoadmapStage = 'learning' | 'chapter_review' | 'semester_review' | 'exam_prep';

export type KnowledgeUnitStatus = 'not_studied' | 'in_progress' | 'studied' | 'mastered';

export interface CompetencyEstimate {
  knowledgeUnitId: string;
  level: number; // 0–1
  lastUpdated: Date;
  evidenceCount: number;
}

export interface RoadmapTask {
  id: string;
  type: 'lesson' | 'practice' | 'quiz' | 'review' | 'flashcard' | 'mock_exam';
  title: string;
  knowledgeUnitIds: string[];
  estimatedMinutes: number;
  priority: number;
  stage: RoadmapStage;
}

export interface StudentRoadmap {
  studentId: string;
  stage: RoadmapStage;
  tasks: RoadmapTask[];
  competencies: Record<string, CompetencyEstimate>;
  lastUpdated: Date;
}
