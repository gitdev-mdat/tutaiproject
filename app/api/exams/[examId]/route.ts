import { NextResponse } from 'next/server';
import { EXAM_TYPES } from '@/lib/content-import/types';
import { getQuestion } from '@/lib/question-bank/qb-storage';
import type { Question } from '@/lib/question-bank/qb-types';
import { GRADE_VALUES, SUBJECT_ID_VALUES } from '@/lib/question-bank/qb-types';
import { isSelectableQuestion } from '@/lib/exams/exam-selection';
import { deleteExam, getExam, publishExam, saveExam } from '@/lib/exams/exam-storage';
import type { ExamDraftInput, ExamRecord } from '@/lib/exams/exam-types';

const MAX_EXAM_QUESTIONS = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAllowed<T extends readonly unknown[]>(values: T, value: unknown): value is T[number] {
  return values.includes(value);
}

async function resolveQuestions(questionIds: readonly string[]): Promise<Array<Question | null>> {
  return Promise.all(questionIds.map((id) => getQuestion(id)));
}

function publicationIssues(exam: ExamRecord, questions: Array<Question | null>) {
  const issues: Array<{ field: string; message: string; questionId?: string }> = [];
  if (!exam.name.trim()) issues.push({ field: 'name', message: 'Tên đề là bắt buộc.' });
  if (!exam.subjectId) issues.push({ field: 'subjectId', message: 'Môn học là bắt buộc.' });
  if (!exam.grade) issues.push({ field: 'grade', message: 'Khối lớp là bắt buộc.' });
  if (!exam.durationMinutes || exam.durationMinutes <= 0) {
    issues.push({ field: 'durationMinutes', message: 'Thời gian làm bài phải lớn hơn 0.' });
  }
  if (exam.questionIds.length === 0) {
    issues.push({ field: 'questionIds', message: 'Đề phải có ít nhất một câu hỏi.' });
  }
  if (new Set(exam.questionIds).size !== exam.questionIds.length) {
    issues.push({ field: 'questionIds', message: 'Đề không được chứa câu hỏi trùng lặp.' });
  }
  questions.forEach((question, index) => {
    if (!question || !isSelectableQuestion(question)) {
      issues.push({
        field: 'questionIds',
        questionId: exam.questionIds[index],
        message: 'Câu hỏi không tồn tại, chưa xuất bản hoặc không còn đủ điều kiện xuất bản.',
      });
      return;
    }
    if (exam.subjectId && question.subjectId !== exam.subjectId) {
      issues.push({
        field: 'questionIds',
        questionId: question.id,
        message: 'Câu hỏi không cùng môn học với đề.',
      });
    }
    if (exam.grade && question.grade !== exam.grade) {
      issues.push({
        field: 'questionIds',
        questionId: question.id,
        message: 'Câu hỏi không cùng khối lớp với đề.',
      });
    }
  });
  return issues;
}

