import * as React from 'react';
import { AlertTriangle, BookmarkCheck, Lightbulb, Target } from 'lucide-react';
import { QuestionMath } from '@/components/shared/question-content-renderer';
import { ARTICLE_BODY_BLOCKS } from '@/lib/knowledge-tree/knowledge-article';
import type { KnowledgeArticleBlock } from '@/lib/knowledge-tree/knowledge-tree-types';

/**
 * Learner-facing lesson body. Used by the student reader and by the admin
 * preview, so what an editor previews is exactly what a student reads.
 */

const LIST_LINE = /^\s*(?:[-*•]|\d+[.)])\s+/;

function RichText({ content }: { content: string }) {
  const paragraphs = content
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return (
    <>
      {paragraphs.map((paragraph, index) => {
        const lines = paragraph.split('\n');
        if (lines.every((line) => LIST_LINE.test(line))) {
          const ordered = /^\s*\d/.test(lines[0]);
          const List = ordered ? 'ol' : 'ul';
          return (
            <List
              key={index}
              className={`my-3 space-y-1.5 pl-5 ${ordered ? 'list-decimal' : 'list-disc'} marker:text-slate-400`}
            >
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>
                  <QuestionMath text={line.replace(LIST_LINE, '')} />
                </li>
              ))}
            </List>
          );
        }
        return (
          <p key={index} className="my-3 first:mt-0 last:mb-0">
            {lines.map((line, lineIndex) => (
              <React.Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                <QuestionMath text={line} />
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

const CALLOUT_STYLE: Partial<
  Record<KnowledgeArticleBlock['type'], { box: string; icon: React.ElementType; iconClass: string }>
> = {
  OBJECTIVE: { box: 'border-blue-100 bg-blue-50/70', icon: Target, iconClass: 'text-blue-600' },
  EXAMPLE: { box: 'border-slate-200 bg-white', icon: Lightbulb, iconClass: 'text-amber-500' },
  RECAP: {
    box: 'border-emerald-100 bg-emerald-50/70',
    icon: BookmarkCheck,
    iconClass: 'text-emerald-600',
  },
  COMMON_MISTAKE: {
    box: 'border-amber-200 bg-amber-50/70',
    icon: AlertTriangle,
    iconClass: 'text-amber-600',
  },
};

export function LessonArticleView({ blocks }: { blocks: KnowledgeArticleBlock[] }) {
  const sections = ARTICLE_BODY_BLOCKS.map((meta) => ({
    meta,
    content: blocks
      .filter((block) => block.type === meta.type)
      .map((block) => block.content.trim())
      .filter(Boolean)
      .join('\n\n'),
  })).filter((section) => section.content);

  if (sections.length === 0) {
    return <p className="text-[15px] text-slate-500">Bài học này chưa có nội dung.</p>;
  }

  return (
    <div className="space-y-6 text-[15px] leading-7 text-slate-700 sm:text-base sm:leading-8">
      {sections.map(({ meta, content }) => {
        const callout = CALLOUT_STYLE[meta.type];
        if (callout) {
          const Icon = callout.icon;
          return (
            <section
              key={meta.type}
              aria-labelledby={`lesson-${meta.type}`}
              className={`rounded-2xl border p-5 sm:p-6 ${callout.box}`}
            >
              <h2
                id={`lesson-${meta.type}`}
                className="mb-2 flex items-center gap-2 text-[15px] font-bold text-[#091224]"
              >
                <Icon aria-hidden="true" className={`size-[18px] ${callout.iconClass}`} />
                {meta.readerHeading}
              </h2>
              <RichText content={content} />
            </section>
          );
        }
        return (
          <section key={meta.type} aria-labelledby={`lesson-${meta.type}`}>
            <h2
              id={`lesson-${meta.type}`}
              className={
                meta.type === 'REFERENCES'
                  ? 'mb-1 text-xs font-bold uppercase tracking-wider text-slate-400'
                  : 'mb-2 text-lg font-bold text-[#091224] sm:text-xl'
              }
            >
              {meta.readerHeading}
            </h2>
            <div className={meta.type === 'REFERENCES' ? 'text-sm text-slate-500' : undefined}>
              <RichText content={content} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
