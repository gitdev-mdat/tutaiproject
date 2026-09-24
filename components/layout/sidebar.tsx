'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  { href: '/student', label: 'Trang chủ' },
  { href: '/student/roadmap', label: 'Lộ trình học' },
  { href: '/student/practice', label: 'Luyện tập' },
  { href: '/student/exam-sets', label: 'Bộ đề' },
  { href: '/student/mock-exams', label: 'Thi thử' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-full flex-col border-b border-slate-200 bg-white px-4 py-4 lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
      <Link href="/student" className="mb-5 text-xl font-bold tracking-tight text-slate-950">
        Tú Tài
      </Link>
      <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Không gian học tập
      </p>
      <nav aria-label="Điều hướng học tập" className="flex gap-1 overflow-x-auto lg:flex-col">
        {navigation.map((item) => {
          const isActive =
            item.href === '/student' ? pathname === item.href : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
