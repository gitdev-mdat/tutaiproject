import type { TextbookDocumentRecord, TextbookExtractionJob } from './types';

/**
 * One status line for a book, derived from persisted facts only: the book's
 * row and its newest file-check / table-of-contents job. A queued job reads as
 * waiting (never as running), a running job as running until its result is
 * saved, and a failure keeps its real reason. Nothing here estimates progress.
 */
export type BookStateKey =
  | 'CHECK_WAITING'
  | 'CHECK_RUNNING'
  | 'FILE_FAILED'
  | 'NEEDS_SETUP'
  | 'READY_TO_READ'
  | 'TOC_WAITING'
  | 'TOC_RUNNING'
  | 'INTERRUPTED'
  | 'TOC_FAILED'
  | 'TOC_READY';

export type BookStateTone = 'waiting' | 'working' | 'attention' | 'error' | 'success' | 'neutral';

export interface BookState {
  key: BookStateKey;
  /** Short label for lists. */
  label: string;
  /** Headline of the status card. */
  title: string;
  /** One or two plain sentences: what is happening or what to do next. */
  description: string;
  tone: BookStateTone;
  /** True while the server is still expected to change state on its own. */
  active: boolean;
  /** The job behind this state, for the diagnostics section. */
  job: TextbookExtractionJob | null;
  /** A failed re-read of an existing outline: the old outline is kept. */
  previousTocKept?: boolean;
}

type BookFacts = Pick<
  TextbookDocumentRecord,
  'status' | 'anchors' | 'tocPdfPages' | 'processingErrors' | 'tocIndexCompleteness'
> & { tocEntryCount: number };

function pages(job: TextbookExtractionJob | null) {
  const list = job?.tocPdfPages ?? [];
  return list.length ? `trang PDF ${list.join(', ')}` : 'các trang mục lục đã chọn';
}

export function bookState(
  book: BookFacts,
  setupJob: TextbookExtractionJob | null | undefined,
  now = Date.now()
): BookState {
  const job = setupJob ?? null;
  const hasToc = book.tocEntryCount > 0;
  const checking = job?.kind === 'VERIFY';

  if (job?.status === 'RUNNING' && job.leaseUntil && new Date(job.leaseUntil).getTime() < now)
    return {
      key: 'INTERRUPTED',
      label: 'Bị gián đoạn',
      title: checking ? 'Kiểm tra tệp bị gián đoạn' : 'Đọc mục lục bị gián đoạn',
      description:
        'Lần chạy trước dừng giữa chừng và chưa lưu gì. Hệ thống tự chạy lại khi trang này đang mở.',
      tone: 'attention',
      active: true,
      job,
    };
  if (job?.status === 'QUEUED')
    return checking
      ? {
          key: 'CHECK_WAITING',
          label: 'Chờ kiểm tra tệp',
          title: 'Đang chờ kiểm tra tệp',
          description: 'Tệp đã tải lên đủ. Việc kiểm tra sẽ bắt đầu trong giây lát.',
          tone: 'waiting',
          active: true,
          job,
        }
      : {
          key: 'TOC_WAITING',
          label: 'Chờ đọc mục lục',
          title: 'Đang chờ đọc mục lục',
          description: `Yêu cầu đã được ghi nhận, AI chưa bắt đầu đọc. Khi bắt đầu, AI chỉ đọc ${pages(job)}.`,
          tone: 'waiting',
          active: true,
          job,
        };
  if (job?.status === 'RUNNING')
    return checking
      ? {
          key: 'CHECK_RUNNING',
          label: 'Đang kiểm tra tệp',
          title: 'Đang kiểm tra tệp',
          description: 'Đang mở tệp đã lưu, đối chiếu mã kiểm tra và đếm số trang.',
          tone: 'working',
          active: true,
          job,
        }
      : {
          key: 'TOC_RUNNING',
          label: 'Đang đọc mục lục',
          title: 'AI đang đọc mục lục',
          description: `AI đang đọc ${pages(job)} trong một lượt duy nhất, nên không có phần trăm tiến độ. Thường xong trong khoảng 1–2 phút.`,
          tone: 'working',
          active: true,
          job,
        };

  if (book.status === 'FAILED')
    return {
      key: 'FILE_FAILED',
      label: 'Tệp lỗi',
      title: 'Không dùng được tệp này',
      description:
        book.processingErrors.at(-1) ?? 'Tệp đã lưu không đọc được. Tải tệp lên lại để thay.',
      tone: 'error',
      active: false,
      job,
    };
  if (book.status === 'VERIFYING')
    return {
      key: 'CHECK_WAITING',
      label: 'Chờ kiểm tra tệp',
      title: 'Đang chờ kiểm tra tệp',
      description: 'Tệp đã tải lên đủ. Việc kiểm tra sẽ bắt đầu trong giây lát.',
      tone: 'waiting',
      active: true,
      job,
    };

  if (job?.kind === 'INDEX_TOC' && job.status === 'FAILED')
    return {
      key: 'TOC_FAILED',
      label: hasToc ? 'Có mục lục' : 'Đọc mục lục thất bại',
      title: hasToc ? 'Lần đọc lại mục lục thất bại' : 'Chưa đọc được mục lục',
      description: hasToc
        ? `${job.error ?? 'Lỗi không xác định.'} Mục lục hiện có vẫn được giữ nguyên.`
        : (job.error ?? 'Lỗi không xác định.'),
      tone: hasToc ? 'attention' : 'error',
      active: false,
      job,
      previousTocKept: hasToc,
    };

  if (hasToc)
    return {
      key: 'TOC_READY',
      label: 'Có mục lục',
      title: `Đã có mục lục (${book.tocEntryCount} mục)`,
      description:
        book.tocIndexCompleteness === 'COMPLETE'
          ? 'Mục lục đã được kiểm tra. Có thể liên kết mục với bài học.'
          : 'AI đã đọc xong. Hãy rà lại tên mục và số trang trước khi liên kết với bài học.',
      tone: 'success',
      active: false,
      job,
    };

  const configured = (book.tocPdfPages?.length ?? 0) > 0 && book.anchors.length >= 2;
  return configured
    ? {
        key: 'READY_TO_READ',
        label: 'Sẵn sàng đọc mục lục',
        title: 'Sẵn sàng đọc mục lục',
        description: 'Thiết lập trang đã lưu. Bấm Đọc mục lục để AI đọc các trang mục lục.',
        tone: 'neutral',
        active: false,
        job,
      }
    : {
        key: 'NEEDS_SETUP',
        label: 'Cần thiết lập trang',
        title: 'Cần thiết lập trang',
        description:
          'Cho biết cách quét (một hay hai trang sách trên một trang PDF), hai mốc số trang và các trang có mục lục.',
        tone: 'neutral',
        active: false,
        job,
      };
}
