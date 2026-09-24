import Link from 'next/link';
import { ArrowUpRight, BookOpenText, Clock3, ListChecks } from 'lucide-react';

import type { AcademicContributorProfile } from '@/lib/teachers';

import { AcademicTeamBadge, TeacherPortrait } from './teacher-profile-parts';

export function TeacherCard({ teacher }: { teacher: AcademicContributorProfile }) {
  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-[#dfe8f5] bg-white shadow-[0_10px_30px_rgba(35,70,120,0.06)] transition-[transform,border-color,box-shadow] duration-200 motion-reduce:transition-none lg:hover:-translate-y-[3px] lg:hover:border-[#b8d4ff] lg:hover:shadow-[0_16px_38px_rgba(35,70,120,0.11)]">
      <TeacherPortrait
        teacher={teacher}
        sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1279px) 46vw, 390px"
        className="aspect-[5/4] w-full"
      />

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#1351d8]">
            {teacher.subject}
          </span>
          <AcademicTeamBadge label={teacher.teamLabel} />
        </div>

        <h3 className="text-[23px] font-extrabold leading-tight tracking-[-0.025em] text-[#0a1628]">
          {teacher.name}
        </h3>
        <p className="mt-1.5 text-[13px] font-bold leading-relaxed text-[#1351d8]">
          {teacher.academicRole}
        </p>
        <p className="mt-4 text-[15px] font-semibold leading-[1.55] text-[#243a58]">
          {teacher.contributionSummary}
        </p>

        <ul className="mt-4 flex flex-wrap gap-2" aria-label={`Lĩnh vực của ${teacher.name}`}>
          {teacher.specializations.map((specialization) => (
            <li
              key={specialization}
              className="rounded-full border border-[#dfe8f5] bg-[#f5f8ff] px-3 py-1.5 text-[12px] font-semibold text-[#49617f]"
            >
              {specialization}
            </li>
          ))}
        </ul>

        <div className="mt-5 grid gap-2 border-y border-[#e8eef8] py-4 text-[13px] text-[#526881] sm:grid-cols-2">
          <span className="flex items-center gap-2">
            <BookOpenText size={15} className="shrink-0 text-[#1768ff]" aria-hidden="true" />
            {teacher.education}
          </span>
          <span className="flex items-center gap-2">
            <Clock3 size={15} className="shrink-0 text-[#1768ff]" aria-hidden="true" />
            {teacher.experienceLabel}
          </span>
        </div>

        <div className="mt-4 flex items-start gap-2.5 text-[13px] font-semibold leading-relaxed text-[#526881]">
          <ListChecks size={16} className="mt-0.5 shrink-0 text-[#1768ff]" aria-hidden="true" />
          <p>
            <span className="text-[#263f5d]">Phụ trách: </span>
            {teacher.contentResponsibilities.slice(0, 2).join(' · ')}
          </p>
        </div>

        <Link
          href={`/teachers/${teacher.slug}`}
          aria-label={`Xem vai trò chuyên môn của ${teacher.name} trong đội ngũ ${teacher.subject}`}
          className="mt-5 inline-flex min-h-11 items-center justify-between rounded-xl bg-[#0a1628] px-4 text-[14px] font-bold text-white transition-colors duration-200 hover:bg-[#14345f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1768ff]"
        >
          Xem vai trò chuyên môn
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
