export type CompetitionStatus =
  'UPCOMING' | 'REGISTRATION_OPEN' | 'LIVE' | 'ENDED' | 'RESULT_PENDING' | 'COMPLETED';

export type Competition = {
  id: string;
  slug: string;
  title: string;
  subject: string;
  description: string;
  status: CompetitionStatus;
  startAt: string;
  endAt?: string;
  durationMinutes: number;
  questionCount: number;
  participantCount: number;
  participantPreview?: {
    id: string;
    initials: string;
  }[];
  plusRequired: boolean;
  prizePool: number;
  prizes: {
    rankFrom: number;
    rankTo: number;
    amount: number;
  }[];
  rankingRules: string[];
  examAvailable: boolean;
  solutionAvailable: boolean;
  difficulty?: string;
  cta?: {
    label: string;
    href: string;
  };
  winner?: {
    name: string;
    score: number;
  };
};

export type LeaderboardEntry = {
  id: string;
  rank: number;
  studentName: string;
  school: string;
  score: number;
  completionTime: string;
};

export const mockPrizes = [
  { rankFrom: 1, rankTo: 1, amount: 2000000 },
  { rankFrom: 2, rankTo: 3, amount: 1000000 },
  { rankFrom: 4, rankTo: 6, amount: 500000 },
];

export const featuredCompetition: Competition = {
  id: 'c-01',
  slug: 'thpt-quoc-gia-01',
  title: 'Đấu trường THPT Quốc Gia Toán #01',
  subject: 'Toán · Lớp 12',
  description:
    'Đề được tuyển chọn theo cấu trúc THPT Quốc Gia, tập trung vào những dạng bài có khả năng tạo khoảng cách điểm.',
  status: 'UPCOMING',
  startAt: '2026-10-03T20:00:00+07:00', // SẮP DIỄN RA
  durationMinutes: 50,
  questionCount: 40,
  participantCount: 1284,
  participantPreview: [
    { id: 'preview-1', initials: 'GH' },
    { id: 'preview-2', initials: 'MA' },
    { id: 'preview-3', initials: 'HN' },
  ],
  plusRequired: true,
  prizePool: 5500000,
  prizes: mockPrizes,
  rankingRules: ['Xếp hạng ưu tiên điểm số trước, thời gian hoàn thành sau.'],
  examAvailable: false,
  solutionAvailable: false,
  difficulty: 'Phân loại 7+ → 9+',
  cta: {
    label: 'Tham gia Đấu trường',
    href: '/competitions',
  },
};

export const mockLeaderboard: LeaderboardEntry[] = [
  {
    id: 'u1',
    rank: 1,
    studentName: 'Trần Gia Huy',
    school: 'THPT Nguyễn Thị Minh Khai',
    score: 9.75,
    completionTime: '34:18',
  },
  {
    id: 'u2',
    rank: 2,
    studentName: 'Nguyễn Minh Anh',
    school: 'THPT Chuyên Lê Hồng Phong',
    score: 9.5,
    completionTime: '31:44',
  },
  {
    id: 'u3',
    rank: 3,
    studentName: 'Lê Hoàng Nam',
    school: 'THPT Gia Định',
    score: 9.5,
    completionTime: '35:07',
  },
  {
    id: 'u4',
    rank: 4,
    studentName: 'Phạm Khánh Linh',
    school: 'THPT Nguyễn Hữu Huân',
    score: 9.25,
    completionTime: '37:14',
  },
  {
    id: 'u5',
    rank: 5,
    studentName: 'Nguyễn Đức Anh',
    school: 'THPT Trần Phú',
    score: 9.0,
    completionTime: '31:42',
  },
  {
    id: 'u6',
    rank: 6,
    studentName: 'Trần Hoàng Minh',
    school: 'THPT Nguyễn Du',
    score: 9.0,
    completionTime: '35:08',
  },
  {
    id: 'u7',
    rank: 7,
    studentName: 'Võ Minh Khang',
    school: 'THPT Bùi Thị Xuân',
    score: 8.75,
    completionTime: '29:54',
  },
  {
    id: 'u8',
    rank: 8,
    studentName: 'Nguyễn Gia Hân',
    school: 'THPT Marie Curie',
    score: 8.75,
    completionTime: '33:21',
  },
  {
    id: 'u9',
    rank: 9,
    studentName: 'Lê Minh Khoa',
    school: 'THPT Nguyễn Thượng Hiền',
    score: 8.5,
    completionTime: '28:39',
  },
  {
    id: 'u10',
    rank: 10,
    studentName: 'Phan Hải Anh',
    school: 'THPT Gia Định',
    score: 8.5,
    completionTime: '32:18',
  },
];

export const currentUserRank = {
  rank: 127,
  score: 7.75,
  percentile: 31,
  gapToNextTier: 0.5,
  nextTierPercentile: 20,
};

export const competitionArchive: Competition[] = [
  {
    id: 'c-old-1',
    slug: 'ham-so-03',
    title: 'Đấu trường Hàm số #03',
    subject: 'Toán',
    description: '',
    status: 'COMPLETED',
    startAt: '2026-08-12T20:00:00+07:00',
    durationMinutes: 50,
    questionCount: 40,
    participantCount: 524,
    plusRequired: true,
    prizePool: 0,
    prizes: [],
    rankingRules: [],
    examAvailable: true,
    solutionAvailable: true,
    winner: { name: 'Nguyễn Minh Anh', score: 9.75 },
  },
  {
    id: 'c-old-2',
    slug: 'di-truyen-hoc-02',
    title: 'Đấu trường Di truyền học #02',
    subject: 'Sinh học',
    description: '',
    status: 'COMPLETED',
    startAt: '2026-08-05T20:00:00+07:00',
    durationMinutes: 50,
    questionCount: 40,
    participantCount: 382,
    plusRequired: true,
    prizePool: 0,
    prizes: [],
    rankingRules: [],
    examAvailable: true,
    solutionAvailable: true,
    winner: { name: 'Lê Hoàng Nam', score: 9.5 },
  },
  {
    id: 'c-old-3',
    slug: 'dien-xoay-chieu-01',
    title: 'Đấu trường Điện xoay chiều #01',
    subject: 'Vật lý',
    description: '',
    status: 'COMPLETED',
    startAt: '2026-07-29T20:00:00+07:00',
    durationMinutes: 50,
    questionCount: 40,
    participantCount: 417,
    plusRequired: true,
    prizePool: 0,
    prizes: [],
    rankingRules: [],
    examAvailable: true,
    solutionAvailable: true,
    winner: { name: 'Trần Gia Huy', score: 9.25 },
  },
];
