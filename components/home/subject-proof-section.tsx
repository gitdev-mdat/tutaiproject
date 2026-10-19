import Link from 'next/link';
import {
  ArrowRight,
  Atom,
  ChevronRight,
  FlaskConical,
  GraduationCap,
  Leaf,
  Sigma,
} from 'lucide-react';

const SUBJECT_STYLES = {
  toan: {
    card: 'sm:hover:border-[#1768ff]/35 sm:hover:shadow-[0_18px_38px_-20px_rgba(23,104,255,0.55)]',
    focus: 'focus-visible:ring-[#1768ff]/70',
    iconSurface: 'bg-[#1768ff]/[0.08] shadow-[inset_0_0_0_1px_rgba(23,104,255,0.08)]',
    icon: 'text-[#1768ff]',
    arrow: 'group-hover:text-[#1768ff]',
    chevron: 'bg-[#1768ff]/[0.07] text-[#1768ff]',
  },
  'vat-ly': {
    card: 'sm:hover:border-[#0ea5c6]/35 sm:hover:shadow-[0_18px_38px_-20px_rgba(14,165,198,0.5)]',
    focus: 'focus-visible:ring-[#0ea5c6]/70',
    iconSurface: 'bg-[#0ea5c6]/[0.08] shadow-[inset_0_0_0_1px_rgba(14,165,198,0.08)]',
    icon: 'text-[#0a8eaa]',
    arrow: 'group-hover:text-[#0a8eaa]',
    chevron: 'bg-[#0ea5c6]/[0.08] text-[#0a8eaa]',
  },
  'hoa-hoc': {
    card: 'sm:hover:border-[#f59e0b]/35 sm:hover:shadow-[0_18px_38px_-20px_rgba(245,158,11,0.5)]',
    focus: 'focus-visible:ring-[#f59e0b]/70',
    iconSurface: 'bg-[#f59e0b]/[0.08] shadow-[inset_0_0_0_1px_rgba(245,158,11,0.08)]',
    icon: 'text-[#d97706]',
    arrow: 'group-hover:text-[#d97706]',
    chevron: 'bg-[#f59e0b]/[0.09] text-[#d97706]',
  },
  'sinh-hoc': {
    card: 'sm:hover:border-[#13b99a]/35 sm:hover:shadow-[0_18px_38px_-20px_rgba(19,185,154,0.5)]',
    focus: 'focus-visible:ring-[#13b99a]/70',
    iconSurface: 'bg-[#13b99a]/[0.08] shadow-[inset_0_0_0_1px_rgba(19,185,154,0.08)]',
    icon: 'text-[#0d937b]',
    arrow: 'group-hover:text-[#0d937b]',
    chevron: 'bg-[#13b99a]/[0.09] text-[#0d937b]',
  },
} as const;

/**
 * `topics` names chapters of each subject's grade-12 programme (GDPT 2018), so a
 * student can tell what the subject covers before opening it.
 */
const SUBJECTS = [
  {
    slug: 'toan',
    title: 'Toán',
    topics: 'Đạo hàm · Tích phân · Oxyz',
    href: '/subjects/toan',
    icon: Sigma,
  },
  {
    slug: 'vat-ly',
    title: 'Vật lý',
    topics: 'Nhiệt · Từ trường · Hạt nhân',
    href: '/subjects/vat-ly',
    icon: Atom,
  },
  {
    slug: 'hoa-hoc',
    title: 'Hóa học',
    topics: 'Ester · Polymer · Kim loại',
    href: '/subjects/hoa-hoc',
    icon: FlaskConical,
  },
  {
    slug: 'sinh-hoc',
    title: 'Sinh học',
    topics: 'Di truyền · Tiến hóa · Sinh thái',
    href: '/subjects/sinh-hoc',
    icon: Leaf,
  },
] as const;

/**
 * Below `sm` the four subjects form one grouped list of full-width rows, so all
 * four fit in a single phone screen; from `sm` up the same links become cards.
 */
