import 'server-only';

import { z } from 'zod';
import { executeWithAbortableProviderTimeout } from '@/lib/ai/provider-timeout';
import { GEMINI_MODELS } from '@/lib/config/models';
import { hasRequiredVisualCue } from './media-readiness';
import type { QuestionCandidate } from './types';

export const VISUAL_DETECTION_MAX_PAGES = 4;
export const VISUAL_DETECTION_MAX_REGIONS = 3;
export const VISUAL_DETECTION_AUTO_ATTACH_CONFIDENCE = 0.82;
export const VISUAL_DETECTION_MIN_DIMENSION = 0.015;
export const VISUAL_DETECTION_MIN_AREA = 0.0005;
export const VISUAL_DETECTION_MAX_AREA = 0.9;
const VISUAL_DETECTION_PROVIDER_TIMEOUT_MS = 90_000;

const visualKindSchema = z.enum([
  'GRAPH',
  'VARIATION_TABLE',
  'SIGN_TABLE',
  'GEOMETRY',
  'DIAGRAM',
  'CHART',
  'COORDINATE_PLANE',
  'PHOTO',
  'SCHEMATIC',
  'CIRCUIT',
  'SCIENTIFIC_IMAGE',
  'OTHER',
]);

const visionBoxSchema = z
  .object({
    ymin: z.number().min(0).max(1000),
    xmin: z.number().min(0).max(1000),
    ymax: z.number().min(0).max(1000),
    xmax: z.number().min(0).max(1000),
  })
  .strict();

const visualDetectionResponseSchema = z
  .object({
    results: z.array(
      z
        .object({
          questionNumber: z.number().int().positive(),
          status: z.enum(['DETECTED', 'AMBIGUOUS', 'NOT_FOUND']),
          visuals: z
            .array(
              z
                .object({
                  pageNumber: z.number().int().positive(),
                  box2d: visionBoxSchema,
                  kind: visualKindSchema,
                  confidence: z.number().min(0).max(1),
                  evidence: z.string(),
                })
                .strict()
            )
            .max(VISUAL_DETECTION_MAX_REGIONS),
        })
        .strict()
    ),
  })
  .strict();

const VISUAL_DETECTION_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['results'],
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['questionNumber', 'status', 'visuals'],
        properties: {
          questionNumber: { type: 'integer', minimum: 1 },
          status: { type: 'string', enum: ['DETECTED', 'AMBIGUOUS', 'NOT_FOUND'] },
          visuals: {
            type: 'array',
            maxItems: VISUAL_DETECTION_MAX_REGIONS,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['pageNumber', 'box2d', 'kind', 'confidence', 'evidence'],
              properties: {
                pageNumber: { type: 'integer', minimum: 1 },
                box2d: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['ymin', 'xmin', 'ymax', 'xmax'],
                  properties: {
                    ymin: { type: 'number', minimum: 0, maximum: 1000 },
                    xmin: { type: 'number', minimum: 0, maximum: 1000 },
                    ymax: { type: 'number', minimum: 0, maximum: 1000 },
                    xmax: { type: 'number', minimum: 0, maximum: 1000 },
                  },
                },
                kind: { type: 'string', enum: visualKindSchema.options },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                evidence: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
} as const;

export type VisionBox = z.infer<typeof visionBoxSchema>;
export type VisualKind = z.infer<typeof visualKindSchema>;

export interface VisualDetectionPage {
  pageNumber: number;
  rasterPng?: Buffer;
  lowText: boolean;
}

export interface VisualDetectionWindow {
  pageNumbers: number[];
  candidates: QuestionCandidate[];
}

export interface ValidatedVisualDetection {
  candidateId: string;
  questionNumber: number;
  decision: 'AUTO_ATTACH' | 'REVIEW' | 'REJECT';
  status: 'DETECTED' | 'AMBIGUOUS' | 'NOT_FOUND' | 'INVALID';
  pageNumber?: number;
  sourceRegion?: { x: number; y: number; width: number; height: number };
  kind?: VisualKind;
  confidence?: number;
  evidence?: string;
  reason?: string;
}

export interface VisualDetectionBatchResult {
  detections: ValidatedVisualDetection[];
  failedWindows: number[][];
}

const RECOVERY_PLACEHOLDER =
  /\[(?:đồ\s*thị|bảng\s+(?:biến\s+thiên|xét\s+dấu)|hình(?:\s+vẽ)?|graph|figure|diagram|image)[^\]]*\]/iu;

