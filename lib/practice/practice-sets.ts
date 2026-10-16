import type { Difficulty, Question } from '@/lib/question-bank/qb-types';
import { practiceExclusionReason } from './grading';
import {
  PRACTICE_READY_THRESHOLD,
  PRACTICE_SESSION_SIZE,
  isInLessonPractice,
  orderPracticeQuestions,
} from './practice-rules';

/**
 * Practice sets that span a chapter, built only from what the question bank
 * stores (no text matching, no AI):
 *
 * - CHAPTER ("Ôn chương", free): the lessons' own free practice questions,
 *   mixed across the chapter. Offered once at least two lessons have practice;
 *   with one lesson it would only repeat that lesson's practice.
 * - SYNTHESIS ("Tổng hợp", Tú Tài Plus): questions the admin published with
 *   access tier PLUS and the usage context PLUS_SPECIAL ("Plus đặc biệt"),
 *   placed on the chapter or one of its lessons. Free questions never become
 *   Plus here, and Plus questions never enter free practice.
 */

export type PracticeSetKind = 'CHAPTER' | 'SYNTHESIS';

export const PRACTICE_SET_KINDS: readonly PracticeSetKind[] = ['CHAPTER', 'SYNTHESIS'];

/** URL segment for each set kind: /student/practice/<segment>/<chapterId>. */
export const SET_SEGMENTS: Record<PracticeSetKind, string> = {
  CHAPTER: 'chapter',
  SYNTHESIS: 'synthesis',
};

export function setKindFromSegment(segment: string): PracticeSetKind | null {
  return (
    (Object.entries(SET_SEGMENTS).find(([, value]) => value === segment)?.[0] as
      PracticeSetKind | undefined) ?? null
  );
}

export const SET_LABELS: Record<PracticeSetKind, string> = {
  CHAPTER: 'Ôn chương',
  SYNTHESIS: 'Tổng hợp',
};

export interface ChapterScope {
  id: string;
  lessonIds: string[];
}

export type DifficultyMix = Record<Difficulty, number>;

export function difficultyMix(questions: Pick<Question, 'difficulty'>[]): DifficultyMix {
  const mix: DifficultyMix = {
    FOUNDATIONAL: 0,
    INTERMEDIATE: 0,
    ADVANCED: 0,
    HIGH_DISCRIMINATION: 0,
  };
  for (const question of questions) mix[question.difficulty] += 1;
  return mix;
}

/** A published, auto-gradable Plus question marked for "Plus đặc biệt". */
export function isSynthesisQuestion(question: Question): boolean {
  return (
    question.editorialStatus === 'PUBLISHED' &&
    question.accessTier === 'PLUS' &&
    question.usageContexts.includes('PLUS_SPECIAL') &&
    practiceExclusionReason(question) === null
  );
}

function inChapter(question: Question, chapter: ChapterScope): boolean {
  const node = question.primaryKnowledgeNodeId;
  return !!node && (node === chapter.id || chapter.lessonIds.includes(node));
}

export function synthesisPool(questions: Question[], chapter: ChapterScope): Question[] {
  return orderPracticeQuestions(
    questions.filter((q) => isSynthesisQuestion(q) && inChapter(q, chapter))
  );
}

/** The chapter's free practice questions, by lesson; only lessons that have some. */
function reviewByLesson(questions: Question[], chapter: ChapterScope): Question[][] {
  return chapter.lessonIds
    .map((lessonId) =>
      orderPracticeQuestions(questions.filter((q) => isInLessonPractice(q, lessonId)))
    )
    .filter((pool) => pool.length > 0);
}

export function chapterReviewPool(questions: Question[], chapter: ChapterScope): Question[] {
  const byLesson = reviewByLesson(questions, chapter);
  return byLesson.length >= 2 ? byLesson.flat() : [];
}

/** Takes questions lesson by lesson in turn, easiest first, so every lesson is covered. */
export function pickChapterReview(questions: Question[], chapter: ChapterScope): Question[] {
  const byLesson = reviewByLesson(questions, chapter);
  if (byLesson.length < 2) return [];
  const picked: Question[] = [];
  for (let round = 0; picked.length < PRACTICE_SESSION_SIZE; round++) {
    const layer = byLesson.map((pool) => pool[round]).filter((q): q is Question => Boolean(q));
    if (!layer.length) break;
    picked.push(...layer);
  }
  return picked.slice(0, PRACTICE_SESSION_SIZE);
}

export function pickSynthesis(questions: Question[], chapter: ChapterScope): Question[] {
  return synthesisPool(questions, chapter).slice(0, PRACTICE_SESSION_SIZE);
}

export function pickSet(
  kind: PracticeSetKind,
  questions: Question[],
  chapter: ChapterScope
): Question[] {
  return kind === 'SYNTHESIS'
    ? pickSynthesis(questions, chapter)
    : pickChapterReview(questions, chapter);
}

/** A set is offered to students once it has enough questions to be worth a session. */
export function isSetReady(picked: Question[]): boolean {
  return picked.length >= PRACTICE_READY_THRESHOLD;
}

/**
 * What a set's questions actually contain, for the card and the intro. Every
 * number is counted from stored metadata; nothing is estimated.
 */
export interface SetFacts {
  questionCount: number;
  mix: DifficultyMix;
  /** Lessons of this chapter the questions are placed on or linked to. */
  lessonsLinked: number;
  /** Questions linking several pieces of knowledge (coverage CROSS or related nodes). */
  linkedCount: number;
  /** ADVANCED or HIGH_DISCRIMINATION. */
  demandingCount: number;
  /** Questions the editors flagged as special, with a written reason. */
  curatedCount: number;
}

export function setFacts(picked: Question[], chapter: ChapterScope): SetFacts {
  const lessons = new Set<string>();
  for (const question of picked) {
    for (const id of [question.primaryKnowledgeNodeId, ...(question.relatedKnowledgeNodeIds ?? [])])
      if (id && chapter.lessonIds.includes(id)) lessons.add(id);
  }
  return {
    questionCount: picked.length,
    mix: difficultyMix(picked),
    lessonsLinked: lessons.size,
    linkedCount: picked.filter(
      (q) => q.knowledgeCoverage === 'CROSS' || (q.relatedKnowledgeNodeIds?.length ?? 0) > 0
    ).length,
    demandingCount: picked.filter(
      (q) => q.difficulty === 'ADVANCED' || q.difficulty === 'HIGH_DISCRIMINATION'
    ).length,
    curatedCount: picked.filter((q) => q.isSpecial && !!q.specialReason?.trim()).length,
  };
}
