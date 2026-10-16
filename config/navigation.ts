/**
 * Navigation structure — URL paths are explicit and conflict-free.
 * Used for UI navigation components.
 */
import type { NavItem, NavSection } from '@/config/navigation.types';

export { type NavItem, type NavSection };

export const publicNav: NavSection[] = [
  {
    title: 'Học tập',
    items: [
      { title: 'Môn học', href: '/subjects' },
      { title: 'Bộ đề', href: '/exam-sets' },
      { title: 'Đấu trường', href: '/competitions' },
      { title: 'Đội ngũ', href: '/teachers' },
      { title: 'Bảng giá', href: '/pricing' },
      { title: 'Blog', href: '/blog' },
    ],
  },
];

export const studentNav: NavItem[] = [
  { title: 'Trang chủ', href: '/student' },
  { title: 'Lộ trình', href: '/student/roadmap' },
  { title: 'Flashcards', href: '/student/flashcards' },
  { title: 'Ôn tập', href: '/student/review' },
  { title: 'Hồ sơ', href: '/student/profile' },
];

export const teacherNav: NavItem[] = [
  { title: 'Trang chủ', href: '/teacher' },
  { title: 'Nội dung', href: '/teacher/content' },
  { title: 'Tải lên', href: '/teacher/uploads' },
  { title: 'Phân tích', href: '/teacher/analytics' },
  { title: 'Doanh thu', href: '/teacher/revenue' },
  { title: 'Hồ sơ', href: '/teacher/profile' },
];

/**
 * The admin workspace, in the order content moves through it: the curriculum
 * (Knowledge Tree) comes first because every lesson, question, practice set and
 * exam is attached to one of its nodes; assessment tools build on published
 * questions; the student group shows what students receive from all of it.
 * Every entry is a working, database-backed page; nothing here is a placeholder.
 */
export const adminNav: NavSection[] = [
  {
    title: 'TỔNG QUAN',
    items: [
      {
        title: 'Tổng quan',
        href: '/admin',
        description: 'Nội dung đã mở và việc cần làm',
      },
    ],
  },
  {
    title: 'CHƯƠNG TRÌNH',
    items: [
      {
        title: 'Chương trình & Kiến thức',
        href: '/admin/knowledge',
        description: 'Cây môn, lớp, chương, bài và nội dung bài',
      },
    ],
  },
  {
    title: 'CÂU HỎI & ĐÁNH GIÁ',
    items: [
      {
        title: 'Ngân hàng câu hỏi',
        href: '/admin/question-bank',
        description: 'Soạn, nhập, duyệt mọi câu hỏi',
      },
      {
        title: 'Luyện tập theo bài',
        href: '/admin/practice',
        description: 'Câu học sinh nhận ở từng bài, chương',
      },
      {
        title: 'Đề thi',
        href: '/admin/exams',
        description: 'Ghép đề tính giờ từ câu đã duyệt',
      },
    ],
  },
  {
    title: 'HỌC SINH',
    items: [
      {
        title: 'Lộ trình học sinh',
        href: '/admin/roadmaps',
        description: 'Học sinh nhận chương trình nào',
      },
      {
        title: 'Thanh toán Plus',
        href: '/admin/payments',
        description: 'Duyệt chuyển khoản nâng cấp',
      },
    ],
  },
];
