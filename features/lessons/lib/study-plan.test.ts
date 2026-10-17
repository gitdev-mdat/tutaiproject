import { describe, expect, it } from 'vitest';
import type { LearningLesson, LearningSubject } from '@/lib/knowledge-tree/learning-visibility';
import type { LessonProgressState } from './lesson-progress';
import {
  lessonStanding,
  pickNextStep,
  planProgress,
  roadmapScope,
  scopeLessonsFor,
  standingLabel,
  learningPrograms,
  lessonSummaryHref,
  practiceHref,
  practiceOrigin,
  programFor,
  programHref,
  selectProgram,
  startingPointFor,
  latestResultSentence,
  CHECK_FIRST_FROM_SCORE,
  type Summaries,
} from './study-plan';

const lesson = (id: string, chapterId = 'c1'): LearningLesson => ({
  id,
  title: `Bài ${id}`,
  description: '',
  chapterId,
  chapterTitle: `Chương ${chapterId}`,
});
const lessons = [lesson('a'), lesson('b'), lesson('c', 'c2')];

const progress = (
  stages: Record<string, { reached: number; total: number; done?: boolean }>,
  lastLessonId: string | null = null
): LessonProgressState => ({
  version: 1,
  viewed: Object.fromEntries(Object.keys(stages).map((id) => [id, '2026-10-01T00:00:00Z'])),
  lastLessonId,
  stages: Object.fromEntries(
    Object.entries(stages).map(([id, s]) => [
      id,
      { reached: s.reached, total: s.total, completedAt: s.done ? '2026-10-01T00:00:00Z' : null },
    ])
  ),
});
const fresh = progress({});
const practice = (
  questionCount: number,
  best?: { correctCount: number; totalCount: number; passed: boolean },
  inProgress?: { id: string; answeredCount: number; totalCount: number }
) => ({ questionCount, best: best ?? null, inProgress: inProgress ?? null });
const withQuestions: Summaries = {
  a: practice(6),
  b: practice(6),
  c: practice(6),
};

