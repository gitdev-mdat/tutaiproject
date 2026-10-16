import 'server-only';

import { randomUUID } from 'node:crypto';
import { getSql } from '@/lib/db/postgres';
import { getPremiumAccess } from '@/lib/access/premium-access';
import {
  parsePracticeResponse,
  gradePracticeResponse,
  toPracticeFeedback,
  toPracticeQuestion,
  type PracticeFeedback,
  type PracticeQuestion,
  type PracticeResponse,
} from '@/lib/practice/grading';
import { PracticeError } from '@/lib/practice/practice-service';
import type { Question } from '@/lib/question-bank/qb-types';
import { examAccessTier } from './exam-access';
import { getExam, listExams } from './exam-storage';
import type { ExamAccessTier, ExamRecord } from './exam-types';
import {
  examDuration,
  examFacts,
  examName,
  examQuestions,
  examScope,
  gradeExam,
  isExamTakeable,
  isPastDeadline,
  scoreOutOfTen,
  type ExamFacts,
  type ExamQuestionResult,
  type ExamScope,
} from './student-exam-rules';

/**
 * Exams for students: the published exams Admin manages, taken under a server
 * clock, saved as the student answers and graded on submit. Plus exams are
 * visible to everyone; starting one, and reading its questions while it runs,
 * needs Tú Tài Plus, checked here on every request.
 */

export const EXAM_PLUS_REQUIRED = 'Đề này dành cho tài khoản Tú Tài Plus.';

type AttemptRow = {
  id: string;
  student_id: string;
  exam_id: string;
  exam_published_at: Date;
  status: 'IN_PROGRESS' | 'SUBMITTED';
  responses: Record<string, unknown>;
  results: ExamQuestionResult[] | null;
  correct_count: number | null;
  total_count: number;
  duration_minutes: number;
  started_at: Date;
  deadline_at: Date;
  submitted_at: Date | null;
  auto_submitted: boolean;
};

export type ExamAttemptSummary = {
  id: string;
  status: 'IN_PROGRESS' | 'SUBMITTED';
  answered: number;
  total: number;
  correct: number | null;
  score: number | null;
  startedAt: string;
  deadlineAt: string;
  submittedAt: string | null;
  autoSubmitted: boolean;
};

export type ExamCard = {
  id: string;
  name: string;
  scope: ExamScope;
  accessTier: ExamAccessTier;
  curatorNote: string | null;
  sourceName: string | null;
  publishedAt: string | null;
  facts: ExamFacts;
  locked: boolean;
  inProgress: ExamAttemptSummary | null;
  lastSubmitted: ExamAttemptSummary | null;
  best: ExamAttemptSummary | null;
  submittedCount: number;
};

function requireDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new PracticeError(503, 'Luyện thi cần kết nối cơ sở dữ liệu.');
  }
  return getSql();
}

function answeredCount(responses: Record<string, unknown> | null | undefined) {
  return Object.values(responses ?? {}).filter((value) => value !== null && value !== undefined)
    .length;
}

function summarize(row: AttemptRow): ExamAttemptSummary {
  return {
    id: row.id,
    status: row.status,
    answered: answeredCount(row.responses),
    total: row.total_count,
    correct: row.correct_count,
    score: row.correct_count === null ? null : scoreOutOfTen(row.correct_count, row.total_count),
    startedAt: row.started_at.toISOString(),
    deadlineAt: row.deadline_at.toISOString(),
    submittedAt: row.submitted_at?.toISOString() ?? null,
    autoSubmitted: row.auto_submitted,
  };
}

/** Grades and closes an attempt; safe to call twice (the second call changes nothing). */
async function finalize(
  sql: ReturnType<typeof getSql>,
  row: AttemptRow,
  exam: ExamRecord | null,
  auto: boolean
): Promise<AttemptRow> {
  const questions = exam ? examQuestions(exam) : [];
  const { results, correct } = gradeExam(questions, row.responses ?? {});
  const [done] = await sql<AttemptRow[]>`
    update tutai.exam_attempts
    set status = 'SUBMITTED', results = ${sql.json(results as never)}, correct_count = ${correct},
      submitted_at = ${auto ? row.deadline_at : new Date()}, auto_submitted = ${auto}
    where id = ${row.id} and status = 'IN_PROGRESS'
    returning *`;
  if (done) return done;
  const [current] = await sql<AttemptRow[]>`select * from tutai.exam_attempts where id = ${row.id}`;
  return current;
}

