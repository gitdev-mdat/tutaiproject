import 'server-only';

import { randomUUID } from 'node:crypto';
import { getSql } from '@/lib/db/postgres';
import { getQuestion, listQuestions } from '@/lib/question-bank/qb-storage';
import type { Question } from '@/lib/question-bank/qb-types';
import { getVisibleLessonArticle } from '@/lib/knowledge-tree/knowledge-tree-service';
import {
  gradePracticeResponse,
  parsePracticeResponse,
  toPracticeFeedback,
  toPracticeQuestion,
  type PracticeFeedback,
  type PracticeQuestion,
} from './grading';
import {
  PRACTICE_SESSION_SIZE,
  isInLessonPractice,
  isPassingScore,
  orderPracticeQuestions,
  pickLessonSession,
} from './practice-rules';

/**
 * Lesson practice for students. Questions come from the question bank (linked
 * to the lesson by primaryKnowledgeNodeId), grading happens here on the
 * server, and attempts and answers are stored in PostgreSQL.
 */

export type PracticeMode = 'LESSON' | 'MISTAKES';

export class PracticeError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export type AttemptSummary = {
  id: string;
  lessonId: string;
  mode: PracticeMode;
  status: 'IN_PROGRESS' | 'COMPLETED';
  correctCount: number | null;
  totalCount: number;
  answeredCount: number;
  startedAt: string;
  completedAt: string | null;
  passed: boolean;
};

export type LessonPracticeOverview = {
  lessonId: string;
  questionCount: number;
  inProgress: AttemptSummary | null;
  lastCompleted: AttemptSummary | null;
  best: AttemptSummary | null;
  completedCount: number;
};

export type AttemptView = {
  attempt: AttemptSummary;
  questions: PracticeQuestion[];
  feedback: Record<string, PracticeFeedback>;
};

function requireDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new PracticeError(503, 'Luyện tập cần kết nối cơ sở dữ liệu.');
  }
  return getSql();
}

type AttemptRow = {
  id: string;
  student_id: string;
  lesson_id: string;
  mode: PracticeMode;
  question_ids: string[];
  status: 'IN_PROGRESS' | 'COMPLETED';
  correct_count: number | null;
  total_count: number;
  started_at: Date;
  completed_at: Date | null;
  answered_count?: number;
};

function summarize(row: AttemptRow): AttemptSummary {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    mode: row.mode,
    status: row.status,
    correctCount: row.correct_count,
    totalCount: row.total_count,
    answeredCount: Number(row.answered_count ?? 0),
    startedAt: row.started_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
    passed: row.correct_count !== null && isPassingScore(row.correct_count, row.total_count),
  };
}

async function lessonQuestions(lessonId: string): Promise<Question[]> {
  const { questions } = await listQuestions({ curriculumItemId: lessonId, pageSize: 10_000 });
  return questions;
}

async function requireVisibleLesson(lessonId: string) {
  if (!(await getVisibleLessonArticle(lessonId))) {
    throw new PracticeError(404, 'Bài học này chưa mở.');
  }
}

/** What the lesson page shows: how many questions there are and the student's results so far. */
export async function getLessonPracticeOverview(
  studentId: string,
  lessonId: string
): Promise<LessonPracticeOverview> {
  const sql = requireDatabase();
  const questions = (await lessonQuestions(lessonId)).filter((q) =>
    isInLessonPractice(q, lessonId)
  );
  const rows = await sql<AttemptRow[]>`
    select a.*, (select count(*) from tutai.practice_answers x where x.attempt_id = a.id)::int as answered_count
    from tutai.practice_attempts a
    where a.student_id = ${studentId} and a.lesson_id = ${lessonId}
    order by a.started_at desc`;
  const attempts = rows.map(summarize);
  const completed = attempts.filter((a) => a.status === 'COMPLETED');
  // A retry of only the missed questions is not a score for the whole lesson.
  const best = completed
    .filter((a) => a.mode === 'LESSON')
    .reduce<AttemptSummary | null>(
      (top, a) =>
        !top || (a.correctCount ?? 0) / a.totalCount > (top.correctCount ?? 0) / top.totalCount
          ? a
          : top,
      null
    );
  return {
    lessonId,
    questionCount: Math.min(questions.length, PRACTICE_SESSION_SIZE),
    inProgress: attempts.find((a) => a.status === 'IN_PROGRESS') ?? null,
    lastCompleted: completed[0] ?? null,
    best,
    completedCount: completed.length,
  };
}

