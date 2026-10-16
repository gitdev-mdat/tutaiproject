import 'server-only';

import { randomUUID } from 'node:crypto';
import { getSql } from '@/lib/db/postgres';
import { getPremiumAccess } from '@/lib/access/premium-access';
import { getLearningCatalog } from '@/lib/knowledge-tree/knowledge-tree-service';
import { listQuestions } from '@/lib/question-bank/qb-storage';
import type { Question } from '@/lib/question-bank/qb-types';
import {
  learningPrograms,
  selectProgram,
  type StudyScope,
} from '@/features/lessons/lib/study-plan';
import { toPracticeQuestion } from './grading';
import {
  PRACTICE_SESSION_SIZE,
  isInLessonPractice,
  orderPracticeQuestions,
} from './practice-rules';
import {
  difficultyMix,
  isSetReady,
  pickSet,
  setFacts,
  type ChapterScope,
  type DifficultyMix,
  type PracticeSetKind,
  type SetFacts,
} from './practice-sets';
import {
  PLUS_REQUIRED_MESSAGE,
  PracticeError,
  requireDatabase,
  summarize,
  type AttemptRow,
  type AttemptSummary,
  type AttemptView,
} from './practice-service';

/**
 * The practice catalog of one program (e.g. Toán 12): every published lesson
 * with its free practice, and per chapter the free "Ôn chương" set and the Plus
 * "Tổng hợp" set when the question bank has enough questions for them. States
 * come from the student's stored attempts only.
 */

export type AttemptState = {
  inProgress: { attemptId: string; answered: number; total: number } | null;
  best: { correct: number; total: number; passed: boolean } | null;
  lastCompleted: {
    attemptId: string;
    correct: number;
    total: number;
    passed: boolean;
    mode: AttemptSummary['mode'];
  } | null;
  completedCount: number;
};

export type LessonEntry = AttemptState & {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  mix: DifficultyMix;
};

export type SetEntry = AttemptState & {
  kind: PracticeSetKind;
  chapterId: string;
  chapterTitle: string;
  facts: SetFacts;
  /** Plus set shown to a student without Plus: details are visible, the questions are not. */
  locked: boolean;
};

export type ChapterEntry = {
  id: string;
  number: number;
  title: string;
  lessons: LessonEntry[];
  review: SetEntry | null;
  synthesis: SetEntry | null;
};

export type ResumeEntry = {
  kind: 'LESSON' | PracticeSetKind;
  id: string;
  title: string;
  chapterTitle: string;
  attemptId: string;
  answered: number;
  total: number;
};

export type ProgramLink = { id: string; title: string; subjectId: string; gradeId: string };

export type PracticeCatalog = {
  program: ProgramLink | null;
  programs: ProgramLink[];
  /** Plus sets are open: through a Plus membership or an admin's preview. */
  hasPlus: boolean;
  /** Open only because the account is an admin previewing, not a member. */
  previewAsAdmin: boolean;
  chapters: ChapterEntry[];
  resume: ResumeEntry | null;
};

const link = (program: StudyScope): ProgramLink => ({
  id: program.id,
  title: program.title,
  subjectId: program.subjectId,
  gradeId: program.gradeId,
});

const scopeOf = (chapter: StudyScope['chapters'][number]): ChapterScope => ({
  id: chapter.id,
  lessonIds: chapter.lessons.map((lesson) => lesson.id),
});

type Row = AttemptRow & { answered_count: number };

/** Attempts newest first → state. `isWhole` says which completed attempts count as a score. */
function attemptState(rows: Row[], isWhole: (row: Row) => boolean): AttemptState {
  const attempts = rows.map(summarize);
  const newest = attempts[0];
  const completed = attempts.filter((a) => a.status === 'COMPLETED');
  const best = completed
    .filter((a) => isWhole(rows[attempts.indexOf(a)]))
    .reduce<AttemptSummary | null>(
      (top, a) =>
        !top || (a.correctCount ?? 0) / a.totalCount > (top.correctCount ?? 0) / top.totalCount
          ? a
          : top,
      null
    );
  const last = completed[0];
  return {
    inProgress:
      newest?.status === 'IN_PROGRESS'
        ? { attemptId: newest.id, answered: newest.answeredCount, total: newest.totalCount }
        : null,
    best: best
      ? { correct: best.correctCount ?? 0, total: best.totalCount, passed: best.passed }
      : null,
    lastCompleted: last
      ? {
          attemptId: last.id,
          correct: last.correctCount ?? 0,
          total: last.totalCount,
          passed: last.passed,
          mode: last.mode,
        }
      : null,
    completedCount: completed.length,
  };
}

