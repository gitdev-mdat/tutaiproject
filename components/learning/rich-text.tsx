import * as React from 'react';
import { QuestionMath } from '@/components/shared/question-content-renderer';

/**
 * Lesson text as authors write it in the admin editor: paragraphs separated
 * by blank lines, "-" / "1." lists, **bold**, and $…$ formulas.
 */

const LIST_LINE = /^\s*(?:[-*•+]|\d+[.)])\s+/;
const BOLD = /\*\*([^*]+?)\*\*/g;

/** One line of text with **bold** and $math$. */
export function InlineText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(BOLD)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(<QuestionMath key={last} text={text.slice(last, index)} />);
    parts.push(
      <strong key={`b${index}`} className="font-semibold text-[#091224]">
        <QuestionMath text={match[1]} />
      </strong>
    );
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(<QuestionMath key={last} text={text.slice(last)} />);
  return <>{parts}</>;
}

export function RichText({ content, className = '' }: { content: string; className?: string }) {
  const paragraphs = content
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return (
    <div className={className}>
      {paragraphs.map((paragraph, index) => {
        const groups: Array<{ list: boolean; lines: string[] }> = [];
        for (const raw of paragraph.split('\n')) {
          const line = raw.replace(/^#{1,4}\s+/, '');
          const list = LIST_LINE.test(line);
          const last = groups[groups.length - 1];
          if (last && last.list === list) last.lines.push(line);
          else groups.push({ list, lines: [line] });
        }
        return (
          <div key={index} className="my-3 first:mt-0 last:mb-0">
            {groups.map((group, groupIndex) => {
              if (group.list) {
                const ordered = /^\s*\d/.test(group.lines[0]);
                const List = ordered ? 'ol' : 'ul';
                return (
                  <List
                    key={groupIndex}
                    className={`my-2 space-y-1.5 pl-5 ${ordered ? 'list-decimal' : 'list-disc'} marker:text-slate-400`}
                  >
                    {group.lines.map((line, lineIndex) => (
                      <li key={lineIndex} className="pl-1">
                        <InlineText text={line.replace(LIST_LINE, '')} />
                      </li>
                    ))}
                  </List>
                );
              }
              return (
                <p key={groupIndex}>
                  {group.lines.map((line, lineIndex) => (
                    <React.Fragment key={lineIndex}>
                      {lineIndex > 0 && <br />}
                      <InlineText text={line} />
                    </React.Fragment>
                  ))}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
