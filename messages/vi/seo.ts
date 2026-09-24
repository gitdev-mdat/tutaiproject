/**
 * SEO-related user-facing strings (Vietnamese).
 * Used for metadata, page titles, and descriptions.
 */
export const seoMessages = {
  // Site
  siteName: 'Tú Tài',
  siteDescription:
    'Nền tảng học tập cá nhân hóa cho học sinh lớp 12 — lộ trình học thông minh, luyện tập targeted, và mô phỏng kỳ thi.',
  siteKeywords: [
    'học tập',
    'lớp 12',
    'ôn thi tốt nghiệp',
    'toán',
    'vật lý',
    'hóa học',
    'lộ trình học',
    'luyện tập',
    'quiz',
    'thi thử',
  ],

  // Home
  homeTitle: 'Tú Tài — Học thông minh hơn, thi tốt hơn',
  homeDescription:
    'Nền tảng học tập cá nhân hóa cho học sinh lớp 12. Lộ trình đúng, luyện tập đúng chỗ, thi thử như thi thật.',

  // Subjects
  subjectsTitle: 'Môn học',
  subjectsDescription: 'Danh sách các môn học trên Tú Tài. Chọn môn bạn muốn học.',

  // Topics
  topicsTitle: '{topic} — {subject}',
  topicsDescription: 'Học về chủ đề {topic} trong môn {subject} trên Tú Tài.',

  // Lessons
  lessonsTitle: '{lesson} — {subject}',
  lessonsDescription: 'Bài học {lesson} trong môn {subject} trên Tú Tài.',

  // Practice
  practiceTitle: 'Luyện tập {topic}',
  practiceDescription:
    'Luyện tập câu hỏi về {topic} trên Tú Tài. Câu hỏi được phân loại theo độ khó.',

  // Mock Exams
  mockExamsTitle: 'Đề thi thử {exam}',
  mockExamsDescription: 'Mô phỏng kỳ thi tốt nghiệp THPT 2026. Làm đề thi thử {exam} trên Tú Tài.',

  // Teachers
  teachersTitle: 'Giáo viên',
  teachersDescription: 'Nội dung chất lượng cao từ các giáo viên được kiểm duyệt trên Tú Tài.',
  teacherProfileTitle: '{name} — Giáo viên trên Tú Tài',
  teacherProfileDescription: 'Xem nội dung và phân tích từ giáo viên {name} trên Tú Tài.',

  // Pricing
  pricingTitle: 'Bảng giá',
  pricingDescription: 'Bảng giá Tú Tài cho học sinh. Miễn phí để bắt đầu.',

  // Blog
  blogTitle: 'Blog',
  blogDescription: 'Tin tức, bài viết và cập nhật từ Tú Tài.',
  blogPostTitle: '{postTitle} — Blog Tú Tài',
  blogPostDescription: '{postTitle} — Đọc bài viết trên blog Tú Tài.',

  // About
  aboutTitle: 'Về Tú Tài',
  aboutDescription: 'Tìm hiểu về Tú Tài — nền tảng học tập cá nhân hóa cho học sinh lớp 12.',

  // Contact
  contactTitle: 'Liên hệ',
  contactDescription: 'Liên hệ với đội ngũ Tú Tài.',

  // Auth
  loginTitle: 'Đăng nhập',
  loginDescription: 'Đăng nhập vào tài khoản Tú Tài của bạn.',
  registerTitle: 'Đăng ký',
  registerDescription: 'Tạo tài khoản Tú Tài mới.',

  // Student portal
  dashboardTitle: 'Trang chủ',
  dashboardDescription: 'Trang chủ học tập cá nhân trên Tú Tài.',
  roadmapTitle: 'Lộ trình học tập',
  roadmapDescription: 'Lộ trình học tập cá nhân của bạn trên Tú Tài.',
  profileTitle: 'Hồ sơ',
  profileDescription: 'Quản lý hồ sơ và cài đặt trên Tú Tài.',

  // Teacher portal
  teacherDashboardTitle: 'Cổng giáo viên',
  teacherDashboardDescription: 'Quản lý nội dung và xem phân tích trên Tú Tài.',

  // 404
  notFoundTitle: 'Trang không tồn tại',
  notFoundDescription: 'Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.',
} as const;

export type SeoMessages = typeof seoMessages;
