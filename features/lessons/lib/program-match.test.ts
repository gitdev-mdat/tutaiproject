import { describe, expect, it } from 'vitest';
import type { LearningSubject } from '@/lib/knowledge-tree/learning-visibility';
import { chooseProgram, programGrade, programSubjectCode, requestedLabel } from './program-match';
import { learningPrograms } from './study-plan';

const lesson = (id: string) => ({
  id,
  title: id,
  description: '',
  chapterId: `${id}-c`,
  chapterTitle: 'Chương',
});
const grade = (id: string, title: string, lessonId: string) => ({
  id,
  title,
  chapters: [{ id: `${lessonId}-c`, title: 'Chương', lessons: [lesson(lessonId)] }],
});
const catalog: LearningSubject[] = [
  {
    id: 'subj_math',
    title: 'Toán học',
    lessonCount: 2,
    grades: [grade('grade_11', 'Lớp 11', 'm11'), grade('grade_12', 'Lớp 12', 'm12')],
  },
  { id: 'subj_phys', title: 'Vật lí', lessonCount: 1, grades: [grade('p12', 'Lớp 12', 'p12')] },
];
const programs = learningPrograms(catalog);

describe('chooseProgram', () => {
  it('reads subject and grade codes from the Knowledge Tree nodes', () => {
    expect(programs.map((p) => [programSubjectCode(p), programGrade(p)])).toEqual([
      ['MATH', 11],
      ['MATH', 12],
      ['PHYSICS', 12],
    ]);
  });

  it('opens the program of the declared subject and grade', () => {
    expect(chooseProgram(programs, { primarySubject: 'MATH', grade: '12' })).toMatchObject({
      program: { id: 'subj_math:grade_12' },
      basis: 'PROFILE',
      requested: 'Toán 12',
    });
    expect(chooseProgram(programs, { primarySubject: 'MATH', grade: '11' }).program?.id).toBe(
      'subj_math:grade_11'
    );
    expect(chooseProgram(programs, { primarySubject: 'PHYSICS', grade: '12' })).toMatchObject({
      program: { id: 'subj_phys:p12' },
      basis: 'PROFILE',
    });
  });

  it('uses the nearest grade of the same subject when the grade has no program', () => {
    expect(chooseProgram(programs, { primarySubject: 'PHYSICS', grade: '10' })).toMatchObject({
      program: { id: 'subj_phys:p12' },
      basis: 'OTHER_GRADE',
      requested: 'Vật lý 10',
    });
    expect(chooseProgram(programs, { primarySubject: 'MATH', grade: 'Khác' })).toMatchObject({
      program: { id: 'subj_math:grade_11' },
      basis: 'OTHER_GRADE',
    });
  });

  it('says so, and opens the default program, when the subject has nothing published', () => {
    expect(chooseProgram(programs, { primarySubject: 'CHEMISTRY', grade: '12' })).toMatchObject({
      program: { id: 'subj_math:grade_12' },
      basis: 'NO_SUBJECT_PROGRAM',
      requested: 'Hóa học 12',
    });
    expect(chooseProgram([], { primarySubject: 'MATH', grade: '12' })).toMatchObject({
      program: null,
      basis: 'NONE',
    });
  });

  it('lets a program the student opened win over the profile', () => {
    expect(
      chooseProgram(
        programs,
        { primarySubject: 'PHYSICS', grade: '12' },
        { subjectId: 'subj_math', gradeId: 'grade_11' }
      )
    ).toMatchObject({ program: { id: 'subj_math:grade_11' }, basis: 'CHOSEN' });
    // An unknown program in the link falls back to the profile.
    expect(
      chooseProgram(programs, { primarySubject: 'PHYSICS', grade: '12' }, { subjectId: 'x' })
    ).toMatchObject({ program: { id: 'subj_phys:p12' }, basis: 'PROFILE' });
  });

  it('does not use the scores: two Mathematics 12 students with different goals get the same program', () => {
    const a = chooseProgram(programs, { primarySubject: 'MATH', grade: '12' });
    const b = chooseProgram(programs, { primarySubject: 'MATH', grade: '12' });
    expect(a).toEqual(b);
    expect(requestedLabel({ primarySubject: null, grade: '12' })).toBeNull();
  });
});
