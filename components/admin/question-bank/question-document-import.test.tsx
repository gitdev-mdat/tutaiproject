import { describe, expect, it } from 'vitest';
import { FILTER_LABELS, formatUserFacingWarnings } from './question-document-import';

describe('question-document-import unit tests', () => {
  it('translates technical visual recovery / OCR warnings into user-friendly Vietnamese text', () => {
    const rawWarnings = [
      'Gemini visual recovery applied on page 2',
      'Low text OCR density detected in table',
      'Processing duration elapsed: 12000ms',
      'Cảnh báo chung từ hệ thống',
    ];

    const formatted = formatUserFacingWarnings(rawWarnings);

    expect(formatted).toContain(
      'Hệ thống đã tự động quét và phục hồi bố cục nâng cao từ tài liệu. Vui lòng đối chiếu với bản gốc bên phải.'
    );
    expect(formatted).toContain(
      'Một số trang có chất lượng nhận diện chữ chưa tối ưu. Vui lòng kiểm tra lại công thức và nội dung.'
    );
    expect(formatted).toContain(
      'Thời gian xử lý tài liệu kéo dài hơn dự kiến. Các câu hỏi đã được trích xuất hoàn tất.'
    );
    expect(formatted).toContain('Cảnh báo chung từ hệ thống');
  });

  it('deduplicates recurring warnings into single user-facing messages', () => {
    const rawWarnings = [
      'Gemini visual recovery applied on page 2',
      'Gemini visual recovery applied on page 3',
      'Low text OCR density detected in table',
      'OCR quality low in region',
      'Processing duration elapsed: 12000ms',
    ];

    const formatted = formatUserFacingWarnings(rawWarnings);

    // Should collapse similar technical warnings into one user-facing message each
    expect(formatted.length).toBeLessThan(rawWarnings.length);
    expect(formatted.filter((w) => w.includes('phục hồi bố cục nâng cao')).length).toBe(1);
    expect(formatted.filter((w) => w.includes('chất lượng nhận diện chữ')).length).toBe(1);
  });

  it('handles empty warnings list safely', () => {
    expect(formatUserFacingWarnings([])).toEqual([]);
  });

  it('exports correct review filter labels', () => {
    expect(FILTER_LABELS.ALL).toBe('Tất cả');
    expect(FILTER_LABELS.READY).toBe('Sẵn sàng');
    expect(FILTER_LABELS.REVIEW).toBe('Cần kiểm tra');
    expect(FILTER_LABELS.BLOCKING).toBe('Thiếu thông tin');
  });
});
