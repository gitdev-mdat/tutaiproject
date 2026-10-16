import type {
  StudentDestination,
  StudentMetric,
  StudentNotification,
  StudentProfile,
  StudentShellModel,
} from '@/lib/student/types';

// Re-exported for backward compatibility with modules (notably the
// authentication boundary) that import StudentProfile from this fixture
// module rather than from the canonical lib/student/types contract.
export type { StudentProfile };

export const DEMO_STUDENT: StudentProfile = {
  id: 'demo-student-001',
  name: 'Nguyễn Minh',
  email: 'student@gmail.com',
  grade: 12,
  targetScore: 9,
  examBlock: 'A00',
};

// Only verified, routable student destinations are exposed here. Adding a
// destination requires a corresponding real route under app/student/**.
const DEMO_STUDENT_DESTINATIONS: StudentDestination[] = [
  // The one place to learn: every published lesson by subject and chapter,
  // the next step and progress. Lessons (/student/lessons/…) open from it.
  {
    id: 'roadmap',
    group: 'learn',
    hint: 'Bài học và tiến độ của em',
    title: 'Lộ trình',
    href: '/student/roadmap',
    description: 'Mọi bài học theo môn và chương, bước tiếp theo và tiến độ',
    keywords: [
      'roadmap',
      'lộ trình',
      'kế hoạch',
      'lessons',
      'bài học',
      'chương trình',
      'kiến thức',
      'môn học',
    ],
    includes: ['/student/lessons'],
  },
  {
    id: 'practice',
    group: 'learn',
    hint: 'Củng cố theo bài, theo chương',
    title: 'Luyện tập',
    href: '/student/practice',
    description: 'Luyện tập theo bài, ôn chương và bộ Tổng hợp',
    keywords: ['practice', 'luyện tập', 'luyện đề', 'theo bài', 'theo chương', 'tổng hợp'],
  },
  {
    id: 'exams',
    group: 'extra',
    hint: 'Đề tính giờ, xem lại bài',
    title: 'Luyện thi',
    href: '/student/exams',
    description: 'Làm đề thi có tính giờ, nộp bài và xem lại từng câu',
    keywords: ['exam', 'luyện thi', 'thi thử', 'đề thi', 'thpt quốc gia', 'học kỳ'],
  },
  {
    id: 'rankings',
    group: 'compete',
    title: 'Thứ hạng',
    href: '/student/rankings',
    description: 'Xem xếp hạng từ kết quả đủ điều kiện',
    keywords: ['ranking', 'thứ hạng', 'xếp hạng'],
  },
  {
    id: 'arena',
    group: 'compete',
    title: 'Đấu trường',
    href: '/student/arena',
    description: 'Tham gia các sự kiện tranh tài học thuật',
    keywords: ['arena', 'đấu trường', 'cuộc thi'],
  },
  {
    id: 'profile',
    group: 'account',
    title: 'Hồ sơ',
    href: '/student/profile',
    description: 'Thông tin cá nhân và cài đặt',
    keywords: ['profile', 'hồ sơ', 'tài khoản'],
  },
];

const DEMO_STUDENT_NOTIFICATIONS: StudentNotification[] = [
  {
    id: 'notif-1',
    title: 'Bài luyện tập mới',
    description: 'Chuyên đề Hàm số đã sẵn sàng để luyện tập.',
    timestamp: '2 giờ trước',
    read: false,
  },
  {
    id: 'notif-2',
    title: 'Nhắc nhở học tập',
    description: 'Bạn còn 1 bước trong lộ trình tuần này.',
    timestamp: 'Hôm qua',
    read: true,
  },
];

function buildInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'HS';
  }
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  const initials = `${first}${last}`.toUpperCase();
  return initials || 'HS';
}

function buildMetrics(profile: StudentProfile): StudentMetric[] {
  return [{ id: 'target-score', label: 'Mục tiêu', value: `${profile.targetScore}+` }];
}

/**
 * Returns a fresh, independent copy of the centralized destination fixtures.
 * Callers must never mutate the returned array or its entries in place;
 * this keeps the module-level fixture immutable across requests/tests.
 */
export function getDemoStudentDestinations(): StudentDestination[] {
  return DEMO_STUDENT_DESTINATIONS.map((destination) => ({
    ...destination,
    keywords: destination.keywords ? [...destination.keywords] : undefined,
  }));
}

/**
 * Returns a fresh, independent copy of the centralized notification
 * fixtures so callers (and persisted state) can safely mutate read status
 * without corrupting the shared module-level defaults.
 */
export function getDemoStudentNotifications(): StudentNotification[] {
  return DEMO_STUDENT_NOTIFICATIONS.map((notification) => ({ ...notification }));
}

/**
 * Mock implementation of the student shell data boundary. Builds a
 * serializable shell model (identity, metrics, notifications, verified
 * destinations) from an authenticated student profile.
 */
export function getStudentShellModel(profile: StudentProfile): StudentShellModel {
  return {
    identity: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      initials: buildInitials(profile.name),
    },
    metrics: buildMetrics(profile),
    notifications: getDemoStudentNotifications(),
    destinations: getDemoStudentDestinations(),
  };
}
