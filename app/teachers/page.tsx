import type { Metadata } from 'next';

import { PublicFooter, PublicHeader } from '@/components/layout';
import {
  EditorialProcess,
  LearningResourceTeam,
} from '@/components/teachers/academic-content-process';
import { TeachersDirectory } from '@/components/teachers/teachers-directory';
import { TeachersHero } from '@/components/teachers/teachers-hero';
import { MOCK_TEACHERS, TEACHER_SUBJECTS } from '@/lib/teachers';

export const metadata: Metadata = {
  title: 'Đội ngũ học thuật',
  description:
    'Tìm hiểu đội ngũ giáo viên biên soạn, phản biện và chuẩn hóa nội dung học tập, bộ đề và lời giải trên Tú Tài.',
};

export default function TeachersPage() {
  const featuredTeacher = MOCK_TEACHERS.find((teacher) => teacher.isFeatured) ?? MOCK_TEACHERS[0];

  return (
    <div className="min-h-screen bg-[#f5f8ff]">
      <div className="bg-[radial-gradient(circle_at_78%_30%,rgba(23,104,255,0.2),transparent_32%),linear-gradient(180deg,#071a35_0%,#0a2245_100%)]">
        <PublicHeader />
      </div>

      <main id="main-content" tabIndex={-1}>
        <section
          aria-label="Giới thiệu đội ngũ học thuật Tú Tài"
          className="bg-[radial-gradient(circle_at_78%_18%,rgba(23,104,255,0.2),transparent_34%),linear-gradient(180deg,#0a2245_0%,#071a35_100%)]"
        >
          <TeachersHero featuredTeacher={featuredTeacher} />
        </section>
        <TeachersDirectory teachers={MOCK_TEACHERS} subjects={TEACHER_SUBJECTS} />
        <LearningResourceTeam />
        <EditorialProcess />
      </main>

      <PublicFooter />
    </div>
  );
}
