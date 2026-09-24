/**
 * Tú Tài — Subject Configuration
 *
 * Single source of truth for the four core subjects.
 * Used by:
 *   - /subjects          (hub grid)
 *   - /subjects/[slug]   (grade selector)
 *   - /subjects/[slug]/grade-12  (Grade 12 learning hub)
 *
 * Grade availability:
 *   'active'      → fully supported, CTA enabled
 *   'coming-soon' → visible but not yet available
 *   'hidden'      → not shown in UI
 */

export type GradeAvailability = 'active' | 'coming-soon' | 'hidden';

export interface SubjectGradeConfig {
  grade: 10 | 11 | 12;
  label: string;
  subtitle: string;
  availability: GradeAvailability;
  /** Route segment: e.g. 'grade-12' */
  routeSegment: string;
}

export interface SubjectConfig {
  /** URL slug used in routes: /subjects/[slug] */
  slug: string;
  name: string;
  nameShort: string;
  tagline: string;
  /** High-level topic preview — does NOT imply identical content across grades */
  previewTags: string[];
  valueStatement: string;
  label: string;

  // Visual accent tokens
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  accentText: string;
  accentBtn: string;
  tagBg: string;
  tagText: string;

  /** Icon component name from lucide-react */
  iconName: 'FunctionSquare' | 'Atom' | 'FlaskConical' | 'Leaf';

  grades: SubjectGradeConfig[];
}

export const SUBJECT_GRADES: SubjectGradeConfig[] = [
  {
    grade: 10,
    label: 'Lớp 10',
    subtitle: 'Nền tảng THPT',
    availability: 'coming-soon',
    routeSegment: 'grade-10',
  },
  {
    grade: 11,
    label: 'Lớp 11',
    subtitle: 'Mở rộng kiến thức',
    availability: 'coming-soon',
    routeSegment: 'grade-11',
  },
  {
    grade: 12,
    label: 'Lớp 12',
    subtitle: 'Ôn thi THPT Quốc Gia',
    availability: 'active',
    routeSegment: 'grade-12',
  },
];

export const SUBJECTS: SubjectConfig[] = [
  {
    slug: 'toan',
    name: 'Toán',
    nameShort: 'Toán',
    tagline: 'Từ nền tảng đến vận dụng cao, học theo đúng phần em còn yếu.',
    previewTags: ['Đại số', 'Giải tích', 'Hình học'],
    valueStatement: 'Lộ trình tự điều chỉnh theo năng lực',
    label: 'KHOA HỌC TỰ NHIÊN',
    accentColor: '#1768FF',
    accentBg: 'rgba(23,104,255,0.07)',
    accentBorder: 'rgba(23,104,255,0.15)',
    accentText: '#1351D8',
    accentBtn: 'rgba(23,104,255,0.09)',
    tagBg: 'rgba(23,104,255,0.07)',
    tagText: '#1351D8',
    iconName: 'FunctionSquare',
    grades: SUBJECT_GRADES,
  },
  {
    slug: 'vat-ly',
    name: 'Vật lý',
    nameShort: 'Vật lý',
    tagline: 'Hiểu bản chất, nắm công thức và luyện cách áp dụng vào bài thi.',
    previewTags: ['Cơ học', 'Điện', 'Sóng'],
    valueStatement: 'Bài tập theo từng mức độ thi THPT',
    label: 'KHOA HỌC TỰ NHIÊN',
    accentColor: '#0EA5C6',
    accentBg: 'rgba(14,165,198,0.07)',
    accentBorder: 'rgba(14,165,198,0.15)',
    accentText: '#0882A0',
    accentBtn: 'rgba(14,165,198,0.09)',
    tagBg: 'rgba(14,165,198,0.07)',
    tagText: '#0882A0',
    iconName: 'Atom',
    grades: SUBJECT_GRADES,
  },
  {
    slug: 'hoa-hoc',
    name: 'Hóa học',
    nameShort: 'Hóa',
    tagline: 'Hệ thống phản ứng, bản chất hóa học và dạng bài thường gặp.',
    previewTags: ['Vô cơ', 'Hữu cơ', 'Điện hóa'],
    valueStatement: 'Phân loại dạng bài theo ma trận đề thi',
    label: 'KHOA HỌC TỰ NHIÊN',
    accentColor: '#F59E0B',
    accentBg: 'rgba(245,158,11,0.06)',
    accentBorder: 'rgba(245,158,11,0.14)',
    accentText: '#B45309',
    accentBtn: 'rgba(245,158,11,0.08)',
    tagBg: 'rgba(245,158,11,0.07)',
    tagText: '#92400E',
    iconName: 'FlaskConical',
    grades: SUBJECT_GRADES,
  },
  {
    slug: 'sinh-hoc',
    name: 'Sinh học',
    nameShort: 'Sinh',
    tagline: 'Hiểu cơ chế, liên kết kiến thức và luyện đúng dạng câu hỏi.',
    previewTags: ['Di truyền', 'Tiến hóa', 'Sinh thái'],
    valueStatement: 'Sơ đồ tư duy theo từng chuyên đề',
    label: 'KHOA HỌC TỰ NHIÊN',
    accentColor: '#13B99A',
    accentBg: 'rgba(19,185,154,0.07)',
    accentBorder: 'rgba(19,185,154,0.14)',
    accentText: '#0D8F77',
    accentBtn: 'rgba(19,185,154,0.08)',
    tagBg: 'rgba(19,185,154,0.07)',
    tagText: '#0D6E5C',
    iconName: 'Leaf',
    grades: SUBJECT_GRADES,
  },
];

/** Look up a subject by its URL slug. Returns undefined if not found. */
export function getSubjectBySlug(slug: string): SubjectConfig | undefined {
  return SUBJECTS.find((s) => s.slug === slug);
}

/** Look up a grade config within a subject. */
export function getGradeConfig(
  subject: SubjectConfig,
  grade: 10 | 11 | 12
): SubjectGradeConfig | undefined {
  return subject.grades.find((g) => g.grade === grade);
}
