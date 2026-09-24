'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, Minimize2 } from 'lucide-react';
import { adminNav } from '@/config/navigation';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminSidebarUtilities } from '@/components/admin/admin-sidebar-utilities';
import { AdminMain } from '@/components/admin/admin-main';
import {
  AdminWorkspaceProvider,
  useAdminWorkspace,
} from '@/components/admin/admin-workspace-context';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';
import { resolveWorkspacePanels } from '@/lib/admin/workspace-layout';

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={`flex h-16 shrink-0 items-center border-b border-slate-200 ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'}`}
    >
      <div className="flex size-8 shrink-0 select-none items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
        TT
      </div>
      {!collapsed && (
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-sm font-bold tracking-tight text-slate-900">Tú Tài</span>
          <span className="text-[11px] font-medium text-slate-400">Quản trị nội dung</span>
        </div>
      )}
    </div>
  );
}

function AdminCommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const items = adminNav.flatMap((section) => section.items);
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Tìm kiếm trong trang quản trị"
      description="Mở nhanh một khu vực quản trị"
    >
      <Command>
        <CommandInput placeholder="Tìm khu vực quản trị…" autoFocus />
        <CommandList>
          <CommandEmpty>Không tìm thấy kết quả.</CommandEmpty>
          <CommandGroup heading="Điều hướng">
            {items.map((item) => (
              <CommandItem key={item.href} onSelect={() => onOpenChange(false)}>
                <Link href={item.href} className="w-full">
                  {item.title}
                </Link>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const {
    adminSidebarCollapsed,
    setAdminSidebarCollapsed,
    treePanelCollapsed,
    focusMode,
    toggleFocusMode,
  } = useAdminWorkspace();
  const panels = resolveWorkspacePanels({
    adminSidebarCollapsed,
    treePanelCollapsed,
    focusMode,
  });

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <TooltipProvider>
      <div className="flex h-dvh overflow-hidden bg-slate-50" data-testid="admin-shell">
        <aside
          className={`hidden shrink-0 flex-col overflow-hidden bg-white transition-[width] duration-200 lg:flex ${
            panels.adminSidebarHidden ? 'border-r-0' : 'border-r border-slate-200'
          }`}
          style={{ width: panels.adminSidebarWidth }}
          aria-label="Thanh điều hướng quản trị"
          aria-hidden={panels.adminSidebarHidden || undefined}
          inert={panels.adminSidebarHidden || undefined}
          data-testid="admin-sidebar"
          data-collapsed={adminSidebarCollapsed ? 'true' : 'false'}
        >
          <Brand collapsed={adminSidebarCollapsed} />
          <div
            className={`min-h-0 flex-1 overflow-y-auto py-4 ${adminSidebarCollapsed ? 'px-2' : 'px-3'}`}
          >
            <AdminSidebar sections={adminNav} collapsed={adminSidebarCollapsed} />
          </div>
          <div
            className={`border-t border-slate-200 py-3 ${adminSidebarCollapsed ? 'px-2' : 'px-3'}`}
          >
            <AdminSidebarUtilities
              collapsed={adminSidebarCollapsed}
              onSearch={() => setSearchOpen(true)}
              onToggleCollapse={() => setAdminSidebarCollapsed((value) => !value)}
            />
          </div>
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[280px] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu điều hướng</SheetTitle>
            </SheetHeader>
            <div className="flex h-full flex-col bg-white">
              <Brand />
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                <AdminSidebar sections={adminNav} onClose={() => setMobileOpen(false)} />
              </div>
              <div className="border-t border-slate-200 px-3 py-3">
                <AdminSidebarUtilities collapsed={false} onSearch={() => setSearchOpen(true)} />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <AdminMain>{children}</AdminMain>
        </div>

        {!focusMode && (
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="fixed bottom-4 left-4 z-40 grid size-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:hidden"
            aria-label="Mở menu điều hướng quản trị"
          >
            <Menu className="size-5" />
          </button>
        )}

        {focusMode && (
          <button
            type="button"
            onClick={toggleFocusMode}
            className="fixed right-4 top-3 z-[70] inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-md hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Thoát chế độ tập trung"
          >
            <Minimize2 className="size-4" /> Thoát chế độ tập trung
          </button>
        )}

        <AdminCommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </TooltipProvider>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminWorkspaceProvider>
      <AdminShell>{children}</AdminShell>
    </AdminWorkspaceProvider>
  );
}
