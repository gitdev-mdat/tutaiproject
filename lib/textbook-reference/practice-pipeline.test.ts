import { describe, expect, it } from 'vitest';
import fixture from './fixtures/math-book-3-real.json';
import { exerciseSetFor, validateItem } from './extraction-response';
import { applyTextbookImport, applyTextbookPublish, textbookExternalId } from './practice-import';
import {
  isPracticeSourceForLesson,
  practiceSetsForLesson,
  suggestLessonForSet,
} from './practice-sources';
import { exercisePracticeView, explainsSomething, stemOf } from './practice-state';
import { VERIFIED_Q22_ARTIFACT_ID } from './student-diagram';
import { proposeSolutions } from './solution-matching';
import type { Question } from '@/lib/question-bank/qb-types';
import type { TextbookArtifact, TextbookKnowledgeMapping, TextbookTocEntry } from './types';

/**
 * The textbook-exercise → lesson-practice pipeline on the real regression
 * fixture: math_book_3.pdf, printed pages 19–20 (22 questions of "Bài tập rèn
 * luyện kỹ năng" after Dạng 1) and page 29 ("Hướng dẫn giải chi tiết"), as
 * Gemini read them. Câu numbers restart in every set, so "Câu 1" of the Dạng 2
 * set on page 28 is a different question.
 */

const DOC = 'textbook-28823755f9b0448a';
const P1 = 'knowledge-p1';
const P2 = 'knowledge-p2';
const toc = (
  id: string,
  parentId: string | null,
  level: number,
  heading: string,
  start: number,
  end: number
) =>
  ({
    id,
    parentId,
    level,
    originalHeading: heading,
    normalizedHeading: heading.toLocaleLowerCase('vi'),
    printedStartPage: start,
    printedEndPage: end,
    locations: [],
    status: 'OBSERVED',
  }) satisfies TextbookTocEntry;
const TOC: TextbookTocEntry[] = [
  toc('toc-1', null, 1, 'Chủ đề 1: Hàm số và các ứng dụng của đạo hàm', 13, 136),
  toc('toc-2', 'toc-1', 2, 'I.I. Tính đơn điệu của hàm số', 13, 33),
  toc('toc-3', 'toc-2', 3, 'A. Lý thuyết', 13, 13),
  toc('toc-4', 'toc-2', 3, 'B. Bài tập trong các đề thi thử của các trường', 14, 33),
  toc('toc-5', 'toc-4', 4, 'Dạng 1: Bài toán không chứa tham số', 14, 18),
  toc('toc-6', 'toc-4', 4, 'Bài tập rèn luyện kỹ năng', 19, 20),
  toc('toc-7', 'toc-4', 4, 'Dạng 2: Bài toán chứa tham số', 21, 27),
  toc('toc-8', 'toc-4', 4, 'Bài tập rèn luyện kỹ năng', 28, 28),
  toc('toc-9', 'toc-4', 4, 'Hướng dẫn giải chi tiết', 29, 33),
  toc('toc-10', 'toc-1', 2, 'I.II. Cực trị của hàm số', 34, 97),
  toc('toc-50', 'toc-1', 2, 'Hàm số mũ và logarit', 150, 180),
  toc('toc-54', 'toc-50', 3, 'D. Phương pháp sử dụng tính đơn điệu của hàm số', 169, 172),
];
const document = { id: DOC, tocEntries: TOC };
const mapping = (knowledgeNodeId: string, entryId: string, status: 'CONFIRMED' | 'REJECTED') =>
  ({
    id: `${knowledgeNodeId}-${entryId}`,
    documentId: DOC,
    knowledgeNodeId,
    entryId,
    status,
    confidence: 1,
    confirmationRequired: false,
    updatedAt: '2026-10-24T00:00:00.000Z',
  }) satisfies TextbookKnowledgeMapping;
/** Production today: P1 uses theory and Dạng 1; the exercise list was unlinked from its theory view. */
const PRODUCTION = [
  mapping(P1, 'toc-3', 'CONFIRMED'),
  mapping(P1, 'toc-5', 'CONFIRMED'),
  mapping(P1, 'toc-6', 'REJECTED'),
  mapping(P1, 'toc-54', 'REJECTED'),
  mapping(P2, 'toc-2', 'REJECTED'),
  mapping(P2, 'toc-3', 'REJECTED'),
];

