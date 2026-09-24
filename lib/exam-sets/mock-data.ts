/**
 * Exam Sets — mock data.
 *
 * This is the single source of truth for MVP content.
 * When a real API exists, replace `EXAM_SETS` with an API call
 * that returns `ExamSet[]` — UI components need no changes.
 *
 * Do NOT fabricate credibility claims (school names, author credentials)
 * unless real metadata exists. Fields left undefined will cause UI to
 * omit the corresponding badge/label.
 */

import type { ExamSet } from './types';

export const EXAM_SETS: ExamSet[] = [
  // ─── FREE — Toán ─────────────────────────────────────────────────────────
  {
    id: 'math-foundation-g12',
    slug: 'toan-luyen-nen-tang-lop-12',
    title: 'Bộ đề củng cố kiến thức trọng tâm',
    description:
      'Luyện các dạng bài cốt lõi và phát hiện phần kiến thức còn yếu trước khi bước vào giai đoạn luyện đề chuyên sâu.',
    subjectId: 'MATH',
    grade: 12,
    examType: 'PRACTICE',
    difficulty: 'FOUNDATIONAL',
    accessTier: 'FREE',
    sourceType: 'TUTAI_EDITORIAL',
    authorName: 'Tổ biên soạn Tú Tài',
    verifiedSource: true,
    examCount: 10,
    questionCount: 400,
    estimatedDuration: '90 phút',
    tags: ['đại số', 'hàm số', 'tích phân'],
    featured: true,
    published: true,
    intendedFor: [
      'cần rà soát lại kiến thức nền tảng',
      'chưa xác định rõ chuyên đề còn yếu',
      'muốn bắt đầu luyện đề theo từng bước',
      'cần làm quen với áp lực thời gian cơ bản',
    ],
    exams: [
      {
        id: 'm-f-01',
        title: 'Kiểm tra nền tảng Đại số',
        order: 1,
        difficulty: 'FOUNDATIONAL',
        duration: '90 phút',
      },
      {
        id: 'm-f-02',
        title: 'Khảo sát Hàm số và Đồ thị',
        order: 2,
        difficulty: 'FOUNDATIONAL',
        duration: '90 phút',
      },
      {
        id: 'm-f-03',
        title: 'Củng cố Tích phân và Ứng dụng',
        order: 3,
        difficulty: 'INTERMEDIATE',
        duration: '90 phút',
      },
    ],
  },

  // ─── PLUS — Toán ─────────────────────────────────────────────────────────
  {
    id: 'math-high-discrimination-g12',
    slug: 'toan-phan-hoa-cao-lop-12',
    title: 'Bộ đề tuyển chọn cách hỏi ít gặp',
    description:
      'Rèn khả năng nhận diện kiến thức khi câu hỏi xuất hiện dưới cách diễn đạt hoặc bối cảnh mới.',
    subjectId: 'MATH',
    grade: 12,
    examType: 'THPT_NATIONAL',
    difficulty: 'HIGH_DISCRIMINATION',
    accessTier: 'PLUS',
    isSpecial: true,
    specialReason: 'UNCOMMON_QUESTION_PATTERNS',
    examRealism: 'HIGH',
    uncommonPatternLevel: 'HIGH',
    sourceType: 'PARTNER_TEACHER',
    authorName: 'Nguyễn Văn A',
    authorRole: 'Giáo viên Toán',
    verifiedSource: true,
    examCount: 12,
    questionCount: 480,
    estimatedDuration: '90 phút',
    tags: ['tuyển chọn chuyên sâu', 'THPT Quốc Gia', 'cách hỏi mới'],
    specialTags: [
      'Cách hỏi khác với bài tập quen thuộc',
      'Dữ kiện được kết hợp từ nhiều phần kiến thức',
      'Câu hỏi dễ gây nhầm nếu chỉ ghi nhớ công thức',
    ],
    featured: true,
    published: true,
    features: [
      {
        title: 'Có những cách hỏi ít gặp',
        description:
          'Kiến thức quen thuộc có thể xuất hiện dưới cách diễn đạt, dữ kiện hoặc ngữ cảnh mà em chưa thường xuyên luyện ở trường.',
      },
      {
        title: 'Sát trải nghiệm thi thật',
        description:
          'Cấu trúc, thời lượng và nhịp độ làm bài được tổ chức gần với trải nghiệm của một kỳ thi hoàn chỉnh.',
      },
      {
        title: 'Giảm bất ngờ trong phòng thi',
        description:
          'Em được tiếp xúc trước với các tình huống lạ để tránh mất thời gian chỉ vì không nhận ra dạng bài.',
      },
      {
        title: 'Nguồn được tuyển chọn',
        description:
          'Bộ đề được biên soạn hoặc tuyển chọn từ nguồn có chuyên môn và kiểm duyệt trước khi phát hành.',
      },
    ],
    intendedFor: [
      'muốn làm quen với trải nghiệm thi hoàn chỉnh',
      'thường bị lúng túng khi câu hỏi được diễn đạt khác cách đã học',
      'muốn tiếp xúc với những dạng bài ít xuất hiện trong bài tập ở trường',
      'muốn giảm cảm giác bất ngờ trước kỳ thi thật',
    ],
    sampleExamId: 'm-h-01',
    previewEnabled: true,
    exams: [
      {
        id: 'm-h-01',
        title: 'Đề rèn tư duy kết hợp chuyên đề',
        order: 1,
        difficulty: 'INTERMEDIATE',
        duration: '90 phút',
        previewAvailable: true,
      },
      {
        id: 'm-h-02',
        title: 'Đề thử thách xử lý tình huống lạ',
        order: 2,
        difficulty: 'ADVANCED',
        duration: '90 phút',
      },
      {
        id: 'm-h-03',
        title: 'Đề mô phỏng cấu trúc THPT Quốc Gia',
        order: 3,
        difficulty: 'HIGH_DISCRIMINATION',
        duration: '90 phút',
      },
    ],
  },

  // ─── FREE — Vật lý ────────────────────────────────────────────────────────
  {
    id: 'physics-topic-g12',
    slug: 'vat-ly-theo-chuyen-de-lop-12',
    title: 'Đề Vật lý theo chuyên đề lớp 12',
    description:
      'Mỗi đề tập trung vào một chuyên đề cụ thể: Dao động, Sóng, Điện xoay chiều, Quang học. Phù hợp để ôn tập có trọng điểm.',
    subjectId: 'PHYSICS',
    grade: 12,
    examType: 'TOPIC',
    difficulty: 'INTERMEDIATE',
    accessTier: 'FREE',
    sourceType: 'CURATED',
    authorName: 'Tú Tài tuyển chọn',
    examCount: 8,
    questionCount: 280,
    estimatedDuration: '45 phút',
    tags: ['dao động', 'sóng', 'điện xoay chiều'],
    featured: false,
    published: true,
    intendedFor: ['cần hệ thống hóa lại từng chuyên đề', 'ôn tập có trọng điểm trước kỳ thi'],
    exams: [
      {
        id: 'p-t-01',
        title: 'Chuyên đề Dao động cơ học',
        order: 1,
        difficulty: 'INTERMEDIATE',
        duration: '45 phút',
      },
      {
        id: 'p-t-02',
        title: 'Chuyên đề Sóng cơ và Sóng âm',
        order: 2,
        difficulty: 'INTERMEDIATE',
        duration: '45 phút',
      },
    ],
  },

  // ─── PLUS — Vật lý ────────────────────────────────────────────────────────
  {
    id: 'physics-mock-g12',
    slug: 'vat-ly-thi-thu-thpt-lop-12',
    title: 'Bộ đề mô phỏng sát kỳ thi',
    description:
      'Làm quen với cấu trúc, nhịp độ và những cách hỏi ít gặp trong bài tập thông thường.',
    subjectId: 'PHYSICS',
    grade: 12,
    examType: 'MOCK_EXAM',
    difficulty: 'ADVANCED',
    accessTier: 'PLUS',
    isSpecial: true,
    specialReason: 'REAL_EXAM_SIMULATION',
    examRealism: 'HIGH',
    sourceType: 'TUTAI_EDITORIAL',
    authorName: 'Tổ biên soạn Tú Tài',
    verifiedSource: true,
    examCount: 10,
    questionCount: 400,
    estimatedDuration: '50 phút',
    tags: ['thi thử', 'phân tích kết quả', 'mô phỏng'],
    specialTags: [
      'Nhịp độ và phân bổ thời gian gần bài thi hoàn chỉnh',
      'Tình huống cần nhận diện nhanh bản chất bài toán',
    ],
    featured: true,
    published: true,
    features: [
      {
        title: 'Sát trải nghiệm thi thật',
        description:
          'Cấu trúc, thời lượng và nhịp độ làm bài được tổ chức gần với trải nghiệm của một kỳ thi hoàn chỉnh.',
      },
      {
        title: 'Giảm bất ngờ trong phòng thi',
        description:
          'Em được tiếp xúc trước với các tình huống lạ để tránh mất thời gian chỉ vì không nhận ra dạng bài.',
      },
      {
        title: 'Nguồn được tuyển chọn',
        description:
          'Bộ đề được biên soạn hoặc tuyển chọn từ nguồn có chuyên môn và kiểm duyệt trước khi phát hành.',
      },
    ],
    intendedFor: [
      'muốn làm quen với trải nghiệm thi hoàn chỉnh',
      'cần kiểm tra khả năng vận dụng kiến thức trong bối cảnh mới',
      'muốn giảm cảm giác bất ngờ trước kỳ thi thật',
    ],
    exams: [
      {
        id: 'p-m-01',
        title: 'Thi thử Vật lý mô phỏng đề chính thức',
        order: 1,
        difficulty: 'ADVANCED',
        duration: '50 phút',
      },
      {
        id: 'p-m-02',
        title: 'Thi thử Vật lý tổng hợp kỹ năng',
        order: 2,
        difficulty: 'ADVANCED',
        duration: '50 phút',
      },
    ],
  },

  // ─── FREE — Hóa học ──────────────────────────────────────────────────────
  {
    id: 'chemistry-foundation-g12',
    slug: 'hoa-hoc-nen-tang-lop-12',
    title: 'Đề Hóa học luyện nền tảng lớp 12',
    description:
      'Ôn tập hệ thống hóa học hữu cơ và vô cơ lớp 12. Phù hợp để rà soát kiến thức trước khi bước vào giai đoạn luyện đề.',
    subjectId: 'CHEMISTRY',
    grade: 12,
    examType: 'PRACTICE',
    difficulty: 'FOUNDATIONAL',
    accessTier: 'FREE',
    sourceType: 'CURATED',
    authorName: 'Tú Tài tuyển chọn',
    examCount: 8,
    questionCount: 320,
    estimatedDuration: '90 phút',
    tags: ['hữu cơ', 'vô cơ', 'hóa lý'],
    featured: false,
    published: true,
  },

  // ─── PLUS — Hóa học ──────────────────────────────────────────────────────
  {
    id: 'chemistry-advanced-g12',
    slug: 'hoa-hoc-nang-cao-lop-12',
    title: 'Bộ đề mô phỏng kỳ thi Hóa học',
    description:
      'Bộ đề được xây dựng để em làm quen với cấu trúc, nhịp độ và những cách đặt câu hỏi ít xuất hiện trong bài tập thông thường.',
    subjectId: 'CHEMISTRY',
    grade: 12,
    examType: 'THPT_NATIONAL',
    difficulty: 'INTERMEDIATE',
    accessTier: 'PLUS',
    isSpecial: true,
    specialReason: 'MULTI_CONCEPT_COMBINATION',
    sourceType: 'PARTNER_TEACHER',
    authorName: 'Trần Thị B',
    authorRole: 'Giáo viên cộng tác',
    verifiedSource: true,
    examCount: 10,
    questionCount: 400,
    estimatedDuration: '90 phút',
    tags: ['THPT Quốc Gia', 'mô phỏng'],
    featured: false,
    published: true,
  },

  // ─── FREE — Sinh học ─────────────────────────────────────────────────────
  {
    id: 'biology-foundation-g12',
    slug: 'sinh-hoc-nen-tang-lop-12',
    title: 'Đề Sinh học luyện nền tảng lớp 12',
    description:
      'Ôn tập kiến thức Sinh học lớp 12: Di truyền, Tiến hóa, Sinh thái. Bộ đề giúp phát hiện lỗ hổng kiến thức sớm.',
    subjectId: 'BIOLOGY',
    grade: 12,
    examType: 'PRACTICE',
    difficulty: 'FOUNDATIONAL',
    accessTier: 'FREE',
    sourceType: 'TUTAI_EDITORIAL',
    authorName: 'Tổ biên soạn Tú Tài',
    verifiedSource: true,
    examCount: 8,
    questionCount: 320,
    estimatedDuration: '50 phút',
    tags: ['di truyền', 'tiến hóa', 'sinh thái'],
    featured: false,
    published: true,
  },

  // ─── PLUS — Sinh học ─────────────────────────────────────────────────────
  {
    id: 'biology-mock-g12',
    slug: 'sinh-hoc-thi-thu-thpt-lop-12',
    title: 'Bộ đề làm quen với những tình huống lạ',
    description:
      'Bộ đề giúp học sinh luyện khả năng nhận diện dữ kiện ẩn và những cách diễn đạt chưa từng gặp trên lớp học thông thường.',
    subjectId: 'BIOLOGY',
    grade: 12,
    examType: 'MOCK_EXAM',
    difficulty: 'ADVANCED',
    accessTier: 'PLUS',
    isSpecial: true,
    specialReason: 'UNFAMILIAR_CONTEXT',
    sourceType: 'OFFICIAL',
    authorName: 'Tú Tài tuyển chọn',
    verifiedSource: true,
    examCount: 8,
    questionCount: 320,
    estimatedDuration: '50 phút',
    tags: ['thi thử', 'phân tích kết quả'],
    featured: false,
    published: true,
  },
];

/** Published sets only */
export const publishedExamSets = EXAM_SETS.filter((s) => s.published);

/** Featured sets (for highlighted sections) */
export const featuredExamSets = publishedExamSets.filter((s) => s.featured);
