/**
 * Centralized Gemini model configuration.
 *
 * Each stage of the pipeline uses the most cost-effective model that still
 * delivers reliable structured JSON output.  Override per-model via environment
 * variables without changing code.
 *
 * Model selection rationale:
 *   documentAnalysis — reads first+last pages of a PDF for metadata only.
 *                     gemini-3.5-flash: 1 M token context, PDF-native, GA stable.
 *   tocDetection     — scans the full PDF for structural markers.
 *                     Same model as analysis; consistent API usage.
 *   batchExtraction — processes chapter/page slices, moderate complexity.
 *                     Uses the same model to avoid API key permission issues
 *                     when the same Gemini file is used across multiple calls.
 *
 * If you need to split models (e.g. use a cheaper model for TOC and a more
 * capable one for extraction), add a new GEMINI_EXTRACTION_MODEL env var and
 * update the table below.
 *
 * Current availability (July 2026):
 *   gemini-3.5-flash      — GA stable, 1 M token context, PDF-native, structured output ✅
 *   gemini-2.5-flash      — RETIRED, HTTP 404 ("not available to new users")
 *   gemini-2.0-flash      — RETIRED, HTTP 404
 */
export const GEMINI_MODELS = {
  /**
   * Single-page / few-page analysis tasks:
   *   - Document metadata extraction (first + last pages)
   *   - Table-of-contents detection
   */
  documentAnalysis: process.env.GEMINI_DOCUMENT_ANALYSIS_MODEL ?? 'gemini-3.5-flash',

  /**
   * Full-document structural scan — same model as analysis for consistency.
   * (Uses the same uploaded Gemini file; no extra upload cost.)
   */
  tocDetection: process.env.GEMINI_TOC_MODEL ?? 'gemini-3.5-flash',

  /**
   * Batch knowledge extraction — processes chapter/page slices.
   * Same model family to avoid cross-model permission issues with Gemini Files API.
   */
  batchExtraction: process.env.GEMINI_EXTRACTION_MODEL ?? 'gemini-3.5-flash',

  /** Bounded semantic-record classification; optimized for cost and structured output. */
  semanticClassification: process.env.GEMINI_SEMANTIC_CLASSIFICATION_MODEL ?? 'gemini-3.5-flash',

  /** Optional stronger route for a future second-pass ambiguity adjudication. */
  ontologyAmbiguity: process.env.GEMINI_ONTOLOGY_AMBIGUITY_MODEL ?? 'gemini-3.5-flash',
} as const;

export type GeminiModelStage = keyof typeof GEMINI_MODELS;
