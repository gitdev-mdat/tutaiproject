import * as React from 'react';

/**
 * The picture of a chapter. The curriculum has no chapter images yet, so this
 * draws a calm, recognisable tile from the chapter's number and subject: a
 * tint per chapter, the chapter number, and a few symbols of the subject.
 * When chapter illustrations are added (see docs/reviews/learning-path),
 * pass `src` and the same slot shows the image at the same size.
 */

const TINTS = [
  { bg: '#EAF1FF', line: '#C9D9FF', ink: '#2347C4' },
  { bg: '#E5F5EF', line: '#C2E7D8', ink: '#0F7A5C' },
  { bg: '#F0ECFF', line: '#DAD1FF', ink: '#5B3FCF' },
  { bg: '#FFF2E3', line: '#F7DDBD', ink: '#A85A0C' },
  { bg: '#FCEBF1', line: '#F4CEDB', ink: '#B23462' },
  { bg: '#E6F3FA', line: '#C5E3F2', ink: '#16719E' },
];

const SYMBOLS: [RegExp, string[]][] = [
  [/toán/i, ['f′(x)', '∫', 'Oxyz', 'σ²', 'P(A|B)', 'Σ', '√x', 'π', 'lim']],
  [/lí|lý/i, ['F = ma', 'λ', 'ω', 'Ω', 'v = s/t', 'E', 'Δt', 'Hz']],
  [/hoá|hóa/i, ['H₂O', 'pH', 'mol', 'C₆H₆', '⇌', 'e⁻']],
  [/sinh/i, ['DNA', 'ATP', 'RNA', 'Aa', 'n = 46']],
];

export function chapterTint(index: number) {
  return TINTS[index % TINTS.length];
}

function symbolsFor(subject: string, index: number): string[] {
  const set = SYMBOLS.find(([match]) => match.test(subject))?.[1] ?? ['A', 'B', 'C', '1', '2'];
  return [0, 1, 2].map((offset) => set[(index * 2 + offset) % set.length]);
}

export function ChapterArt({
  number,
  subject,
  size = 'sm',
  done = false,
  src,
  className = '',
}: {
  /** Chapter number, from 1. */
  number: number;
  subject: string;
  size?: 'sm' | 'lg';
  done?: boolean;
  src?: string | null;
  className?: string;
}) {
  const tint = chapterTint(number - 1);
  if (src)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={`object-cover ${className}`} aria-hidden="true" />
    );
  const [a, b, c] = symbolsFor(subject, number - 1);
  const large = size === 'lg';
  return (
    <span
      aria-hidden="true"
      className={`relative block overflow-hidden ${className}`}
      style={{ backgroundColor: tint.bg, color: tint.ink }}
    >
      {/* Squared paper: the page of an exercise book. */}
      <span
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage: `linear-gradient(${tint.line} 1px, transparent 1px), linear-gradient(90deg, ${tint.line} 1px, transparent 1px)`,
          backgroundSize: large ? '22px 22px' : '12px 12px',
          backgroundPosition: '-1px -1px',
        }}
      />
      {large && (
        <>
          <span className="absolute right-[12%] top-[14%] font-serif text-[22px] italic opacity-45">
            {a}
          </span>
          <span className="absolute bottom-[16%] right-[30%] font-serif text-[17px] italic opacity-35">
            {b}
          </span>
          <span className="absolute left-[56%] top-[44%] font-serif text-[15px] italic opacity-30">
            {c}
          </span>
        </>
      )}
      <span
        className={`absolute font-extrabold leading-none tracking-tight ${
          large ? 'bottom-4 left-5 text-[64px]' : 'inset-0 grid place-items-center text-[20px]'
        }`}
      >
        {done && !large ? (
          <svg
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          number
        )}
      </span>
    </span>
  );
}
