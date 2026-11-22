import { describe, expect, it } from 'vitest';
import type { LessonEntry } from './practice-catalog';
import {
  attemptStatus,
  lessonAction,
  lessonStatus,
  nextLessonId,
  passMark,
  passedCount,
} from './catalog-status';

const lesson = (over: Partial<LessonEntry> = {}): LessonEntry => ({
  id: 'l1',
  title: 'Tính đơn điệu của hàm số',
  description: '',
  questionCount: 10,
  mix: { FOUNDATIONAL: 0, INTERMEDIATE: 0, ADVANCED: 0 } as LessonEntry['mix'],
  inProgress: null,
  best: null,
  lastCompleted: null,
  completedCount: 0,
  ...over,
});

const done = (correct: number, total: number, mode: 'LESSON' | 'MISTAKES' = 'LESSON') => ({
  attemptId: `a-${mode}-${correct}`,
  correct,
  total,
  passed: correct / total >= 0.8,
  mode,
});

describe('passMark', () => {
  it('is the smallest passing score', () => {
    expect(passMark(10)).toBe(8);
    expect(passMark(5)).toBe(4);
    expect(passMark(4)).toBe(4);
    expect(passMark(6)).toBe(5);
    expect(passMark(1)).toBe(1);
  });
});

describe('lessonStatus', () => {
  it('shows the question count before any session', () => {
    expect(lessonStatus(lesson())).toEqual({ tone: 'idle', text: '10 câu' });
  });

  it('counts answered questions of the open session, like the resume strip', () => {
    const status = lessonStatus(lesson({ inProgress: { attemptId: 'a', answered: 3, total: 10 } }));
    expect(status).toEqual({ tone: 'active', text: 'Đang làm · 3/10 câu' });
  });

  it('says what score passes when the best is below it', () => {
    expect(lessonStatus(lesson({ best: { correct: 2, total: 10, passed: false } }))).toEqual({
      tone: 'attention',
      text: 'Cao nhất 2/10 · cần 8 để đạt',
    });
  });

  it('shows the passing score', () => {
    expect(lessonStatus(lesson({ best: { correct: 9, total: 10, passed: true } })).text).toBe(
      'Đạt · 9/10'
    );
  });

  it('says when a lesson has no questions', () => {
    expect(lessonStatus(lesson({ questionCount: 0 }))).toEqual({
      tone: 'empty',
      text: 'Chưa có câu hỏi',
    });
  });

  it('keeps a stored result when the questions were taken down later', () => {
    const status = lessonStatus(
      lesson({ questionCount: 0, best: { correct: 6, total: 10, passed: false } })
    );
    expect(status.tone).toBe('attention');
  });
});

describe('lessonAction', () => {
  it('starts a first session', () => {
    expect(lessonAction(lesson())).toEqual({ kind: 'start' });
  });

  it('resumes an open session before anything else', () => {
    expect(
      lessonAction(
        lesson({
          inProgress: { attemptId: 'open', answered: 3, total: 10 },
          best: { correct: 2, total: 10, passed: false },
          lastCompleted: done(2, 10),
        })
      )
    ).toEqual({ kind: 'resume', attemptId: 'open' });
  });

  it('offers the missed questions of a whole session', () => {
    expect(
      lessonAction(
        lesson({ best: { correct: 6, total: 10, passed: false }, lastCompleted: done(6, 10) })
      )
    ).toMatchObject({ kind: 'mistakes', count: 4, label: 'Xem 4 câu sai' });
  });

  // The owner's screenshot: best 2/10, then a retry of the 8 missed with 2 right.
  it('counts what is still wrong after a retry of missed questions', () => {
    expect(
      lessonAction(
        lesson({
          best: { correct: 2, total: 10, passed: false },
          lastCompleted: done(2, 8, 'MISTAKES'),
        })
      )
    ).toMatchObject({ kind: 'mistakes', count: 6, label: 'Xem 6 câu còn sai' });
  });

  // Regression: 7/8 on a retry is ≥ 80 %, but the lesson is not passed and 1 is still wrong.
  it('still offers missed questions when the retry itself scored high', () => {
    expect(
      lessonAction(
        lesson({
          best: { correct: 2, total: 10, passed: false },
          lastCompleted: done(7, 8, 'MISTAKES'),
        })
      )
    ).toMatchObject({ kind: 'mistakes', count: 1, label: 'Xem 1 câu còn sai' });
  });

  it('offers a whole new session once every missed question is right', () => {
    expect(
      lessonAction(
        lesson({
          best: { correct: 2, total: 10, passed: false },
          lastCompleted: done(8, 8, 'MISTAKES'),
        })
      )
    ).toEqual({ kind: 'retry' });
  });

  it('does not push missed questions on a passed lesson', () => {
    expect(
      lessonAction(
        lesson({ best: { correct: 9, total: 10, passed: true }, lastCompleted: done(5, 10) })
      )
    ).toEqual({ kind: 'retry' });
  });

  it('sends a lesson without questions to the lesson itself', () => {
    expect(lessonAction(lesson({ questionCount: 0 }))).toEqual({ kind: 'read' });
  });
});

describe('attemptStatus for chapter sets', () => {
  it('uses the set size before a session', () => {
    expect(
      attemptStatus({ inProgress: null, best: null, lastCompleted: null, completedCount: 0 }, 6)
        .text
    ).toBe('6 câu');
  });
});

describe('page summary', () => {
  const lessons = [
    lesson({ id: 'a', best: { correct: 9, total: 10, passed: true } }),
    lesson({ id: 'b', best: { correct: 2, total: 10, passed: false } }),
    lesson({ id: 'c' }),
    lesson({ id: 'd', questionCount: 0 }),
  ];

  it('counts passed lessons among those with practice', () => {
    expect(passedCount(lessons)).toEqual({ passed: 1, total: 3 });
  });

  it('picks the first lesson with practice that is not passed', () => {
    expect(nextLessonId(lessons)).toBe('b');
    expect(nextLessonId([lessons[0], lessons[3]])).toBeNull();
  });
});
