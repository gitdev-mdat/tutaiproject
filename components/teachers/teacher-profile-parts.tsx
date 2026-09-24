import Image from 'next/image';
import type { ReactNode } from 'react';
import { BookOpenCheck } from 'lucide-react';

import type { AcademicContributorProfile } from '@/lib/teachers';

export function AcademicTeamBadge({
  label,
  inverse = false,
}: {
  label: string;
  inverse?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.06em] ${
        inverse
          ? 'border-blue-200/20 bg-blue-200/10 text-blue-100'
          : 'border-blue-200 bg-blue-50 text-[#1351d8]'
      }`}
    >
      <BookOpenCheck size={14} strokeWidth={2.2} aria-hidden="true" />
      {label}
    </span>
  );
}

interface TeacherPortraitProps {
  teacher: AcademicContributorProfile;
  priority?: boolean;
  className?: string;
  sizes: string;
  children?: ReactNode;
}

export function TeacherPortrait({
  teacher,
  priority = false,
  className = '',
  sizes,
  children,
}: TeacherPortraitProps) {
  return (
    <div className={`relative overflow-hidden bg-[#0e315b] ${className}`}>
      <Image
        src={teacher.imageSrc}
        alt={teacher.imageAlt}
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover object-top transition-transform duration-200 motion-reduce:transition-none lg:group-hover:scale-[1.02]"
      />
      {children}
    </div>
  );
}
