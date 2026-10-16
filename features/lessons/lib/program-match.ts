import { PRIMARY_SUBJECTS, type PrimarySubjectCode } from '@/lib/onboarding/onboarding-model';
import { resolveGrade, resolveSubjectId } from '@/lib/question-bank/qb-knowledge-utils';
import type { SubjectId } from '@/lib/question-bank/qb-types';
import { defaultProgram, type StudyScope } from './study-plan';

/**
 * Which published program a student's Roadmap opens on, and why.
 *
 * One deterministic rule, from the two onboarding answers that name a
 * curriculum: the subject the student most wants to improve and their grade.
 * The program is looked up in the published Knowledge Tree, so a program the
 * admin publishes later is picked up without any per-student assignment.
 *
 * Nothing else is inferred. The current and target scores are self-reported;
 * they are shown as the student's goal but never used to skip or reorder
 * lessons, because neither proves what the student already knows.
 */

/** The subject code of a program, from its Knowledge Tree subject node. */
export function programSubjectCode(program: Pick<StudyScope, 'subjectId' | 'subjectTitle'>) {
  return resolveSubjectId({ id: program.subjectId, title: program.subjectTitle }) ?? null;
}

/** The grade (10, 11, 12) of a program, from its Knowledge Tree grade node. */
export function programGrade(program: Pick<StudyScope, 'gradeId' | 'gradeTitle'>) {
  return resolveGrade(program.gradeTitle, program.gradeId) ?? null;
}

export const subjectLabel = (code: string | null | undefined) =>
  PRIMARY_SUBJECTS.find((subject) => subject.code === code)?.label ?? null;

export interface LearnerDeclaration {
  primarySubject: PrimarySubjectCode | SubjectId | null;
  /** As stored by onboarding: '10', '11', '12' or 'Khác'. */
  grade: string | null;
}

export type ProgramBasis =
  /** The student picked this program themselves (a link or the program switch). */
  | 'CHOSEN'
  /** The program of the subject and grade in the student's profile. */
  | 'PROFILE'
  /** The profile's subject has a program, but not for the student's grade. */
  | 'OTHER_GRADE'
  /** Nothing is published for the profile's subject yet. */
  | 'NO_SUBJECT_PROGRAM'
  /** Nothing is published at all. */
  | 'NONE';

export interface ProgramChoice {
  program: StudyScope | null;
  basis: ProgramBasis;
  /** The program the profile asks for, e.g. "Vật lý 12", for the explanation. */
  requested: string | null;
}

/** "Vật lý" + "12" → "Vật lý 12"; "Khác" grade → "Vật lý". */
export function requestedLabel(declaration: LearnerDeclaration): string | null {
  const subject = subjectLabel(declaration.primarySubject);
  if (!subject) return null;
  return /^\d+$/.test(declaration.grade ?? '') ? `${subject} ${declaration.grade}` : subject;
}

/** The programs that teach the declared subject, highest grade last. */
export function programsForSubject(programs: StudyScope[], code: string | null | undefined) {
  return code
    ? programs
        .filter((program) => programSubjectCode(program) === code)
        .sort((a, b) => (programGrade(a) ?? 0) - (programGrade(b) ?? 0))
    : [];
}

/**
 * The program for a student. `explicit` is a program the student opened
 * themselves (`?subject=…&grade=…`); it wins when it exists.
 */
export function chooseProgram(
  programs: StudyScope[],
  declaration: LearnerDeclaration | null,
  explicit?: { subjectId?: string | null; gradeId?: string | null }
): ProgramChoice {
  const requested = declaration ? requestedLabel(declaration) : null;
  if (explicit?.subjectId) {
    const ofSubject = programs.filter((p) => p.subjectId === explicit.subjectId);
    const chosen =
      ofSubject.find((p) => p.gradeId === explicit.gradeId) ?? ofSubject[ofSubject.length - 1];
    if (chosen) return { program: chosen, basis: 'CHOSEN', requested };
  }
  if (!programs.length) return { program: null, basis: 'NONE', requested };
  const ofSubject = programsForSubject(programs, declaration?.primarySubject);
  const grade = Number(declaration?.grade);
  const exact = ofSubject.find((program) => programGrade(program) === grade);
  if (exact) return { program: exact, basis: 'PROFILE', requested };
  if (ofSubject.length) {
    // The nearest grade at or below the student's, else the lowest one above it.
    const below = ofSubject.filter((p) => (programGrade(p) ?? 99) <= grade);
    const nearest = below[below.length - 1] ?? ofSubject[0];
    return { program: nearest, basis: 'OTHER_GRADE', requested };
  }
  return { program: defaultProgram(programs), basis: 'NO_SUBJECT_PROGRAM', requested };
}
