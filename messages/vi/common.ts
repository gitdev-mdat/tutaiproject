/**
 * Common user-facing strings (Vietnamese).
 * Used across all portals.
 * No hard-coded strings in components — reference these instead.
 */
export const common = {
  // Actions
  save: 'Lưu',
  cancel: 'Hủy',
  confirm: 'Xác nhận',
  delete: 'Xóa',
  edit: 'Sửa',
  close: 'Đóng',
  submit: 'Gửi',
  back: 'Quay lại',
  next: 'Tiếp theo',
  previous: 'Trước',
  search: 'Tìm kiếm',
  filter: 'Lọc',
  sort: 'Sắp xếp',
  download: 'Tải xuống',
  upload: 'Tải lên',
  refresh: 'Làm mới',
  retry: 'Thử lại',
  viewMore: 'Xem thêm',
  viewAll: 'Xem tất cả',

  // Status
  loading: 'Đang tải...',
  saving: 'Đang lưu...',
  processing: 'Đang xử lý...',
  success: 'Thành công',
  error: 'Đã xảy ra lỗi',
  warning: 'Cảnh báo',
  info: 'Thông tin',

  // Empty states
  noData: 'Chưa có dữ liệu',
  noResults: 'Không tìm thấy kết quả',
  emptyList: 'Danh sách trống',

  // Validation
  required: 'Trường này là bắt buộc',
  invalidEmail: 'Email không hợp lệ',
  minLength: 'Tối thiểu {min} ký tự',
  maxLength: 'Tối đa {max} ký tự',

  // Misc
  or: 'hoặc',
  and: 'và',
  yes: 'Có',
  no: 'Không',
  all: 'Tất cả',
  none: 'Không có',
  other: 'Khác',
} as const;

export type CommonMessages = typeof common;
