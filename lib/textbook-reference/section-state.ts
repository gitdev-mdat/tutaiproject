import { entryWithDescendants, mappingSpan, type PageSpan } from './lesson-coverage';
import type {
  TextbookArtifact,
  TextbookExtractionJob,
  TextbookKnowledgeMapping,
  TextbookTocEntry,
} from './types';

/**
 * Where one linked book section stands on the way to AI drafting, from stored
 * facts only: its extraction jobs and its extracted artifacts. Linked is not
 * extracted, extracted is not approved, and only approved material reaches AI.
 */
export type SectionStateKey =
  | 'LINKED' // linked, no page extracted yet
  | 'WAITING' // an extraction is queued, not started
  | 'EXTRACTING' // an extraction is running
  | 'FAILED' // the newest extraction failed and nothing is waiting for review
  | 'NEEDS_REVIEW' // extracted, nothing approved yet
  | 'READY' // at least one approved extract: AI can use it
  | 'NOTHING_USABLE'; // everything extracted was rejected, or pages held nothing

export interface SectionState {
  key: SectionStateKey;
  label: string;
  /** What the Admin does next, in one sentence. */
  next: string;
  tone: 'neutral' | 'waiting' | 'working' | 'attention' | 'error' | 'success';
  span: PageSpan | null;
  approved: number;
  needsReview: number;
  rejected: number;
  /** Printed pages that were read by a finished extraction or yielded an artifact. */
  extractedPages: number[];
  /** Pages of the linked range not read yet (null when the range is unknown). */
  remainingPages: number[] | null;
  activeJob: TextbookExtractionJob | null;
  failedJob: TextbookExtractionJob | null;
}

export function jobsForSection(
  jobs: TextbookExtractionJob[],
  documentId: string,
  coveredEntryIds: Set<string>
) {
  return jobs.filter(
    (job) =>
      job.kind === 'EXTRACT' &&
      job.documentId === documentId &&
      job.entryIds.some((id) => coveredEntryIds.has(id))
  );
}

const pageList = (pages: number[]) => {
  if (!pages.length) return '';
  const runs: string[] = [];
  let start = pages[0];
  let previous = pages[0];
  for (const page of [...pages.slice(1), Number.NaN]) {
    if (page === previous + 1) {
      previous = page;
      continue;
    }
    runs.push(start === previous ? `${start}` : `${start}–${previous}`);
    start = page;
    previous = page;
  }
  return `tr. ${runs.join(', ')}`;
};
export { pageList as formatPageList };

export function sectionState(input: {
  documentId: string;
  mapping: Pick<TextbookKnowledgeMapping, 'printedStartPage' | 'printedEndPage'>;
  entry: TextbookTocEntry;
  tocEntries: TextbookTocEntry[];
  /** Artifacts of this section already limited to the link's pages. */
  artifacts: Pick<TextbookArtifact, 'reviewStatus' | 'printedPages'>[];
  /** Extraction jobs of this lesson, newest first. */
  jobs: TextbookExtractionJob[];
}): SectionState {
  const covered = entryWithDescendants(input.tocEntries, input.entry.id);
  const span = mappingSpan(input.mapping, input.entry);
  const jobs = jobsForSection(input.jobs, input.documentId, covered);
  const inSpan = (page: number) => !span || (page >= span.start && page <= span.end);
  const approved = input.artifacts.filter((item) => item.reviewStatus === 'APPROVED').length;
  const needsReview = input.artifacts.filter((item) => item.reviewStatus === 'NEEDS_REVIEW').length;
  const rejected = input.artifacts.filter((item) => item.reviewStatus === 'REJECTED').length;
  const extracted = new Set<number>();
  for (const artifact of input.artifacts)
    artifact.printedPages.forEach((page) => extracted.add(page));
  for (const job of jobs)
    if (job.status === 'COMPLETED') job.printedPages.forEach((page) => extracted.add(page));
  const extractedPages = [...extracted].filter(inSpan).sort((a, b) => a - b);
  const remainingPages = span
    ? Array.from({ length: span.end - span.start + 1 }, (_, index) => span.start + index).filter(
        (page) => !extracted.has(page)
      )
    : null;
  const activeJob =
    jobs.find((job) => job.status === 'RUNNING') ??
    jobs.find((job) => job.status === 'QUEUED') ??
    null;
  const newest = jobs[0] ?? null;
  const failedJob = newest?.status === 'FAILED' ? newest : null;
  const base = {
    span,
    approved,
    needsReview,
    rejected,
    extractedPages,
    remainingPages,
    activeJob,
    failedJob,
  };
  const reviewNext = needsReview > 0 ? ` ${needsReview} trích đoạn khác đang chờ duyệt.` : '';

  if (approved > 0)
    return {
      ...base,
      key: 'READY',
      tone: 'success',
      label: `Sẵn sàng cho AI · ${approved} đã duyệt`,
      next: `AI soạn nháp sẽ dùng ${approved} trích đoạn đã duyệt của mục này.${reviewNext}`,
    };
  if (activeJob)
    return {
      ...base,
      key: activeJob.status === 'RUNNING' ? 'EXTRACTING' : 'WAITING',
      tone: activeJob.status === 'RUNNING' ? 'working' : 'waiting',
      label:
        activeJob.status === 'RUNNING'
          ? `Đang trích ${pageList(activeJob.printedPages)}`
          : `Chờ xử lý ${pageList(activeJob.printedPages)}`,
      next:
        needsReview > 0
          ? `Có thể duyệt ${needsReview} trích đoạn đã có trong khi chờ.`
          : 'Kết quả sẽ hiện ở đây để duyệt; AI chưa dùng gì của mục này.',
    };
  if (needsReview > 0)
    return {
      ...base,
      key: 'NEEDS_REVIEW',
      tone: 'attention',
      label: `Đã trích, chờ duyệt · ${needsReview}`,
      next: 'Đọc và duyệt trích đoạn bên dưới. AI chỉ dùng trích đoạn đã duyệt.',
    };
  if (failedJob)
    return {
      ...base,
      key: 'FAILED',
      tone: 'error',
      label: 'Trích xuất lỗi',
      next:
        failedJob.retryable === false
          ? `${failedJob.error ?? 'Lần trích gần nhất bị lỗi.'} Thử lại chưa giúp được cho đến khi cấu hình được sửa.`
          : `${failedJob.error ?? 'Lần trích gần nhất bị lỗi.'} Có thể thử lại.`,
    };
  if (extractedPages.length > 0)
    return {
      ...base,
      key: 'NOTHING_USABLE',
      tone: 'neutral',
      label: rejected > 0 ? 'Không có trích đoạn dùng được' : 'Không tìm thấy nội dung',
      next:
        rejected > 0
          ? 'Mọi trích đoạn đã bị loại. Trích trang khác hoặc duyệt lại một trích đoạn.'
          : `Đã đọc ${pageList(extractedPages)} nhưng không có nội dung để trích. Thử trang khác.`,
    };
  return {
    ...base,
    key: 'LINKED',
    tone: 'neutral',
    label: 'Mới liên kết, chưa trích trang nào',
    next: 'Chọn trang và bấm “Trích xuất”. Liên kết thôi chưa cho AI đọc được nội dung sách.',
  };
}
