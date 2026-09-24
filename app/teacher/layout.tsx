'use client';

import * as React from 'react';
import Link from 'next/link';

import { teacherNav } from '@/config/navigation';
import { SidebarNav } from '@/components/shared/app-shell';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
        <button
          type="button"
          className="lg:hidden shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted"
          onClick={() => setMobileOpen(true)}
          aria-label="Mở menu điều hướng"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="18" y2="18" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold tracking-tight text-foreground lg:hidden">Tú Tài</span>
          <span className="hidden text-sm font-medium text-muted-foreground lg:block">
            Cổng giáo viên
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-transparent text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Menu giáo viên"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-info/10 text-info text-xs font-semibold">
                G
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium text-foreground">Giáo viên</p>
                <p className="text-xs text-muted-foreground">gv@tutai.vn</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Link href="/teacher/profile" className="w-full">
                Hồ sơ
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Link href="/auth/login" className="w-full">
                Đăng xuất
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
          <div className="flex h-14 items-center border-b border-border px-4">
            <span className="text-sm font-bold tracking-tight text-foreground">Cổng giáo viên</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <SidebarNav items={teacherNav} label="Điều hướng giáo viên" />
          </div>
        </aside>

        {/* Mobile sidebar */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 p-0 pr-10">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu điều hướng</SheetTitle>
            </SheetHeader>
            <div className="flex h-full flex-col gap-4 p-4">
              <div className="flex items-center gap-2 px-1">
                <span className="text-base font-bold tracking-tight text-foreground">
                  Cổng giáo viên
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SidebarNav
                  items={teacherNav}
                  label="Điều hướng giáo viên"
                  onClose={() => setMobileOpen(false)}
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <main id="main-content" className="flex-1 min-w-0" tabIndex={-1}>
          <div className="px-4 py-8 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
