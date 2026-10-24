import type { TextbookJobErrorCode } from './types';

export interface JobErrorDescription {
  code: TextbookJobErrorCode;
  /** Plain Vietnamese for the Admin: what happened and what to do. */
  message: string;
  /** Short technical detail for the diagnostics section. Never contains credentials. */
  detail: string;
  /** Whether trying again without changing anything can succeed. */
  retryable: boolean;
}

const MESSAGES: Record<TextbookJobErrorCode, { message: string; retryable: boolean }> = {
  BILLING: {
    message:
      'Tài khoản Gemini đã hết tín dụng hoặc chưa bật thanh toán, nên AI chưa đọc được. Chủ tài khoản cần nạp thêm hoặc kiểm tra thanh toán trong Google AI Studio, rồi bấm Thử lại.',
    retryable: false,
  },
  QUOTA: {
    message: 'Gemini đang giới hạn số lượt dùng. Đợi vài phút rồi bấm Thử lại.',
    retryable: true,
  },
  AUTH: {
    message:
      'Khóa Gemini trên máy chủ không hợp lệ hoặc không có quyền dùng mô hình này. Cần kiểm tra lại khóa rồi mới thử lại.',
    retryable: false,
  },
  MODEL: {
    message: 'Mô hình Gemini đang cấu hình không dùng được. Cần đổi cấu hình mô hình.',
    retryable: false,
  },
  UNAVAILABLE: {
    message: 'Dịch vụ Gemini tạm thời gặp sự cố. Bấm Thử lại sau ít phút.',
    retryable: true,
  },
  TIMEOUT: { message: 'Gemini phản hồi quá lâu. Bấm Thử lại.', retryable: true },
  OUTPUT_LIMIT: {
    message:
      'Kết quả quá dài nên bị cắt giữa chừng. Thử chọn ít trang hơn (ví dụ từng trang mục lục).',
    retryable: false,
  },
  INTERRUPTED: {
    message: 'Việc xử lý bị gián đoạn nhiều lần nên đã dừng. Bấm Thử lại để chạy lại từ đầu.',
    retryable: true,
  },
  FILE: {
    message: 'Không đọc được tệp PDF đã lưu. Tải tệp lên lại.',
    retryable: false,
  },
  INVALID_RESPONSE: {
    message:
      'Gemini đã trả lời nhưng không có câu hỏi hay nội dung nào dùng được. Có thể thử lại một lần; nếu vẫn lỗi, trích từng trang một.',
    retryable: true,
  },
  UNREADABLE: {
    message:
      'Gemini không đọc được bản quét của các trang này. Kiểm tra mốc trang (đúng trang, đúng nửa trái/phải) và chất lượng bản quét; gửi lại y nguyên sẽ không giúp.',
    retryable: false,
  },
  UNKNOWN: {
    message: 'Xử lý thất bại vì một lỗi chưa phân loại. Xem “Chi tiết kỹ thuật”, rồi thử lại.',
    retryable: true,
  },
};

function fromHttp(code: number, status: string, text: string): TextbookJobErrorCode {
  const lower = text.toLowerCase();
  if (code === 402 || /billing|prepa(id|yment)|credit/.test(lower)) return 'BILLING';
  if (code === 429 || status === 'RESOURCE_EXHAUSTED') return 'QUOTA';
  if (code === 401 || code === 403 || status === 'PERMISSION_DENIED') return 'AUTH';
  if (code === 404 || status === 'NOT_FOUND') return 'MODEL';
  if (code === 400 && /api key/.test(lower)) return 'AUTH';
  if (code >= 500) return 'UNAVAILABLE';
  return 'UNKNOWN';
}

/**
 * Turns a provider or worker error into a stable class, a plain message and a
 * retry decision. Gemini errors arrive as `{"error":{"code","status","message"}}`
 * JSON in the message; an HTTP 402 is a billing problem that no retry fixes.
 */
export function describeJobError(error: unknown): JobErrorDescription {
  const raw = error instanceof Error ? error.message : String(error);
  let code: TextbookJobErrorCode = 'UNKNOWN';
  let detail = raw.slice(0, 300);
  try {
    const parsed = JSON.parse(raw) as {
      error?: { code?: number; status?: string; message?: string };
    };
    if (parsed.error?.code) {
      const { code: http, status = '', message = '' } = parsed.error;
      code = fromHttp(http, status, message);
      detail = `Gemini HTTP ${http}${status ? ` ${status}` : ''}${message ? `: ${message.slice(0, 200)}` : ''}`;
    }
  } catch {}
  if (code === 'UNKNOWN') {
    const known = (error as { code?: string; status?: number; name?: string } | null) ?? {};
    if (known.code === 'TIMEOUT') code = 'TIMEOUT';
    else if (known.code === 'INVALID_RESPONSE') code = 'INVALID_RESPONSE';
    else if (known.code === 'UNREADABLE') code = 'UNREADABLE';
    else if (known.code === 'INTERRUPTED') code = 'INTERRUPTED';
    else if (known.name === 'TextbookChecksumError') code = 'FILE';
    else if (typeof known.status === 'number') code = fromHttp(known.status, '', raw);
    else if (/output limit|cut off/i.test(raw)) code = 'OUTPUT_LIMIT';
  }
  const { message, retryable } = MESSAGES[code];
  return {
    code,
    // Provider internals stay in `detail` (the diagnostics view), never in the message.
    message,
    detail,
    retryable,
  };
}