function extracted(entryId: string, items: unknown[], pages: number[]): TextbookArtifact[] {
  const entry = TOC.find((item) => item.id === entryId)!;
  return items.map((raw, index) => {
    const result = validateItem(raw, index, {
      documentId: DOC,
      entryId,
      extractionKey: `real-${entryId}-${pages.join('-')}`,
      pages,
      pdfPageOf: (page) => Math.floor(page / 2) + 1,
      exerciseSet: exerciseSetFor(entry, TOC),
      createdAt: '2026-10-24T00:00:00.000Z',
    });
    if (!result.ok) throw new Error(result.reason);
    return result.artifact;
  });
}

const exercises = extracted(
  'toc-6',
  fixture.exercises.map((item) => ({
    kind: 'EXERCISE',
    title: `Câu ${item.questionNumber}`,
    ...item,
  })),
  [19, 20]
);
const solutions = extracted(
  'toc-9',
  fixture.solutions.map((item) => ({
    kind: 'SOLUTION',
    title: `Câu ${item.questionNumber}`,
    ...item,
  })),
  [29]
);
const number = (artifacts: TextbookArtifact[], n: string) =>
  artifacts.find((a) => a.questionNumber === n)!;

describe('practice sources from the table of contents', () => {
  it('finds the exercise sets, the solution section and its bounded page groups', () => {
    const sets = practiceSetsForLesson({
      lessonId: P1,
      documents: [document],
      mappings: PRODUCTION,
      artifacts: exercises,
    });
    expect(sets.map((set) => [set.entry.id, set.problemType])).toEqual([
      ['toc-6', 'dạng 1'],
      ['toc-8', 'dạng 2'],
    ]);
    expect(sets[0].solutionSources.map((s) => [s.entry.id, s.chunks])).toEqual([
      [
        'toc-9',
        [
          [29, 30, 31],
          [32, 33],
        ],
      ],
    ]);
    // Exercises extracted under toc-6 belong to its set.
    expect(sets[0].exerciseIds).toHaveLength(fixture.exercises.length);
  });

  it('suggests the lesson from the problem-type hierarchy, not from page numbers', () => {
    const p1 = suggestLessonForSet(TOC[5], TOC, PRODUCTION, DOC);
    expect(p1.lesson).toMatchObject({ lessonId: P1, via: 'PROBLEM_TYPE' });
    expect(p1.lesson?.reason).toContain('Dạng 1: Bài toán không chứa tham số');
    // Nothing links Dạng 2 yet: no guess, the Admin chooses.
    expect(suggestLessonForSet(TOC[7], TOC, PRODUCTION, DOC)).toEqual({
      lesson: null,
      ambiguous: [],
    });
    const withP2 = [...PRODUCTION, mapping(P2, 'toc-7', 'CONFIRMED')];
    expect(suggestLessonForSet(TOC[7], TOC, withP2, DOC).lesson).toMatchObject({
      lessonId: P2,
      via: 'PROBLEM_TYPE',
    });
    // Two lessons on the same "Dạng" is ambiguous, never a pick.
    const both = [...withP2, mapping(P1, 'toc-7', 'CONFIRMED')];
    expect(suggestLessonForSet(TOC[7], TOC, both, DOC)).toEqual({
      lesson: null,
      ambiguous: [P2, P1],
    });
  });

  it('allows extracting practice sources only inside a chapter the lesson is linked in', () => {
    expect(isPracticeSourceForLesson(TOC[8], document, PRODUCTION, P1)).toBe(true);
    expect(isPracticeSourceForLesson(TOC[7], document, PRODUCTION, P1)).toBe(true);
    // Theory sections are not practice sources; P2 has no confirmed link at all.
    expect(isPracticeSourceForLesson(TOC[4], document, PRODUCTION, P1)).toBe(false);
    expect(isPracticeSourceForLesson(TOC[8], document, PRODUCTION, P2)).toBe(false);
    expect(isPracticeSourceForLesson(TOC[11], document, PRODUCTION, P1)).toBe(false);
  });
});

