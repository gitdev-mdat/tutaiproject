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

export const adminNav: NavSection[] = [
  {
    title: 'TỔNG QUAN',
    items: [{ title: 'Tổng quan', href: '/admin' }],
  },
  {
    title: 'NỘI DUNG',
    items: [
      { title: 'Chương trình & Kiến thức', href: '/admin/knowledge' },
      { title: 'Ngân hàng câu hỏi', href: '/admin/question-bank' },
      { title: 'Đề thi', href: '/admin/exams' },
      { title: 'Lộ trình học', href: '/admin/roadmaps' },
    ],
  },
  {
    title: 'VẬN HÀNH',
    items: [
      { title: 'Hàng chờ xử lý', href: '/admin/queue' },
      { title: 'Học sinh', href: '/admin/students' },
    ],
  },
  {
    title: 'HỆ THỐNG',
    items: [{ title: 'Cài đặt', href: '/admin/settings' }],
  },
];
