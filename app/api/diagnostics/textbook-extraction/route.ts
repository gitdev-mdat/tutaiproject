// TEMPORARY diagnostic route for the pages 19–20 regression. Never merged; deleted with its branch.
// Read-only: no database access, no storage writes. Token-guarded.
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { GEMINI_MODELS } from '@/lib/config/models';
import { splitNumberedArtifacts } from '@/lib/textbook-reference/artifact-linking';
import {
  buildExtractionPrompt,
  classifyOutcome,
  exerciseSetFor,
  parseExtractionResponse,
  TEXTBOOK_RESPONSE_SCHEMA,
  validateItem,
} from '@/lib/textbook-reference/extraction-response';
import { mapPrintedPage } from '@/lib/textbook-reference/page-mapping';
import { renderPrintedPageCrops } from '@/lib/textbook-reference/pdf-pages';
import { geminiVisionProvider } from '@/lib/textbook-reference/vision-provider';
import type { TextbookTocEntry } from '@/lib/textbook-reference/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

const TOKEN_SHA256 = '4ad97f2971f16f69c26d4eaa177a70ae6421df696d5e5cb794509e66c0c55896';
const FUNCTION_URL = 'https://izxaydrlsdwvycfmjwuj.supabase.co/functions/v1/tmp-textbook-signed-url';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6eGF5ZHJsc2R3dnljZm1qd3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5MjU0NTIsImV4cCI6MjEwNjUwMTQ1Mn0.uaU8Ri2RRF9Ajmrrxd1vcd7Jt72_RziH4vZe4g8vzpU';
const DOCUMENT_ID = 'textbook-28823755f9b0448a';
const ANCHORS = [
  { printedPage: 13, pdfPage: 7, position: 'RIGHT' as const, evidence: '' },
  { printedPage: 39, pdfPage: 20, position: 'RIGHT' as const, evidence: '' },
];
const toc = (
  id: string,
  level: number,
  parentId: string | null,
  heading: string,
  start: number,
  end: number
) =>
  ({
    id,
    level,
    parentId,
    originalHeading: heading,
    normalizedHeading: heading.toLowerCase(),
    printedStartPage: start,
    printedEndPage: end,
    status: 'OBSERVED',
    locations: [],
  }) as unknown as TextbookTocEntry;
const TOC = [
  toc('toc-1', 1, null, 'Chủ đề 1: Hàm số và các ứng dụng của đạo hàm', 13, 136),
  toc('toc-2', 2, 'toc-1', 'I.I. Tính đơn điệu của hàm số', 13, 33),
  toc('toc-3', 3, 'toc-2', 'A. Lý thuyết', 13, 13),
  toc('toc-4', 3, 'toc-2', 'B. Bài tập trong các đề thi thử của các trường', 14, 33),
  toc('toc-5', 4, 'toc-4', 'Dạng 1: Bài toán không chứa tham số', 14, 18),
  toc('toc-6', 4, 'toc-4', 'Bài tập rèn luyện kỹ năng', 19, 20),
  toc('toc-7', 4, 'toc-4', 'Dạng 2: Bài toán chứa tham số', 21, 27),
  toc('toc-8', 4, 'toc-4', 'Bài tập rèn luyện kỹ năng', 28, 28),
  toc('toc-9', 4, 'toc-4', 'Hướng dẫn giải chi tiết', 29, 33),
];