export function SubjectProofSection() {
  return (
    <section
      aria-labelledby="subject-proof-heading"
      className="relative w-full overflow-hidden bg-[linear-gradient(180deg,#f2f7ff_0%,#f5f9ff_58%,#f7faff_100%)] pb-12 pt-12 sm:py-20 lg:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-48 top-16 h-[560px] w-[560px] rounded-full bg-blue-200/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 bottom-0 h-80 w-80 rounded-full bg-cyan-100/30 blur-3xl"
      />

      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="grid items-center gap-7 sm:gap-10 xl:grid-cols-[340px_minmax(0,1fr)] xl:gap-12 2xl:grid-cols-[368px_minmax(0,1fr)] 2xl:gap-16">
          <div className="flex max-w-[560px] flex-col items-start text-left">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-white/75 px-3 py-1.5 text-[11px] font-extrabold tracking-[0.12em] text-[#075cf4] shadow-[0_8px_24px_-18px_rgba(7,92,244,0.7)] backdrop-blur-md sm:mb-5 sm:px-3.5 sm:text-xs">
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

            <p className="mt-3 max-w-[520px] text-[15px] font-medium leading-6 text-slate-600 sm:mt-5 sm:text-lg sm:leading-7">
              Bài học, luyện tập và đề thi thử lớp 12. Chọn một môn để xem trước.
            </p>
          </div>

          <ul className="grid grid-cols-1 divide-y divide-slate-200/70 overflow-hidden rounded-[24px] border border-white/90 bg-white/90 shadow-[0_22px_50px_-34px_rgba(8,22,47,0.55)] backdrop-blur-sm sm:grid-cols-2 sm:gap-4 sm:divide-y-0 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent sm:shadow-none sm:backdrop-blur-none lg:grid-cols-4">
            {SUBJECTS.map((subject) => {
              const styles = SUBJECT_STYLES[subject.slug];
              const Icon = subject.icon;

              return (
                <li key={subject.slug} className="flex">
                  <Link
                    href={subject.href}
                    aria-label={`Khám phá môn ${subject.title}`}
                    className={`group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset active:bg-slate-50 sm:flex sm:min-h-[196px] sm:flex-col sm:items-start sm:rounded-[24px] sm:border sm:border-white/90 sm:bg-white/90 sm:p-5 sm:shadow-[0_12px_30px_-22px_rgba(8,22,47,0.45)] sm:backdrop-blur-sm sm:active:bg-white/90 motion-safe:sm:transition-all motion-safe:sm:duration-300 motion-safe:sm:hover:-translate-y-1.5 lg:min-h-[220px] ${styles.card} ${styles.focus}`}
                  >
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] sm:h-14 sm:w-14 sm:rounded-[18px] ${styles.iconSurface}`}
                    >
                      <Icon
                        className={`h-6 w-6 sm:h-7 sm:w-7 ${styles.icon}`}
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                    </span>

                    <div className="min-w-0 sm:mt-5">
                      <h3 className="text-[17px] font-extrabold leading-6 tracking-[-0.02em] text-[#08162f] sm:text-xl sm:tracking-[-0.025em]">
                        {subject.title}
                      </h3>
                      <span className="mt-0.5 block text-[13px] font-medium leading-5 text-slate-500 sm:mt-2">
                        {subject.topics}
                      </span>
                    </div>

                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full sm:hidden ${styles.chevron}`}
                      aria-hidden="true"
                    >
                      <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
                    </span>

                    <span className="mt-auto hidden w-full items-center justify-between pt-5 text-xs font-bold text-slate-500 sm:flex">
                      Xem môn học
                      <ArrowRight
                        className={`h-4 w-4 text-slate-300 motion-safe:transition-all motion-safe:duration-200 motion-safe:group-hover:translate-x-1 ${styles.arrow}`}
                        aria-hidden="true"
                      />
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