function hasAttachedImage(candidate: QuestionCandidate): boolean {
  return Boolean(
    candidate.orderedContent?.some((block) => block.type === 'IMAGE') ||
    candidate.mediaCandidates?.length
  );
}

export function isUnresolvedVisualCandidate(
  candidate: QuestionCandidate,
  pages: VisualDetectionPage[]
): boolean {
  if (hasAttachedImage(candidate)) return false;
  if (hasRequiredVisualCue(candidate.content) || RECOVERY_PLACEHOLDER.test(candidate.content)) {
    return true;
  }
  if (candidate.warnings.some((warning) => warning.code === 'MISSING_ASSET')) return true;
  if (
    candidate.fieldConfidence.asset === 'REVIEW' ||
    candidate.fieldConfidence.asset === 'UNCERTAIN'
  ) {
    return true;
  }
  const sourcePages = new Set(candidate.sourcePages ?? []);
  return (
    candidate.warnings.some((warning) => warning.code === 'SUSPECT_MATH') &&
    pages.some((page) => sourcePages.has(page.pageNumber) && page.lowText)
  );
}

export function buildCandidatePageWindow(
  candidate: QuestionCandidate,
  availablePageNumbers: number[]
): number[] {
  const available = [...new Set(availablePageNumbers)].sort((a, b) => a - b);
  const availableSet = new Set(available);
  const source = [...new Set(candidate.sourcePages ?? [])]
    .filter((pageNumber) => availableSet.has(pageNumber))
    .sort((a, b) => a - b)
    .slice(0, VISUAL_DETECTION_MAX_PAGES);
  if (source.length === 0) return [];

  const selected = new Set(source);
  const before = source[0] - 1;
  const after = source[source.length - 1] + 1;
  if (selected.size < VISUAL_DETECTION_MAX_PAGES && availableSet.has(before)) selected.add(before);
  if (selected.size < VISUAL_DETECTION_MAX_PAGES && availableSet.has(after)) selected.add(after);
  return [...selected].sort((a, b) => a - b);
}

function overlaps(left: number[], right: number[]): boolean {
  const values = new Set(left);
  return right.some((value) => values.has(value));
}

export function buildVisualDetectionWindows(
  pages: VisualDetectionPage[],
  candidates: QuestionCandidate[]
): VisualDetectionWindow[] {
  const available = pages.filter((page) => page.rasterPng).map((page) => page.pageNumber);
  const entries = candidates
    .filter((candidate) => isUnresolvedVisualCandidate(candidate, pages))
    .map((candidate) => ({ candidate, pages: buildCandidatePageWindow(candidate, available) }))
    .filter((entry) => entry.pages.length > 0)
    .sort((left, right) => left.pages[0] - right.pages[0]);
  const windows: VisualDetectionWindow[] = [];

  for (const entry of entries) {
    const matching = windows.find((window) => {
      const union = new Set([...window.pageNumbers, ...entry.pages]);
      return overlaps(window.pageNumbers, entry.pages) && union.size <= VISUAL_DETECTION_MAX_PAGES;
    });
    if (matching) {
      matching.pageNumbers = [...new Set([...matching.pageNumbers, ...entry.pages])].sort(
        (a, b) => a - b
      );
      matching.candidates.push(entry.candidate);
    } else {
      windows.push({ pageNumbers: entry.pages, candidates: [entry.candidate] });
    }
  }
  return windows;
}

