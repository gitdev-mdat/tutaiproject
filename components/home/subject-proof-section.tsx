import { Fragment } from 'react';
import Link from 'next/link';
import { ArrowRight, Atom, FlaskConical, GraduationCap, Leaf, Sigma } from 'lucide-react';

import { SUBJECTS as SUBJECT_CONFIG } from '@/config/subjects';

const SUBJECT_STYLES = {
  toan: {
    card: 'sm:hover:border-[#1768ff]/35 sm:hover:shadow-[0_18px_38px_-20px_rgba(23,104,255,0.55)]',
    focus: 'focus-visible:ring-[#1768ff]/35',
    iconSurface: 'bg-[#1768ff]/[0.08] shadow-[inset_0_0_0_1px_rgba(23,104,255,0.08)]',
    icon: 'text-[#1768ff]',
    arrow: 'group-hover:text-[#1768ff] group-active:text-[#1768ff]',
  },
  'vat-ly': {
    card: 'sm:hover:border-[#0ea5c6]/35 sm:hover:shadow-[0_18px_38px_-20px_rgba(14,165,198,0.5)]',
    focus: 'focus-visible:ring-[#0ea5c6]/35',
    iconSurface: 'bg-[#0ea5c6]/[0.08] shadow-[inset_0_0_0_1px_rgba(14,165,198,0.08)]',
    icon: 'text-[#0a8eaa]',
    arrow: 'group-hover:text-[#0a8eaa] group-active:text-[#0a8eaa]',
  },
  'hoa-hoc': {
    card: 'sm:hover:border-[#f59e0b]/35 sm:hover:shadow-[0_18px_38px_-20px_rgba(245,158,11,0.5)]',
    focus: 'focus-visible:ring-[#f59e0b]/35',
    iconSurface: 'bg-[#f59e0b]/[0.08] shadow-[inset_0_0_0_1px_rgba(245,158,11,0.08)]',
    icon: 'text-[#d97706]',
    arrow: 'group-hover:text-[#d97706] group-active:text-[#d97706]',
  },
  'sinh-hoc': {
    card: 'sm:hover:border-[#13b99a]/35 sm:hover:shadow-[0_18px_38px_-20px_rgba(19,185,154,0.5)]',
    focus: 'focus-visible:ring-[#13b99a]/35',
    iconSurface: 'bg-[#13b99a]/[0.08] shadow-[inset_0_0_0_1px_rgba(19,185,154,0.08)]',
    icon: 'text-[#0d937b]',
    arrow: 'group-hover:text-[#0d937b] group-active:text-[#0d937b]',
  },
} as const;

const SUBJECTS = [
  { slug: 'toan', title: 'Toán', href: '/subjects/toan', icon: Sigma },
  { slug: 'vat-ly', title: 'Vật lý', href: '/subjects/vat-ly', icon: Atom },
  { slug: 'hoa-hoc', title: 'Hóa học', href: '/subjects/hoa-hoc', icon: FlaskConical },
  { slug: 'sinh-hoc', title: 'Sinh học', href: '/subjects/sinh-hoc', icon: Leaf },
] as const;

/** Topic names come from the subject config, the single source for subjects. */
function topicsOf(slug: string): readonly string[] {
  return SUBJECT_CONFIG.find((subject) => subject.slug === slug)?.previewTags ?? [];
}

/**
 * "Học gì trên Tú Tài?" — the four subjects as entry points.
 *
 * Phones get one composed subject index (all four subjects in about one
 * screen), tablets a 2×2 grid of rows and desktops four cards, from the same
 * markup. The section shows no counts or live activity: none of them has a
 * data source yet.
 */