const sha = (text: string) => createHash('sha256').update(text).digest('hex');

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('t') ?? '';
  if (sha(token) !== TOKEN_SHA256) return new NextResponse('Forbidden', { status: 403 });
  const entry = TOC.find((item) => item.id === (url.searchParams.get('entry') ?? 'toc-6'))!;
  const pages = (url.searchParams.get('pages') ?? '19,20').split(',').map(Number);
  if (pages.length > 6 || pages.some((page) => page < entry.printedStartPage! || page > entry.printedEndPage!))
    return NextResponse.json({ error: 'pages outside entry' }, { status: 400 });
  const start = Date.now();
  const signed = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ANON}`, 'x-diagnostic-token': token },
  });
  if (!signed.ok) return NextResponse.json({ error: `sign ${signed.status}` }, { status: 502 });
  const pdf = new Uint8Array(await (await fetch((await signed.json()).url)).arrayBuffer());
  const locations = pages.map((page) => mapPrintedPage(page, ANCHORS, 'TWO_UP'));
  const images = await renderPrintedPageCrops(pdf, locations as never);
  const image = url.searchParams.get('image');
  if (image !== null && url.searchParams.get('b64'))
    return NextResponse.json({ b64: images[Number(image)].bytes.toString('base64') });
  if (image !== null)
    return new NextResponse(new Uint8Array(images[Number(image)].bytes), {
      headers: { 'content-type': 'image/png' },
    });
  const exerciseSet = exerciseSetFor(entry, TOC);
  const chapter = TOC.find((item) => item.id === exerciseSet.chapterEntryId);
  const prompt = buildExtractionPrompt({
    pages,
    headings: [entry.originalHeading],
    chapterHeading: chapter?.originalHeading ?? null,
    problemType: exerciseSet.problemType,
  });
  const variant = url.searchParams.get('schema') ?? 'full';
  const schema = JSON.parse(JSON.stringify(TEXTBOOK_RESPONSE_SCHEMA));
  const itemProps = schema.properties.items.items.properties;
  if (variant === 'nochoices') delete itemProps.choices;
  if (variant === 'nomax') {
    delete schema.properties.items.maxItems;
    delete itemProps.choices.maxItems;
  }
  if (variant === 'noenum') {
    delete schema.properties.pages.items.properties.status.enum;
    delete itemProps.choices.items.properties.label.enum;
  }
  let response;
  try {
    response = await geminiVisionProvider({
      model: url.searchParams.get('model') ?? GEMINI_MODELS.batchExtraction,
      prompt,
      images: url.searchParams.get('noimages') ? [] : images.map((item) => item.bytes),
      schema,
      maxOutputTokens: Number(url.searchParams.get('tokens') ?? 32768),
      allowTruncated: true,
    });
  } catch (error) {
    return NextResponse.json({
      providerError: String((error as Error).message),
      variant,
      images: images.map(({ bytes, ...rest }) => ({ ...rest, pngBytes: bytes.length })),
      promptChars: prompt.length,
      durationMs: Date.now() - start,
    });
  }
  const truncated = response.finishReason === 'MAX_TOKENS';
  const parsed = parseExtractionResponse(response.text, { truncated, pages });
  const createdAt = new Date().toISOString();
  const results = (parsed.items ?? []).map((raw, index) =>
    validateItem(raw, index, {
      documentId: DOCUMENT_ID,
      entryId: entry.id,
      extractionKey: `diag-${entry.id}-${pages.join('-')}`,
      pages,
      pdfPageOf: (page) => mapPrintedPage(page, ANCHORS, 'TWO_UP').pdfPage,
      exerciseSet,
      createdAt,
    })
  );
  const accepted = splitNumberedArtifacts(results.flatMap((r) => (r.ok ? [r.artifact] : [])));
  const rejected = results.flatMap((r) => (r.ok ? [] : [r]));
  return NextResponse.json({
    model: GEMINI_MODELS.batchExtraction,
    pages,
    entry: entry.id,
    exerciseSet,
    images: images.map(({ bytes, ...rest }) => ({ ...rest, pngBytes: bytes.length })),
    finishReason: response.finishReason,
    usage: response.usage,
    responseChars: response.text.length,
    outcome: classifyOutcome({
      accepted: accepted.length,
      rejected: rejected.length,
      partialItems: results.filter((r) => r.ok && r.partial).length,
      truncated: parsed.truncated,
      pages: parsed.pages,
      unreadable: parsed.unreadable.length,
    }),
    pageReports: parsed.pages,
    unreadable: parsed.unreadable,
    rejected,
    accepted,
    rawText: response.text,
    durationMs: Date.now() - start,
  });
}