export function buildVisualDetectionPrompt(window: VisualDetectionWindow): string {
  const questions = window.candidates
    .map(
      (candidate) =>
        `Question ${candidate.number} (candidate ${candidate.id}; source pages ${(candidate.sourcePages ?? []).join(', ') || 'unknown'}):\n${candidate.content.slice(0, 2400)}`
    )
    .join('\n\n');
  return `You are locating required visual source regions for already-extracted exam questions.

You are NOT solving the questions, rewriting their text, or inferring answers. For each supplied question, inspect only the supplied source-page images and identify visible regions that are part of that question and necessary to preserve it faithfully. A required visual may be on an adjacent page before or after the textual cue.

Visuals include graphs, tables, diagrams, geometry figures, photos, charts, scientific illustrations, circuits, apparatus, coordinate systems, and unknown visual types. Do not reject an unknown type; use OTHER.

Return a tight box around the visual itself using 0..1000 coordinates relative to that page image: { ymin, xmin, ymax, xmax }. Exclude unrelated questions, answer choices outside the visual, headers, footers, logos, watermarks where avoidable, solutions, and unrelated diagrams. If no required visual can be confidently associated, return NOT_FOUND. If multiple nearby visuals compete or association is unclear, return AMBIGUOUS. Never invent a box. Return no more than ${VISUAL_DETECTION_MAX_REGIONS} regions per question.

Submitted pages: ${window.pageNumbers.join(', ')}.

${questions}`;
}

export function visionBoxToNormalizedRegion(box: VisionBox): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  if (
    !Object.values(box).every(Number.isFinite) ||
    box.xmin < 0 ||
    box.ymin < 0 ||
    box.xmax > 1000 ||
    box.ymax > 1000 ||
    box.xmin >= box.xmax ||
    box.ymin >= box.ymax
  ) {
    return null;
  }
  return {
    x: box.xmin / 1000,
    y: box.ymin / 1000,
    width: (box.xmax - box.xmin) / 1000,
    height: (box.ymax - box.ymin) / 1000,
  };
}

type ProviderResult = z.infer<typeof visualDetectionResponseSchema>['results'][number];

export function validateVisualDetection(
  candidate: QuestionCandidate,
  pageNumbers: number[],
  result: ProviderResult | undefined,
  rasterPageNumbers: Set<number>
): ValidatedVisualDetection {
  const base = { candidateId: candidate.id, questionNumber: candidate.number };
  if (!result || result.questionNumber !== candidate.number) {
    return { ...base, decision: 'REJECT', status: 'INVALID', reason: 'QUESTION_MISMATCH' };
  }
  if (result.status === 'NOT_FOUND') {
    return { ...base, decision: 'REVIEW', status: 'NOT_FOUND', reason: 'NOT_FOUND' };
  }
  if (result.status === 'AMBIGUOUS') {
    return { ...base, decision: 'REVIEW', status: 'AMBIGUOUS', reason: 'AMBIGUOUS' };
  }
  if (result.visuals.length !== 1) {
    return { ...base, decision: 'REVIEW', status: 'AMBIGUOUS', reason: 'MULTIPLE_REGIONS' };
  }

  const visual = result.visuals[0];
  if (!pageNumbers.includes(visual.pageNumber) || !rasterPageNumbers.has(visual.pageNumber)) {
    return { ...base, decision: 'REJECT', status: 'INVALID', reason: 'PAGE_OUTSIDE_WINDOW' };
  }
  const sourceRegion = visionBoxToNormalizedRegion(visual.box2d);
  if (!sourceRegion) {
    return { ...base, decision: 'REJECT', status: 'INVALID', reason: 'INVALID_BOX' };
  }
  const area = sourceRegion.width * sourceRegion.height;
  if (
    sourceRegion.width < VISUAL_DETECTION_MIN_DIMENSION ||
    sourceRegion.height < VISUAL_DETECTION_MIN_DIMENSION ||
    area < VISUAL_DETECTION_MIN_AREA
  ) {
    return { ...base, decision: 'REJECT', status: 'INVALID', reason: 'IMPLAUSIBLY_SMALL' };
  }
  if (area > VISUAL_DETECTION_MAX_AREA) {
    return { ...base, decision: 'REVIEW', status: 'DETECTED', reason: 'IMPLAUSIBLY_LARGE' };
  }
  if (visual.confidence < VISUAL_DETECTION_AUTO_ATTACH_CONFIDENCE) {
    return { ...base, decision: 'REVIEW', status: 'DETECTED', reason: 'LOW_CONFIDENCE' };
  }
  return {
    ...base,
    decision: 'AUTO_ATTACH',
    status: 'DETECTED',
    pageNumber: visual.pageNumber,
    sourceRegion,
    kind: visual.kind,
    confidence: visual.confidence,
    evidence: visual.evidence,
  };
}

