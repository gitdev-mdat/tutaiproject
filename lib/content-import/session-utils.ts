import type { ImportSession, QuestionCandidate } from './types';

export function normalizeExamCode(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^\d+$/.test(trimmed)) return trimmed.replace(/^0+(?=\d)/, '');
  return trimmed.toUpperCase().replace(/\s+/g, '');
}

export function codesNeedConfirmation(examCode: string, answerCode: string): boolean {
  if (!examCode.trim() || !answerCode.trim() || examCode === answerCode) return false;
  return normalizeExamCode(examCode) === normalizeExamCode(answerCode);
}

export function summarizeSession(session: Pick<ImportSession, 'pages' | 'candidates'>) {
  const candidates = session.candidates;
  return {
    pageCount: session.pages.length,
    detectedQuestions: candidates.length,
    approvedQuestions: candidates.filter((candidate) => candidate.status === 'APPROVED').length,
    reviewQuestions: candidates.filter((candidate) =>
      ['UNREVIEWED', 'WARNING', 'EDITED'].includes(candidate.status)
    ).length,
    skippedQuestions: candidates.filter((candidate) => candidate.status === 'SKIPPED').length,
    questionsWithAnswers: candidates.filter((candidate) => candidate.correctAnswer.trim()).length,
    questionsWithoutAnswers: candidates.filter((candidate) => !candidate.correctAnswer.trim())
      .length,
    duplicateCandidates: candidates.filter((candidate) =>
      candidate.warnings.some((warning) => warning.code === 'POSSIBLE_DUPLICATE')
    ).length,
    failedItems: 0,
    lowQualityImages: session.pages.filter((page) => page.warnings.includes('LOW_RESOLUTION'))
      .length,
  };
}

export function candidateHasBlockingWarning(candidate: QuestionCandidate): boolean {
  return candidate.warnings.some((warning) =>
    ['MISSING_ANSWER', 'SUSPECT_MATH', 'MISSING_ASSET'].includes(warning.code)
  );
}
