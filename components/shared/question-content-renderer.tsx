'use client';

import Image from 'next/image';
import * as React from 'react';
import type { QuestionContentBlock } from '@/lib/question-bank/qb-types';

const MATH_TOKEN = /(\$[^$]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g;

function renderMathExpression(source: string, key: React.Key): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  const token =
    /(\\frac\{([^{}]*)\}\{([^{}]*)\}|\\sqrt(?:\[([^\]]+)\])?\{([^{}]*)\}|\\mathbb\{R\}|\^\{([^{}]+)\}|\^([A-Za-z0-9+-]+)|_\{([^{}]+)\}|_([A-Za-z0-9+-]+)|\\(?:leq?|geq?|neq|times|div|pm|infty|alpha|beta|gamma|pi|theta|Delta|int))/g;
  const symbols: Record<string, string> = {
    '\\mathbb{R}': 'ℝ',
    '\\le': '≤',
    '\\leq': '≤',
    '\\ge': '≥',
    '\\geq': '≥',
    '\\neq': '≠',
    '\\times': '×',
    '\\div': '÷',
    '\\pm': '±',
    '\\infty': '∞',
    '\\alpha': 'α',
    '\\beta': 'β',
    '\\gamma': 'γ',
    '\\pi': 'π',
    '\\theta': 'θ',
    '\\Delta': 'Δ',
    '\\int': '∫',
  };
  for (const match of source.matchAll(token)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(source.slice(cursor, index));
    if (match[2] !== undefined) {
      nodes.push(
        <span
          key={`${index}-f`}
          className="inline-flex align-middle flex-col text-center leading-none"
        >
          <span className="border-b border-current px-0.5">
            {renderMathExpression(match[2], `${index}-n`)}
          </span>
          <span className="px-0.5">{renderMathExpression(match[3], `${index}-d`)}</span>
        </span>
      );
    } else if (match[5] !== undefined) {
      nodes.push(
        <span key={`${index}-r`} className="whitespace-nowrap">
          {match[4] && <sup>{match[4]}</sup>}√
          <span className="border-t border-current px-0.5">
            {renderMathExpression(match[5], `${index}-v`)}
          </span>
        </span>
      );
    } else if (match[6] !== undefined || match[7] !== undefined) {
      nodes.push(<sup key={`${index}-s`}>{match[6] ?? match[7]}</sup>);
    } else if (match[8] !== undefined || match[9] !== undefined) {
      nodes.push(<sub key={`${index}-b`}>{match[8] ?? match[9]}</sub>);
    } else nodes.push(symbols[match[0]] ?? match[0]);
    cursor = index + match[0].length;
  }
  if (cursor < source.length) nodes.push(source.slice(cursor));
  return <React.Fragment key={key}>{nodes}</React.Fragment>;
}

/** Canonical learner-facing text renderer shared by student and review experiences. */
export function QuestionMath({ text }: { text: string }): React.ReactNode {
  if (!text) return null;
  const parts = text.split(MATH_TOKEN);
  return (
    <>
      {parts.map((part, index) => {
        const delimited =
          (part.startsWith('$') && part.endsWith('$')) ||
          (part.startsWith('\\(') && part.endsWith('\\)')) ||
          (part.startsWith('\\[') && part.endsWith('\\]'));
        if (!delimited) return <React.Fragment key={index}>{part}</React.Fragment>;
        const display = part.startsWith('\\[');
        const raw = part.startsWith('$') ? part.slice(1, -1) : part.slice(2, -2);
        return (
          <span
            key={index}
            className={display ? 'my-2 block text-center font-serif' : 'inline font-serif'}
          >
            {renderMathExpression(raw, index)}
          </span>
        );
      })}
    </>
  );
}

/** Backwards-compatible name; delegates to the canonical learner renderer. */
export function formatMathSnippet(text: string): React.ReactNode {
  return text ? <QuestionMath text={text} /> : null;
}

export function QuestionContentRenderer({
  blocks,
  resolveAssetUrl,
  className = '',
}: {
  blocks: QuestionContentBlock[];
  resolveAssetUrl: (assetId: string) => string;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block) =>
        block.type === 'TEXT' ? (
          <div key={block.id} className="whitespace-pre-wrap">
            <QuestionMath text={block.text} />
          </div>
        ) : (
          <figure
            key={block.id}
            className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2"
          >
            <Image
              src={resolveAssetUrl(block.media.assetId)}
              alt={block.media.alt}
              width={1200}
              height={800}
              unoptimized
              className="mx-auto h-auto max-h-[32rem] w-auto max-w-full object-contain"
            />
          </figure>
        )
      )}
    </div>
  );
}

export function questionAssetUrl(questionId: string, storageKey: string): string {
  const fileName = storageKey.split('/').pop() ?? '';
  return `/api/question-bank/assets/${encodeURIComponent(questionId)}/${encodeURIComponent(fileName)}`;
}