/** Closes attempts whose time ran out, so every list shows the real state. */
async function closeExpired(
  sql: ReturnType<typeof getSql>,
  rows: AttemptRow[],
  exams: Map<string, ExamRecord>
): Promise<AttemptRow[]> {
  return Promise.all(
    rows.map((row) =>
      row.status === 'IN_PROGRESS' && isPastDeadline(row.deadline_at)
        ? finalize(sql, row, exams.get(row.exam_id) ?? null, true)
        : row
    )
  );
}

function cardState(rows: AttemptRow[]) {
  const summaries = rows.map(summarize);
  const submitted = summaries.filter((s) => s.status === 'SUBMITTED');
  const best = submitted.reduce<ExamAttemptSummary | null>(
    (top, s) => (!top || (s.correct ?? 0) / s.total > (top.correct ?? 0) / top.total ? s : top),
    null
  );
  return {
    inProgress: summaries.find((s) => s.status === 'IN_PROGRESS') ?? null,
    lastSubmitted: submitted[0] ?? null,
    best,
    submittedCount: submitted.length,
  };
}

function toCard(exam: ExamRecord, rows: AttemptRow[], hasPlus: boolean): ExamCard {
  const accessTier = examAccessTier(exam);
  return {
    id: exam.id,
    name: examName(exam),
    scope: examScope(exam.publishedSnapshot?.metadata.examType ?? exam.examType),
    accessTier,
    curatorNote: accessTier === 'PLUS' ? (exam.curatorNote ?? null) : null,
    sourceName: exam.sourceName?.trim() || null,
    publishedAt: exam.publishedAt ?? null,
    facts: examFacts(exam),
    locked: accessTier === 'PLUS' && !hasPlus,
    ...cardState(rows),
  };
}

async function studentRows(studentId: string, examIds?: string[]): Promise<AttemptRow[]> {
  if (!process.env.DATABASE_URL) return [];
  const sql = getSql();
  if (examIds && !examIds.length) return [];
  return examIds
    ? sql<AttemptRow[]>`
        select * from tutai.exam_attempts
        where student_id = ${studentId} and exam_id in ${sql(examIds)}
        order by started_at desc`
    : sql<AttemptRow[]>`
        select * from tutai.exam_attempts where student_id = ${studentId}
        order by started_at desc`;
}

export type StudentExamCatalog = {
  /** Plus exams are open: through a Plus membership or an admin's preview. */
  hasPlus: boolean;
  /** Open only because the account is an admin previewing, not a member. */
  previewAsAdmin: boolean;
  exams: ExamCard[];
  /**
   * For an admin only: exams that exist but students cannot open, so an empty
   * page is not mistaken for missing access. Null for everyone else.
   */
  hiddenFromStudents: { drafts: number; notTakeable: number } | null;
};

/** Every exam a student can take, newest first, with their own attempts. */
export async function listStudentExams(studentId: string): Promise<StudentExamCatalog> {
  const [all, access] = await Promise.all([listExams(), getPremiumAccess(studentId)]);
  const hasPlus = access.allowed;
  const exams = all
    .filter(isExamTakeable)
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
  const byId = new Map(exams.map((exam) => [exam.id, exam]));
  let rows = await studentRows(
    studentId,
    exams.map((exam) => exam.id)
  );
  if (rows.some((row) => row.status === 'IN_PROGRESS' && isPastDeadline(row.deadline_at))) {
    rows = await closeExpired(getSql(), rows, byId);
  }
  const previewAsAdmin = access.via === 'ADMIN_PREVIEW';
  return {
    hasPlus,
    previewAsAdmin,
    hiddenFromStudents: previewAsAdmin
      ? {
          drafts: all.filter((exam) => exam.publishStatus !== 'PUBLISHED').length,
          notTakeable: all.filter(
            (exam) => exam.publishStatus === 'PUBLISHED' && !isExamTakeable(exam)
          ).length,
        }
      : null,
    exams: exams.map((exam) =>
      toCard(
        exam,
        rows.filter((row) => row.exam_id === exam.id),
        hasPlus
      )
    ),
  };
}

