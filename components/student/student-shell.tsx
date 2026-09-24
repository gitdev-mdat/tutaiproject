'use client';

import * as React from 'react';
import { Menu, X } from 'lucide-react';
import type { StudentShellModel } from '@/lib/student/types';
import { StudentSidebar } from './student-sidebar';

type StudentShellContextValue = {
  model: StudentShellModel;
};

const StudentShellContext = React.createContext<StudentShellContextValue | null>(null);

export function useStudentShell() {
  const context = React.useContext(StudentShellContext);
  if (!context) {
    throw new Error('useStudentShell must be used inside StudentShell');
  }
  return context;
}

const FOCUSABLE_ELEMENTS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function StudentShell({
  model,
  children,
}: {
  model: StudentShellModel;
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const menuTriggerRef = React.useRef<HTMLElement | null>(null);

  const openMobileMenu = React.useCallback(() => {
    menuTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMobileMenuOpen(true);
  }, []);

  const closeMobileMenu = React.useCallback(() => {
    setMobileMenuOpen(false);
    window.requestAnimationFrame(() => menuTriggerRef.current?.focus());
  }, []);

  React.useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerRef.current?.querySelector<HTMLElement>(FOCUSABLE_ELEMENTS)?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  const handleDrawerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMobileMenu();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = Array.from(
      drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS) ?? []
    ).filter((element) => element.getClientRects().length > 0);

    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  const handleDrawerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('a[href]')) {
      closeMobileMenu();
    }
  };

  return (
    <StudentShellContext.Provider value={{ model }}>
      <div className="flex min-h-[100dvh] w-full bg-[#F8FAFD]">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen">
          <StudentSidebar model={model} />
        </div>

        {/* Mobile Drawer Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
            aria-hidden="true"
            onClick={closeMobileMenu}
          />
        )}

        {/* Mobile Sidebar Drawer */}
        <div
          ref={drawerRef}
          id="student-mobile-navigation"
          role="dialog"
          aria-label="Điều hướng học tập"
          aria-modal={mobileMenuOpen ? 'true' : undefined}
          aria-hidden={!mobileMenuOpen}
          inert={!mobileMenuOpen}
          onClick={handleDrawerClick}
          onKeyDown={handleDrawerKeyDown}
          className={`fixed inset-y-0 left-0 z-50 w-[260px] transform transition-transform duration-300 ease-in-out lg:hidden ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <button
            type="button"
            onClick={closeMobileMenu}
            aria-label="Đóng menu học tập"
            className="absolute right-3 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <X aria-hidden="true" size={20} />
          </button>
          <StudentSidebar model={model} />
        </div>

        {/* A compact mobile-only trigger keeps navigation available without restoring a toolbar. */}
        <button
          type="button"
          onClick={openMobileMenu}
          aria-label="Mở menu học tập"
          aria-controls="student-mobile-navigation"
          className="fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-slate-600 shadow-sm backdrop-blur focus:outline-none focus:ring-2 focus:ring-blue-500 lg:hidden"
        >
          <Menu aria-hidden="true" size={20} />
        </button>

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 overflow-x-hidden px-4 pb-4 pt-16 focus:outline-none md:p-6 lg:px-7 lg:py-6 xl:px-8"
          >
            <div className="mx-auto w-full max-w-[1360px]">{children}</div>
          </main>
        </div>
      </div>
    </StudentShellContext.Provider>
  );
}
