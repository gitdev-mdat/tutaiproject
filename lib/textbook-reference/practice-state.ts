import { findMathIssues, hasMathIssues } from '@/lib/content/math-notation';
import { checkMonotonicityAnswer, type AnswerCheck } from './math-checks';
import type { LessonSuggestion } from './practice-sources';
import type { SolutionCandidate, SolutionProposal } from './solution-matching';
import type { ExerciseChoice, SolutionStatus, TextbookArtifact } from './types';

/**
 * One textbook exercise on its way to lesson practice: what the matcher
 * suggests, what the Admin decided, and whether it may enter the Question Bank.
 * Pure: the service loads the artifacts and decisions, this derives the rest.
 */

export interface PracticeCandidateView extends SolutionCandidate {
  solution: Pick<
    TextbookArtifact,
    'id' | 'title' | 'content' | 'printedPages' | 'questionNumber' | 'answerChoice'
  >;
}

export interface ExercisePracticeView {
  id: string;
  documentId: string;
  entryId: string;
  questionNumber: string | null;
  printedPages: number[];
  hasDiagram: boolean;
  /** As extracted, never edited. */
  source: { content: string; choices: ExerciseChoice[] };
  /** What would go to the Question Bank: the Admin's corrected draft, else the extraction. */
  stem: string;
  choices: ExerciseChoice[];
  explanation: string;
  /** The exam the question was taken from, when the book prints "(Trích …)". */
  citation: string | null;
  status: SolutionStatus;
  candidates: PracticeCandidateView[];
  confirmedSolution: PracticeCandidateView['solution'] | null;
  verification: NonNullable<TextbookArtifact['practice']>['verification'] | null;
  answer: string | null;
  check: AnswerCheck;
  lesson: { lessonId: string; source: 'ADMIN' | 'SUGGESTED'; reason: string } | null;
  draftSaved: boolean;
  imported: NonNullable<TextbookArtifact['practice']>['imported'] | null;
  /** Why it cannot be imported yet; empty when it can. */
  blockers: string[];
}

const CHOICE_LINE = /^\s*[A-D]\s*[.)]\s+/;
const CITATION_LINE = /^\s*\((?:Trích|Nguồn)\b[^)]*\)\s*\.?\s*$/iu;

/** "Câu 3: Hỏi hàm số … ?\nA. …" → the stem alone, without number, choices or citation. */
export function stemOf(
  content: string,
  hasChoices: boolean
): { stem: string; citation: string | null } {
  const lines = content.replace(/^\s*Câu\s*\d+\s*[:.]\s*/iu, '').split('\n');
  const citation = lines.find((line) => CITATION_LINE.test(line))?.trim() ?? null;
  const kept = lines.filter(
    (line) => !CITATION_LINE.test(line) && !(hasChoices && CHOICE_LINE.test(line))
  );
  return { stem: kept.join('\n').trim(), citation };
}

/** The printed solution as an explanation: without its "Câu n:" label. */
export function explanationOf(solutionContent: string): string {
  return solutionContent.replace(/^\s*Câu\s*\d+\s*[:.]\s*/iu, '').trim();
}

/** A solution that only names the answer ("Đáp án C.") explains nothing to a student. */
export function explainsSomething(explanation: string): boolean {
  const rest = explanation
    .replace(/(?:đáp án|chọn)\s*:?\s*[A-D]\b\.?/giu, '')
    .replace(/[\s.:;]+/g, ' ')
    .trim();
  return rest.length >= 20;
}

const solutionView = (solution: TextbookArtifact): PracticeCandidateView['solution'] => ({
  id: solution.id,
  title: solution.title,
  content: solution.content,
  printedPages: solution.printedPages,
  questionNumber: solution.questionNumber,
  answerChoice: solution.answerChoice,
});

export function exercisePracticeView(input: {
  exercise: TextbookArtifact;
  proposal: SolutionProposal | undefined;
  artifactsById: Map<string, TextbookArtifact>;
  suggestion: LessonSuggestion | null;
}): ExercisePracticeView {
  const { exercise } = input;
  const practice = exercise.practice ?? {};
  const choices = practice.draft?.choices ?? exercise.choices ?? [];
  const extracted = stemOf(exercise.content, (exercise.choices ?? []).length > 0);
  const verification = practice.verification ?? null;
  const confirmed = verification?.solutionArtifactId
    ? (input.artifactsById.get(verification.solutionArtifactId) ?? null)
    : null;
  const status: SolutionStatus = verification
    ? verification.method === 'ADMIN_SOLVED'
      ? 'ADMIN_VERIFIED'
      : 'MATCHED'
    : (input.proposal?.status ?? 'UNRESOLVED');
  const answer = verification?.answer ?? null;
  const explanation =
    practice.draft?.explanation ?? (confirmed ? explanationOf(confirmed.content) : '');
  const stem = practice.draft?.stem ?? extracted.stem;
  const candidates = (input.proposal?.candidates ?? []).flatMap((candidate) => {
    const solution = input.artifactsById.get(candidate.solutionId);
    return solution ? [{ ...candidate, solution: solutionView(solution) }] : [];
  });
  const lesson = practice.lesson
    ? { lessonId: practice.lesson.lessonId, source: 'ADMIN' as const, reason: 'Admin đã chọn bài' }
    : input.suggestion
      ? {
          lessonId: input.suggestion.lessonId,
          source: 'SUGGESTED' as const,
          reason: input.suggestion.reason,
        }
      : null;
  const check = checkMonotonicityAnswer(stem, choices, answer);

  const blockers: string[] = [];
  if (!verification)
    blockers.push('Chưa xác nhận đáp án: chọn lời giải trong sách hoặc tự giải và ghi nhận.');
  if (choices.length < 2)
    blockers.push('Chỉ đưa được câu trắc nghiệm có các phương án A–D vào luyện tập.');
  else if (answer && !choices.some((choice) => choice.label === answer))
    blockers.push(`Đáp án ${answer} không có trong các phương án.`);
  if (exercise.hasDiagram)
    blockers.push(
      'Câu dựa vào hình, đồ thị hoặc bảng: học sinh không xem bản scan, nên chưa đưa vào luyện tập được.'
    );
  if (verification && !explainsSomething(explanation))
    blockers.push(
      'Cần lời giải để học sinh đọc sau khi nộp bài (sách chỉ ghi đáp án): viết lời giải.'
    );
  if (!lesson) blockers.push('Chưa chọn bài học cho câu này.');
  if (check.status === 'CONFLICT') blockers.push(check.note);
  const text = [stem, ...choices.map((choice) => choice.text), explanation].join('\n');
  if (/\[\?\]/.test(text))
    blockers.push('Còn ký hiệu chưa đọc chắc [?]: đối chiếu bản scan và sửa.');
  if (hasMathIssues(findMathIssues(text)))
    blockers.push('Có công thức sẽ hiện thô cho học sinh: sửa ký hiệu LaTeX.');

  return {
    id: exercise.id,
    documentId: exercise.documentId,
    entryId: exercise.entryId,
    questionNumber: exercise.questionNumber ?? null,
    printedPages: exercise.printedPages,
    hasDiagram: exercise.hasDiagram === true,
    source: { content: exercise.content, choices: exercise.choices ?? [] },
    stem,
    choices,
    explanation,
    citation: extracted.citation,
    status,
    candidates,
    confirmedSolution: confirmed ? solutionView(confirmed) : null,
    verification,
    answer,
    check,
    lesson,
    draftSaved: !!practice.draft,
    imported: practice.imported ?? null,
    blockers,
  };
}
