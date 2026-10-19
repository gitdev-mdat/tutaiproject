import 'server-only';

import { createHash } from 'node:crypto';
import { GEMINI_MODELS } from '@/lib/config/models';
import { mapPrintedPage, normalizedHeading } from './page-mapping';
import { renderPdfPages } from './pdf-pages';
import type { VisionProvider } from './vision-provider';
import { visionProviderFor } from './vision-provider';
import type { TextbookDocumentRecord, TextbookExtractionJob, TextbookTocEntry } from './types';

export const TOC_PROMPT_VERSION = 'textbook-toc-v1';
export const MAX_TOC_PAGES = 4;

const TOC_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['entries'],
  properties: {
    entries: {
      type: 'array',
      maxItems: 250,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['heading', 'level', 'printedPage'],
        properties: {
          heading: { type: 'string' },
          level: { type: 'integer' },
          printedPage: { type: 'integer' },
        },
      },
    },
  },
} as const;

export function tocJobKey(document: Pick<TextbookDocumentRecord, 'sha256'>, tocPdfPages: number[]) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        source: document.sha256,
        tocPdfPages,
        prompt: TOC_PROMPT_VERSION,
        model: GEMINI_MODELS.tocDetection,
      })
    )
    .digest('hex');
}

interface RawTocEntry {
  heading: string;
  level: number;
  printedPage: number | null;
}

/**
 * Turns headings read from a printed table of contents into a section tree.
 * Parents come from heading levels; a section ends where the next section of
 * the same or a higher level begins.
 */
export function buildTocEntries(
  raw: RawTocEntry[],
  document: Pick<TextbookDocumentRecord, 'anchors' | 'pageLayout'>
): TextbookTocEntry[] {
  const clean = raw
    .map((item) => ({
      heading: item.heading.replace(/\s*\.{3,}\s*\d*\s*$/, '').replace(/\s+/g, ' ').trim(),
      level: Math.min(Math.max(Math.round(item.level) || 1, 1), 6),
      printedPage: item.printedPage && item.printedPage > 0 ? Math.round(item.printedPage) : null,
    }))
    .filter((item) => item.heading.length > 0);
  const stack: Array<{ id: string; level: number }> = [];
  return clean.map((item, index) => {
    while (stack.length && stack[stack.length - 1].level >= item.level) stack.pop();
    const id = `toc-${index + 1}`;
    const parentId = stack[stack.length - 1]?.id ?? null;
    stack.push({ id, level: item.level });
    const next = clean
      .slice(index + 1)
      .find((candidate) => candidate.level <= item.level && candidate.printedPage !== null);
    const start = item.printedPage;
    const end = start !== null && next?.printedPage ? Math.max(start, next.printedPage - 1) : null;
    return {
      id,
      parentId,
      originalHeading: item.heading,
      normalizedHeading: normalizedHeading(item.heading),
      level: item.level,
      printedStartPage: start,
      printedEndPage: end,
      locations: start !== null ? [mapPrintedPage(start, document.anchors, document.pageLayout)] : [],
      status: 'OBSERVED',
    };
  });
}

/** Reads the printed table of contents from the chosen PDF pages with one provider call. */
export async function runTocJob(
  job: TextbookExtractionJob,
  document: TextbookDocumentRecord,
  pdf: Buffer,
  provider: VisionProvider = visionProviderFor()
) {
  const pages = job.tocPdfPages ?? [];
  if (!pages.length || pages.length > MAX_TOC_PAGES)
    throw new Error(`Choose 1 to ${MAX_TOC_PAGES} PDF pages that hold the table of contents.`);
  const images = await renderPdfPages(pdf, pages);
  const response = await provider({
    model: GEMINI_MODELS.tocDetection,
    prompt: [
      `Các ảnh đính kèm là ${pages.length} trang mục lục của một cuốn sách giáo khoa/tham khảo tiếng Việt, theo đúng thứ tự.`,
      'Chép lại MỌI dòng mục lục theo thứ tự xuất hiện. Bỏ qua nội dung không thuộc mục lục (ví dụ danh sách trường, lời cảm ơn).',
      'heading: nguyên văn tiêu đề, giữ số thứ tự (ví dụ "I.I. Tính đơn điệu của hàm số", "Dạng 1: ..."); bỏ dãy dấu chấm và số trang. Một tiêu đề xuống dòng thì ghép thành một.',
      'level: cấp lùi đầu dòng, 1 là cấp ngoài cùng (Chủ đề/Chương), tăng dần theo mức thụt lề.',
      'printedPage: số trang in ở cuối dòng. Không đọc được thì trả 0. Không tự suy đoán.',
      'Công thức trong tiêu đề viết bằng LaTeX trong $...$.',
    ].join('\n'),
    images: images.map((image) => image.bytes),
    schema: TOC_RESPONSE_SCHEMA,
  });
  const parsed = JSON.parse(
    response.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  ) as { entries?: RawTocEntry[] };
  if (!Array.isArray(parsed.entries) || parsed.entries.length === 0)
    throw new Error('No table-of-contents lines were read from the selected pages.');
  return {
    entries: buildTocEntries(parsed.entries, document),
    usage: response.usage,
  };
}