export type StudentExamDetail = {
  exam: ExamCard;
  hasPlus: boolean;
  previewAsAdmin: boolean;
  history: ExamAttemptSummary[];
};

/** One exam's page: structure, access and the student's past attempts. */
export async function getStudentExam(
  studentId: string,
  examId: string
): Promise<StudentExamDetail | null> {
  const exam = await getExam(examId);
  if (!exam || !isExamTakeable(exam)) return null;
  const access = await getPremiumAccess(studentId);
  const hasPlus = access.allowed;
  let rows = await studentRows(studentId, [examId]);
  if (rows.some((row) => row.status === 'IN_PROGRESS' && isPastDeadline(row.deadline_at))) {
    rows = await closeExpired(getSql(), rows, new Map([[exam.id, exam]]));
  }
  return {
    exam: toCard(exam, rows, hasPlus),
    hasPlus,
    previewAsAdmin: examAccessTier(exam) === 'PLUS' && access.via === 'ADMIN_PREVIEW',
    history: rows.map(summarize),
  };
}

async function requireTakeableExam(examId: string): Promise<ExamRecord> {
  const exam = await getExam(examId);
  if (!exam || !isExamTakeable(exam)) throw new PracticeError(404, 'Không tìm thấy đề thi.');
  return exam;
}

async function requireAccess(studentId: string, exam: ExamRecord) {
  if (examAccessTier(exam) === 'PLUS' && !(await getPremiumAccess(studentId)).allowed) {
    throw new PracticeError(403, EXAM_PLUS_REQUIRED);
  }
}

/** Starts the exam, or returns the attempt already running (one open attempt per exam). */
export async function startExamAttempt(studentId: string, examId: string): Promise<{ id: string }> {
  const sql = requireDatabase();
  const exam = await requireTakeableExam(examId);
  await requireAccess(studentId, exam);
  const [open] = await sql<AttemptRow[]>`
    select * from tutai.exam_attempts
    where student_id = ${studentId} and exam_id = ${examId} and status = 'IN_PROGRESS'`;
  if (open) {
    if (!isPastDeadline(open.deadline_at)) return { id: open.id };
    await finalize(sql, open, exam, true);
  }
  const duration = examDuration(exam);
  const questions = examQuestions(exam);
  const id = `ea-${randomUUID()}`;
  const [row] = await sql<AttemptRow[]>`
    insert into tutai.exam_attempts
      (id, student_id, exam_id, exam_published_at, status, total_count, duration_minutes, deadline_at)
    values (${id}, ${studentId}, ${examId}, ${exam.publishedAt ?? exam.publishedSnapshot!.publishedAt},
      'IN_PROGRESS', ${questions.length}, ${duration}, now() + make_interval(mins => ${duration}))
    on conflict (student_id, exam_id) where status = 'IN_PROGRESS' do nothing
    returning *`;
  if (row) return { id: row.id };
  // Another tab started it at the same moment: resume that one.
  const [raced] = await sql<AttemptRow[]>`
    select id from tutai.exam_attempts
    where student_id = ${studentId} and exam_id = ${examId} and status = 'IN_PROGRESS'`;
  return { id: raced.id };
}

async function ownedAttempt(sql: ReturnType<typeof getSql>, studentId: string, attemptId: string) {
  const [row] = await sql<AttemptRow[]>`
    select * from tutai.exam_attempts where id = ${attemptId} and student_id = ${studentId}`;
  if (!row) throw new PracticeError(404, 'Không tìm thấy bài làm.');
  return row;
}

export type ExamAttemptView = {
  exam: { id: string; name: string; scope: ExamScope; accessTier: ExamAccessTier };
  attempt: ExamAttemptSummary;
  /** Server time when this view was made, so the client clock can be corrected. */
  serverNow: string;
  questions: PracticeQuestion[];
  /** While running: the saved responses. After submit: also every question's result. */
  responses: Record<string, unknown>;
  review: Record<string, PracticeFeedback & { answered: boolean }> | null;
};

function attemptQuestions(exam: ExamRecord | null): Question[] {
  return exam ? examQuestions(exam) : [];
}

