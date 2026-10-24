/** Extraction prompt versions, shared by the worker and the Admin UI. */

// v9: every question is its own item, no solution required; per-page readability; up to 40 items.
export const PROMPT_VERSION = 'textbook-knowledge-v9';
/** Earlier versions whose stored results are reused instead of extracting the same pages again. */
export const PREVIOUS_PROMPT_VERSIONS = ['textbook-knowledge-v8'] as const;