describe('pickNextStep', () => {
  it('starts a new student at the first lesson in curriculum order', () => {
    const step = pickNextStep(lessons, fresh, withQuestions);
    expect(step).toMatchObject({ kind: 'start', lesson: { id: 'a' }, cta: 'Bắt đầu học' });
  });

  it('resumes a lesson left midway, where it stopped', () => {
    const step = pickNextStep(
      lessons,
      progress({ b: { reached: 2, total: 6 } }, 'b'),
      withQuestions
    );
    expect(step).toMatchObject({ kind: 'resume-lesson', lesson: { id: 'b' } });
    expect(step?.reason).toContain('phần 3/6');
  });

  it('asks for practice once a lesson is read, without counting reading as completion', () => {
    const read = progress({ a: { reached: 5, total: 6, done: true } }, 'a');
    expect(pickNextStep(lessons, read, withQuestions)).toMatchObject({
      kind: 'practice',
      lesson: { id: 'a' },
    });
    expect(lessonStanding('a', read, withQuestions).completed).toBe(false);
    expect(planProgress(lessons, read, withQuestions)).toEqual({ completed: 0, total: 3 });
  });

  it('recommends retrying a failed practice, with the persisted best score', () => {
    const summaries = {
      ...withQuestions,
      a: practice(6, { correctCount: 2, totalCount: 6, passed: false }),
    };
    const step = pickNextStep(
      lessons,
      progress({ a: { reached: 5, total: 6, done: true } }),
      summaries
    );
    expect(step).toMatchObject({ kind: 'retry', lesson: { id: 'a' }, cta: 'Luyện tập lại' });
    expect(step?.reason).toContain('2/6');
  });

  it('finishes an open practice session before anything else', () => {
    const summaries = {
      ...withQuestions,
      c: practice(6, undefined, { id: 'att-1', answeredCount: 2, totalCount: 6 }),
    };
    const step = pickNextStep(lessons, progress({ b: { reached: 1, total: 6 } }, 'b'), summaries);
    expect(step).toMatchObject({ kind: 'resume-practice', lesson: { id: 'c' } });
    expect(step?.href).toBe('/student/lessons/c/practice?attempt=att-1');
  });

  it('moves on after a pass, and counts a lesson studied out of order', () => {
    const summaries = {
      ...withQuestions,
      c: practice(6, { correctCount: 6, totalCount: 6, passed: true }),
    };
    const read = progress({ c: { reached: 5, total: 6, done: true } }, 'c');
    expect(pickNextStep(lessons, read, summaries)).toMatchObject({
      kind: 'start',
      lesson: { id: 'a' },
    });
    expect(planProgress(lessons, read, summaries)).toEqual({ completed: 1, total: 3 });
  });

  it('does not hold the student on an optional retry of a lesson already passed', () => {
    const step = pickNextStep(lessons, progress({ a: { reached: 6, total: 6, done: true } }, 'a'), {
      ...withQuestions,
      a: practice(
        6,
        { correctCount: 6, totalCount: 6, passed: true },
        {
          id: 't2',
          answeredCount: 1,
          totalCount: 6,
        }
      ),
    });
    expect(step).toMatchObject({ kind: 'start', lesson: { id: 'b' } });
  });

  it('completes a lesson without practice questions when it is read to the end', () => {
    const summaries = { ...withQuestions, a: practice(0) };
    const read = progress({ a: { reached: 3, total: 4, done: true } });
    expect(lessonStanding('a', read, summaries).completed).toBe(true);
    expect(standingLabel(lessonStanding('a', read, summaries)).text).toBe(
      'Hoàn thành · đã học hết bài'
    );
    expect(pickNextStep(lessons, read, summaries)?.lesson.id).toBe('b');
  });

  it('leaves out the lesson the student is on, and returns null when all is completed', () => {
    const passed = { correctCount: 5, totalCount: 6, passed: true };
    const summaries = { a: practice(6, passed), b: practice(6, passed), c: practice(6) };
    expect(pickNextStep(lessons, fresh, summaries, { exclude: 'c' })).toBeNull();
    expect(pickNextStep(lessons, fresh, summaries)?.lesson.id).toBe('c');
  });

  it('suggests reading a lesson whose practice failed before it was read', () => {
    const summaries = {
      ...withQuestions,
      a: practice(6, { correctCount: 1, totalCount: 6, passed: false }),
    };
    const step = pickNextStep(lessons, fresh, summaries);
    expect(step).toMatchObject({ kind: 'start', lesson: { id: 'a' } });
    expect(step?.reason).toContain('chưa đạt');
  });
});

describe('labels and helpers', () => {
  it('describes each state factually', () => {
    const cases: [Summaries[string] | undefined, LessonProgressState, string][] = [
      [practice(6), fresh, 'Chưa học'],
      [practice(6), progress({ a: { reached: 1, total: 6 } }), 'Đang học · phần 2/6'],
      [
        practice(6),
        progress({ a: { reached: 5, total: 6, done: true } }),
        'Đã học · chưa luyện tập',
      ],
      [
        practice(6, { correctCount: 3, totalCount: 6, passed: false }),
        progress({ a: { reached: 5, total: 6, done: true } }),
        'Đã học · luyện tập 3/6, chưa đạt',
      ],
      [
        practice(6, { correctCount: 6, totalCount: 6, passed: true }),
        fresh,
        'Hoàn thành · luyện tập đạt 6/6',
      ],
    ];
    for (const [summary, state, text] of cases) {
      const summaries: Summaries = summary ? { a: summary } : {};
      expect(standingLabel(lessonStanding('a', state, summaries)).text).toBe(text);
    }
  });

  it('links practice with where it was opened from, and nothing else', () => {
    expect(practiceHref('a')).toBe('/student/lessons/a/practice');
    expect(practiceHref('a', 'pa-1')).toBe('/student/lessons/a/practice?attempt=pa-1');
    expect(practiceHref('a', 'pa-1', 'lesson')).toBe(
      '/student/lessons/a/practice?attempt=pa-1&from=lesson'
    );
    expect(practiceHref('a', undefined, 'lesson')).toBe('/student/lessons/a/practice?from=lesson');
    expect(lessonSummaryHref('a')).toBe('/student/lessons/a#tong-ket');
    for (const value of [undefined, '', 'roadmap', 'https://evil.example', '//evil', ['lesson']])
      expect(practiceOrigin(value)).toBe('roadmap');
    expect(practiceOrigin('lesson')).toBe('lesson');
    expect(practiceOrigin('practice')).toBe('practice');
    expect(practiceHref('a', undefined, 'practice')).toBe(
      '/student/lessons/a/practice?from=practice'
    );
  });
});

