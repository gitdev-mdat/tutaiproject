import { createCanvas } from '@napi-rs/canvas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachDetectedQuestionVisuals,
  enrichPdfCandidatesWithMedia,
  type ExtractedDocumentPage,
} from './document-extraction';
import type { QuestionCandidate } from './types';
import {
  buildCandidatePageWindow,
  buildVisualDetectionWindows,
  detectMissingQuestionVisuals,
  isUnresolvedVisualCandidate,
  validateVisualDetection,
  visionBoxToNormalizedRegion,
} from './visual-region-detection';

const generateContent = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ai/gemini-client', () => ({ gemini: { models: { generateContent } } }));

function candidate(
  number: number,
  content = 'Cho hàm số có đồ thị như hình vẽ sau:'
): QuestionCandidate {
  return {
    id: `q-${number}`,
    number,
    sourcePageIds: [],
    sourcePages: [number],
    questionType: 'SHORT_ANSWER',
    content,
    options: [],
    statements: [],
    correctAnswer: '1',
    detectedSelectedAnswer: '',
    explanation: '',
    sharedContext: '',
    questionAssetDescription: '',
    chapter: '',
    lesson: '',
    concept: '',
    difficulty: 'INTERMEDIATE',
    status: 'EDITED',
    fieldConfidence: {
      content: 'HIGH',
      options: 'HIGH',
      answer: 'HIGH',
      asset: 'REVIEW',
      classification: 'HIGH',
    },
    warnings: [
      {
        id: `missing-${number}`,
        code: 'MISSING_ASSET',
        message: 'missing',
        actions: ['RESELECT_REGION'],
      },
    ],
    updatedAt: '',
    reviewLevel: 'BLOCKING',
    validationErrors: [],
  };
}

function raster(width = 200, height = 100): Buffer {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#000000';
  context.fillRect(width / 4, height / 4, width / 2, height / 2);
  return canvas.toBuffer('image/png');
}

function page(pageNumber: number): ExtractedDocumentPage {
  return {
    pageNumber,
    text: '',
    width: 100,
    height: 50,
    rasterPng: raster(),
    lowText: true,
  };
}

function detected(questionNumber: number, pageNumber: number) {
  return {
    questionNumber,
    status: 'DETECTED' as const,
    visuals: [
      {
        pageNumber,
        box2d: { ymin: 200, xmin: 100, ymax: 700, xmax: 600 },
        kind: 'OTHER' as const,
        confidence: 0.95,
        evidence: 'Visible source figure',
      },
    ],
  };
}

describe('visual-region detection planning and validation', () => {
  beforeEach(() => generateContent.mockReset());

  it('builds a bounded adjacent-page window for single and multi-page candidates', () => {
    const available = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const single = candidate(7);
    single.sourcePages = [7];
    const multi = candidate(8);
    multi.sourcePages = [7, 8];
    expect(buildCandidatePageWindow(single, available)).toEqual([6, 7, 8]);
    expect(buildCandidatePageWindow(multi, available)).toEqual([6, 7, 8, 9]);
  });

  it('groups unresolved candidates with overlapping windows into one bounded request', () => {
    const pages = [6, 7, 8].map(page);
    const q18 = candidate(18);
    q18.sourcePages = [6, 7];
    const q19 = candidate(19);
    q19.sourcePages = [7];
    const q20 = candidate(20);
    q20.sourcePages = [8];
    const windows = buildVisualDetectionWindows(pages, [q18, q19, q20]);
    expect(windows).toHaveLength(1);
    expect(windows[0].pageNumbers).toEqual([6, 7, 8]);
    expect(windows[0].candidates).toHaveLength(3);
  });

  it('does not select text-only or already-attached candidates', () => {
    const textOnly = candidate(1, 'Tính đạo hàm của hàm số.');
    textOnly.fieldConfidence.asset = 'HIGH';
    textOnly.warnings = [];
    expect(isUnresolvedVisualCandidate(textOnly, [page(1)])).toBe(false);

    const attached = candidate(2);
    attached.orderedContent = [
      {
        id: 'image',
        type: 'IMAGE',
        media: {
          assetId: 'existing',
          alt: 'existing',
          sourcePage: 2,
          sourceRegion: { x: 0, y: 0, width: 0.5, height: 0.5 },
        },
      },
    ];
    expect(isUnresolvedVisualCandidate(attached, [page(2)])).toBe(false);
  });

  it('converts the 0..1000 vision box exactly to normalized coordinates', () => {
    expect(visionBoxToNormalizedRegion({ ymin: 250, xmin: 125, ymax: 750, xmax: 875 })).toEqual({
      x: 0.125,
      y: 0.25,
      width: 0.75,
      height: 0.5,
    });
  });

  it('rejects invalid and unrelated detections and retains review for ambiguous/not-found', () => {
    const q = candidate(19);
    const rasters = new Set([7, 8]);
    expect(
      validateVisualDetection(q, [7, 8], { ...detected(99, 8), questionNumber: 99 }, rasters)
        .decision
    ).toBe('REJECT');
    expect(
      validateVisualDetection(
        q,
        [7, 8],
        {
          ...detected(19, 8),
          visuals: [
            {
              ...detected(19, 8).visuals[0],
              box2d: { ymin: 500, xmin: 600, ymax: 400, xmax: 500 },
            },
          ],
        },
        rasters
      ).decision
    ).toBe('REJECT');
    expect(
      validateVisualDetection(
        q,
        [7, 8],
        { questionNumber: 19, status: 'NOT_FOUND', visuals: [] },
        rasters
      ).decision
    ).toBe('REVIEW');
    expect(
      validateVisualDetection(
        q,
        [7, 8],
        { questionNumber: 19, status: 'AMBIGUOUS', visuals: [] },
        rasters
      ).decision
    ).toBe('REVIEW');
  });

  it('batches shared pages into one provider call', async () => {
    const pages = [page(6), page(7), page(8)];
    const q18 = candidate(18);
    q18.sourcePages = [6, 7];
    const q19 = candidate(19);
    q19.sourcePages = [7];
    generateContent.mockResolvedValue({
      text: JSON.stringify({ results: [detected(18, 7), detected(19, 8)] }),
    });
    const result = await detectMissingQuestionVisuals(pages, [q18, q19]);
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(result.detections.map((item) => item.decision)).toEqual(['AUTO_ATTACH', 'AUTO_ATTACH']);
  });

  it('contains provider failure and leaves the window reviewable', async () => {
    generateContent.mockResolvedValue({ text: '' });
    const result = await detectMissingQuestionVisuals([page(1), page(2)], [candidate(1)]);
    expect(result.detections).toEqual([]);
    expect(result.failedWindows).toEqual([[1, 2]]);
  });
});

