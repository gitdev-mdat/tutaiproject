import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  ArrowLeft,
  FlaskConical,
  Atom,
  Leaf,
  FunctionSquare,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import { PublicHeader } from '@/components/layout';
import { PublicFooter } from '@/components/layout';
import { SUBJECTS, type SubjectConfig, type SubjectGradeConfig } from '@/config/subjects';

// ─── Icon map ─────────────────────────────────────────────────────────────────
const ICON_MAP: Record<SubjectConfig['iconName'], LucideIcon> = {
  FunctionSquare,
  Atom,
  FlaskConical,
  Leaf,
};

// ─── Static params ─────────────────────────────────────────────────────────────
export function generateStaticParams() {
  return SUBJECTS.map((s) => ({ subjectSlug: s.slug }));
}

// ─── Metadata ─────────────────────────────────────────────────────────────────
interface Props {
  params: Promise<{ subjectSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subjectSlug } = await params;
  const subject = SUBJECTS.find((s) => s.slug === subjectSlug);
  if (!subject) return { title: 'Môn học | Tú Tài' };
  return {
    title: `${subject.name} — Chọn lớp | Tú Tài`,
    description: `Chọn khối lớp để bắt đầu học ${subject.name} trên Tú Tài. Hiện hỗ trợ Lớp 12, Lớp 10 và 11 sắp ra mắt.`,
  };
}

// ─── Grade Card ───────────────────────────────────────────────────────────────
function GradeCard({ grade, subject }: { grade: SubjectGradeConfig; subject: SubjectConfig }) {
  const isActive = grade.availability === 'active';

  if (isActive) {
    return (
      <Link
        href={`/subjects/${subject.slug}/${grade.routeSegment}`}
        className="group relative flex flex-col rounded-[20px] p-6 outline-none
          focus-visible:ring-2 focus-visible:ring-offset-2 transition-all duration-200
          hover:-translate-y-[2px] hover:shadow-[0_16px_40px_rgba(35,75,145,0.13)]"
        style={{
          background: subject.accentBg,
          border: `1.5px solid ${subject.accentBorder}`,
        }}
        aria-label={`Vào ${subject.name} ${grade.label}`}
      >
        {/* Grade number */}
        <div className="mb-3 flex items-center justify-between">
          <span
            className="text-[32px] font-black leading-none tracking-tight"
            style={{ color: subject.accentColor }}
          >
            {grade.grade}
          </span>
          {/* Active badge */}
          <span
            className="rounded-full px-3 py-1 text-[11px] font-bold"
            style={{
              background: subject.accentColor,
              color: '#ffffff',
            }}
          >
            Đang hỗ trợ
          </span>
        </div>

        {/* Label */}
        <p className="mb-0.5 text-[18px] font-extrabold" style={{ color: '#091224' }}>
          {grade.label}
        </p>
        <p className="mb-5 text-[13px] font-medium text-slate-500">{grade.subtitle}</p>

        {/* CTA row */}
        <div
          className="mt-auto flex items-center justify-between rounded-[12px] px-4 py-3 text-[14px] font-bold transition-all duration-150"
          style={{ background: subject.accentColor, color: '#ffffff' }}
        >
          <span>
            Vào {subject.nameShort} {grade.grade} →
          </span>
          <ArrowRight
            size={15}
            className="transition-transform duration-200 group-hover:translate-x-1"
          />
        </div>
      </Link>
    );
  }

  // Coming soon
  return (
    <div
      className="relative flex flex-col rounded-[20px] p-6"
      style={{
        background: 'rgba(248,250,255,0.80)',
        border: '1.5px solid rgba(23,104,255,0.08)',
      }}
      aria-label={`${subject.name} ${grade.label} — Sắp ra mắt`}
    >
      {/* Grade number */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[32px] font-black leading-none tracking-tight text-slate-300">
          {grade.grade}
        </span>
        {/* Coming soon badge */}
        <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-500">
          <Clock size={11} />
          Sắp ra mắt
        </span>
      </div>

      {/* Label */}
      <p className="mb-0.5 text-[18px] font-extrabold text-slate-400">{grade.label}</p>
      <p className="mb-5 text-[13px] font-medium text-slate-400">{grade.subtitle}</p>

      {/* Placeholder CTA */}
      <div className="mt-auto flex items-center justify-center rounded-[12px] border border-slate-200 px-4 py-3 text-[13px] font-semibold text-slate-400">
        Thông báo khi có →
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function SubjectOverviewPage({ params }: Props) {
  const { subjectSlug } = await params;
  const subject = SUBJECTS.find((s) => s.slug === subjectSlug);

  if (!subject) notFound();

  const Icon = ICON_MAP[subject.iconName];

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
          {/* Back breadcrumb */}
          <Link
            href="/subjects"
            className="mb-8 inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 transition-colors hover:text-[#1351D8]"
          >
            <ArrowLeft size={14} />
            Tất cả môn học
          </Link>

          {/* Subject identity */}
          <div className="mb-10 flex flex-col items-center text-center">
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-[18px]"
              style={{ background: subject.accentBg }}
            >
              <Icon size={28} style={{ color: subject.accentColor }} strokeWidth={1.75} />
            </div>

            <span
              className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em]"
              style={{ color: subject.accentText }}
            >
              {subject.label}
            </span>

            <h1
              className="mb-3 text-[40px] font-extrabold tracking-[-0.03em] leading-none md:text-[52px]"
              style={{ color: '#091224' }}
            >
              {subject.name}
            </h1>

            <p
              className="mb-2 text-[22px] font-semibold tracking-tight"
              style={{ color: '#091224' }}
            >
              Chọn khối lớp của em.
            </p>
            <p className="max-w-[520px] text-[15px] font-medium leading-[1.7] text-slate-500">
              Mỗi khối có kiến thức, chuyên đề và lộ trình khác nhau. Tú Tài sẽ xây lộ trình phù hợp
              với đúng chương trình em đang học.
            </p>
          </div>

          {/* ── Grade cards ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
            {subject.grades.map((grade) => (
              <GradeCard key={grade.grade} grade={grade} subject={subject} />
            ))}
          </div>

          {/* Supporting note */}
          <p className="mt-8 text-center text-[13px] font-medium text-slate-400">
            Tú Tài hiện tập trung vào chương trình Lớp 12 — Lớp 10 và 11 sẽ ra mắt sớm.
          </p>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
