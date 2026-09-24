'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

export function isAdminWorkspacePath(pathname: string): boolean {
  return (
    pathname.startsWith('/admin/knowledge') ||
    pathname.startsWith('/admin/knowledge-graph') ||
    pathname.startsWith('/admin/exams/import/images') ||
    /^\/admin\/exams\/import\/[^/]+\/review/.test(pathname)
  );
}

export function AdminMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const workspace = isAdminWorkspacePath(pathname);

  return (
    <main
      id="main-content"
      data-testid="admin-main"
      data-workspace={workspace ? 'true' : 'false'}
      className={
        workspace
          ? 'min-h-0 min-w-0 flex-1 overflow-hidden'
          : 'min-h-0 min-w-0 flex-1 overflow-y-auto px-8 py-8'
      }
      tabIndex={-1}
    >
      <div className={workspace ? 'h-full w-full' : 'mx-auto w-full max-w-[1440px]'}>
        {children}
      </div>
    </main>
  );
}
