export const siteConfig = {
  name: 'Tú Tài',
  description:
    'Nền tảng học tập cá nhân hóa cho học sinh lớp 12 — lộ trình học thông minh, luyện tập targeted, và mô phỏng kỳ thi.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tutai.vn',
  author: 'Tú Tài Team',
  keywords: [
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
  social: {
    twitter: '@tutai_vn',
    facebook: 'https://facebook.com/tutai.vn',
  },
} as const;