describe('matching the real page-29 solutions to the page 19–20 questions', () => {
  const proposals = proposeSolutions([...exercises, ...solutions]);
  const status = (n: string) => proposals.get(number(exercises, n).id)!;

  it('suggests only pairs whose mathematics checks out', () => {
    for (const n of ['1', '2', '3', '5', '6']) {
      expect(status(n).status, `Câu ${n}`).toBe('SUGGESTED');
      expect(status(n).candidates[0].solutionId).toBe(number(solutions, n).id);
    }
    expect(status('3').candidates[0].evidence.join(' ')).toMatch(/phương án A đúng/);
  });

  it('asks the Admin when only the number and set agree (Câu 4, Câu 7)', () => {
    for (const n of ['4', '7']) {
      expect(status(n).status, `Câu ${n}`).toBe('NEEDS_CONFIRMATION');
      expect(status(n).candidates[0].strength).toBe('WEAK');
    }
    // Câu 8's solution is on page 30, not extracted yet.
    expect(status('8')).toEqual({ status: 'UNRESOLVED', candidates: [] });
  });

  it('never offers a Dạng 1 solution to "Câu 1" of the Dạng 2 set on page 28', () => {
    const dang2 = extracted(
      'toc-8',
      [
        {
          kind: 'EXERCISE',
          title: 'Câu 1',
          questionNumber: '1',
          printedPages: [28],
          content: 'Câu 1: Tìm $m$ để hàm số $y = x^3 - 3mx^2 + 3x$ đồng biến trên $\\mathbb{R}$.',
          choices: [
            { label: 'A', text: '$m \\le 1$' },
            { label: 'B', text: '$-1 \\le m \\le 1$' },
            { label: 'C', text: '$m \\ge 1$' },
            { label: 'D', text: '$m \\ne 0$' },
          ],
        },
      ],
      [28]
    );
    const result = proposeSolutions([...exercises, ...dang2, ...solutions]);
    expect(result.get(dang2[0].id)).toEqual({ status: 'UNRESOLVED', candidates: [] });
    expect(result.get(number(exercises, '1').id)?.status).toBe('SUGGESTED');
  });
});

