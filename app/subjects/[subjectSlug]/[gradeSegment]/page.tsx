import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  FlaskConical,
  Atom,
  Leaf,
  FunctionSquare,
  BookOpen,
  Map,
  Dumbbell,
  ScrollText,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import { PublicHeader } from '@/components/layout';
import { PublicFooter } from '@/components/layout';
import { SUBJECTS, type SubjectConfig } from '@/config/subjects';

// ─── Icon map ─────────────────────────────────────────────────────────────────
const ICON_MAP: Record<SubjectConfig['iconName'], LucideIcon> = {
  FunctionSquare,
  Atom,
  FlaskConical,
  Leaf,
};

// ─── Grade route → grade number map ──────────────────────────────────────────
const GRADE_ROUTE_MAP: Record<string, 10 | 11 | 12> = {
  'grade-10': 10,
  'grade-11': 11,
  'grade-12': 12,
};

// ─── Static params ─────────────────────────────────────────────────────────────
export function generateStaticParams() {
  return SUBJECTS.flatMap((s) =>
    s.grades.map((g) => ({
      subjectSlug: s.slug,
      gradeSegment: g.routeSegment,
    }))
  );
}

// ─── Metadata ─────────────────────────────────────────────────────────────────
interface Props {
  params: Promise<{ subjectSlug: string; gradeSegment: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subjectSlug, gradeSegment } = await params;
  const subject = SUBJECTS.find((s) => s.slug === subjectSlug);
  const grade = GRADE_ROUTE_MAP[gradeSegment];
  if (!subject || !grade) return { title: 'Tú Tài' };
  return {
    title: `${subject.name} ${grade} | Tú Tài`,
    description: `Lộ trình, chuyên đề và bài luyện môn ${subject.name} Lớp ${grade} trên Tú Tài.`,
  };
}

// ─── Feature tile ─────────────────────────────────────────────────────────────
function FeatureTile({
  Icon,
  title,
  description,
  href,
  accentColor,
  accentBg,
  disabled = false,
}: {
  Icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  accentColor: string;
  accentBg: string;
  disabled?: boolean;
}) {
  const inner = (
    <div
      className={`flex flex-col rounded-[16px] p-5 transition-all duration-200 ${
        disabled
          ? 'opacity-60'
          : 'hover:-translate-y-[2px] hover:shadow-[0_12px_32px_rgba(35,75,145,0.10)]'
      }`}
      style={{
        background: 'rgba(255,255,255,0.92)',
        border: disabled ? '1px solid rgba(23,104,255,0.07)' : `1px solid ${accentBg}`,
        boxShadow: disabled ? 'none' : '0 2px 10px rgba(35,75,145,0.05)',
      }}
    >
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-[12px]"
        style={{ background: accentBg }}
      >
        <Icon size={18} style={{ color: accentColor }} strokeWidth={1.75} />
      </div>
      <p className="mb-1 text-[15px] font-bold" style={{ color: '#091224' }}>
        {title}
      </p>
      <p className="text-[13px] font-medium leading-[1.5] text-slate-500">{description}</p>
    </div>
  );

  if (disabled) return inner;
  return (
    <Link
      href={href}
      className="block outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-[16px]"
      style={{ ['--tw-ring-color' as string]: accentColor }}
    >
      {inner}
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function SubjectGradePage({ params }: Props) {
  const { subjectSlug, gradeSegment } = await params;
  const subject = SUBJECTS.find((s) => s.slug === subjectSlug);
  const grade = GRADE_ROUTE_MAP[gradeSegment];

  if (!subject || !grade) notFound();

  const gradeConfig = subject.grades.find((g) => g.grade === grade);
  if (!gradeConfig || gradeConfig.availability !== 'active') notFound();

  const Icon = ICON_MAP[subject.iconName];

  const features = [
    {
      Icon: Map,
      title: 'Lộ trình',
      description: 'Lộ trình cá nhân hóa theo năng lực của em.',
      href: `/student/roadmap`,
    },
    {
      Icon: BookOpen,
      title: 'Chuyên đề & Bài học',
      description: 'Từng chuyên đề được chia theo chương, bài rõ ràng.',
      href: `/subjects/${subject.slug}/grade-12/topics`,
    },
    {
      Icon: Dumbbell,
      title: 'Luyện tập',
      description: 'Bài tập theo dạng, theo mức độ, có giải thích chi tiết.',
      href: `/subjects/${subject.slug}/grade-12/practice`,
    },
    {
      Icon: ScrollText,
      title: 'Thi thử',
      description: 'Đề thi THPT Quốc Gia năm trước, thi thử theo thời gian thật.',
      href: `/exam-sets`,
    },
    {
      Icon: BarChart3,
      title: 'Tiến độ',
      description: 'Theo dõi những phần đã học và phần còn yếu.',
      href: `/student/roadmap`,
    },
  ];

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(circle at 50% 12%, rgba(23,104,255,0.07), transparent 28%), #F4F8FF',
      }}
    >
      <PublicHeader />

      <main id="main-content" tabIndex={-1}>
        <section className="mx-auto max-w-[900px] px-6 pb-20 pt-10 lg:px-8 lg:pt-12">
          {/* Breadcrumb */}
          <Link
            href={`/subjects/${subject.slug}`}
            className="mb-8 inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 transition-colors hover:text-[#1351D8]"
          >
            <ArrowLeft size={14} />
            {subject.name}
          </Link>

          {/* Header */}
          <div className="mb-10 flex flex-col items-center text-center">
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-[18px]"
              style={{ background: subject.accentBg }}
            >
              <Icon size={28} style={{ color: subject.accentColor }} strokeWidth={1.75} />
            </div>

            <span
              className="mb-2 rounded-full px-3 py-1 text-[11px] font-bold"
              style={{ background: subject.accentBg, color: subject.accentText }}
            >
              LỚP {grade}
            </span>

            <h1
              className="mb-2 text-[40px] font-extrabold tracking-[-0.03em] leading-tight md:text-[52px]"
              style={{ color: '#091224' }}
            >
              {subject.name} {grade}
            </h1>

            <p className="max-w-[480px] text-[15px] font-medium leading-[1.7] text-slate-500">
              {gradeConfig.subtitle} — lộ trình, chuyên đề và bài luyện được thiết kế riêng cho
              chương trình Lớp {grade}.
            </p>
          </div>

          {/* Feature tiles */}
          <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <FeatureTile
                key={f.title}
                Icon={f.Icon}
                title={f.title}
                description={f.description}
                href={f.href}
                accentColor={subject.accentColor}
                accentBg={subject.accentBg}
              />
            ))}
          </div>

          {/* Primary action */}
          <div className="flex justify-center">
            <Link
              href="/student/roadmap"
              className="flex h-[52px] items-center gap-2 rounded-[14px] px-8 text-[15px] font-bold text-white transition-all hover:-translate-y-[1px] hover:shadow-[0_8px_24px_rgba(23,104,255,0.30)]"
              style={{
                background: `linear-gradient(135deg, ${subject.accentColor} 0%, #1448E0 100%)`,
                boxShadow: `0 4px 16px rgba(23,104,255,0.22)`,
              }}
            >
              Bắt đầu lộ trình {subject.nameShort} {grade}
              <ArrowLeft size={16} className="rotate-180" />
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
