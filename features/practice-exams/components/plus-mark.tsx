import * as React from 'react';

/**
 * The Tú Tài Plus mark: an amber bookmark ribbon on the brand's deepest navy.
 * Navy is the colour the Roadmap uses for the journey itself, and amber is its
 * goal colour, so Plus reads as "the curated edition" of the same brand rather
 * than a separate, louder product. One shape, used everywhere Plus appears, so
 * students recognise it without reading.
 */
export function PlusRibbon({ className = '' }: { className?: string }) {
  return (
    <span
      className={`pointer-events-none absolute right-5 top-0 flex h-11 w-9 flex-col items-center justify-start pt-2 ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 36 44" className="absolute inset-0 h-full w-full drop-shadow-sm">
        <path d="M0 0h36v44l-18-9-18 9z" fill="#F5B83D" />
        <path d="M0 0h36v3H0z" fill="#E09A12" />
      </svg>
      <span className="relative text-[9px] font-black tracking-[0.08em] text-[#3A2600]">PLUS</span>
    </span>
  );
}

/** Inline label for Plus, for places too small for the ribbon (rows, history, headings). */
export function PlusTag({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-extrabold tracking-wide ${
        tone === 'dark' ? 'bg-[#F5B83D] text-[#3A2600]' : 'bg-[#FFF4D6] text-[#8A5A00]'
      }`}
    >
      <svg viewBox="0 0 10 12" className="h-3 w-2.5" aria-hidden="true">
        <path d="M0 0h10v12L5 9.5 0 12z" fill="currentColor" />
      </svg>
      Plus
    </span>
  );
}

/** Surface classes for a Plus card: the curated edition. */
export const PLUS_SURFACE =
  'relative overflow-hidden rounded-[24px] bg-[#0A1F5C] text-white shadow-[0_18px_40px_-24px_rgba(10,31,92,0.75)] ring-1 ring-[#1D3A8A]';

/** Faint ruled-paper texture behind Plus content: an exam sheet, not a sparkle. */
export function PlusTexture() {
  return (
    <span
      className="pointer-events-none absolute inset-0 opacity-[0.07]"
      style={{
        backgroundImage: 'repeating-linear-gradient(0deg, #ffffff 0 1px, transparent 1px 28px)',
      }}
      aria-hidden="true"
    />
  );
}