/** Results for every lesson the student practised, for the lesson list. */
export async function getStudentPracticeResults(
  studentId: string
): Promise<Record<string, { best: number; total: number; passed: boolean }>> {
  if (!process.env.DATABASE_URL) return {};
  const sql = getSql();
  const rows = await sql<{ lesson_id: string; correct_count: number; total_count: number }[]>`
    select distinct on (lesson_id) lesson_id, correct_count, total_count
    from tutai.practice_attempts
    where student_id = ${studentId} and status = 'COMPLETED' and mode = 'LESSON'
    order by lesson_id, correct_count::float / total_count desc`;
  return Object.fromEntries(
    rows.map((row) => [
      row.lesson_id,
      {
        best: row.correct_count,
        total: row.total_count,
        passed: isPassingScore(row.correct_count, row.total_count),
      },
    ])
  );
}

export async function startPracticeAttempt(
  studentId: string,
  lessonId: string,
  mode: PracticeMode = 'LESSON',
  fromAttemptId?: string
): Promise<AttemptView> {
  const sql = requireDatabase();
  await requireVisibleLesson(lessonId);
  const available = await lessonQuestions(lessonId);
  let picked: Question[];
  if (mode === 'MISTAKES') {
    if (!fromAttemptId) throw new PracticeError(400, 'Thiếu lượt làm cần luyện lại.');
    const [source] = await sql<AttemptRow[]>`
      select * from tutai.practice_attempts
      where id = ${fromAttemptId} and student_id = ${studentId} and lesson_id = ${lessonId}`;
    if (!source || source.status !== 'COMPLETED') {
      throw new PracticeError(404, 'Không tìm thấy lượt làm đã hoàn thành.');
    }
    const wrong = new Set(
      (
        await sql<{ question_id: string }[]>`
          select question_id from tutai.practice_answers
          where attempt_id = ${fromAttemptId} and not is_correct`
      ).map((row) => row.question_id)
    );
    picked = orderPracticeQuestions(
      available.filter((q) => wrong.has(q.id) && isInLessonPractice(q, lessonId))
    );
    if (picked.length === 0) throw new PracticeError(409, 'Không còn câu sai nào để luyện lại.');
  } else {
    picked = pickLessonSession(available, lessonId);
    if (picked.length === 0) throw new PracticeError(409, 'Bài học này chưa có câu luyện tập.');
  }
  const id = `pa-${randomUUID()}`;
  const ids = picked.map((q) => q.id);
  const [row] = await sql<AttemptRow[]>`
    insert into tutai.practice_attempts (id, student_id, lesson_id, mode, question_ids, status, total_count)
    values (${id}, ${studentId}, ${lessonId}, ${mode}, ${sql.array(ids)}, 'IN_PROGRESS', ${ids.length})
    returning *`;
  return { attempt: summarize(row), questions: picked.map(toPracticeQuestion), feedback: {} };
}

async function ownedAttempt(sql: ReturnType<typeof getSql>, studentId: string, attemptId: string) {
  const [row] = await sql<AttemptRow[]>`
    select * from tutai.practice_attempts where id = ${attemptId} and student_id = ${studentId}`;
  if (!row) throw new PracticeError(404, 'Không tìm thấy lượt luyện tập.');
  return row;
}

