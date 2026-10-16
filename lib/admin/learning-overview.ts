import 'server-only';

import { getSql } from '@/lib/db/postgres';
import { readAuthDatabase } from '@/lib/auth/store';
import { getAllOrders } from '@/lib/db/payment-db';
import { listExams } from '@/lib/exams/exam-storage';
import { isExamTakeable } from '@/lib/exams/student-exam-rules';
import { readKnowledgeArticles } from '@/lib/knowledge-tree/knowledge-article-storage';
import { readKnowledgeTree } from '@/lib/knowledge-tree/knowledge-tree-storage';
import { buildLearningCatalog } from '@/lib/knowledge-tree/learning-visibility';
import { PRIMARY_SUBJECTS } from '@/lib/onboarding/onboarding-model';
import { getPracticeCoverage } from '@/lib/practice/practice-admin';
import { listQuestions } from '@/lib/question-bank/qb-storage';
import { learningPrograms } from '@/features/lessons/lib/study-plan';
import {
  chooseProgram,
  programGrade,
  programSubjectCode,
  subjectLabel,
  type ProgramBasis,
} from '@/features/lessons/lib/program-match';

/**
 * What students receive from the published content, for the admin: every
 * program a student can be placed on, which onboarding answers lead to which
 * program, and what is still unpublished. Read from the same sources the
 * student pages use (Knowledge Tree, question bank, exams, profiles, attempts);
 * nothing here is stored separately or estimated.
 */

export interface ProgramOverview {
  id: string;
  title: string;
  subjectId: string;
  gradeId: string;
  subjectCode: string | null;
  grade: number | null;
  chapterCount: number;
  lessonCount: number;
  /** Published lessons that give students at least one practice question. */
  lessonsWithPractice: number;
  practiceQuestions: number;
  /** Students whose profile (subject, grade) opens this program. */
  studentsPlaced: number;
  /** Students with at least one practice attempt on a lesson of this program. */
  studentsPracticing: number;
}

export interface DeclarationOverview {
  subjectCode: string;
  subjectLabel: string;
  grade: string;
  students: number;
  basis: ProgramBasis;
  programTitle: string | null;
}

export interface LearningOverview {
  programs: ProgramOverview[];
  declarations: DeclarationOverview[];
  students: { onboarded: number; registered: number; source: 'database' | 'file' };
  lessons: { published: number; notVisible: number; withoutArticle: number };
  questions: { published: number; inReview: number; draft: number; archived: number };
  exams: { published: number; takeable: number; unpublished: number; plus: number };
  pendingPayments: number;
}

type Declared = { subject: string | null; grade: string | null; onboarded: boolean };

async function declaredProfiles(): Promise<{ rows: Declared[]; source: 'database' | 'file' }> {
  if (process.env.DATABASE_URL) {
    const rows = await getSql()<
      { subject: string | null; grade: string | null; onboarded: boolean }[]
    >`
      select l.primary_subject as subject, p.grade, p.onboarding_completed_at is not null as onboarded
      from tutai.student_profiles p
      left join tutai.learning_profiles l on l.student_id = p.id`;
    return { rows: [...rows], source: 'database' };
  }
  const database = await readAuthDatabase();
  const learning = new Map(database.learningProfiles.map((item) => [item.studentId, item]));
  return {
    rows: database.studentProfiles.map((profile) => ({
      subject: learning.get(profile.id)?.primarySubject ?? null,
      grade: profile.grade,
      onboarded: Boolean(profile.onboardingCompletedAt),
    })),
    source: 'file',
  };
}

async function practicingStudents(): Promise<{ lesson_id: string; student_id: string }[]> {
  if (!process.env.DATABASE_URL) return [];
  return [
    ...(await getSql()<{ lesson_id: string; student_id: string }[]>`
      select distinct lesson_id, student_id from tutai.practice_attempts`),
  ];
}

