/** Deterministic SHA-256 fingerprints used for exact duplicate detection. */

import { createHash } from 'crypto';
import type { QuestionFingerprints, QuestionOption } from './qb-types';

export function normalizeText(text: string): string {
  return text.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
}

function sortedOptions(options: QuestionOption[]): QuestionOption[] {
  return [...options].sort((a, b) => a.key.localeCompare(b.key));
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function computeQuestionFingerprints(
  stem: string,
  options: QuestionOption[],
  correctAnswer: string
): QuestionFingerprints {
  const normalizedStem = normalizeText(stem);
  const normalizedOptions = sortedOptions(options)
    .map((option) => `${option.key.toUpperCase()}:${normalizeText(option.content)}`)
    .join('|');
  const normalizedAnswer = normalizeText(correctAnswer);
  return {
    stem: sha256(normalizedStem),
    stemAndOptions: sha256(`${normalizedStem}\u00a7${normalizedOptions}`),
    full: sha256(`${normalizedStem}\u00a7${normalizedOptions}\u00a7${normalizedAnswer}`),
  };
}

/** Backward-compatible name for the canonical full fingerprint. */
export function computeContentHash(
  stem: string,
  options: QuestionOption[],
  correctAnswer: string
): string {
  return computeQuestionFingerprints(stem, options, correctAnswer).full;
}

/** Generate a short human-readable question code. */
export function generateQuestionCode(subjectId: string): string {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `Q-${subjectId.substring(0, 3)}-${rand}`;
}