async function attemptQuestions(ids: string[]): Promise<Map<string, Question>> {
  const found = await Promise.all(ids.map((id) => getQuestion(id)));
  return new Map(found.filter((q): q is Question => q !== null).map((q) => [q.id, q]));
}

/** The attempt with its questions and the feedback for every question already answered. */
export async function getPracticeAttempt(
  studentId: string,
  attemptId: string
): Promise<AttemptView> {
  const sql = requireDatabase();
  const row = await ownedAttempt(sql, studentId, attemptId);
  const answers = await sql<{ question_id: string; response: unknown; is_correct: boolean }[]>`
    select question_id, response, is_correct from tutai.practice_answers where attempt_id = ${attemptId}`;
  const questions = await attemptQuestions(row.question_ids);
  const feedback: Record<string, PracticeFeedback> = {};
  for (const answer of answers) {
    const question = questions.get(answer.question_id);
    if (!question) continue;
    const parsed = parsePracticeResponse(question, answer.response);
    feedback[answer.question_id] = toPracticeFeedback(
      question,
      parsed,
      gradePracticeResponse(question, parsed)
    );
  }
  return {
    attempt: summarize({ ...row, answered_count: answers.length }),
    questions: row.question_ids
      .map((id) => questions.get(id))
      .filter((q): q is Question => Boolean(q))
      .map(toPracticeQuestion),
    feedback,
  };
}

/**
 * Grades one answer and stores it. An answer is final: answering the same
 * question again returns the stored result. The attempt completes when its
 * last question is answered.
 */
export async function answerPracticeQuestion(
  studentId: string,
  attemptId: string,
  questionId: string,
  rawResponse: unknown
): Promise<{ feedback: PracticeFeedback; attempt: AttemptSummary }> {
  const sql = requireDatabase();
  const row = await ownedAttempt(sql, studentId, attemptId);
  if (!row.question_ids.includes(questionId)) {
    throw new PracticeError(404, 'Câu hỏi không thuộc lượt luyện tập này.');
  }
  const question = await getQuestion(questionId);
  if (!question) throw new PracticeError(410, 'Câu hỏi này đã bị gỡ.');

  const result = await sql.begin(async (tx) => {
    const [locked] = await tx<AttemptRow[]>`
      select * from tutai.practice_attempts where id = ${attemptId} for update`;
    const [stored] = await tx<{ response: unknown }[]>`
      select response from tutai.practice_answers
      where attempt_id = ${attemptId} and question_id = ${questionId}`;
    let response;
    if (stored) {
      response = parsePracticeResponse(question, stored.response);
    } else {
      if (locked.status !== 'IN_PROGRESS') {
        throw new PracticeError(409, 'Lượt luyện tập này đã kết thúc.');
      }
      response = parsePracticeResponse(question, rawResponse);
      const graded = gradePracticeResponse(question, response);
      await tx`
        insert into tutai.practice_answers (attempt_id, question_id, response, is_correct)
        values (${attemptId}, ${questionId}, ${tx.json(response as never)}, ${graded.correct})`;
    }
    const [{ answered, correct }] = await tx<{ answered: number; correct: number }[]>`
      select count(*)::int as answered, count(*) filter (where is_correct)::int as correct
      from tutai.practice_answers where attempt_id = ${attemptId}`;
    if (locked.status === 'IN_PROGRESS' && answered >= locked.total_count) {
      const [done] = await tx<AttemptRow[]>`
        update tutai.practice_attempts
        set status = 'COMPLETED', correct_count = ${correct}, completed_at = now()
        where id = ${attemptId} returning *`;
      return { response, attempt: { ...done, answered_count: answered } };
    }
    return { response, attempt: { ...locked, answered_count: answered } };
  });
  return {
    feedback: toPracticeFeedback(
      question,
      result.response,
      gradePracticeResponse(question, result.response)
    ),
    attempt: summarize(result.attempt),
  };
}
