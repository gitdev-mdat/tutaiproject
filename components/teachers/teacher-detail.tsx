import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Layers3,
} from 'lucide-react';

import type { AcademicContributorProfile, EditorialStage } from '@/lib/teachers';

import { AcademicTeamBadge, TeacherPortrait } from './teacher-profile-parts';

const EDITORIAL_STAGE_DESCRIPTIONS: Record<EditorialStage, string> = {
  'Biên soạn': 'Xây dựng câu hỏi, đáp án, lời giải và mục tiêu đánh giá theo chuyên môn.',
  'Phản biện': 'Đối chiếu độ chính xác, cách diễn đạt và giá trị phân loại của nội dung.',
  'Chuẩn hóa lời giải': 'Thống nhất lập luận, ký hiệu và mức độ chi tiết cần thiết trong lời giải.',
  'Kiểm tra cấu trúc': 'Rà soát sự cân đối giữa chuyên đề, kỹ năng và mức độ của bộ nội dung.',
};

export function TeacherProfileHero({ teacher }: { teacher: AcademicContributorProfile }) {
  return (
    <div className="mx-auto grid max-w-[1160px] items-center gap-10 px-4 pb-16 pt-10 sm:px-6 md:grid-cols-[minmax(300px,0.78fr)_minmax(0,1.22fr)] md:gap-14 md:pb-20 md:pt-14 lg:px-8">
      <div className="group mx-auto w-full max-w-[430px]">
        <TeacherPortrait
          teacher={teacher}
          priority
          sizes="(max-width: 767px) calc(100vw - 32px), 420px"
          className="aspect-[4/5] w-full rounded-[22px] border border-white/15 shadow-[0_28px_65px_rgba(0,8,24,0.3)]"
        />
      </div>

      <div className="min-w-0">
        <Link
          href="/teachers"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg text-[13px] font-bold text-[#aebfd8] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9fc2ff]"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Đội ngũ học thuật
        </Link>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8bb6ff]">
            {teacher.subject}
          </span>
          <AcademicTeamBadge label={teacher.teamLabel} inverse />
        </div>

        <h1 className="mt-4 text-[38px] font-extrabold leading-[1.08] tracking-[-0.04em] text-white md:text-[50px] lg:text-[58px]">
          {teacher.name}
        </h1>
        <p className="mt-3 text-[16px] font-bold text-[#9fc2ff] md:text-[18px]">
          {teacher.academicRole}
        </p>
        <p className="mt-2 text-[14px] font-semibold text-[#b8c8df] md:text-[15px]">
          {teacher.professionalBackground}
        </p>
        <p className="mt-6 max-w-[650px] text-[20px] font-bold leading-[1.48] tracking-[-0.015em] text-[#edf4ff] md:text-[24px]">
          {teacher.contributionSummary}
        </p>

        <div className="mt-7 grid gap-3 border-y border-white/10 py-5 text-[14px] font-semibold text-[#d3dff0] sm:grid-cols-2">
          <span className="flex items-center gap-2.5">
            <BookOpenText size={17} className="shrink-0 text-[#8bb6ff]" aria-hidden="true" />
            {teacher.education}
          </span>
          <span className="flex items-center gap-2.5">
            <Clock3 size={17} className="shrink-0 text-[#8bb6ff]" aria-hidden="true" />
            {teacher.experienceLabel}
          </span>
        </div>

        <ul className="mt-5 flex flex-wrap gap-2" aria-label={`Lĩnh vực của ${teacher.name}`}>
          {teacher.specializations.map((specialization) => (
            <li
              key={specialization}
              className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[12px] font-bold text-[#dae6f7]"
            >
              {specialization}
            </li>
          ))}
        </ul>

        <Link
          href="/exam-sets"
          className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1768ff] px-5 text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(23,104,255,0.25)] transition-colors duration-200 hover:bg-[#0f5ae4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9fc2ff]"
        >
          Khám phá bộ đề của Tú Tài
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export function TeacherProfileContent({ teacher }: { teacher: AcademicContributorProfile }) {
  return (
    <div className="bg-[#f5f8ff]">
      <section
        aria-labelledby="contributor-role-title"
        className="mx-auto grid max-w-[1160px] gap-10 px-4 py-16 sm:px-6 md:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)] md:py-24 lg:gap-16 lg:px-8"
      >
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#1351d8]">
            Trách nhiệm học thuật
          </p>
          <h2
            id="contributor-role-title"
            className="mt-3 text-[29px] font-extrabold tracking-[-0.035em] text-[#0a1628] md:text-[40px]"
          >
            Vai trò tại Tú Tài
          </h2>
          <p className="mt-5 text-[16px] font-medium leading-[1.8] text-[#526881]">
            {teacher.profileSummary}
          </p>

          <div className="mt-8 rounded-[18px] border border-[#dbe7f5] bg-white p-5 sm:p-6">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#71849b]">
              Nguyên tắc biên soạn
            </p>
            <p className="mt-3 text-[19px] font-bold leading-[1.55] tracking-[-0.01em] text-[#173253]">
              {teacher.editorialPrinciple}
            </p>
          </div>
        </div>

        <aside className="rounded-[20px] border border-[#dbe7f5] bg-white p-5 sm:p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eaf2ff] text-[#0b55c8]">
            <ClipboardCheck size={21} aria-hidden="true" />
          </div>
          <h2 className="mt-5 text-[21px] font-extrabold tracking-[-0.02em] text-[#0a1628]">
            Nội dung phụ trách
          </h2>
          <ul className="mt-4 grid gap-3">
            {teacher.contentResponsibilities.map((responsibility) => (
              <li
                key={responsibility}
                className="flex items-start gap-2.5 text-[14px] font-semibold leading-relaxed text-[#526881]"
              >
                <CheckCircle2
                  size={17}
                  className="mt-0.5 shrink-0 text-[#138b73]"
                  aria-hidden="true"
                />
                {responsibility}
              </li>
            ))}
          </ul>

          <div className="mt-7 border-t border-[#e8eef8] pt-5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#71849b]">
              Lĩnh vực chuyên môn
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {teacher.specializations.map((specialization) => (
                <li
                  key={specialization}
                  className="rounded-full bg-[#f0f5fc] px-3 py-1.5 text-[12px] font-bold text-[#415b79]"
                >
                  {specialization}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>

      <section
        aria-labelledby="editorial-participation-title"
        className="bg-white px-4 py-16 sm:px-6 md:py-24 lg:px-8"
      >
        <div className="mx-auto max-w-[1160px]">
          <div className="max-w-[760px]">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#1351d8]">
              Trách nhiệm biên tập
            </p>
            <h2
              id="editorial-participation-title"
              className="mt-3 text-[29px] font-extrabold leading-[1.15] tracking-[-0.035em] text-[#0a1628] md:text-[40px]"
            >
              Tham gia quy trình nội dung
            </h2>
            <p className="mt-4 text-[15px] font-medium leading-[1.75] text-[#61738a] md:text-[16px]">
              Hồ sơ mô tả các giai đoạn chuyên môn mà thành viên tham gia; không gán quyền sở hữu cá
              nhân cho toàn bộ bộ đề hoặc nội dung đã xuất bản.
            </p>
          </div>

          <ol className="mt-9 border-y border-[#dfe8f5] lg:grid lg:grid-cols-4">
            {teacher.editorialStages.map((stage, index) => (
              <li
                key={stage}
                className={`py-7 lg:px-6 lg:py-8 ${
                  index > 0 ? 'border-t border-[#dfe8f5] lg:border-l lg:border-t-0' : ''
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf2ff] text-[#0b55c8]">
                  {index % 2 === 0 ? (
                    <FileCheck2 size={19} aria-hidden="true" />
                  ) : (
                    <Layers3 size={19} aria-hidden="true" />
                  )}
                </div>
                <span className="mt-5 block text-[11px] font-extrabold tracking-[0.12em] text-[#7b8da3]">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-2 text-[19px] font-extrabold text-[#0a1628]">{stage}</h3>
                <p className="mt-3 text-[14px] font-medium leading-[1.7] text-[#61738a]">
                  {EDITORIAL_STAGE_DESCRIPTIONS[stage]}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
