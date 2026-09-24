/**
 * Public website user-facing strings (Vietnamese).
 */
export const publicMessages = {
  // Navigation
  navHome: 'Trang chủ',
  navSubjects: 'Môn học',
  navRoadmap: 'Lộ trình',
  navPractice: 'Luyện tập',
  navMockExams: 'Đề thi thử',
  navPricing: 'Bảng giá',
  navBlog: 'Blog',
  navAbout: 'Về chúng tôi',
  navContact: 'Liên hệ',
  navLogin: 'Đăng nhập',
  navRegister: 'Đăng ký',
  navLogout: 'Đăng xuất',

  // Hero
  heroTitle: 'Học thông minh hơn, thi tốt hơn',
  heroSubtitle:
    'Nền tảng học tập cá nhân hóa cho học sinh lớp 12. Lộ trình đúng, luyện tập đúng chỗ.',

  // Subjects
  subjectsTitle: 'Chọn môn học',
  subjectsSubtitle: 'Tất cả môn thi tốt nghiệp 2026',
  subjectMathematics: 'Toán',
  subjectLiterature: 'Ngữ văn',
  subjectPhysics: 'Vật lý',
  subjectChemistry: 'Hóa học',
  subjectHistory: 'Lịch sử',
  subjectGeography: 'Địa lý',
  subjectEnglish: 'Tiếng Anh',

  // Topics
  topicsTitle: 'Chủ đề',
  lessonsTitle: 'Bài học',
  practiceTitle: 'Luyện tập',

  // Practice
  practiceCta: 'Bắt đầu luyện tập',
  practiceDescription: 'Luyện tập theo chủ đề với câu hỏi được phân loại.',

  // Mock Exams
  mockExamsTitle: 'Đề thi thử',
  mockExamsSubtitle: 'Mô phỏng kỳ thi tốt nghiệp THPT 2026',
  mockExamStart: 'Bắt đầu thi',
  mockExamDuration: '{minutes} phút',

  // Teachers
  teachersTitle: 'Giáo viên',
  teachersSubtitle: 'Nội dung chất lượng cao từ giáo viên được kiểm duyệt',
  viewTeacherProfile: 'Xem hồ sơ giáo viên',

  // Pricing
  pricingTitle: 'Bảng giá',
  pricingFree: 'Miễn phí',
  pricingPremium: 'Tú Tài Premium',
  pricingCta: 'Bắt đầu dùng thử',
  pricingCtaPremium: 'Nâng cấp ngay',

  // About
  aboutTitle: 'Về Tú Tài',
  aboutMission: 'Sứ mệnh',
  aboutTeam: 'Đội ngũ',
  aboutContact: 'Liên hệ',

  // Contact
  contactTitle: 'Liên hệ',
  contactEmail: 'Email',
  contactPhone: 'Điện thoại',
  contactAddress: 'Địa chỉ',
  contactSuccess: 'Tin nhắn của bạn đã được gửi. Chúng tôi sẽ phản hồi sớm nhất có thể.',
  contactSubmit: 'Gửi tin nhắn',

  // Footer
  footerTagline: 'Học thông minh hơn, thi tốt hơn.',
  footerAllRights: '© {year} Tú Tài. Mọi quyền được bảo lưu.',

  // Errors
  notFoundTitle: 'Trang không tồn tại',
  notFoundMessage: 'Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.',
  goHome: 'Về trang chủ',
} as const;

export type PublicMessages = typeof publicMessages;
