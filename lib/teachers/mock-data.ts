import type { AcademicContributorProfile, TeacherSubject } from './types';

/**
 * Development-only academic contributor profiles.
 * Replace every mock credential, role, responsibility, and local portrait with verified
 * production CMS/API data before launch.
 */
export const MOCK_TEACHERS: readonly AcademicContributorProfile[] = [
  {
    id: 'teacher-math-01',
    slug: 'nguyen-minh-quan',
    name: 'Thầy Nguyễn Minh Quân',
    subject: 'Toán',
    academicRole: 'Phụ trách biên soạn nội dung Toán',
    professionalBackground: 'Giáo viên luyện thi THPT Quốc gia',
    profileSummary:
      'Thầy Quân phụ trách tổ chức câu hỏi theo cấu trúc kiến thức, mục tiêu đánh giá và mức độ nhận thức để mỗi nội dung có vị trí rõ ràng trong hệ thống học tập.',
    education: 'Thạc sĩ Toán học',
    experienceLabel: '8 năm luyện thi THPT',
    specializations: ['Hàm số', 'Hình học Oxyz', 'Xác suất'],
    contributionSummary:
      'Biến kiến thức và cấu trúc đề thi thành những bộ câu hỏi có mục tiêu học tập rõ ràng.',
    contentResponsibilities: [
      'Hệ thống câu hỏi và lời giải chuyên đề Toán',
      'Tiêu chí phân loại mức độ câu hỏi',
      'Cấu trúc bộ đề tổng hợp và tuyển chọn',
    ],
    editorialPrinciple:
      'Mỗi câu hỏi không chỉ để kiểm tra đúng hay sai, mà phải cho thấy học sinh đang hiểu đến đâu.',
    editorialStages: ['Biên soạn', 'Phản biện', 'Chuẩn hóa lời giải', 'Kiểm tra cấu trúc'],
    imageSrc: '/assets/teachers/mock-teacher-math.svg',
    imageAlt: 'Minh họa Thầy Nguyễn Minh Quân, thành viên đội ngũ biên soạn môn Toán',
    isFeatured: true,
    teamLabel: 'Thành viên đội ngũ biên soạn',
  },
  {
    id: 'teacher-physics-01',
    slug: 'le-thanh-ha',
    name: 'Cô Lê Thanh Hà',
    subject: 'Vật lý',
    academicRole: 'Phụ trách biên soạn nội dung Vật lý',
    professionalBackground: 'Giáo viên Vật lý THPT',
    profileSummary:
      'Cô Hà tập trung rà soát sự nhất quán giữa hiện tượng, mô hình, dữ kiện và công thức trong từng câu hỏi Vật lý.',
    education: 'Thạc sĩ Vật lý',
    experienceLabel: '7 năm giảng dạy THPT',
    specializations: ['Dao động', 'Điện xoay chiều', 'Sóng ánh sáng'],
    contributionSummary:
      'Xây dựng câu hỏi giúp phân biệt rõ khả năng hiểu hiện tượng, chọn mô hình và xử lý dữ kiện.',
    contentResponsibilities: [
      'Câu hỏi mô hình hóa hiện tượng',
      'Rà soát đại lượng, đơn vị và dữ kiện',
      'Chuẩn hóa lời giải chuyên đề Vật lý',
    ],
    editorialPrinciple:
      'Một câu hỏi Vật lý tốt phải kiểm tra được cách học sinh nối hiện tượng với mô hình, không chỉ khả năng nhớ công thức.',
    editorialStages: ['Biên soạn', 'Phản biện', 'Chuẩn hóa lời giải'],
    imageSrc: '/assets/teachers/mock-teacher-physics.svg',
    imageAlt: 'Minh họa Cô Lê Thanh Hà, thành viên đội ngũ biên soạn môn Vật lý',
    isFeatured: false,
    teamLabel: 'Thành viên đội ngũ biên soạn',
  },
  {
    id: 'teacher-chemistry-01',
    slug: 'tran-mai-anh',
    name: 'Cô Trần Mai Anh',
    subject: 'Hóa học',
    academicRole: 'Phụ trách biên soạn nội dung Hóa học',
    professionalBackground: 'Giáo viên Hóa học luyện thi',
    profileSummary:
      'Cô Mai Anh phụ trách kiểm tra mối liên hệ giữa chất, phản ứng, điều kiện và phương pháp giải để hạn chế câu hỏi dựa trên ghi nhớ rời rạc.',
    education: 'Thạc sĩ Hóa học',
    experienceLabel: '6 năm luyện thi THPT',
    specializations: ['Hóa hữu cơ', 'Điện hóa', 'Bảo toàn'],
    contributionSummary:
      'Chuẩn hóa hệ thống phản ứng, phương pháp bảo toàn và lời giải cho các nhóm câu hỏi Hóa học.',
    contentResponsibilities: [
      'Hệ thống phản ứng và điều kiện',
      'Câu hỏi phương pháp bảo toàn',
      'Đối chiếu đáp án và sai số tính toán',
    ],
    editorialPrinciple:
      'Lời giải cần chỉ rõ vì sao chọn phản ứng và phương pháp, thay vì chỉ đưa ra một chuỗi biến đổi đúng.',
    editorialStages: ['Biên soạn', 'Phản biện', 'Chuẩn hóa lời giải'],
    imageSrc: '/assets/teachers/mock-teacher-chemistry.svg',
    imageAlt: 'Minh họa Cô Trần Mai Anh, thành viên đội ngũ biên soạn môn Hóa học',
    isFeatured: false,
    teamLabel: 'Thành viên đội ngũ biên soạn',
  },
  {
    id: 'teacher-biology-01',
    slug: 'pham-duc-nam',
    name: 'Thầy Phạm Đức Nam',
    subject: 'Sinh học',
    academicRole: 'Phụ trách biên soạn nội dung Sinh học',
    professionalBackground: 'Giáo viên Sinh học THPT',
    profileSummary:
      'Thầy Nam phụ trách đối chiếu cơ chế sinh học, dữ kiện thí nghiệm và chuỗi nguyên nhân – kết quả trong câu hỏi vận dụng.',
    education: 'Thạc sĩ Sinh học',
    experienceLabel: '7 năm giảng dạy THPT',
    specializations: ['Di truyền', 'Tiến hóa', 'Sinh thái học'],
    contributionSummary:
      'Xây dựng câu hỏi liên kết cơ chế, dữ kiện khoa học và khả năng suy luận trong các chuyên đề Sinh học.',
    contentResponsibilities: [
      'Câu hỏi cơ chế và quan hệ nhân quả',
      'Dữ kiện bảng biểu và thí nghiệm',
      'Liên kết kiến thức giữa các chương',
    ],
    editorialPrinciple:
      'Câu hỏi cần cho học sinh cơ hội dùng cơ chế đã hiểu để giải thích dữ kiện mới, thay vì lặp lại một mệnh đề đã nhớ.',
    editorialStages: ['Biên soạn', 'Phản biện', 'Kiểm tra cấu trúc'],
    imageSrc: '/assets/teachers/mock-teacher-biology.svg',
    imageAlt: 'Minh họa Thầy Phạm Đức Nam, thành viên đội ngũ biên soạn môn Sinh học',
    isFeatured: false,
    teamLabel: 'Thành viên đội ngũ biên soạn',
  },
] as const;

export const TEACHER_SUBJECTS: readonly TeacherSubject[] = [
  'Toán',
  'Vật lý',
  'Hóa học',
  'Sinh học',
];

export function getTeacherBySlug(slug: string): AcademicContributorProfile | undefined {
  return MOCK_TEACHERS.find((teacher) => teacher.slug === slug);
}