describe('roadmapScope', () => {
  const subject = (
    id: string,
    title: string,
    grades: LearningSubject['grades']
  ): LearningSubject => ({
    id,
    title,
    grades,
    lessonCount: grades.reduce(
      (n, g) => n + g.chapters.reduce((m, c) => m + c.lessons.length, 0),
      0
    ),
  });
  const catalog: LearningSubject[] = [
    subject('subj_phys', 'Vật lí', [
      {
        id: 'g',
        title: 'Lớp 12',
        chapters: [{ id: 'p1', title: 'Dao động', lessons: [lesson('p', 'p1')] }],
      },
    ]),
    subject('subj_math', 'Toán học', [
      {
        id: 'grade_11',
        title: 'Lớp 11',
        chapters: [{ id: 'm11', title: 'Dãy số', lessons: [lesson('d', 'm11')] }],
      },
      {
        id: 'grade_12',
        title: 'Lớp 12',
        chapters: [{ id: 'm12', title: 'Đạo hàm', lessons: [lesson('a', 'm12')] }],
      },
    ]),
  ];

  it('opens on the published Mathematics grade 12 curriculum by default', () => {
    const scope = roadmapScope(catalog);
    expect(scope?.lessons.map((l) => l.id)).toEqual(['a']);
    expect(scope?.subjectId).toBe('subj_math');
  });

  it('chooses the next step for every lesson within its own program', () => {
    expect(scopeLessonsFor(catalog, 'a').map((l) => l.id)).toEqual(['a']);
    expect(scopeLessonsFor(catalog, 'p').map((l) => l.id)).toEqual(['p']);
    expect(scopeLessonsFor(catalog, 'd').map((l) => l.id)).toEqual(['d']);
  });

  it('lists one program per subject and grade, so every published lesson is on the Roadmap', () => {
    const programs = learningPrograms(catalog);
    expect(programs.map((p) => [p.id, p.title])).toEqual([
      ['subj_phys:g', 'Vật lí 12'],
      ['subj_math:grade_11', 'Toán 11'],
      ['subj_math:grade_12', 'Toán 12'],
    ]);
    expect(programs.flatMap((p) => p.lessons.map((l) => l.id)).sort()).toEqual(['a', 'd', 'p']);
    expect(programFor(catalog, 'p')?.subjectTitle).toBe('Vật lí');
  });

  it('opens the program a link asks for, Mathematics 12 otherwise', () => {
    const programs = learningPrograms(catalog);
    expect(selectProgram(programs)?.id).toBe('subj_math:grade_12');
    expect(selectProgram(programs, 'subj_phys')?.id).toBe('subj_phys:g');
    expect(selectProgram(programs, 'subj_math', 'grade_11')?.id).toBe('subj_math:grade_11');
    // Old /student/lessons?subject= links: the subject's highest grade.
    expect(selectProgram(programs, 'subj_math')?.id).toBe('subj_math:grade_12');
    expect(selectProgram(programs, 'unknown')?.id).toBe('subj_math:grade_12');
    expect(selectProgram([], 'subj_math')).toBeNull();
  });

  it('links to a named program on the Roadmap; the plain URL is the profile program', () => {
    const programs = learningPrograms(catalog);
    expect(programHref(programs[2])).toBe('/student/roadmap?subject=subj_math&grade=grade_12');
    expect(programHref(programs[0])).toBe('/student/roadmap?subject=subj_phys&grade=g');
    expect(programHref(null)).toBe('/student/roadmap');
  });

  it('opens on another subject when Mathematics has nothing published, and is empty without lessons', () => {
    expect(roadmapScope([catalog[0]])?.title).toBe('Vật lí 12');
    expect(roadmapScope([])).toBeNull();
  });
});

