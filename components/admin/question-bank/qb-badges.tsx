'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { AccessTier, EditorialStatus, UsageContext } from '@/lib/question-bank/qb-types';
import {
  ACCESS_TIER_LABELS,
  EDITORIAL_STATUS_LABELS,
  USAGE_CONTEXT_LABELS,
} from '@/lib/question-bank/qb-types';

// ─── Access Tier Badge ────────────────────────────────────────────────────────

const ACCESS_TIER_STYLES: Record<AccessTier, string> = {
  OPEN: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  PLUS: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
};

export function AccessTierBadge({ tier }: { tier: AccessTier }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
        ACCESS_TIER_STYLES[tier]
      )}
    >
      {tier === 'PLUS' && (
        <svg
          className="mr-0.5"
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      )}
      {ACCESS_TIER_LABELS[tier]}
    </span>
  );
}

// ─── Editorial Status Badge ───────────────────────────────────────────────────

const EDITORIAL_STATUS_STYLES: Record<EditorialStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  IN_REVIEW: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  PUBLISHED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  ARCHIVED: 'bg-slate-50 text-slate-400 ring-1 ring-slate-200',
};

export function EditorialStatusBadge({ status }: { status: EditorialStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
        EDITORIAL_STATUS_STYLES[status]
      )}
    >
      {EDITORIAL_STATUS_LABELS[status]}
    </span>
  );
}

// ─── Usage Context mini-badges ────────────────────────────────────────────────

const USAGE_CONTEXT_IMPORTANT: UsageContext[] = ['ROADMAP', 'PLUS_SPECIAL', 'NATIONAL_EXAM_MOCK'];

export function UsageContextBadges({ contexts }: { contexts: UsageContext[] }) {
  if (contexts.length === 0) return null;

  const sorted = [
    ...contexts.filter((c) => USAGE_CONTEXT_IMPORTANT.includes(c)),
    ...contexts.filter((c) => !USAGE_CONTEXT_IMPORTANT.includes(c)),
  ];

  const visible = sorted.slice(0, 2);
  const rest = sorted.length - visible.length;

  return (
    <span className="flex flex-wrap items-center gap-1">
      {visible.map((c) => (
        <span
          key={c}
          className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600"
        >
          {USAGE_CONTEXT_LABELS[c]}
        </span>
      ))}
      {rest > 0 && (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">
          +{rest}
        </span>
      )}
    </span>
  );
}

// ─── Roadmap badge ────────────────────────────────────────────────────────────

export function RoadmapBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700 ring-1 ring-teal-200">
      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M9 11l3 3L22 4" />
      </svg>
      Lộ trình
    </span>
  );
}

// ─── Special badge ────────────────────────────────────────────────────────────

export function SpecialBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
      ĐẶC BIỆT
    </span>
  );
}
