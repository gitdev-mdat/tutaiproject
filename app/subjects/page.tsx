import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  FlaskConical,
  Atom,
  Leaf,
  FunctionSquare,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { PublicHeader } from '@/components/layout';
import { PublicFooter } from '@/components/layout';
import { SUBJECTS, type SubjectConfig } from '@/config/subjects';

export const metadata: Metadata = {
  title: 'Môn học | Tú Tài',
  description:
    'Chọn môn học để xem lộ trình, chuyên đề và bài luyện phù hợp với mục tiêu của em. Tú Tài tập trung vào 4 môn trọng tâm: Toán, Vật lý, Hóa học, Sinh học.',
};

// ─── Icon map ─────────────────────────────────────────────────────────────────
const ICON_MAP: Record<SubjectConfig['iconName'], LucideIcon> = {
  FunctionSquare,
  Atom,
  FlaskConical,
  Leaf,
};

// ─── Subject Card ─────────────────────────────────────────────────────────────
function SubjectCard({ subject }: { subject: SubjectConfig }) {
  const Icon = ICON_MAP[subject.iconName];

  return (
    <Link
      href={`/subjects/${subject.slug}`}
      className="group relative flex flex-col rounded-[24px] bg-white/95 p-7 outline-none
        focus-visible:ring-2 focus-visible:ring-[#1768FF] focus-visible:ring-offset-2
        transition-all duration-200 ease-out
        hover:-translate-y-[3px] hover:shadow-[0_28px_60px_rgba(35,75,145,0.12)]"
      style={{
        border: `1px solid ${subject.accentBorder}`,
        boxShadow: '0 2px 18px rgba(35,75,145,0.06), 0 1px 4px rgba(35,75,145,0.04)',
      }}
      aria-label={`Xem chương trình môn ${subject.name}`}
    >
      {/* Subtle top accent line */}
      <div
        className="absolute top-0 left-7 right-7 h-[2px] rounded-full transition-all duration-200 group-hover:left-4 group-hover:right-4"
        style={{ background: subject.accentColor, opacity: 0.35 }}
      />

      {/* Top: Icon + category label */}
      <div className="mb-5 flex items-start justify-between">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-[14px] transition-all duration-200 group-hover:scale-105"
          style={{ background: subject.accentBg }}
        >
          <Icon size={22} style={{ color: subject.accentColor }} strokeWidth={1.75} />
        </div>
        <span
          className="text-[10px] font-bold tracking-[0.1em] uppercase"
          style={{ color: subject.accentText, opacity: 0.7 }}
        >
          {subject.label}
        </span>
      </div>

      {/* Subject name */}
      <h2
        className="mb-2 text-[26px] font-extrabold tracking-tight leading-none"
        style={{ color: '#091224' }}
      >
        {subject.name}
      </h2>

      {/* Tagline */}
      <p className="mb-4 text-[14px] font-medium leading-[1.6] text-slate-500">{subject.tagline}</p>

      {/* Topic preview tags — high-level only, not grade-specific */}
      <div className="mb-6 flex flex-wrap gap-2">
        {subject.previewTags.map((tag) => (
          <span
            key={tag}
            className="rounded-full px-3 py-1 text-[12px] font-semibold"
            style={{ background: subject.tagBg, color: subject.tagText }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Value statement */}
      <p className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
        ✓ {subject.valueStatement}
      </p>

      {/* CTA — navigates to subject overview, not directly to Grade 12 */}
      <div
        className="mt-auto flex h-[46px] w-full items-center justify-between rounded-[12px] px-4 text-[14px] font-bold transition-all duration-150"
        style={{
          background: subject.accentBtn,
          color: subject.accentText,
        }}
      >
        <span>Xem chương trình {subject.nameShort}</span>
        <ArrowRight
          size={16}
          className="transition-transform duration-200 group-hover:translate-x-1"
          style={{ color: subject.accentColor }}
        />
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SubjectsPage() {
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(circle at 50% 15%, rgba(23,104,255,0.08), transparent 32%), #F4F8FF',
      }}
    >
      {/* Navbar */}
      <PublicHeader />

      <main id="main-content" tabIndex={-1}>
        {/* ── Page intro ──────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[1200px] px-6 pb-10 pt-7 lg:px-8 lg:pt-14">
          {/* Eyebrow */}
          <div className="mb-5 flex justify-center">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em]"
              style={{
                background: 'rgba(23,104,255,0.06)',
                border: '1px solid rgba(23,104,255,0.14)',
                color: '#1351D8',
              }}
            >
              4 môn trọng tâm
            </span>
          </div>

          {/* Headline */}
          <h1
            className="mb-4 text-center text-[38px] font-extrabold leading-[1.1] tracking-[-0.03em] md:text-[48px] lg:text-[52px]"
            style={{ color: '#091224' }}
          >
            Em muốn chinh phục môn nào?
          </h1>

          {/* Description */}
          <p className="mx-auto max-w-[580px] text-center text-[16px] font-medium leading-[1.7] text-slate-500 lg:text-[18px]">
            Chọn môn học để xem lộ trình, chuyên đề và bài luyện phù hợp với mục tiêu của em.
          </p>

          {/* ── Personalization strip ─────────────────────────────────── */}
          <div
            className="mx-auto mt-8 flex max-w-[680px] flex-col items-center justify-between gap-4 rounded-[16px] px-6 py-4 sm:flex-row"
            style={{
              background: 'rgba(255,255,255,0.80)',
              border: '1px solid rgba(23,104,255,0.10)',
              boxShadow: '0 2px 12px rgba(35,75,145,0.05)',
            }}
          >
            <div>
              <p className="text-[14px] font-semibold text-[#091224]">
                Không biết nên bắt đầu từ đâu?
              </p>
              <p className="text-[13px] font-medium text-slate-500">
                Đánh giá nhanh để Tú Tài gợi ý môn và chuyên đề cần ưu tiên.
              </p>
            </div>
            <Link
              href="/onboarding/welcome"
              className="group flex shrink-0 items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-bold transition-all duration-150 hover:-translate-y-[1px]"
              style={{
                background: 'linear-gradient(135deg, #1768FF 0%, #1448E0 100%)',
                color: '#ffffff',
                boxShadow: '0 3px 10px rgba(23,104,255,0.22)',
              }}
            >
              Đánh giá năng lực
              <ChevronRight
                size={14}
                className="transition-transform duration-150 group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </section>

        {/* ── Subject Grid ─────────────────────────────────────────────── */}
        <section
          className="mx-auto max-w-[1200px] px-6 pb-20 lg:px-8"
          aria-label="Danh sách môn học"
        >
          <div className="grid gap-6 sm:grid-cols-2 lg:gap-7">
            {SUBJECTS.map((subject) => (
              <SubjectCard key={subject.slug} subject={subject} />
            ))}
          </div>

          {/* Bottom note */}
          <p className="mt-10 text-center text-[13px] font-medium text-slate-400">
            Tú Tài tập trung chuyên sâu vào 4 môn thi khối tự nhiên — không dàn trải, không hời hợt.
          </p>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
