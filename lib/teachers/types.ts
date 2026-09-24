export type TeacherSubject = 'Toán' | 'Vật lý' | 'Hóa học' | 'Sinh học';

export type EditorialStage = 'Biên soạn' | 'Phản biện' | 'Chuẩn hóa lời giải' | 'Kiểm tra cấu trúc';

export interface AcademicContributorProfile {
  id: string;
  slug: string;
  name: string;
  subject: TeacherSubject;
  academicRole: string;
  professionalBackground: string;
  profileSummary: string;
  education: string;
  experienceLabel: string;
  specializations: readonly string[];
  contributionSummary: string;
  contentResponsibilities: readonly string[];
  editorialPrinciple: string;
  editorialStages: readonly EditorialStage[];
  imageSrc: string;
  imageAlt: string;
  isFeatured: boolean;
  teamLabel: string;
}