async function studentAttempts(studentId: string, ids: string[]): Promise<Row[]> {
  if (!ids.length || !process.env.DATABASE_URL) return [];
  const sql = getSql();
  return sql<Row[]>`
    select a.*, (select count(*) from tutai.practice_answers x where x.attempt_id = a.id)::int as answered_count
    from tutai.practice_attempts a
    where a.student_id = ${studentId} and a.lesson_id in ${sql(ids)}
    order by a.started_at desc`;
}

export async function getPracticeCatalog(
  studentId: string,
  subjectId?: string | null,
  gradeId?: string | null
): Promise<PracticeCatalog> {
  const [catalog, { questions }, access] = await Promise.all([
    getLearningCatalog(),
    listQuestions({ pageSize: 100_000 }),
    getPremiumAccess(studentId),
  ]);
  const hasPlus = access.allowed;
  const previewAsAdmin = access.via === 'ADMIN_PREVIEW';
  const programs = learningPrograms(catalog);
  const program = selectProgram(programs, subjectId, gradeId);
  if (!program)
    return { program: null, programs: [], hasPlus, previewAsAdmin, chapters: [], resume: null };

  const lessonIds = program.lessons.map((lesson) => lesson.id);
  const chapterIds = program.chapters.map((chapter) => chapter.id);
  const rows = await studentAttempts(studentId, [...new Set([...lessonIds, ...chapterIds])]);
  const rowsFor = (id: string, modes: AttemptSummary['mode'][]) =>
    rows.filter((row) => row.lesson_id === id && modes.includes(row.mode));

  const resumes: (ResumeEntry & { startedAt: number })[] = [];
  const chapters: ChapterEntry[] = program.chapters.map((chapter, index) => {
    const lessons: LessonEntry[] = chapter.lessons.map((lesson) => {
      const pool = orderPracticeQuestions(
        questions.filter((q) => isInLessonPractice(q, lesson.id))
      );
      const picked = pool.slice(0, PRACTICE_SESSION_SIZE);
      const lessonRows = rowsFor(lesson.id, ['LESSON', 'MISTAKES']);
      const state = attemptState(lessonRows, (row) => row.mode === 'LESSON');
      if (state.inProgress)
        resumes.push({
          kind: 'LESSON',
          id: lesson.id,
          title: lesson.title,
          chapterTitle: chapter.title,
          ...state.inProgress,
          startedAt: lessonRows[0].started_at.getTime(),
        });
      return {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        questionCount: picked.length,
        mix: difficultyMix(picked),
        ...state,
      };
    });
    const scope = scopeOf(chapter);
    const set = (kind: PracticeSetKind): SetEntry | null => {
      const picked = pickSet(kind, questions, scope);
      if (!isSetReady(picked)) return null;
      const setRows = rowsFor(chapter.id, [kind]);
      const state = attemptState(setRows, () => true);
      const locked = kind === 'SYNTHESIS' && !hasPlus;
      if (state.inProgress && !locked)
        resumes.push({
          kind,
          id: chapter.id,
          title: kind === 'SYNTHESIS' ? 'Tổng hợp' : 'Ôn chương',
          chapterTitle: chapter.title,
          ...state.inProgress,
          startedAt: setRows[0].started_at.getTime(),
        });
      return {
        kind,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        facts: setFacts(picked, scope),
        locked,
        ...state,
      };
    };
    return {
      id: chapter.id,
      number: index + 1,
      title: chapter.title,
      lessons,
      review: set('CHAPTER'),
      synthesis: set('SYNTHESIS'),
    };
  });

  const resume = resumes.sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
  return {
    program: link(program),
    programs: programs.map(link),
    hasPlus,
    previewAsAdmin,
    chapters,
    resume: resume
      ? {
          kind: resume.kind,
          id: resume.id,
          title: resume.title,
          chapterTitle: resume.chapterTitle,
          attemptId: resume.attemptId,
          answered: resume.answered,
          total: resume.total,
        }
      : null,
  };
}