async function detectWindow(
  pages: VisualDetectionPage[],
  window: VisualDetectionWindow
): Promise<ValidatedVisualDetection[]> {
  const { gemini } = await import('@/lib/ai/gemini-client');
  const pagesByNumber = new Map(pages.map((page) => [page.pageNumber, page]));
  const imageParts = window.pageNumbers.flatMap((pageNumber) => {
    const rasterPng = pagesByNumber.get(pageNumber)?.rasterPng;
    return rasterPng
      ? [
          { text: `SOURCE PAGE ${pageNumber}` },
          { inlineData: { mimeType: 'image/png', data: rasterPng.toString('base64') } },
        ]
      : [];
  });
  const response = await executeWithAbortableProviderTimeout(
    (abortSignal) =>
      gemini.models.generateContent({
        model: GEMINI_MODELS.documentAnalysis,
        contents: [
          {
            role: 'user',
            parts: [...imageParts, { text: buildVisualDetectionPrompt(window) }],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: VISUAL_DETECTION_RESPONSE_JSON_SCHEMA,
          temperature: 0,
          abortSignal,
        },
      }),
    VISUAL_DETECTION_PROVIDER_TIMEOUT_MS
  );
  const text = (response as { text?: string }).text;
  if (!text) throw new Error('EMPTY_VISUAL_LOCALIZATION_RESPONSE');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('INVALID_VISUAL_LOCALIZATION_JSON');
  }
  const validated = visualDetectionResponseSchema.safeParse(parsed);
  if (!validated.success) throw new Error('INVALID_VISUAL_LOCALIZATION_SCHEMA');

  const resultByQuestion = new Map(
    validated.data.results.map((result) => [result.questionNumber, result])
  );
  const rasterPageNumbers = new Set(
    pages.filter((page) => page.rasterPng).map((page) => page.pageNumber)
  );
  return window.candidates.map((candidate) =>
    validateVisualDetection(
      candidate,
      window.pageNumbers,
      resultByQuestion.get(candidate.number),
      rasterPageNumbers
    )
  );
}

export async function detectMissingQuestionVisuals(
  pages: VisualDetectionPage[],
  candidates: QuestionCandidate[]
): Promise<VisualDetectionBatchResult> {
  const windows = buildVisualDetectionWindows(pages, candidates);
  const detections: ValidatedVisualDetection[] = [];
  const failedWindows: number[][] = [];
  for (const window of windows) {
    try {
      detections.push(...(await detectWindow(pages, window)));
    } catch (error: unknown) {
      failedWindows.push(window.pageNumbers);
      console.warn(
        `[content-import] Visual localization failed for pages ${window.pageNumbers.join(',')} (${error instanceof Error ? error.name : 'UnknownError'}).`
      );
    }
  }
  return { detections, failedWindows };
}
