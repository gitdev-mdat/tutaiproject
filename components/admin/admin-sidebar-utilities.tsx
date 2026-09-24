'use client';

import Link from 'next/link';
import { Bell, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function UtilityTooltip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: React.ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      {collapsed && <TooltipContent side="right">{label}</TooltipContent>}
    </Tooltip>
  );
}

const utilityClass =
  'flex h-10 w-full items-center rounded-lg text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

export function AdminSidebarUtilities({
  collapsed,
  onSearch,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onSearch: () => void;
  onToggleCollapse?: () => void;
}) {
  const contentClass = collapsed ? 'justify-center px-0' : 'gap-3 px-3';
  return (
    <div className="space-y-1" aria-label="Tiện ích quản trị">
      {onToggleCollapse && (
        <UtilityTooltip
          collapsed={collapsed}
          label={collapsed ? 'Mở rộng thanh quản trị' : 'Thu gọn thanh quản trị'}
        >
          <button
            type="button"
            className={`${utilityClass} ${contentClass}`}
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Mở rộng thanh quản trị' : 'Thu gọn thanh quản trị'}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
            <span className={collapsed ? 'sr-only' : ''}>Thu gọn thanh quản trị</span>
          </button>
        </UtilityTooltip>
      )}

      <UtilityTooltip collapsed={collapsed} label="Tìm kiếm">
        <button
          type="button"
          className={`${utilityClass} ${contentClass}`}
          onClick={onSearch}
          aria-label="Tìm kiếm"
        >
          <Search className="size-4 shrink-0" />
          <span className={collapsed ? 'sr-only' : ''}>Tìm kiếm</span>
          {!collapsed && <kbd className="ml-auto text-[10px] text-slate-400">Ctrl/⌘ K</kbd>}
        </button>
      </UtilityTooltip>

      <UtilityTooltip collapsed={collapsed} label="Thông báo, 3 thông báo mới">
        <button
          type="button"
          className={`${utilityClass} ${contentClass} relative`}
          aria-label="Thông báo, 3 thông báo mới"
        >
          <span className="relative">
            <Bell className="size-4" />
            <span className="absolute -right-1 -top-1 size-2 rounded-full bg-red-500 ring-2 ring-white" />
          </span>
          <span className={collapsed ? 'sr-only' : ''}>Thông báo</span>
        </button>
      </UtilityTooltip>

      <DropdownMenu>
        <DropdownMenuTrigger
          className={`${utilityClass} ${contentClass}`}
          aria-label="Tài khoản quản trị viên"
        >
          <Avatar className="size-7">
            <AvatarFallback className="bg-blue-100 text-xs font-bold text-blue-700">
              QT
            </AvatarFallback>
          </Avatar>
          <span className={collapsed ? 'sr-only' : 'min-w-0 truncate'}>Quản trị viên</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="right" className="w-52">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-semibold text-slate-900">Quản trị viên</p>
            <p className="text-xs text-slate-500">admin@tutai.vn</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/admin/settings" />}>Cài đặt</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/auth/login" />} className="text-red-600">
            Đăng xuất
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