export function SubjectProofSection() {
  return (
    <section
      aria-labelledby="subject-proof-heading"
      className="relative w-full overflow-hidden bg-[linear-gradient(180deg,#f2f7ff_0%,#f5f9ff_58%,#f7faff_100%)] pb-14 pt-10 sm:py-20 lg:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-48 top-16 h-[560px] w-[560px] rounded-full bg-blue-200/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 bottom-0 h-80 w-80 rounded-full bg-cyan-100/30 blur-3xl"
      />

      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-6 sm:px-8 lg:px-12">
        <div className="grid items-center gap-7 sm:gap-10 xl:grid-cols-[340px_minmax(0,1fr)] xl:gap-12 2xl:grid-cols-[368px_minmax(0,1fr)] 2xl:gap-16">
          <div className="flex max-w-[560px] flex-col items-start text-left">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-white/75 px-3.5 py-1.5 text-[11px] font-extrabold tracking-[0.12em] text-[#075cf4] shadow-[0_8px_24px_-18px_rgba(7,92,244,0.7)] backdrop-blur-md sm:mb-5 sm:text-xs">
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
              CHƯƠNG TRÌNH LỚP 12
            </div>

            <h2
              id="subject-proof-heading"
              className="text-balance text-[clamp(2.125rem,5vw,4.5rem)] font-extrabold leading-[1.04] tracking-[-0.045em]"
            >
              <span className="text-[#08162f]">Học gì trên </span>
              <span className="text-[#075cf4]">Tú Tài?</span>
            </h2>

            <p className="mt-3.5 max-w-[520px] text-[15px] font-medium leading-6 text-slate-600 sm:mt-5 sm:text-lg sm:leading-7">
              4 môn lớp 12 với bài học trọng tâm, luyện tập và bộ đề. Chọn một môn để bắt đầu.
            </p>
          </div>

          <ul className="grid rounded-[26px] border border-white/90 bg-white/85 p-1.5 shadow-[0_20px_48px_-32px_rgba(8,22,47,0.55)] backdrop-blur-sm sm:grid-cols-2 sm:gap-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none lg:grid-cols-4">
            {SUBJECTS.map((subject) => {
              const styles = SUBJECT_STYLES[subject.slug];
              const Icon = subject.icon;

              return (
                <li
                  key={subject.slug}
                  className="relative before:absolute before:left-[74px] before:right-4 before:top-0 before:h-px before:bg-slate-200/70 first:before:hidden sm:before:hidden"
                >
                  <Link
                    href={subject.href}
                    className={`group flex h-full min-h-[76px] items-center gap-3.5 rounded-[20px] px-3 py-3 text-left outline-none active:bg-slate-50/90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:min-h-[88px] sm:gap-4 sm:rounded-[24px] sm:border sm:border-white/90 sm:bg-white/90 sm:px-4 sm:py-4 sm:shadow-[0_12px_30px_-22px_rgba(8,22,47,0.45)] sm:backdrop-blur-sm sm:focus-visible:ring-offset-4 sm:focus-visible:ring-offset-[#f4f8ff] motion-safe:transition-all motion-safe:duration-300 lg:min-h-[220px] lg:flex-col lg:items-start lg:gap-0 lg:p-5 lg:motion-safe:hover:-translate-y-1.5 ${styles.card} ${styles.focus}`}
                  >
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] lg:h-14 lg:w-14 lg:rounded-[18px] ${styles.iconSurface}`}
                    >
                      <Icon
                        className={`h-6 w-6 lg:h-7 lg:w-7 ${styles.icon}`}
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                    </span>

                    <div className="min-w-0 flex-1 lg:mt-5 lg:flex-none">
                      <h3 className="text-[17px] font-extrabold leading-6 tracking-[-0.02em] text-[#08162f] sm:text-lg lg:text-xl lg:tracking-[-0.025em]">
                        {subject.title}
                      </h3>
                      <span className="mt-0.5 block text-[13px] font-medium leading-5 text-slate-500 lg:mt-2">
                        {topicsOf(subject.slug).map((topic, index) => (
                          <Fragment key={topic}>
                            {index > 0 ? ' · ' : null}
                            <span className="whitespace-nowrap">{topic}</span>
                          </Fragment>
                        ))}
                      </span>
                    </div>

                    <span className="flex shrink-0 items-center text-xs font-bold text-slate-500 lg:mt-auto lg:w-full lg:justify-between lg:pt-5">
                      <span className="hidden lg:inline">Xem môn học</span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100/80 lg:h-auto lg:w-auto lg:bg-transparent">
                        <ArrowRight
                          className={`h-4 w-4 text-slate-400 motion-safe:transition-all motion-safe:duration-200 motion-safe:group-hover:translate-x-0.5 lg:text-slate-300 lg:motion-safe:group-hover:translate-x-1 ${styles.arrow}`}
                          aria-hidden="true"
                        />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
