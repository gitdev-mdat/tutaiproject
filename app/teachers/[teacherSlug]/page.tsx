import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PublicFooter, PublicHeader } from '@/components/layout';
import { TeacherProfileContent, TeacherProfileHero } from '@/components/teachers/teacher-detail';
import { MOCK_TEACHERS, getTeacherBySlug } from '@/lib/teachers';

interface Props {
  params: Promise<{ teacherSlug: string }>;
}

export function generateStaticParams() {
  return MOCK_TEACHERS.map((teacher) => ({ teacherSlug: teacher.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { teacherSlug } = await params;
  const teacher = getTeacherBySlug(teacherSlug);

  if (!teacher) {
    return {
      title: 'Không tìm thấy thành viên học thuật',
      description: 'Hồ sơ thành viên học thuật này không tồn tại trên Tú Tài.',
    };
  }

  return {
    title: `${teacher.name} — Đội ngũ học thuật ${teacher.subject}`,
    description: `${teacher.contributionSummary} Tìm hiểu vai trò và nội dung phụ trách của ${teacher.name} tại Tú Tài.`,
  };
}

export default async function TeacherPage({ params }: Props) {
  const { teacherSlug } = await params;
  const teacher = getTeacherBySlug(teacherSlug);

  if (!teacher) notFound();

  return (
    <div className="min-h-screen bg-[#f5f8ff]">
      <div className="bg-[linear-gradient(180deg,#071a35_0%,#0a2245_100%)]">
        <PublicHeader />
      </div>

      <main id="main-content" tabIndex={-1}>
        <section
          aria-label={`Vai trò chuyên môn của ${teacher.name}`}
          className="bg-[radial-gradient(circle_at_26%_30%,rgba(23,104,255,0.18),transparent_34%),linear-gradient(180deg,#0a2245_0%,#071a35_100%)]"
        >
          <TeacherProfileHero teacher={teacher} />
        </section>
        <TeacherProfileContent teacher={teacher} />
      </main>

      <PublicFooter />
    </div>
  );
}
