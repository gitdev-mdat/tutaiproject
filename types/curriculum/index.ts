/**
 * Curriculum domain types for Tú Tài.
 *
 * Hierarchy:
 *   Subject → Curriculum (per grade+semester) → Chapter → Lesson → KnowledgeUnit
 *
 * Grade availability is tracked in config/subjects.ts (UI layer).
 * These types represent the data/content layer.
 */

export type SubjectCode = 'MATH' | 'PHYS' | 'CHEM' | 'BIO';

/** Supported grade levels. 10 and 11 are defined now for forward-compatibility. */
export type GradeLevel = 10 | 11 | 12;

export interface Subject {
  id: string;
  code: SubjectCode;
  /** URL slug, e.g. 'toan', 'vat-ly', 'hoa-hoc', 'sinh-hoc' */
  slug: string;
  nameVi: string;
  nameEn: string;
  isGraduationExamSubject: boolean;
  examWeight?: number;
}

/**
 * A Curriculum ties a Subject to a specific Grade and Semester.
 * This is the correct context for all Chapter/Lesson/KnowledgeUnit content.
 */
export interface Curriculum {
  id: string;
  subjectId: string;
  grade: GradeLevel;
  semester: 1 | 2;
  title: string;
  effectiveDate: Date;
  isCurrent: boolean;
}

export interface Chapter {
  id: string;
  curriculumId: string;
  chapterNumber: number;
  title: string;
  description?: string;
}

export interface Lesson {
  id: string;
  chapterId: string;
  lessonNumber: number;
  title: string;
}

export interface KnowledgeUnit {
  id: string;
  lessonId: string;
  code: string;
  title: string;
  description?: string;
  prerequisiteIds: string[];
}