function view(exam: ExamRecord | null, row: AttemptRow): ExamAttemptView {
  const questions = attemptQuestions(exam);
  const submitted = row.status === 'SUBMITTED';
  let review: ExamAttemptView['review'] = null;
  if (submitted) {
    review = {};
    for (const question of questions) {
      const raw = row.responses?.[question.id];
      let response: PracticeResponse | null = null;
      if (raw !== undefined && raw !== null) {
        try {
          response = parsePracticeResponse(question, raw);
        } catch {
          response = null;
        }
      }
      const answered = response !== null;
      const feedback = toPracticeFeedback(
        question,
        response,
        response ? gradePracticeResponse(question, response) : { correct: false }
      );
      review[question.id] = { ...feedback, answered };
    }
  }
  return {
    exam: {
      id: row.exam_id,
      name: exam ? examName(exam) : 'Đề thi',
      scope: examScope(exam?.publishedSnapshot?.metadata.examType ?? exam?.examType),
      accessTier: exam ? examAccessTier(exam) : 'FREE',
    },
    attempt: summarize(row),
    serverNow: new Date().toISOString(),
    questions: questions.map(toPracticeQuestion),
    responses: row.responses ?? {},
    review,
  };
}

/**
 * The attempt for its owner. A running attempt of a Plus exam needs Plus.
 * A submitted attempt is the student's own result and stays readable.
 */
export async function getExamAttempt(
  studentId: string,
  attemptId: string
): Promise<ExamAttemptView> {
  const sql = requireDatabase();
  let row = await ownedAttempt(sql, studentId, attemptId);
  const exam = await getExam(row.exam_id);
  if (row.status === 'IN_PROGRESS') {
    if (isPastDeadline(row.deadline_at)) row = await finalize(sql, row, exam, true);
    else if (exam) await requireAccess(studentId, exam);
  }
  return view(exam, row);
}

async function runningAttempt(studentId: string, attemptId: string) {
  const sql = requireDatabase();
  const row = await ownedAttempt(sql, studentId, attemptId);
  const exam = await getExam(row.exam_id);
  if (!exam) throw new PracticeError(410, 'Đề thi này đã bị gỡ.');
  if (row.status !== 'IN_PROGRESS') throw new PracticeError(409, 'Bài làm này đã được nộp.');
  if (isPastDeadline(row.deadline_at)) {
    await finalize(sql, row, exam, true);
    throw new PracticeError(409, 'Đã hết giờ, bài làm đã được nộp tự động.');
  }
  await requireAccess(studentId, exam);
  return { sql, row, exam };
}

/** Saves (or clears, with null) one response. Nothing is graded or revealed before submit. */
export async function saveExamResponse(
  studentId: string,
  attemptId: string,
  questionId: string,
  rawResponse: unknown
): Promise<{ answered: number; total: number }> {
  const { sql, row, exam } = await runningAttempt(studentId, attemptId);
  const question = examQuestions(exam).find((q) => q.id === questionId);
  if (!question) throw new PracticeError(404, 'Câu hỏi không thuộc đề này.');
  const response = rawResponse === null ? null : parsePracticeResponse(question, rawResponse);
  const [updated] =
    response === null
      ? await sql<AttemptRow[]>`
          update tutai.exam_attempts set responses = responses - ${questionId}
          where id = ${row.id} and status = 'IN_PROGRESS'
          returning *`
      : await sql<AttemptRow[]>`
          update tutai.exam_attempts
          set responses = responses || jsonb_build_object(${questionId}::text, ${sql.json(response as never)}::jsonb)
          where id = ${row.id} and status = 'IN_PROGRESS'
          returning *`;
  if (!updated) throw new PracticeError(409, 'Bài làm này đã được nộp.');
  return { answered: answeredCount(updated.responses), total: updated.total_count };
}

export async function submitExamAttempt(
  studentId: string,
  attemptId: string
): Promise<ExamAttemptView> {
  const sql = requireDatabase();
  const row = await ownedAttempt(sql, studentId, attemptId);
  const exam = await getExam(row.exam_id);
  if (row.status === 'SUBMITTED') return view(exam, row);
  if (exam && !isPastDeadline(row.deadline_at)) await requireAccess(studentId, exam);
  // The clock reaching zero submits the attempt; that counts as an automatic submit.
  const done = await finalize(sql, row, exam, Date.now() >= row.deadline_at.getTime());
  return view(exam, done);
}
