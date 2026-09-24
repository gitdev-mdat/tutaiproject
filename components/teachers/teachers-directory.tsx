'use client';

import { useMemo, useState } from 'react';
import { Search, UsersRound } from 'lucide-react';

import type { AcademicContributorProfile, TeacherSubject } from '@/lib/teachers';

import { TeacherCard } from './teacher-card';

type SubjectFilter = 'Tất cả' | TeacherSubject;

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLocaleLowerCase('vi');
}

interface TeachersDirectoryProps {
  teachers: readonly AcademicContributorProfile[];
  subjects: readonly TeacherSubject[];
}

export function TeachersDirectory({ teachers, subjects }: TeachersDirectoryProps) {
  const [activeSubject, setActiveSubject] = useState<SubjectFilter>('Tất cả');
  const [query, setQuery] = useState('');
  const filters: readonly SubjectFilter[] = ['Tất cả', ...subjects];

  const filteredTeachers = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query.trim());

    return teachers.filter((teacher) => {
      const matchesSubject = activeSubject === 'Tất cả' || teacher.subject === activeSubject;
      const searchableText = normalizeSearchValue(
        [
          teacher.name,
          teacher.subject,
          teacher.academicRole,
          teacher.contributionSummary,
          ...teacher.specializations,
          ...teacher.contentResponsibilities,
        ].join(' ')
      );
      const matchesQuery = normalizedQuery.length === 0 || searchableText.includes(normalizedQuery);

      return matchesSubject && matchesQuery;
    });
  }, [activeSubject, query, teachers]);

  return (
    <section
      id="academic-team"
      aria-labelledby="academic-team-title"
      className="scroll-mt-4 bg-[#f5f8ff] px-4 py-16 sm:px-6 md:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-[1240px]">
        <div className="max-w-[780px]">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#1351d8]">
            Đội ngũ biên soạn theo môn học
          </p>
          <h2
            id="academic-team-title"
            className="mt-3 text-[29px] font-extrabold leading-[1.15] tracking-[-0.035em] text-[#0a1628] md:text-[42px]"
          >
            Những người trực tiếp xây dựng nội dung của Tú Tài
          </h2>
          <p className="mt-4 max-w-[720px] text-[15px] font-medium leading-[1.7] text-[#61738a] md:text-[17px]">
            Mỗi thành viên phụ trách một nhóm chuyên môn, từ xây dựng câu hỏi và lời giải đến phản
            biện cấu trúc, độ chính xác và giá trị học tập.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4 border-y border-[#dfe8f5] py-5 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
            role="group"
            aria-label="Duyệt đội ngũ học thuật theo môn học"
          >
            {filters.map((filter) => {
              const isActive = filter === activeSubject;
              return (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveSubject(filter)}
                  className={`min-h-11 shrink-0 rounded-xl border px-4 text-[14px] font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1768ff] ${
                    isActive
                      ? 'border-[#9fc2ff] bg-[#eaf2ff] text-[#0b55c8]'
                      : 'border-transparent bg-transparent text-[#526881] hover:border-[#d7e4f6] hover:bg-white'
                  }`}
                >
                  {filter}
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:w-[360px]">
            <label htmlFor="contributor-search" className="sr-only">
              Tìm thành viên hoặc lĩnh vực phụ trách
            </label>
            <Search
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#71849b]"
              aria-hidden="true"
            />
            <input
              id="contributor-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm thành viên hoặc lĩnh vực phụ trách..."
              className="h-12 w-full rounded-xl border border-[#d7e4f2] bg-white pl-11 pr-4 text-[14px] text-[#0a1628] outline-none transition-[border-color,box-shadow] placeholder:text-[#8796a9] focus:border-[#7eafff] focus:ring-4 focus:ring-[#1768ff]/10"
            />
          </div>
        </div>

        {filteredTeachers.length > 0 ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredTeachers.map((teacher) => (
              <TeacherCard key={teacher.id} teacher={teacher} />
            ))}
          </div>
        ) : (
          <div className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-[20px] border border-dashed border-[#cad9ed] bg-white px-6 text-center">
            <UsersRound size={28} className="text-[#6f8db5]" aria-hidden="true" />
            <h3 className="mt-4 text-lg font-bold text-[#0a1628]">
              Chưa tìm thấy thành viên phù hợp
            </h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[#61738a]">
              Thử chọn môn học khác hoặc tìm bằng một lĩnh vực phụ trách ngắn hơn.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
