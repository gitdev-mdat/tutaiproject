import Link from 'next/link';
import {
  ArrowRight,
  Atom,
  BookOpen,
  FileText,
  FlaskConical,
  GraduationCap,
  Leaf,
  Pencil,
  PlayCircle,
  ShieldCheck,
  Sigma,
  Users,
} from 'lucide-react';

const SUBJECT_STYLES = {
  toan: {
    card: 'hover:border-[#1768ff]/35 hover:shadow-[0_18px_38px_-20px_rgba(23,104,255,0.55)]',
    focus: 'focus-visible:ring-[#1768ff]/35',
    iconSurface: 'bg-[#1768ff]/[0.08] shadow-[inset_0_0_0_1px_rgba(23,104,255,0.08)]',
    icon: 'text-[#1768ff]',
    badge: 'border-[#1768ff]/10 bg-[#1768ff]/[0.06] text-[#1351d8]',
    arrow: 'group-hover:text-[#1768ff]',
  },
  'vat-ly': {
    card: 'hover:border-[#0ea5c6]/35 hover:shadow-[0_18px_38px_-20px_rgba(14,165,198,0.5)]',
    focus: 'focus-visible:ring-[#0ea5c6]/35',
    iconSurface: 'bg-[#0ea5c6]/[0.08] shadow-[inset_0_0_0_1px_rgba(14,165,198,0.08)]',
    icon: 'text-[#0a8eaa]',
    badge: 'border-[#0ea5c6]/10 bg-[#0ea5c6]/[0.06] text-[#087f99]',
    arrow: 'group-hover:text-[#0a8eaa]',
  },
  'hoa-hoc': {
    card: 'hover:border-[#f59e0b]/35 hover:shadow-[0_18px_38px_-20px_rgba(245,158,11,0.5)]',
    focus: 'focus-visible:ring-[#f59e0b]/35',
    iconSurface: 'bg-[#f59e0b]/[0.08] shadow-[inset_0_0_0_1px_rgba(245,158,11,0.08)]',
    icon: 'text-[#d97706]',
    badge: 'border-[#f59e0b]/10 bg-[#f59e0b]/[0.07] text-[#a85308]',
    arrow: 'group-hover:text-[#d97706]',
  },
  'sinh-hoc': {
    card: 'hover:border-[#13b99a]/35 hover:shadow-[0_18px_38px_-20px_rgba(19,185,154,0.5)]',
    focus: 'focus-visible:ring-[#13b99a]/35',
    iconSurface: 'bg-[#13b99a]/[0.08] shadow-[inset_0_0_0_1px_rgba(19,185,154,0.08)]',
    icon: 'text-[#0d937b]',
    badge: 'border-[#13b99a]/10 bg-[#13b99a]/[0.07] text-[#0d7664]',
    arrow: 'group-hover:text-[#0d937b]',
  },
} as const;

const SUBJECTS = [
  {
    slug: 'toan',
    title: 'Toán',
    label: 'Bám sát SGK',
    href: '/subjects/toan',
    icon: Sigma,
  },
  {
    slug: 'vat-ly',
    title: 'Vật lý',
    label: 'Lý thuyết trọng tâm',
    href: '/subjects/vat-ly',
    icon: Atom,
  },
  {
    slug: 'hoa-hoc',
    title: 'Hóa học',
    label: 'Dễ hiểu, dễ nhớ',
    href: '/subjects/hoa-hoc',
    icon: FlaskConical,
  },
  {
    slug: 'sinh-hoc',
    title: 'Sinh học',
    label: 'Hệ thống khoa học',
    href: '/subjects/sinh-hoc',
    icon: Leaf,
  },
] as const;

const STATS = [
  {
    id: 'subjects',
    value: '4',
    label: 'môn học',
    icon: BookOpen,
    iconColor: 'text-[#1768ff]',
    iconBg: 'bg-[#1768ff]/[0.08]',
  },
  {
    id: 'lessons',
    value: '128',
    label: 'bài học',
    icon: PlayCircle,
    iconColor: 'text-[#0a8eaa]',
    iconBg: 'bg-[#0ea5c6]/[0.08]',
  },
  {
    id: 'exams',
    value: '42',
    label: 'bộ đề',
    icon: FileText,
    iconColor: 'text-[#d97706]',
    iconBg: 'bg-[#f59e0b]/[0.08]',
  },
  {
    id: 'questions',
    value: '2.600+',
    label: 'câu luyện tập',
    icon: Pencil,
    iconColor: 'text-[#0d937b]',
    iconBg: 'bg-[#13b99a]/[0.08]',
  },
] as const;

const TRUST_POINTS = [
  'Theo chương trình lớp 12',
  'Nội dung rõ ràng, dễ học',
  'Nội dung đang được mở rộng mỗi tuần',
] as const;

