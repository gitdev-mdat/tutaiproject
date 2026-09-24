import Link from 'next/link';
import { ArrowDown, ArrowRight, BookOpenText, CheckCircle2, Clock3, Target } from 'lucide-react';

import type { AcademicContributorProfile } from '@/lib/teachers';

import { AcademicTeamBadge, TeacherPortrait } from './teacher-profile-parts';

const TRUST_SIGNALS = [
  'Biên soạn theo chuyên môn từng môn học',
  'Đối chiếu cấu trúc kỳ thi THPT Quốc gia',
  'Rà soát câu hỏi, đáp án và lời giải nhiều bước',
] as const;

export function TeachersHero({ featuredTeacher }: { featuredTeacher: AcademicContributorProfile }) {
  return (
    <div className="mx-auto grid max-w-[1240px] items-center gap-9 px-4 pb-12 pt-11 sm:px-6 md:pb-16 md:pt-14 lg:min-h-[550px] lg:grid-cols-[minmax(0,0.9fr)_minmax(480px,1.1fr)] lg:gap-16 lg:px-8 lg:pb-20 lg:pt-16">
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#8bb6ff]">
          Đội ngũ học thuật Tú Tài
        </p>
        <h1 className="mt-3.5 max-w-[650px] text-[34px] font-extrabold leading-[1.08] tracking-[-0.045em] text-white sm:text-[42px] md:text-[54px] lg:text-[60px]">
          Mỗi bộ đề đều có người đứng sau chất lượng
        </h1>
        <p className="mt-5 max-w-[620px] text-[16px] font-medium leading-[1.7] text-[#c7d5ea] md:text-[18px]">
          Giáo viên và chuyên gia học thuật trực tiếp biên soạn, phản biện và chuẩn hóa nội dung để
          mỗi câu hỏi đều có mục tiêu rõ ràng trong lộ trình của học sinh.
        </p>

        <ul className="mt-6 grid gap-3.5 text-[13px] font-semibold leading-relaxed text-[#dbe7f8] sm:grid-cols-2">
          {TRUST_SIGNALS.map((signal) => (
            <li key={signal} className="flex items-start gap-2.5 last:sm:col-span-2">
              <CheckCircle2
                size={17}
                className="mt-0.5 shrink-0 text-[#62d8ba]"
                aria-hidden="true"
              />
              {signal}
            </li>
          ))}
        </ul>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="#academic-team"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1768ff] px-5 text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(23,104,255,0.25)] transition-colors duration-200 hover:bg-[#0f5ae4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9fc2ff]"
          >
            Khám phá đội ngũ học thuật
            <ArrowDown size={16} aria-hidden="true" />
          </Link>
          <Link
            href="#editorial-process"
            className="hidden min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.04] px-5 text-[14px] font-bold text-[#dce7f7] transition-colors duration-200 hover:bg-white/[0.09] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9fc2ff] lg:inline-flex"
          >
            Xem quy trình kiểm định nội dung
          </Link>
        </div>
      </div>

      <article className="group overflow-hidden rounded-[22px] border border-white/15 bg-white shadow-[0_28px_70px_rgba(1,12,32,0.28)]">
        <div className="grid sm:grid-cols-[42%_58%]">
          <TeacherPortrait
            teacher={featuredTeacher}
            priority
            sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) 40vw, 250px"
            className="h-[300px] w-full min-[360px]:h-[320px] min-[430px]:h-[340px] sm:h-full sm:min-h-0"
          >
            <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#06162e] via-[#06162e]/90 to-transparent px-4 pb-4 pt-16 sm:px-5 sm:pb-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#9fc2ff]">
                  {featuredTeacher.subject}
                </span>
                <AcademicTeamBadge label={featuredTeacher.teamLabel} inverse />
              </div>
              <h2 className="mt-2.5 text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-white">
                {featuredTeacher.name}
              </h2>
            </div>
          </TeacherPortrait>

          <div className="flex min-w-0 flex-col p-5 sm:p-6">
            <p className="text-[14px] font-semibold leading-relaxed text-[#61738a]">
              {featuredTeacher.academicRole}
            </p>
            <p className="mt-4 text-[17px] font-bold leading-[1.5] text-[#173253]">
              {featuredTeacher.contributionSummary}
            </p>
            <p className="mt-4 border-l-2 border-[#1768ff] pl-3 text-[14px] font-medium leading-[1.6] text-[#526881]">
              {featuredTeacher.editorialPrinciple}
            </p>

            <div className="mt-5 grid gap-2.5 border-t border-[#e8eef8] pt-4 text-[13px] font-semibold text-[#526881]">
              <span className="flex items-center gap-2">
                <BookOpenText size={15} className="text-[#1768ff]" aria-hidden="true" />
                {featuredTeacher.education}
              </span>
              <span className="flex items-center gap-2">
                <Clock3 size={15} className="text-[#1768ff]" aria-hidden="true" />
                {featuredTeacher.experienceLabel}
              </span>
              <span className="flex items-center gap-2">
                <Target size={15} className="shrink-0 text-[#1768ff]" aria-hidden="true" />
                Trọng tâm: {featuredTeacher.specializations.slice(0, 2).join(' · ')}
              </span>
            </div>

            <Link
              href={`/teachers/${featuredTeacher.slug}`}
              className="mt-5 inline-flex min-h-11 items-center justify-between rounded-xl border border-[#c9dcf5] bg-[#f5f8ff] px-4 text-[14px] font-bold text-[#173253] transition-colors duration-200 hover:border-[#9fc2ff] hover:bg-[#eaf2ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1768ff]"
              aria-label={`Xem vai trò chuyên môn của ${featuredTeacher.name}`}
            >
              Xem vai trò chuyên môn
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </article>

      <Link
        href="#editorial-process"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-[14px] font-bold text-[#cbd9ed] transition-colors duration-200 hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9fc2ff] lg:hidden"
      >
        Xem quy trình kiểm định nội dung
      </Link>
    </div>
  );
}
