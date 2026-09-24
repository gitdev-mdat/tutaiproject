/**
 * Teacher portal user-facing strings (Vietnamese).
 */
export const teacherMessages = {
  // Content
  contentTitle: 'Nội dung của tôi',
  contentUpload: 'Tải lên tài liệu',
  contentUploadNew: 'Tải lên tài liệu mới',
  contentLibrary: 'Thư viện nội dung',
  contentDraft: 'Bản nháp',
  contentUnderReview: 'Đang kiểm duyệt',
  contentPublished: 'Đã xuất bản',
  contentRevisionRequested: 'Yêu cầu sửa đổi',
  contentArchived: 'Đã lưu trữ',
  contentQuestionCount: '{count} câu hỏi',
  contentCreatedAt: 'Tạo lúc {date}',
  contentPublish: 'Xuất bản',
  contentUnpublish: 'Gỡ xuống',
  contentDelete: 'Xóa',
  contentEdit: 'Sửa',
  contentDuplicate: 'Sao chép',

  // Upload
  uploadTitle: 'Tải lên tài liệu',
  uploadDragDrop: 'Kéo và thả file vào đây',
  uploadSupportedFormats: 'Hỗ trợ: .docx, .pdf',
  uploadSelectFile: 'Chọn file',
  uploadProcessing: 'Đang xử lý...',
  uploadSuccess: 'Tải lên thành công!',
  uploadError: 'Tải lên thất bại. Vui lòng thử lại.',
  uploadReviewNotice: 'Nội dung sẽ được kiểm duyệt trước khi xuất bản.',

  // Source declaration
  sourceDeclaration: 'Khai báo nguồn gốc',
  sourceOwnWork: 'Tác phẩm của tôi',
  sourceAdapted: 'Chuyển thể từ nguồn khác',
  sourceThirdParty: 'Nội dung bên thứ ba',
  sourceAttributionRequired: 'Bạn phải có quyền sử dụng nội dung này.',

  // Visibility
  visibilityMyStudents: 'Chỉ học sinh của tôi',
  visibilityPublic: 'Công khai thư viện',
  visibilityLabel: 'Phạm vi hiển thị',

  // Analytics
  analyticsTitle: 'Phân tích',
  analyticsOverview: 'Tổng quan',
  analyticsAttempts: 'Lượt làm bài',
  analyticsAccuracy: 'Tỷ lệ đúng',
  analyticsAvgTime: 'Thời gian trung bình',
  analyticsFlagged: 'Đã bị gắn cờ',
  analyticsTopQuestions: 'Câu hỏi được làm nhiều nhất',
  analyticsHardQuestions: 'Câu hỏi khó nhất',
  analyticsEasyQuestions: 'Câu hỏi dễ nhất',
  analyticsStudentFeedback: 'Phản hồi từ học sinh',
  analyticsThisWeek: 'Tuần này',
  analyticsThisMonth: 'Tháng này',
  analyticsAllTime: 'Tất cả thời gian',

  // Revenue
  revenueTitle: 'Doanh thu',
  revenueBalance: 'Số dư khả dụng',
  revenueTotalEarned: 'Tổng đã kiếm được',
  revenueWithdrawal: 'Rút tiền',
  revenueWithdrawalRequest: 'Yêu cầu rút tiền',
  revenueWithdrawalHistory: 'Lịch sử rút tiền',
  revenuePaymentMethod: 'Phương thức thanh toán',
  revenueBankTransfer: 'Chuyển khoản ngân hàng',
  revenueMinWithdrawal: 'Số dư tối thiểu để rút: {amount}',
  revenuePending: 'Đang xử lý',
  revenueCompleted: 'Hoàn thành',
  revenueExpectedIn: 'Dự kiến trong {days} ngày làm việc',
  revenuePerStudent: 'Mỗi học sinh: {amount}',
  revenueQualityMatters: 'Chất lượng nội dung quyết định thu nhập dài hạn của bạn.',

  // Profile
  profileTitle: 'Hồ sơ giáo viên',
  profileBio: 'Giới thiệu bản thân',
  profileSubjects: 'Môn giảng dạy',
  profileVerified: 'Đã xác minh',
  profileNotVerified: 'Chưa xác minh',
  profileStudentCount: '{count} học sinh đang học nội dung của bạn',

  // Notifications
  notificationContentApproved: 'Nội dung của bạn đã được phê duyệt!',
  notificationContentRejected: 'Nội dung của bạn cần chỉnh sửa.',
  notificationStudentFeedback: 'Học sinh đã phản hồi về câu hỏi của bạn.',
  notificationRevenueReceived: 'Bạn nhận được {amount} vào tài khoản.',
} as const;

export type TeacherMessages = typeof teacherMessages;
