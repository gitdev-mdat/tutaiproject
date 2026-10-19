import { mapPrintedPage, normalizedHeading } from '@/lib/textbook-reference/page-mapping';
import {
  readTextbookStore,
  registerTextbook,
  writeTextbookStore,
} from '@/lib/textbook-reference/repository';
import type { TextbookAnchor, TextbookTocEntry } from '@/lib/textbook-reference/types';

const source = process.argv[2];
if (!source)
  throw new Error(
    'Usage: pnpm exec tsx --conditions=react-server scripts/textbooks/index-pilot.ts <pdf-path>'
  );

async function main() {
  const result = await registerTextbook(source, 'Công Phá Toán – Tập 3 – Ngọc Huyền LB');
  const store = await readTextbookStore();
  const document = store.documents.find((item) => item.id === result.document.id)!;
  const anchors: TextbookAnchor[] = [
    {
      printedPage: 13,
      pdfPage: 7,
      position: 'RIGHT',
      evidence: 'Visually inspected: printed folio 13 on PDF page 7, right half.',
    },
    {
      printedPage: 29,
      pdfPage: 15,
      position: 'RIGHT',
      evidence: 'Visually inspected: printed folio 29 on PDF page 15, right half.',
    },
    {
      printedPage: 33,
      pdfPage: 17,
      position: 'RIGHT',
      evidence: 'Visually inspected: printed folio 33 on PDF page 17, right half.',
    },
    {
      printedPage: 34,
      pdfPage: 18,
      position: 'LEFT',
      evidence: 'Visually inspected section boundary: printed folio 34 on PDF page 18, left half.',
    },
  ];

  const toc: Array<{ parent: string | null; heading: string; level: number; start: number }> = [
    { parent: null, heading: 'Chủ đề 1: Hàm số và các ứng dụng của đạo hàm', level: 1, start: 13 },
    {
      parent: 'Chủ đề 1: Hàm số và các ứng dụng của đạo hàm',
      heading: 'I.I. Tính đơn điệu của hàm số',
      level: 2,
      start: 13,
    },
    { parent: 'I.I. Tính đơn điệu của hàm số', heading: 'A. Lý thuyết', level: 3, start: 13 },
    {
      parent: 'I.I. Tính đơn điệu của hàm số',
      heading: 'B. Bài tập trong các đề thi thử của các trường',
      level: 3,
      start: 14,
    },
    {
      parent: 'B. Bài tập trong các đề thi thử của các trường',
      heading: 'Dạng 1: Bài toán không chứa tham số',
      level: 4,
      start: 14,
    },
    {
      parent: 'Dạng 1: Bài toán không chứa tham số',
      heading: 'Bài tập rèn luyện kỹ năng',
      level: 5,
      start: 19,
    },
    {
      parent: 'B. Bài tập trong các đề thi thử của các trường',
      heading: 'Dạng 2: Bài toán chứa tham số',
      level: 4,
      start: 21,
    },
    {
      parent: 'Dạng 2: Bài toán chứa tham số',
      heading: 'Bài tập rèn luyện kỹ năng',
      level: 5,
      start: 28,
    },
    {
      parent: 'I.I. Tính đơn điệu của hàm số',
      heading: 'Hướng dẫn giải chi tiết',
      level: 3,
      start: 29,
    },
    {
      parent: 'Chủ đề 1: Hàm số và các ứng dụng của đạo hàm',
      heading: 'I.II. Cực trị của hàm số và giá trị lớn nhất, giá trị nhỏ nhất của hàm số',
      level: 2,
      start: 34,
    },
    {
      parent: null,
      heading: 'Chủ đề 2: Hàm số lũy thừa, hàm số mũ – hàm số logarit',
      level: 1,
      start: 137,
    },
    { parent: null, heading: 'Chủ đề 3: Nguyên hàm – tích phân và ứng dụng', level: 1, start: 190 },
    { parent: null, heading: 'Chủ đề 4: Số phức', level: 1, start: 225 },
    {
      parent: null,
      heading: 'Chủ đề 5: Khối đa diện và thể tích của một số khối đa diện quen thuộc',
      level: 1,
      start: 246,
    },
    { parent: null, heading: 'Chủ đề 6: Mặt cầu, mặt trụ, mặt nón', level: 1, start: 277 },
    {
      parent: null,
      heading: 'Chủ đề 7: Phương pháp tọa độ trong không gian',
      level: 1,
      start: 310,
    },
    { parent: null, heading: 'Chủ đề 8: Tổng ôn luyện', level: 1, start: 357 },
  ];
  const entries: TextbookTocEntry[] = toc.map((item, index) => {
    const next = toc.slice(index + 1).find((candidate) => candidate.level <= item.level);
    const end = next ? next.start - 1 : null;
    const id = `toc-${index + 1}`;
    return {
      id,
      parentId: item.parent
        ? toc.findIndex((candidate) => candidate.heading === item.parent) >= 0
          ? `toc-${toc.findIndex((candidate) => candidate.heading === item.parent) + 1}`
          : null
        : null,
      originalHeading: item.heading,
      normalizedHeading: normalizedHeading(item.heading),
      level: item.level,
      printedStartPage: item.start,
      printedEndPage: end,
      locations: [mapPrintedPage(item.start, anchors)],
      status: 'OBSERVED',
    };
  });

  document.anchors = anchors;
  document.tocEntries = entries;
  if (document.status === 'REGISTERED') document.status = 'INDEXED';
  await writeTextbookStore(store);
  console.log(
    JSON.stringify(
      {
        duplicate: result.duplicate,
        id: document.id,
        sha256: document.sha256,
        pageCount: document.pdfPageCount,
        scanDetection: result.scanDetection,
        tocEntries: entries.length,
        anchors: anchors.map(({ printedPage, pdfPage, position }) => ({
          printedPage,
          pdfPage,
          position,
        })),
      },
      null,
      2
    )
  );
}

void main();