export async function getLearningOverview(): Promise<LearningOverview> {
  const [tree, articles, { questions }, exams, coverage, profiles, practicing, orders] =
    await Promise.all([
      readKnowledgeTree(),
      readKnowledgeArticles(),
      listQuestions({ pageSize: 100_000 }),
      listExams(),
      getPracticeCoverage(),
      declaredProfiles(),
      practicingStudents(),
      getAllOrders().catch(() => []),
    ]);
  const programs = learningPrograms(buildLearningCatalog(tree, articles.articles));
  const byLesson = new Map(coverage.map((lesson) => [lesson.lessonId, lesson]));
  const onboarded = profiles.rows.filter((row) => row.onboarded);

  const placedIn = new Map<string, number>();
  for (const row of onboarded) {
    const choice = chooseProgram(programs, {
      primarySubject: (row.subject as never) ?? null,
      grade: row.grade,
    });
    if (choice.program && choice.basis === 'PROFILE')
      placedIn.set(choice.program.id, (placedIn.get(choice.program.id) ?? 0) + 1);
  }

  const programRows: ProgramOverview[] = programs.map((program) => {
    const lessonIds = new Set(program.lessons.map((lesson) => lesson.id));
    const inPractice = program.lessons.map(
      (lesson) => byLesson.get(lesson.id)?.counts.IN_PRACTICE ?? 0
    );
    return {
      id: program.id,
      title: program.title,
      subjectId: program.subjectId,
      gradeId: program.gradeId,
      subjectCode: programSubjectCode(program),
      grade: programGrade(program),
      chapterCount: program.chapters.length,
      lessonCount: program.lessons.length,
      lessonsWithPractice: inPractice.filter((count) => count > 0).length,
      practiceQuestions: inPractice.reduce((sum, count) => sum + count, 0),
      studentsPlaced: placedIn.get(program.id) ?? 0,
      studentsPracticing: new Set(
        practicing.filter((row) => lessonIds.has(row.lesson_id)).map((row) => row.student_id)
      ).size,
    };
  });

  // Every onboarding subject for grades 10–12, plus any other answer a student gave.
  const grades = new Set(['10', '11', '12']);
  for (const row of onboarded) if (row.grade) grades.add(row.grade);
  const declarations: DeclarationOverview[] = PRIMARY_SUBJECTS.flatMap((subject) =>
    [...grades].sort().map((grade) => {
      const choice = chooseProgram(programs, { primarySubject: subject.code, grade });
      return {
        subjectCode: subject.code,
        subjectLabel: subjectLabel(subject.code) ?? subject.code,
        grade,
        students: onboarded.filter((row) => row.subject === subject.code && row.grade === grade)
          .length,
        basis: choice.basis,
        programTitle: choice.program?.title ?? null,
      };
    })
  );

  const lessonStates = coverage.filter((lesson) => lesson.publication !== 'ARCHIVED');
  return {
    programs: programRows,
    declarations,
    students: {
      onboarded: onboarded.length,
      registered: profiles.rows.length,
      source: profiles.source,
    },
    lessons: {
      published: lessonStates.filter((lesson) => lesson.publication === 'PUBLISHED').length,
      notVisible: lessonStates.filter(
        (lesson) => lesson.publication === 'DRAFT' || lesson.publication === 'READY'
      ).length,
      withoutArticle: lessonStates.filter((lesson) => lesson.publication === 'NO_ARTICLE').length,
    },
    questions: {
      published: questions.filter((q) => q.editorialStatus === 'PUBLISHED').length,
      inReview: questions.filter((q) => q.editorialStatus === 'IN_REVIEW').length,
      draft: questions.filter((q) => q.editorialStatus === 'DRAFT').length,
      archived: questions.filter((q) => q.editorialStatus === 'ARCHIVED').length,
    },
    exams: {
      published: exams.filter((exam) => exam.publishStatus === 'PUBLISHED').length,
      takeable: exams.filter(isExamTakeable).length,
      unpublished: exams.filter((exam) => exam.publishStatus !== 'PUBLISHED').length,
      plus: exams.filter((exam) => exam.publishStatus === 'PUBLISHED' && exam.accessTier === 'PLUS')
        .length,
    },
    pendingPayments: orders.filter((order) => order.status === 'PAYMENT_REVIEW').length,
  };
}