describe('deterministic detected-region attachment', () => {
  it('crops a graph from the adjacent page and persists it through visualCrops', async () => {
    const pages = [page(7), page(8)];
    const q = candidate(19, 'Cho hàm số có đồ thị như hình vẽ sau:\nHàm số đã cho đồng biến?');
    q.sourcePages = [7];
    const validation = validateVisualDetection(q, [6, 7, 8], detected(19, 8), new Set([7, 8]));
    const result = await attachDetectedQuestionVisuals(pages, [q], [validation]);

    expect(result[0].mediaCandidates?.[0]).toMatchObject({
      sourcePage: 8,
      sourceRegion: { x: 0.1, y: 0.2, width: 0.5, height: 0.5 },
      confidence: 'HIGH',
    });
    expect(result[0].orderedContent?.map((block) => block.type)).toEqual(['TEXT', 'IMAGE', 'TEXT']);
    expect(result[0].warnings.some((warning) => warning.code === 'MISSING_ASSET')).toBe(false);
    expect(pages[1].visualCrops).toHaveLength(1);
    expect(pages[1].visualCrops?.[0]).toMatchObject({
      width: 100,
      height: 50,
      sourceRegion: { x: 0.1, y: 0.2, width: 0.5, height: 0.5 },
    });
    expect(pages[1].visualCrops?.[0].bytes.length).toBeGreaterThan(0);
  });

  it('does not attach rejected, ambiguous, or not-found regions', async () => {
    const q = candidate(19);
    const pages = [page(7), page(8)];
    const outcomes = [
      validateVisualDetection(
        q,
        [7, 8],
        { questionNumber: 19, status: 'AMBIGUOUS', visuals: [] },
        new Set([7, 8])
      ),
      validateVisualDetection(
        q,
        [7, 8],
        { questionNumber: 19, status: 'NOT_FOUND', visuals: [] },
        new Set([7, 8])
      ),
    ];
    const result = await attachDetectedQuestionVisuals(pages, [q], outcomes);
    expect(result[0].mediaCandidates).toBeUndefined();
    expect(result[0].reviewLevel).toBe('BLOCKING');
    expect(pages.flatMap((item) => item.visualCrops ?? [])).toEqual([]);
  });

  it('is idempotent when a candidate already contains an image', async () => {
    const q = candidate(19);
    q.mediaCandidates = [
      {
        id: 'existing',
        alt: 'existing',
        sourcePage: 7,
        sourceRegion: { x: 0, y: 0, width: 0.5, height: 0.5 },
        confidence: 'HIGH',
      },
    ];
    q.orderedContent = [
      {
        id: 'image-existing',
        type: 'IMAGE',
        media: {
          assetId: 'existing',
          alt: 'existing',
          sourcePage: 7,
          sourceRegion: { x: 0, y: 0, width: 0.5, height: 0.5 },
        },
      },
    ];
    const pages = [page(7), page(8)];
    const validation = validateVisualDetection(q, [7, 8], detected(19, 8), new Set([7, 8]));
    await attachDetectedQuestionVisuals(pages, [q], [validation]);
    expect(q.mediaCandidates).toHaveLength(1);
    expect(pages[1].visualCrops).toBeUndefined();
  });
});

describe('existing deterministic media fast path regressions', () => {
  it.each([
    ['variation table', 'Dựa vào bảng biến thiên dưới đây.', ['x  -∞  0  +∞', "f'(x)  +  0  -"]],
    ['graph', 'Cho hàm số có đồ thị như hình vẽ sau:', []],
    [
      'text-heavy sign table',
      'Dựa vào bảng xét dấu sau:',
      ['x  -∞  -1  2  +∞', 'f(x)  +  0  -  0  +'],
    ],
  ])('keeps the same-page %s attached', async (_name, cue, visualText) => {
    const q = candidate(1, `${cue}\nChọn khẳng định đúng.`);
    q.sourcePages = [1];
    const layoutLines = [
      { text: cue, x: 10, y: 5, width: 80, height: 5 },
      ...visualText.map((text, index) => ({
        text,
        x: 15,
        y: 25 + index * 8,
        width: 70,
        height: 5,
      })),
      { text: 'Chọn khẳng định đúng.', x: 10, y: 70, width: 80, height: 5 },
    ];
    const pages: ExtractedDocumentPage[] = [
      { ...page(1), text: layoutLines.map((line) => line.text).join('\n'), layoutLines },
    ];
    const result = await enrichPdfCandidatesWithMedia(pages, [q]);
    expect(result[0].orderedContent?.filter((block) => block.type === 'IMAGE')).toHaveLength(1);
    expect(result[0].mediaCandidates).toHaveLength(1);
    expect(pages[0].visualCrops?.[0].bytes.length).toBeGreaterThan(0);
  });
});
