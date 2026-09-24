import Link from 'next/link';

type HeaderProps = {
  showStudentActions?: boolean;
};

const navigation = [
  { label: 'Tính năng', href: '#tinh-nang' },
  { label: 'Lộ trình', href: '/onboarding' },
  { label: 'Bộ đề', href: '/exam-sets' },
  { label: 'Bảng giá', href: '#bang-gia' },
];

export default function Header({ showStudentActions = false }: HeaderProps) {
  return (
    <header className="border-b border-white/10 bg-[#071a35] text-white">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="shrink-0 text-xl font-extrabold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071a35]"
          aria-label="Tú Tài - Trang chủ"
        >
          Tú Tài<span className="text-blue-400">.</span>
        </Link>

        <nav
          className="hidden flex-1 items-center justify-center gap-1 md:flex"
          aria-label="Điều hướng chính"
        >
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {showStudentActions ? (
            <Link
              href="/student"
              className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:inline-flex"
            >
              Vào học
            </Link>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:inline-flex"
            >
              Đăng nhập
            </Link>
          )}
          <Link
            href="/onboarding"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-500 px-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071a35] sm:px-4"
          >
            Bắt đầu miễn phí
          </Link>
        </div>
      </div>
    </header>
  );
}
