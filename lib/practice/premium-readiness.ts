import type { Question } from '@/lib/question-bank/qb-types';
import type { ExamAccessTier, ExamRecord } from '@/lib/exams/exam-types';
import { examAccessTier } from '@/lib/exams/exam-access';
import { examName, isExamTakeable } from '@/lib/exams/student-exam-rules';
import { practiceExclusionReason } from './grading';
import { PRACTICE_READY_THRESHOLD, isInLessonPractice } from './practice-rules';
import { isSetReady, isSynthesisQuestion, pickSet, type ChapterScope } from './practice-sets';

/**
 * Why each chapter set and exam is, or is not, open to students. Counts only
 * what the metadata says, so an admin can tell "no content", "content not yet
 * published or eligible" and "content restricted to Plus" apart.
 */

type Chapter = { id: string; title: string; lessons: { id: string; title: string }[] };
type Program = { title: string; chapters: Chapter[] };

export type ChapterReadiness = {
  id: string;
  title: string;
  programTitle: string;
  lessonCount: number;
  /** Lessons that give students at least one free practice question. */
  lessonsWithPractice: number;
  review: { ready: boolean; lessonsNeeded: number };
  synthesis: {
    ready: boolean;
    /** Published, Plus, "Plus đặc biệt" and auto-gradable: what the set is made of. */
    eligible: number;
    /** How many more eligible questions the set needs before it opens. */
    needed: number;
    /** Plus đặc biệt questions still in draft or review. */
    unpublished: number;
    /** Published Plus đặc biệt questions students cannot answer on the web yet. */
    notGradable: number;
  };
};

export type ExamReadiness = {
  id: string;
  name: string;
  status: ExamRecord['publishStatus'];
  accessTier: ExamAccessTier;
  /** Published with a snapshot, a time limit and only auto-gradable questions. */
  takeable: boolean;
  questionCount: number;
};

export type PremiumReadiness = {
  questions: {
    published: number;
    publishedOpen: number;
    publishedPlus: number;
    plusSpecialEligible: number;
    plusSpecialUnpublished: number;
    /** Eligible Plus đặc biệt questions placed outside every chapter students can see. */
    plusSpecialOutsideOpenChapters: number;
  };
  chapters: ChapterReadiness[];
  exams: ExamReadiness[];
};

const isPlusSpecial = (q: Question) =>
  q.accessTier === 'PLUS' && q.usageContexts.includes('PLUS_SPECIAL');

const inChapter = (q: Question, chapter: ChapterScope) =>
  !!q.primaryKnowledgeNodeId &&
  (q.primaryKnowledgeNodeId === chapter.id || chapter.lessonIds.includes(q.primaryKnowledgeNodeId));

export function computePremiumReadiness(
  programs: Program[],
  questions: Question[],
  exams: ExamRecord[]
): PremiumReadiness {
  const published = questions.filter((q) => q.editorialStatus === 'PUBLISHED');
  const eligible = questions.filter(isSynthesisQuestion);
  const scopes: ChapterScope[] = [];

  const chapters = programs.flatMap((program) =>
    program.chapters.map((chapter): ChapterReadiness => {
      const scope = { id: chapter.id, lessonIds: chapter.lessons.map((lesson) => lesson.id) };
      scopes.push(scope);
      const lessonsWithPractice = chapter.lessons.filter((lesson) =>
        questions.some((q) => isInLessonPractice(q, lesson.id))
      ).length;
      const special = questions.filter((q) => isPlusSpecial(q) && inChapter(q, scope));
      const eligibleHere = special.filter(isSynthesisQuestion).length;
      return {
        id: chapter.id,
        title: chapter.title,
        programTitle: program.title,
        lessonCount: chapter.lessons.length,
        lessonsWithPractice,
        review: {
          ready: isSetReady(pickSet('CHAPTER', questions, scope)),
          lessonsNeeded: Math.max(0, 2 - lessonsWithPractice),
        },
        synthesis: {
          ready: isSetReady(pickSet('SYNTHESIS', questions, scope)),
          eligible: eligibleHere,
          needed: Math.max(0, PRACTICE_READY_THRESHOLD - eligibleHere),
          unpublished: special.filter(
            (q) => q.editorialStatus === 'DRAFT' || q.editorialStatus === 'IN_REVIEW'
          ).length,
          notGradable: special.filter(
            (q) => q.editorialStatus === 'PUBLISHED' && practiceExclusionReason(q) !== null
          ).length,
        },
      };
    })
  );

  return {
    questions: {
      published: published.length,
      publishedOpen: published.filter((q) => q.accessTier !== 'PLUS').length,
      publishedPlus: published.filter((q) => q.accessTier === 'PLUS').length,
      plusSpecialEligible: eligible.length,
      plusSpecialUnpublished: questions.filter(
        (q) =>
          isPlusSpecial(q) && (q.editorialStatus === 'DRAFT' || q.editorialStatus === 'IN_REVIEW')
      ).length,
      plusSpecialOutsideOpenChapters: eligible.filter(
        (q) => !scopes.some((scope) => inChapter(q, scope))
      ).length,
    },
    chapters,
    exams: exams.map((exam) => ({
      id: exam.id,
      name: examName(exam),
      status: exam.publishStatus,
      accessTier: examAccessTier(exam),
      takeable: isExamTakeable(exam),
      questionCount: exam.publishedSnapshot?.questions.length ?? exam.questionIds.length,
    })),
  };
}