export async function GET(_request: Request, context: { params: Promise<{ examId: string }> }) {
  try {
    const { examId } = await context.params;
    const exam = await getExam(examId);
    if (!exam) return NextResponse.json({ error: 'EXAM_NOT_FOUND' }, { status: 404 });
    const questions =
      exam.publishedSnapshot?.questions ??
      (await resolveQuestions(exam.questionIds)).filter((question): question is Question =>
        Boolean(question)
      );
    return NextResponse.json({ exam, questions });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Không thể tải đề thi.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: { params: Promise<{ examId: string }> }) {
  try {
    const { examId } = await context.params;
    const existing = await getExam(examId);
    if (!existing) return NextResponse.json({ error: 'EXAM_NOT_FOUND' }, { status: 404 });
    const parsed: unknown = await request.json();
    if (!isRecord(parsed)) {
      return NextResponse.json({ error: 'INVALID_REQUEST_BODY' }, { status: 400 });
    }
    const body = parsed as Partial<ExamDraftInput> & { action?: 'PUBLISH' };

    if (body.action === 'PUBLISH') {
      if (existing.publishStatus === 'PUBLISHED' && existing.publishedSnapshot) {
        return NextResponse.json(existing);
      }
      const questions = await resolveQuestions(existing.questionIds);
      const issues = publicationIssues(existing, questions);
      if (issues.length > 0) {
        return NextResponse.json(
          { error: 'EXAM_NOT_PUBLISHABLE', details: issues },
          { status: 422 }
        );
      }
      return NextResponse.json(await publishExam(examId, questions as Question[]));
    }
    if (existing.publishStatus === 'PUBLISHED') {
      return NextResponse.json({ error: 'PUBLISHED_EXAM_IMMUTABLE' }, { status: 409 });
    }

    const questionIds = body.questionIds ?? existing.questionIds;
    if (
      !Array.isArray(questionIds) ||
      questionIds.length > MAX_EXAM_QUESTIONS ||
      questionIds.some((id) => typeof id !== 'string' || !id.trim()) ||
      new Set(questionIds).size !== questionIds.length
    ) {
      return NextResponse.json({ error: 'INVALID_QUESTION_IDS' }, { status: 422 });
    }
    const questions = await resolveQuestions(questionIds);
    if (questions.some((question) => !question || !isSelectableQuestion(question))) {
      return NextResponse.json(
        {
          error: 'INVALID_QUESTION_SELECTION',
          message: 'Đề chỉ được dùng câu hỏi đã xuất bản và đủ điều kiện xuất bản.',
        },
        { status: 422 }
      );
    }
    const name =
      body.name === undefined
        ? existing.name
        : typeof body.name === 'string'
          ? body.name.trim()
          : '';
    if (!name) return NextResponse.json({ error: 'EXAM_NAME_REQUIRED' }, { status: 422 });
    if (
      (body.subjectId !== undefined && !isAllowed(SUBJECT_ID_VALUES, body.subjectId)) ||
      (body.grade !== undefined && !isAllowed(GRADE_VALUES, body.grade)) ||
      (body.examType !== undefined && !isAllowed(EXAM_TYPES, body.examType))
    ) {
      return NextResponse.json({ error: 'INVALID_EXAM_METADATA' }, { status: 422 });
    }
    if (
      body.durationMinutes !== undefined &&
      (!Number.isInteger(body.durationMinutes) || body.durationMinutes <= 0)
    ) {
      return NextResponse.json({ error: 'INVALID_DURATION' }, { status: 422 });
    }

    const updated: ExamRecord = {
      ...existing,
      name,
      subjectId: body.subjectId ?? existing.subjectId,
      grade: body.grade ?? existing.grade,
      examType: body.examType ?? existing.examType,
      durationMinutes: body.durationMinutes ?? existing.durationMinutes,
      rawExamCode:
        body.rawExamCode === undefined
          ? existing.rawExamCode
          : typeof body.rawExamCode === 'string'
            ? body.rawExamCode.trim()
            : existing.rawExamCode,
      normalizedExamCode:
        body.normalizedExamCode === undefined
          ? existing.normalizedExamCode
          : typeof body.normalizedExamCode === 'string'
            ? body.normalizedExamCode.trim()
            : existing.normalizedExamCode,
      questionIds,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin',
    };
    return NextResponse.json(await saveExam(updated));
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Không thể cập nhật đề thi.';
    const status = message === 'PUBLISHED_EXAM_IMMUTABLE' ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ examId: string }> }) {
  try {
    const { examId } = await context.params;
    const deleted = await deleteExam(examId);
    if (!deleted) return NextResponse.json({ error: 'EXAM_NOT_FOUND' }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Không thể xóa đề thi.';
    return NextResponse.json(
      { error: message },
      { status: message === 'PUBLISHED_EXAM_IMMUTABLE' ? 409 : 500 }
    );
  }
}