// ── One chapter set ─────────────────────────────────────────────────────────

export type SetContext = {
  kind: PracticeSetKind;
  chapter: { id: string; title: string; lessonTitles: string[] };
  program: ProgramLink;
  /** First lesson of the chapter that has free practice: the free way in from a locked set. */
  freeLessonId: string | null;
  /** Whether the chapter's free "Ôn chương" set exists. */
  hasReview: boolean;
  facts: SetFacts;
  locked: boolean;
  hasPlus: boolean;
  previewAsAdmin: boolean;
  state: AttemptState;
};

async function findChapter(chapterId: string) {
  const programs = learningPrograms(await getLearningCatalog());
  for (const program of programs) {
    const chapter = program.chapters.find((item) => item.id === chapterId);
    if (chapter) return { program, chapter };
  }
  return null;
}

async function setQuestions(kind: PracticeSetKind, chapterId: string) {
  const found = await findChapter(chapterId);
  if (!found) throw new PracticeError(404, 'Chương này chưa mở.');
  const { questions } = await listQuestions({ pageSize: 100_000 });
  const picked: Question[] = pickSet(kind, questions, scopeOf(found.chapter));
  return { ...found, picked };
}

/** What the set page shows before a session: details, access and the student's results. */
export async function getSetContext(
  studentId: string,
  kind: PracticeSetKind,
  chapterId: string
): Promise<SetContext | null> {
  const found = await findChapter(chapterId);
  if (!found) return null;
  const { questions } = await listQuestions({ pageSize: 100_000 });
  const scope = scopeOf(found.chapter);
  const picked = pickSet(kind, questions, scope);
  if (!isSetReady(picked)) return null;
  const access = await getPremiumAccess(studentId);
  const hasPlus = access.allowed;
  const rows = (await studentAttempts(studentId, [chapterId])).filter((row) => row.mode === kind);
  return {
    kind,
    chapter: {
      id: found.chapter.id,
      title: found.chapter.title,
      lessonTitles: found.chapter.lessons.map((lesson) => lesson.title),
    },
    program: link(found.program),
    freeLessonId:
      found.chapter.lessons.find((lesson) =>
        questions.some((q) => isInLessonPractice(q, lesson.id))
      )?.id ?? null,
    hasReview: isSetReady(pickSet('CHAPTER', questions, scope)),
    facts: setFacts(picked, scope),
    locked: kind === 'SYNTHESIS' && !hasPlus,
    hasPlus,
    previewAsAdmin: kind === 'SYNTHESIS' && access.via === 'ADMIN_PREVIEW',
    state: attemptState(rows, () => true),
  };
}

/**
 * Starts a session of a chapter set. The Plus check is here, on the server,
 * for every start: a hidden or disabled button is never the only barrier.
 */
export async function startSetAttempt(
  studentId: string,
  kind: PracticeSetKind,
  chapterId: string
): Promise<AttemptView> {
  const sql = requireDatabase();
  if (kind === 'SYNTHESIS' && !(await getPremiumAccess(studentId)).allowed) {
    throw new PracticeError(403, PLUS_REQUIRED_MESSAGE);
  }
  const { picked } = await setQuestions(kind, chapterId);
  if (!isSetReady(picked)) throw new PracticeError(409, 'Bộ luyện tập này chưa đủ câu hỏi.');
  const id = `pa-${randomUUID()}`;
  const ids = picked.map((q) => q.id);
  const [row] = await sql<AttemptRow[]>`
    insert into tutai.practice_attempts (id, student_id, lesson_id, mode, question_ids, status, total_count)
    values (${id}, ${studentId}, ${chapterId}, ${kind}, ${sql.array(ids)}, 'IN_PROGRESS', ${ids.length})
    returning *`;
  return { attempt: summarize(row), questions: picked.map(toPracticeQuestion), feedback: {} };
}