describe('starting point from the self-reported average', () => {
  const passed = { correctCount: 5, totalCount: 6, passed: true };
  const failed = { correctCount: 2, totalCount: 6, passed: false };

  it('uses the score only to choose between reading first and trying the practice first', () => {
    expect(startingPointFor(6)).toBe('LEARN_FIRST');
    expect(startingPointFor(6.4)).toBe('LEARN_FIRST');
    expect(startingPointFor(CHECK_FIRST_FROM_SCORE)).toBe('CHECK_FIRST');
    expect(startingPointFor(7.5)).toBe('CHECK_FIRST');
    expect(startingPointFor(null)).toBe('LEARN_FIRST');
    expect(startingPointFor(undefined)).toBe('LEARN_FIRST');
    expect(startingPointFor(Number.NaN)).toBe('LEARN_FIRST');
  });

  it('6.0 → 9.0 reads the first lesson; 7.5 → 9.0 tries its practice first', () => {
    const a = pickNextStep(lessons, fresh, withQuestions, { currentScore: 6 });
    const b = pickNextStep(lessons, fresh, withQuestions, { currentScore: 7.5 });
    expect(a).toMatchObject({ kind: 'start', lesson: { id: 'a' }, href: '/student/lessons/a' });
    expect(b).toMatchObject({
      kind: 'check',
      lesson: { id: 'a' },
      cta: 'Làm thử để kiểm tra',
      href: '/student/lessons/a/practice',
    });
    expect(b?.reason).toContain('7,5/10');
    // Same lesson, same order: the score never skips or completes anything.
    expect(planProgress(lessons, fresh, withQuestions)).toEqual({ completed: 0, total: 3 });
  });

  it('a passed check completes the lesson and the next lesson starts with a check too', () => {
    const summaries: Summaries = { ...withQuestions, a: practice(6, passed) };
    expect(lessonStanding('a', fresh, summaries).completed).toBe(true);
    expect(pickNextStep(lessons, fresh, summaries, { currentScore: 7.5 })).toMatchObject({
      kind: 'check',
      lesson: { id: 'b' },
    });
    expect(pickNextStep(lessons, fresh, summaries, { currentScore: 6 })).toMatchObject({
      kind: 'start',
      lesson: { id: 'b' },
    });
  });

  it('a failed check sends the student to read the lesson, quoting their results by difficulty', () => {
    const summaries: Summaries = {
      ...withQuestions,
      a: {
        ...practice(6, failed),
        latest: {
          correctCount: 2,
          totalCount: 6,
          byDifficulty: [
            { difficulty: 'FOUNDATIONAL', correct: 2, total: 2 },
            { difficulty: 'INTERMEDIATE', correct: 0, total: 3 },
            { difficulty: 'ADVANCED', correct: 0, total: 1 },
          ],
        },
      },
    };
    const step = pickNextStep(lessons, fresh, summaries, { currentScore: 7.5 });
    expect(step).toMatchObject({ kind: 'start', lesson: { id: 'a' }, href: '/student/lessons/a' });
    expect(step?.reason).toContain('chưa đạt');
    expect(step?.reason).toContain('2/2 câu Cơ bản, 0/3 câu Vận dụng, 0/1 câu Nâng cao');
    expect(step?.reason).toContain('nên xem kỹ phần Vận dụng trước');
  });

  it('a lesson without practice questions is read first whatever the score', () => {
    const noQuestions: Summaries = { a: practice(0), b: practice(6), c: practice(6) };
    expect(pickNextStep(lessons, fresh, noQuestions, { currentScore: 9 })).toMatchObject({
      kind: 'start',
      lesson: { id: 'a' },
    });
  });

  it('work already started outranks the check', () => {
    const started = progress({ a: { reached: 1, total: 6 } }, 'a');
    expect(pickNextStep(lessons, started, withQuestions, { currentScore: 8 })).toMatchObject({
      kind: 'resume-lesson',
      lesson: { id: 'a' },
    });
  });
});

describe('latestResultSentence', () => {
  it('is empty without a completed session', () => {
    expect(latestResultSentence(undefined)).toBe('');
    expect(latestResultSentence(practice(6))).toBe('');
  });

  it('names no weak level when every answer was right', () => {
    const sentence = latestResultSentence({
      ...practice(6),
      latest: {
        correctCount: 3,
        totalCount: 3,
        byDifficulty: [{ difficulty: 'FOUNDATIONAL', correct: 3, total: 3 }],
      },
    });
    expect(sentence).toBe(' Lần gần nhất em đúng 3/3 câu Cơ bản.');
  });
});
