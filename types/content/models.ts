export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'olympiad';

export type QuestionType =
  | 'multiple_choice'
  | 'short_answer'
  | 'essay'
  | 'proof'
  | 'matching'
  | 'fill_in_blank'
  | 'ordering';

export type ContentState =
  'draft' | 'under_review' | 'revision_requested' | 'published' | 'archived';

export interface Question {
  id: string;
  stem: string;
  questionType: QuestionType;
  difficulty: DifficultyLevel;
  knowledgeUnitIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Lesson {
  id: string;
  title: string;
  description?: string;
  durationMinutes: number;
  knowledgeUnitIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PracticeSet {
  id: string;
  title: string;
  description?: string;
  questionIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Quiz {
  id: string;
  title: string;
  questionIds: string[];
  durationMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockExam {
  id: string;
  title: string;
  examFormat: string;
  questionIds: string[];
  durationMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}