describe('practice state and the Question Bank import', () => {
  const byId = new Map([...exercises, ...solutions].map((a) => [a.id, a]));
  const confirm = (n: string, extra: Partial<NonNullable<TextbookArtifact['practice']>> = {}) => {
    const exercise = number(exercises, n);
    const solution = number(solutions, n);
    return {
      ...exercise,
      practice: {
        verification: {
          method: 'TEXTBOOK_SOLUTION' as const,
          answer: solution.answerChoice!,
          solutionArtifactId: solution.id,
          by: 'admin-1',
          at: '2026-10-24T01:00:00.000Z',
        },
        ...extra,
      },
    };
  };
  const suggestion = { lessonId: P1, via: 'PROBLEM_TYPE' as const, reason: 'Dạng 1' };
  const view = (exercise: TextbookArtifact) =>
    exercisePracticeView({ exercise, proposal: undefined, artifactsById: byId, suggestion });

  it('takes the stem without number, choices or citation, and needs a confirmed answer', () => {
    expect(stemOf(number(exercises, '3').content, true)).toEqual({
      stem: 'Hỏi hàm số $y = x^3 + 3x^2 - 4$ nghịch biến trên khoảng nào?',
      citation: '(Trích đề thi thử lần I – THPT Kim Liên Hà Nội)',
    });
    expect(view(number(exercises, '3')).blockers[0]).toMatch(/Chưa xác nhận đáp án/);
    const ready = view(confirm('3'));
    expect(ready).toMatchObject({ status: 'MATCHED', answer: 'A', blockers: [] });
    expect(ready.check.status).toBe('CONFIRMED');
  });

  it('imports Q22 with the supported derivative graph while retaining its printed answer and source', () => {
    const [q22Exercise] = extracted(
      'toc-6',
      [
        {
          kind: 'EXERCISE',
          title: 'Câu 22',
          questionNumber: '22',
          printedPages: [20],
          hasDiagram: true,
          content:
            "Câu 22: Cho hàm số $f(x)$ xác định trên $\\mathbb{R}$ và có đồ thị hàm số $y=f'(x)$ là đường cong trong hình bên. Mệnh đề nào dưới đây đúng?",
          choices: [
            { label: 'A', text: 'Đồng biến trên $(1;2)$' },
            { label: 'B', text: 'Nghịch biến trên $(0;2)$' },
            { label: 'C', text: 'Đồng biến trên $(-2;1)$' },
            { label: 'D', text: 'Nghịch biến trên $(-1;1)$' },
          ],
        },
      ],
      [20]
    );
    const [q22Solution] = extracted(
      'toc-9',
      [
        {
          kind: 'SOLUTION',
          title: 'Câu 22',
          questionNumber: '22',
          printedPages: [31],
          answerChoice: 'B',
          content:
            "Câu 22: Trên $(-\\infty;-2)$ và $(0;2)$ thì $f'(x)<0$, nên f nghịch biến trên $(0;2)$.",
        },
      ],
      [29, 30, 31]
    );
    const q22 = exercisePracticeView({
      exercise: {
        ...q22Exercise,
        id: VERIFIED_Q22_ARTIFACT_ID,
        practice: {
          verification: {
            method: 'AUTO_VERIFIED_SOLUTION',
            answer: 'B',
            solutionArtifactId: q22Solution.id,
            verifiedUsing: ['TEXTBOOK_SOLUTION', 'AI_INDEPENDENT'],
            by: 'ai',
            at: 't',
          },
        },
      },
      proposal: undefined,
      artifactsById: new Map([[q22Solution.id, q22Solution]]),
      suggestion,
    });
    expect(q22).toMatchObject({ answer: 'B', hasDiagram: true, blockers: [] });
    const imported = applyTextbookImport(
      [],
      [{ view: q22, documentTitle: 'math_book_3', solutionPages: [31], hierarchy }],
      { ...options, rights: 'REVIEW_REQUIRED' }
    );
    expect(imported.outcomes[0].result).toBe('CREATED');
    expect(imported.questions[0]).toMatchObject({
      correctAnswer: 'B',
      editorialStatus: 'DRAFT',
      primaryKnowledgeNodeId: P1,
      source: { rightsStatus: 'REVIEW_REQUIRED' },
      content: [
        { type: 'TEXT', text: q22.stem },
        {
          type: 'IMAGE',
          media: {
            assetId: '/textbook-figures/derivative-sign-q22.svg',
            sourcePage: 20,
          },
        },
      ],
      textbookSource: {
        questionNumber: '22',
        verification: 'AUTO_VERIFIED_SOLUTION',
      },
    });
  });

  it('never imports an answer without an explanation (Câu 7 prints only "Đáp án C.")', () => {
    expect(explainsSomething('Đáp án C.')).toBe(false);
    expect(view(confirm('7')).blockers.join(' ')).toMatch(/Cần lời giải/);
    const written = confirm('7', {
      draft: {
        stem: view(number(exercises, '7')).stem,
        choices: number(exercises, '7').choices!,
        explanation: "Ta có $y' = 4x^3 - 4x$, $y' < 0$ trên $(-\\infty; -1)$ và $(0; 1)$.",
        by: 'admin-1',
        at: 't',
      },
    });
    expect(view(written).blockers).toEqual([]);
  });

  it('blocks a confirmed answer that the derivative proves wrong', () => {
    const wrong = {
      ...confirm('3'),
      practice: {
        verification: {
          method: 'ADMIN_SOLVED' as const,
          answer: 'C',
          solutionArtifactId: null,
          by: 'admin-1',
          at: 't',
        },
        draft: {
          stem: view(number(exercises, '3')).stem,
          choices: number(exercises, '3').choices!,
          explanation: 'Một lời giải đủ dài nhưng đáp án sai.',
          by: 'a',
          at: 't',
        },
      },
    };
    expect(view(wrong).blockers.join(' ')).toMatch(/phương án C không đúng/);
  });

  const hierarchy = {
    subjectId: 'MATH' as const,
    grade: 12 as const,
    chapterId: 'chapter-1',
    lessonId: P1,
  };
  const item = (exercise: TextbookArtifact) => ({
    view: view(exercise),
    documentTitle: 'math_book_3',
    solutionPages: [29],
    hierarchy,
  });
  const options = {
    rights: 'LICENSED' as const,
    actor: 'admin-1',
    now: '2026-10-24T02:00:00.000Z',
  };

  it('creates one DRAFT per exercise with full provenance, and is idempotent', () => {
    const first = applyTextbookImport(
      [],
      [item(confirm('3')), item(number(exercises, '8'))],
      options
    );
    expect(first.outcomes.map((o) => o.result)).toEqual(['CREATED', 'SKIPPED']);
    const [question] = first.questions;
    expect(question).toMatchObject({
      externalId: textbookExternalId(number(exercises, '3').id),
      editorialStatus: 'DRAFT',
      primaryKnowledgeNodeId: P1,
      correctAnswer: 'A',
      importOrigin: 'PDF',
      usageContexts: [],
      source: {
        sourceType: 'LICENSED_MATERIAL',
        rightsStatus: 'LICENSED',
        sourcePage: 'đề tr. 19; lời giải tr. 29',
      },
      textbookSource: {
        documentId: DOC,
        verification: 'TEXTBOOK_SOLUTION',
        solutionPages: [29],
        exercisePages: [19],
      },
    });
    expect(question.options.map((o) => o.key)).toEqual(['A', 'B', 'C', 'D']);
    expect(first.audits[0]).toMatchObject({ action: 'IMPORTED', questionId: question.id });

    const again = applyTextbookImport(first.questions, [item(confirm('3'))], {
      ...options,
      now: '2026-10-24T03:00:00.000Z',
    });
    expect(again.outcomes[0]).toMatchObject({ result: 'UNCHANGED', questionId: question.id });
    expect(again.questions).toHaveLength(1);
  });

  it('updates an untouched draft in place, and never overwrites a reviewed or edited one', () => {
    const first = applyTextbookImport([], [item(confirm('3'))], options).questions;
    const corrected = confirm('3', {
      draft: {
        stem: 'Hàm số $y = x^3 + 3x^2 - 4$ nghịch biến trên khoảng nào?',
        choices: number(exercises, '3').choices!,
        explanation: explanationFor('3'),
        by: 'a',
        at: 't',
      },
    });
    const updated = applyTextbookImport(first, [item(corrected)], {
      ...options,
      now: '2026-10-24T04:00:00.000Z',
    });
    expect(updated.outcomes[0].result).toBe('UPDATED');
    expect(updated.questions).toHaveLength(1);
    expect(updated.questions[0]).toMatchObject({
      id: first[0].id,
      code: first[0].code,
      stem: corrected.practice.draft!.stem,
    });

    const published: Question[] = [
      { ...updated.questions[0], editorialStatus: 'PUBLISHED', usageContexts: ['OPEN_PRACTICE'] },
    ];
    const kept = applyTextbookImport(published, [item(confirm('3'))], options);
    expect(kept.outcomes[0]).toMatchObject({ result: 'UNCHANGED' });
    expect(kept.outcomes[0].reason).toMatch(/đã xuất bản/);
    expect(kept.questions[0]).toBe(published[0]);

    const editedInBank: Question[] = [
      { ...first[0], difficulty: 'INTERMEDIATE', updatedAt: '2026-10-24T05:00:00.000Z' },
    ];
    expect(applyTextbookImport(editedInBank, [item(corrected)], options).outcomes[0].result).toBe(
      'UNCHANGED'
    );
  });

  it('publishes a verified exercise in one step, through the review and publishing checks', () => {
    const result = applyTextbookPublish(
      [],
      [item(confirm('3')), item(number(exercises, '8'))],
      options
    );
    expect(result.outcomes.map((o) => o.result)).toEqual(['PUBLISHED', 'BLOCKED']);
    expect(result.outcomes[1].reasons[0]).toMatch(/Chưa xác nhận đáp án/);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]).toMatchObject({
      editorialStatus: 'PUBLISHED',
      accessTier: 'OPEN',
      usageContexts: ['OPEN_PRACTICE'],
      primaryKnowledgeNodeId: P1,
      correctAnswer: 'A',
      source: { rightsStatus: 'LICENSED' },
    });
    expect(result.audits.map((a) => a.action)).toEqual([
      'IMPORTED',
      'SUBMITTED_FOR_REVIEW',
      'PUBLISHED',
    ]);
    expect(result.outcomes[0].question?.correctAnswer).toBe('A');

    const again = applyTextbookPublish(result.questions, [item(confirm('3'))], options);
    expect(again.outcomes[0].result).toBe('ALREADY_PUBLISHED');
    expect(again.questions).toHaveLength(1);
    expect(again.audits).toEqual([]);
  });

  it('publishes a question waiting in review once its rights are resolved, and records the change', () => {
    const drafted = applyTextbookImport([], [item(confirm('3'))], {
      ...options,
      rights: 'REVIEW_REQUIRED',
    }).questions;
    const inReview: Question[] = [{ ...drafted[0], editorialStatus: 'IN_REVIEW' }];
    const result = applyTextbookPublish(inReview, [item(confirm('3'))], options);
    expect(result.outcomes[0]).toMatchObject({ result: 'PUBLISHED', questionId: drafted[0].id });
    expect(result.questions[0].source.rightsStatus).toBe('LICENSED');
    expect(result.audits.map((a) => a.action)).toEqual(['SOURCE_RIGHTS_CHANGED', 'PUBLISHED']);
  });

  it('never publishes with unresolved rights, an archived question or a duplicate', () => {
    expect(() =>
      applyTextbookPublish([], [item(confirm('3'))], { ...options, rights: 'REVIEW_REQUIRED' })
    ).toThrow();
    const own = applyTextbookImport([], [item(confirm('3'))], options).questions[0];
    const archived = applyTextbookPublish(
      [{ ...own, editorialStatus: 'ARCHIVED' }],
      [item(confirm('3'))],
      options
    );
    expect(archived.outcomes[0]).toMatchObject({ result: 'BLOCKED' });
    expect(archived.questions[0].editorialStatus).toBe('ARCHIVED');
    const manual = { ...own, id: 'q-manual', externalId: undefined, code: 'Q-MAT-MANUAL' };
    const duplicate = applyTextbookPublish([manual], [item(confirm('3'))], options);
    expect(duplicate.outcomes[0]).toMatchObject({
      result: 'BLOCKED',
      questionCode: 'Q-MAT-MANUAL',
    });
    expect(duplicate.questions).toEqual([manual]);
  });

  it('places a chapter-level question on the chapter, with the chapter as its hierarchy', () => {
    const exercise = confirm('3');
    const chapterView = {
      ...view(exercise),
      lesson: { lessonId: 'chapter-1', source: 'ADMIN' as const, reason: 'Admin' },
    };
    const result = applyTextbookPublish(
      [],
      [
        {
          ...item(exercise),
          view: chapterView,
          hierarchy: { subjectId: 'MATH', grade: 12, chapterId: 'chapter-1' },
        },
      ],
      options
    );
    expect(result.outcomes[0]).toMatchObject({ result: 'PUBLISHED', destinationId: 'chapter-1' });
    expect(result.questions[0]).toMatchObject({
      primaryKnowledgeNodeId: 'chapter-1',
      chapterId: 'chapter-1',
    });
  });

  it('skips a question already in the bank by another route', () => {
    const own = applyTextbookImport([], [item(confirm('3'))], options).questions[0];
    const manual = {
      ...own,
      id: 'q-manual',
      externalId: undefined,
      code: 'Q-MAT-MANUAL',
      textbookSource: undefined,
    };
    const result = applyTextbookImport([manual], [item(confirm('3'))], options);
    expect(result.outcomes[0]).toMatchObject({ result: 'SKIPPED', questionCode: 'Q-MAT-MANUAL' });
    expect(result.questions).toHaveLength(1);
  });
});

function explanationFor(n: string) {
  return fixture.solutions.find((s) => s.questionNumber === n)!.content.replace(/^Câu \d+:\s*/, '');
}
