import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { EXAM_TYPES } from '@/lib/content-import/types';
import { getQuestion } from '@/lib/question-bank/qb-storage';
import type { Question } from '@/lib/question-bank/qb-types';
import { GRADE_VALUES, SUBJECT_ID_VALUES } from '@/lib/question-bank/qb-types';
import { isSelectableQuestion } from '@/lib/exams/exam-selection';
import { listExams, saveExam } from '@/lib/exams/exam-storage';
import type { ExamDraftInput, ExamRecord } from '@/lib/exams/exam-types';

const MAX_EXAM_QUESTIONS = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAllowed<T extends readonly unknown[]>(values: T, value: unknown): value is T[number] {
  return values.includes(value);
}

async function selectableQuestions(questionIds: string[]): Promise<Question[] | null> {
  if (new Set(questionIds).size !== questionIds.length) return null;
  const questions = await Promise.all(questionIds.map((id) => getQuestion(id)));
  if (questions.some((question) => !question || !isSelectableQuestion(question))) return null;
  return questions as Question[];
}

export async function GET() {
  try {
    return NextResponse.json(await listExams());
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Không thể tải danh sách đề thi.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const parsed: unknown = await request.json();
    if (!isRecord(parsed)) {
      return NextResponse.json({ error: 'INVALID_REQUEST_BODY' }, { status: 400 });
    }
    const body = parsed as Partial<ExamDraftInput> & { title?: string };
    const rawName = body.name ?? body.title ?? '';
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    const hasValidQuestionIds =
      body.questionIds === undefined ||
      (Array.isArray(body.questionIds) && body.questionIds.length <= MAX_EXAM_QUESTIONS);
    const questionIds = Array.isArray(body.questionIds)
      ? body.questionIds.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
      : [];
    if (!name) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: [{ field: 'name', message: 'Tên đề là bắt buộc.' }] },
        { status: 422 }
      );
    }
    if (
      !hasValidQuestionIds ||
      (body.questionIds?.length ?? 0) !== questionIds.length ||
      !(await selectableQuestions(questionIds))
    ) {
      return NextResponse.json(
        {
          error: 'INVALID_QUESTION_SELECTION',
          message: 'Đề chỉ được dùng câu hỏi đã xuất bản và đủ điều kiện xuất bản.',
        },
        { status: 422 }
      );
    }
    if (
      (body.subjectId !== undefined && !isAllowed(SUBJECT_ID_VALUES, body.subjectId)) ||
      (body.grade !== undefined && !isAllowed(GRADE_VALUES, body.grade)) ||
      (body.examType !== undefined && !isAllowed(EXAM_TYPES, body.examType))
    ) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'Môn học, lớp hoặc loại đề không hợp lệ.' },
        { status: 422 }
      );
    }
    if (
      body.durationMinutes !== undefined &&
      (!Number.isInteger(body.durationMinutes) || body.durationMinutes <= 0)
    ) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          details: [{ field: 'durationMinutes', message: 'Thời gian phải là số nguyên dương.' }],
        },
        { status: 422 }
      );
    }

    const now = new Date().toISOString();
    const exam: ExamRecord = {
      id: randomUUID(),
      name,
      subjectId: body.subjectId,
      grade: body.grade,
      examType: body.examType,
      durationMinutes: body.durationMinutes,
      questionIds,
      sourceName: '',
      sourceUrl: '',
      rightsStatus: 'INTERNAL_CONTENT',
      importMethod: 'QUESTION_BANK',
      importStatus: 'COMPLETED',
      publishStatus: 'DRAFT',
      rawExamCode: typeof body.rawExamCode === 'string' ? body.rawExamCode.trim() : '',
      normalizedExamCode:
        typeof body.normalizedExamCode === 'string' ? body.normalizedExamCode.trim() : '',
      createdAt: now,
      updatedAt: now,
      createdBy: 'admin',
      updatedBy: 'admin',
    };
    await saveExam(exam);
    return NextResponse.json(exam, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Không thể tạo đề thi.' },
      { status: 500 }
    );
  }
}
