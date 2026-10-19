'use client';

import Image from 'next/image';
import * as React from 'react';
import type { QuestionContentBlock } from '@/lib/question-bank/qb-types';
import {
  MATHBB,
  MATH_ESCAPES,
  MATH_GROUP_COMMANDS,
  MATH_LAYOUT_COMMANDS,
  MATH_SYMBOLS,
  MATH_TOKEN,
  readGroup,
} from '@/lib/content/math-notation';

/**
 * Renders the inside of one formula. A small reader over the LaTeX subset in
 * `math-notation.ts`: nested `{…}` groups, fractions, roots, powers and the
 * symbol table. Unknown commands are kept as written; the authoring checks
 * report them before a lesson is published.
 */
function renderMathExpression(source: string, key: React.Key): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let text = '';
  let i = 0;
  const flush = () => {
    if (text) nodes.push(text);
    text = '';
  };
  const push = (node: React.ReactNode) => {
    flush();
    nodes.push(node);
  };
  const group = (): string | null => {
    while (source[i] === ' ') i += 1;
    const read = readGroup(source, i);
    if (!read) return null;
    i = read.end;
    return read.body;
  };
  /** The argument of ^ or _: a {group}, a command, a run of digits or one character. */
  const script = (): string => {
    while (source[i] === ' ') i += 1;
    if (source[i] === '{') return group() ?? '';
    if (source[i] === '\\') {
      const name = /^\\(?:[A-Za-z]+|.)/.exec(source.slice(i))?.[0] ?? '\\';
      i += name.length;
      return name;
    }
    const run = /^[-+]?(?:\d+(?:[.,]\d+)?|.)/.exec(source.slice(i))?.[0] ?? '';
    i += run.length;
    return run;
  };

  while (i < source.length) {
    const char = source[i];
    if (char === '^' || char === '_') {
      const at = i;
      i += 1;
      const body = renderMathExpression(script(), `${at}-v`);
      push(char === '^' ? <sup key={`${at}-s`}>{body}</sup> : <sub key={`${at}-b`}>{body}</sub>);
      continue;
    }
    if (char === '{' || char === '}') {
      const at = i;
      const inner = char === '{' ? group() : null;
      if (inner === null) {
        i = at + 1;
        continue;
      }
      push(renderMathExpression(inner, `${at}-g`));
      continue;
    }
    if (char !== '\\') {
      text += char;
      i += 1;
      continue;
    }
    const at = i;
    const name = /^[A-Za-z]+/.exec(source.slice(i + 1))?.[0];
    if (!name) {
      const escaped = source[i + 1] ?? '';
      text += escaped in MATH_ESCAPES ? MATH_ESCAPES[escaped] : `\\${escaped}`;
      i += 2;
      continue;
    }
    i += 1 + name.length;
    if (name in MATH_SYMBOLS) {
      text += MATH_SYMBOLS[name];
      continue;
    }
    if (MATH_LAYOUT_COMMANDS.has(name)) continue;
    if (!(name in MATH_GROUP_COMMANDS)) {
      text += `\\${name}`;
      continue;
    }
    if (name === 'sqrt') {
      let index = '';
      if (source[i] === '[') {
        const close = source.indexOf(']', i);
        if (close > i) {
          index = source.slice(i + 1, close);
          i = close + 1;
        }
      }
      const radicand = group();
      if (radicand === null) {
        text += '√';
        continue;
      }
      push(
        <span key={`${at}-r`} className="whitespace-nowrap">
          {index && <sup>{renderMathExpression(index, `${at}-i`)}</sup>}√
          <span className="border-t border-current px-0.5">
            {renderMathExpression(radicand, `${at}-v`)}
          </span>
        </span>
      );
      continue;
    }
    if (MATH_GROUP_COMMANDS[name] === 2) {
      const top = group();
      const bottom = top === null ? null : group();
      if (top === null || bottom === null) {
        text += `\\${name}`;
        continue;
      }
      const stacked = (
        <span
          key={`${at}-f`}
          className="inline-flex align-middle flex-col text-center leading-none"
        >
          <span className={name.endsWith('binom') ? 'px-0.5' : 'border-b border-current px-0.5'}>
            {renderMathExpression(top, `${at}-n`)}
          </span>
          <span className="px-0.5">{renderMathExpression(bottom, `${at}-d`)}</span>
        </span>
      );
      push(
        name.endsWith('binom') ? (
          <span key={`${at}-c`} className="whitespace-nowrap">
            ({stacked})
          </span>
        ) : (
          stacked
        )
      );
      continue;
    }
    const body = group();
    if (body === null) {
      text += `\\${name}`;
      continue;
    }
    if (name === 'mathbb') {
      text += body
        .split('')
        .map((letter) => MATHBB[letter] ?? letter)
        .join('');
    } else if (name.startsWith('text')) {
      push(
        name === 'textbf' ? (
          <strong key={`${at}-t`}>{body}</strong>
        ) : (
          body.replace(/\\([{}%$&#_])/g, '$1')
        )
      );
    } else if (name === 'overline' || name === 'bar') {
      push(
        <span key={`${at}-o`} className="border-t border-current">
          {renderMathExpression(body, `${at}-ov`)}
        </span>
      );
    } else if (
      name === 'vec' ||
      name === 'overrightarrow' ||
      name === 'hat' ||
      name === 'widehat'
    ) {
      push(
        <span
          key={`${at}-a`}
          className="inline-flex flex-col items-center align-bottom leading-none"
        >
          <span aria-hidden="true" className="text-[0.7em] leading-none">
            {name === 'hat' || name === 'widehat' ? '^' : '→'}
          </span>
          <span>{renderMathExpression(body, `${at}-av`)}</span>
        </span>
      );
    } else if (name === 'boxed') {
      push(
        <span key={`${at}-x`} className="rounded border border-current px-1">
          {renderMathExpression(body, `${at}-xv`)}
        </span>
      );
    } else {
      // mathrm, mathbf, mathit, operatorname: the letters as written.
      push(renderMathExpression(body, `${at}-m`));
    }
  }
  flush();
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
