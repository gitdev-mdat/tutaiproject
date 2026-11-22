import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';

export const PREMIUM_READINESS_HREF = '/admin/practice#premium';

/**
 * Shown only to a server-verified admin: says that Plus content is open for
 * preview (not through a membership) and what students can actually open.
 */
export function AdminPreviewNote({ children }: { children: React.ReactNode }) {
  return (
    <aside
      className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#D6DEF0] bg-[#F5F7FC] p-4 text-[13px] leading-6 text-slate-700 sm:flex-row sm:items-start"
      data-testid="admin-preview-note"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#0A1F5C] text-white">
        <ShieldCheck className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-[#0A1F5C]">Bạn đang xem với quyền Admin</p>
        <div className="mt-0.5">{children}</div>
      </div>
      <Link
        href={PREMIUM_READINESS_HREF}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-lg border border-[#C9D3EA] bg-white px-3 text-[13px] font-bold text-[#0A1F5C] hover:bg-[#EEF2FA]"
        data-testid="admin-readiness-link"
      >
        Nội dung còn thiếu <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </aside>
  );
}

/**
 * One line for a server-verified admin on a student page: why Plus content is
 * open and what is still missing, without taking a card's worth of the page
 * the admin is checking. Students never get it.
 */
export function AdminPreviewBar({ children }: { children: React.ReactNode }) {
  return (
    <aside
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-dashed border-[#C9D3EA] bg-[#F5F7FC] px-3 py-2 text-[12px] leading-5 text-slate-600"
      data-testid="admin-preview-note"
      aria-label="Ghi chú cho Admin"
    >
      <span className="inline-flex items-center gap-1 font-bold text-[#0A1F5C]">
        <ShieldCheck className="size-3.5" aria-hidden="true" /> Admin
      </span>
      <span className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
        {children}
      </span>
      <Link
        href={PREMIUM_READINESS_HREF}
        className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-md font-bold text-[#0A1F5C] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        data-testid="admin-readiness-link"
      >
        Nội dung còn thiếu <ArrowRight className="size-3" aria-hidden="true" />
      </Link>
    </aside>
  );
}

/** Small label on a Plus surface opened through admin preview. */
export function AdminPreviewTag() {
  return (
    <span
      className="inline-flex h-6 items-center gap-1 rounded-full bg-white/15 px-2 text-[11px] font-bold tracking-normal normal-case text-white ring-1 ring-white/25"
      data-testid="admin-preview-tag"
    >
      <ShieldCheck className="size-3" aria-hidden="true" /> Xem trước Admin
    </span>
  );
}