export function SubjectProofSection() {
  return (
    <section
      aria-labelledby="subject-proof-heading"
      className="relative w-full overflow-hidden bg-[linear-gradient(180deg,#f2f7ff_0%,#f5f9ff_58%,#f7faff_100%)] py-16 sm:py-20 lg:py-24"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-48 top-16 h-[560px] w-[560px] rounded-full bg-blue-200/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 bottom-0 h-80 w-80 rounded-full bg-cyan-100/30 blur-3xl"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-6 sm:px-8 lg:gap-12 lg:px-12">
        <div className="grid items-center gap-10 xl:grid-cols-[340px_minmax(0,1fr)] xl:gap-12 2xl:grid-cols-[368px_minmax(0,1fr)] 2xl:gap-16">
          <div className="flex max-w-[560px] flex-col items-start text-left">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-white/75 px-3.5 py-1.5 text-[11px] font-extrabold tracking-[0.12em] text-[#075cf4] shadow-[0_8px_24px_-18px_rgba(7,92,244,0.7)] backdrop-blur-md sm:text-xs">
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
              CHƯƠNG TRÌNH LỚP 12
            </div>

            <h2
              id="subject-proof-heading"
              className="text-balance text-[clamp(2.5rem,5vw,4.5rem)] font-extrabold leading-[1.04] tracking-[-0.045em]"
            >
              <span className="text-[#08162f]">Học gì trên </span>
              <span className="text-[#075cf4]">Tú Tài?</span>
            </h2>

            <p className="mt-5 max-w-[520px] text-base font-medium leading-7 text-slate-600 sm:text-lg">
              4 môn lớp 12, nội dung bám chương trình, bài học trọng tâm, luyện tập và bộ đề.
            </p>

            <div className="mt-7 inline-flex max-w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-blue-100/60 bg-white/80 px-3 py-2.5 shadow-[0_10px_30px_-20px_rgba(7,92,244,0.55)] backdrop-blur-md sm:rounded-full sm:px-4">
              <span className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#075cf4]">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span>
                  Hôm nay có <strong className="font-extrabold text-[#075cf4]">37</strong> học sinh
                  đang học
                </span>
              </span>

              <span className="hidden h-5 w-px bg-slate-200 sm:block" aria-hidden="true" />

              <span className="flex items-center gap-2 text-sm font-bold text-emerald-600">
                <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                Đang hoạt động
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SUBJECTS.map((subject) => {
              const styles = SUBJECT_STYLES[subject.slug];
              const Icon = subject.icon;

              return (
                <Link
                  key={subject.slug}
                  href={subject.href}
                  aria-label={`Khám phá môn ${subject.title}`}
                  className={`group flex min-h-[220px] flex-col items-start rounded-[24px] border border-white/90 bg-white/90 p-5 text-left shadow-[0_12px_30px_-22px_rgba(8,22,47,0.45)] outline-none backdrop-blur-sm motion-safe:transition-all motion-safe:duration-300 motion-safe:hover:-translate-y-1.5 focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4f8ff] ${styles.card} ${styles.focus}`}
                >
                  <span
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] ${styles.iconSurface}`}
                  >
                    <Icon
                      className={`h-7 w-7 ${styles.icon}`}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </span>

                  <h3 className="mt-5 text-xl font-extrabold tracking-[-0.025em] text-[#08162f]">
                    {subject.title}
                  </h3>

                  <span
                    className={`mt-2.5 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold leading-4 ${styles.badge}`}
                  >
                    {subject.label}
                  </span>

                  <span className="mt-auto flex w-full items-center justify-between pt-5 text-xs font-bold text-slate-500">
                    Xem môn học
                    <ArrowRight
                      className={`h-4 w-4 text-slate-300 motion-safe:transition-all motion-safe:duration-200 motion-safe:group-hover:translate-x-1 ${styles.arrow}`}
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/90 bg-white/75 shadow-[0_22px_60px_-38px_rgba(8,22,47,0.5)] backdrop-blur-md">
          <dl className="grid grid-cols-2 lg:grid-cols-4">
            {STATS.map((stat, index) => {
              const Icon = stat.icon;

              return (
                <div
                  key={stat.id}
                  className={`grid min-h-[126px] grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_auto] items-center gap-x-3.5 px-4 py-6 sm:px-6 lg:min-h-[148px] lg:px-8 ${
                    index % 2 === 1 ? 'border-l border-slate-200/70' : ''
                  } ${index >= 2 ? 'border-t border-slate-200/70 lg:border-t-0' : ''} ${
                    index > 0 ? 'lg:border-l lg:border-slate-200/70' : ''
                  }`}
                >
                  <dt className="contents">
                    <span
                      className={`row-span-2 flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-[14px] sm:h-12 sm:w-12 ${stat.iconBg}`}
                      aria-hidden="true"
                    >
                      <Icon
                        className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.iconColor}`}
                        strokeWidth={1.9}
                      />
                    </span>
                    <span className="col-start-2 row-start-2 mt-1 text-xs font-semibold text-slate-500 sm:text-sm">
                      {stat.label}
                    </span>
                  </dt>
                  <dd
                    className={`col-start-2 row-start-1 text-[clamp(1.65rem,3vw,2.5rem)] font-extrabold leading-none tracking-[-0.04em] ${stat.iconColor}`}
                  >
                    {stat.value}
                  </dd>
                </div>
              );
            })}
          </dl>

          <div className="border-t border-slate-200/70 px-5 py-6 sm:px-7 lg:px-9">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <ul className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
                {TRUST_POINTS.map((point) => (
                  <li
                    key={point}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-600"
                  >
                    <ShieldCheck
                      className="h-4 w-4 shrink-0 text-[#075cf4]"
                      strokeWidth={2.25}
                      aria-hidden="true"
                    />
                    {point}
                  </li>
                ))}
              </ul>

              <div className="flex max-w-[520px] items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-left">
                <ShieldCheck
                  className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
                <p className="text-xs leading-5 text-slate-600 sm:text-[13px]">
                  <strong className="font-extrabold text-[#08162f]">
                    Mọi đề đều được kiểm duyệt trước khi vào lộ trình.
                  </strong>{' '}
                  Đối chiếu đáp án, phân loại độ khó, gắn chuyên đề và xác định mục tiêu phù hợp.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
