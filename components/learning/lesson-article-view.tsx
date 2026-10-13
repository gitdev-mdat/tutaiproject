import * as React from 'react';
import {
  AlertTriangle,
  BookmarkCheck,
  BookOpenText,
  CheckCircle2,
  ClipboardCheck,
  Lightbulb,
  Sparkles,
  Target,
} from 'lucide-react';
import { QuestionMath } from '@/components/shared/question-content-renderer';
import {
  blockText,
  extractSignChart,
  lessonFlow,
  listItems,
  parseMistakes,
  parseWorkedExample,
  splitIntoChunks,
  type LessonFlowId,
} from '@/lib/knowledge-tree/lesson-structure';
import type { KnowledgeArticleBlock } from '@/lib/knowledge-tree/knowledge-tree-types';
import { MistakeCard, SelfCheck, WorkedExampleSteps } from './lesson-interactions';
import { SignChart } from './sign-chart';

/**
 * Learner-facing lesson body, laid out as a guided lesson:
 * Khởi động → Mục tiêu → Kiến thức chính → Ví dụ mẫu → Tự kiểm tra →
 * Lỗi hay gặp → Ghi nhớ. Used by the student reader and by the admin preview,
 * so what an editor previews is exactly what a student reads. Every block
 * comes from the saved article; sections without content are left out.
 */

const LIST_LINE = /^\s*(?:[-*•+]|\d+[.)])\s+/;

/** Paragraphs separated by blank lines; list lines inside a paragraph become a list. */
export function RichText({ content }: { content: string }) {
  const paragraphs = content
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return (
    <>
      {paragraphs.map((paragraph, index) => {
        const groups: Array<{ list: boolean; lines: string[] }> = [];
        for (const line of paragraph.split('\n')) {
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
                        <QuestionMath text={line.replace(LIST_LINE, '')} />
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
                      <QuestionMath text={line} />
                    </React.Fragment>
                  ))}
                </p>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

const TONES = {
  sky: { badge: 'bg-sky-100 text-sky-700', ring: 'border-sky-100' },
  blue: { badge: 'bg-blue-100 text-blue-700', ring: 'border-blue-100' },
  violet: { badge: 'bg-violet-100 text-violet-700', ring: 'border-violet-100' },
  indigo: { badge: 'bg-indigo-100 text-indigo-700', ring: 'border-indigo-100' },
  teal: { badge: 'bg-teal-100 text-teal-700', ring: 'border-teal-100' },
  amber: { badge: 'bg-amber-100 text-amber-700', ring: 'border-amber-200' },
  emerald: { badge: 'bg-emerald-100 text-emerald-700', ring: 'border-emerald-100' },
} as const;

function Section({
  id,
  step,
  eyebrow,
  title,
  icon: Icon,
  tone,
  className = '',
  children,
}: {
  id: LessonFlowId | 'tham-khao';
  step?: number;
  eyebrow: string;
  title?: string;
  icon: React.ElementType;
  tone: keyof typeof TONES;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      data-lesson-step={id}
      className={`scroll-mt-24 rounded-[20px] border bg-white p-5 sm:p-7 ${TONES[tone].ring} ${className}`}
    >
      <header className="mb-4 flex items-center gap-3">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${TONES[tone].badge}`}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">
            {step ? `Bước ${step} · ` : ''}
            {eyebrow}
          </p>
          <h2
            id={`${id}-title`}
            className="text-[18px] font-extrabold leading-snug text-[#091224] sm:text-[20px]"
          >
            {title ?? eyebrow}
          </h2>
        </div>
      </header>
      {children}
    </section>
  );
}

export function LessonArticleView({
  blocks,
  practiceHref = null,
}: {
  blocks: KnowledgeArticleBlock[];
  /** Where "ready to practise" points; null in the admin preview. */
  practiceHref?: string | null;
}) {
  const intro = blockText(blocks, 'INTRO');
  const objectives = listItems(blockText(blocks, 'OBJECTIVE'));
  const main = blockText(blocks, 'MAIN_CONTENT');
  const exampleText = blockText(blocks, 'EXAMPLE');
  const mistakes = parseMistakes(blockText(blocks, 'COMMON_MISTAKE'));
  const recap = listItems(blockText(blocks, 'RECAP'));
  const references = blockText(blocks, 'REFERENCES');

  if (!intro && !objectives.length && !main && !exampleText && !recap.length && !mistakes.length) {
    return <p className="text-[15px] text-slate-500">Bài học này chưa có nội dung.</p>;
  }

  const chunks = main ? splitIntoChunks(main) : [];
  const example = parseWorkedExample(exampleText);
  const chart = extractSignChart(exampleText);
  const chartStep =
    chart && example ? example.steps.findIndex((step) => extractSignChart(step.body) !== null) : -1;
  const flow = lessonFlow(blocks, { practice: !!practiceHref });
  const stepOf = (id: LessonFlowId) => flow.findIndex((item) => item.id === id) + 1;

  return (
    <div className="space-y-5 text-[15px] leading-7 text-slate-700 sm:text-base sm:leading-8">
      {intro && (
        <Section
          id="khoi-dong"
          step={stepOf('khoi-dong')}
          eyebrow="Khởi động"
          title="Vì sao cần học bài này?"
          icon={Sparkles}
          tone="sky"
          className="bg-gradient-to-br from-sky-50 to-white"
        >
          <div className="text-[16px] leading-8 text-slate-800 sm:text-[17px]">
            <RichText content={intro} />
          </div>
        </Section>
      )}

      {objectives.length > 0 && (
        <Section
          id="muc-tieu"
          step={stepOf('muc-tieu')}
          eyebrow="Mục tiêu"
          title="Sau bài này em sẽ"
          icon={Target}
          tone="blue"
        >
          <ul className="space-y-2.5">
            {objectives.map((objective, index) => (
              <li key={index} className="flex gap-3 rounded-xl bg-blue-50/60 px-4 py-3">
                <CheckCircle2 className="mt-1 size-5 shrink-0 text-blue-600" aria-hidden="true" />
                <span className="text-slate-800">
                  <QuestionMath text={objective} />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {chunks.length > 0 && (
        <Section
          id="kien-thuc"
          step={stepOf('kien-thuc')}
          eyebrow="Kiến thức chính"
          title="Hiểu bản chất"
          icon={BookOpenText}
          tone="violet"
        >
          <div className="space-y-4">
            {chunks.map((chunk, index) =>
              chunk.title ? (
                <article
                  key={index}
                  className="rounded-2xl border border-violet-100 bg-violet-50/30 p-4 sm:p-5"
                >
                  <h3 className="flex items-start gap-2.5 text-[16px] font-bold leading-snug text-[#091224] sm:text-[17px]">
                    <span className="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-violet-600 text-[12px] font-bold text-white">
                      {index + 1 - (chunks[0].title ? 0 : 1)}
                    </span>
                    <QuestionMath text={chunk.title} />
                  </h3>
                  {chunk.body && (
                    <div className="mt-2">
                      <RichText content={chunk.body} />
                    </div>
                  )}
                </article>
              ) : (
                <div key={index}>
                  <RichText content={chunk.body} />
                </div>
              )
            )}
          </div>
        </Section>
      )}

      {exampleText && (
        <Section
          id="vi-du"
          step={stepOf('vi-du')}
          eyebrow="Ví dụ mẫu"
          title="Xem cách làm từng bước"
          icon={Lightbulb}
          tone="indigo"
        >
          {example ? (
            <div className="space-y-4">
              {example.problem && (
                <div className="rounded-2xl border-l-4 border-indigo-500 bg-indigo-50/60 px-4 py-3 sm:px-5">
                  <p className="text-[12px] font-bold uppercase tracking-wider text-indigo-600">
                    Đề bài
                  </p>
                  <div className="mt-1 font-medium text-[#091224]">
                    <RichText content={example.problem} />
                  </div>
                </div>
              )}
              {example.intro && <RichText content={example.intro} />}
              <WorkedExampleSteps
                steps={example.steps.map((exampleStep, index) => ({
                  label: exampleStep.label,
                  content: <RichText content={exampleStep.body} />,
                  after: chart && index === chartStep ? <SignChart chart={chart} /> : undefined,
                }))}
              />
              {chart && chartStep < 0 && <SignChart chart={chart} />}
            </div>
          ) : (
            <RichText content={exampleText} />
          )}
        </Section>
      )}

      {objectives.length > 0 && (
        <Section
          id="tu-kiem-tra"
          step={stepOf('tu-kiem-tra')}
          eyebrow="Tự kiểm tra"
          title="Em đã làm được những gì?"
          icon={ClipboardCheck}
          tone="teal"
        >
          <p className="mb-3 text-[14px] leading-6 text-slate-500">
            Trả lời thật lòng cho từng mục tiêu. Câu trả lời chỉ để em biết nên làm gì tiếp, không
            được chấm điểm.
          </p>
          <SelfCheck
            objectives={objectives.map((objective, index) => (
              <QuestionMath key={index} text={objective} />
            ))}
            practiceHref={practiceHref}
          />
        </Section>
      )}

      {mistakes.length > 0 && (
        <Section
          id="loi-hay-gap"
          step={stepOf('loi-hay-gap')}
          eyebrow="Lỗi hay gặp"
          title="Cẩn thận kẻo mất điểm"
          icon={AlertTriangle}
          tone="amber"
          className="bg-amber-50/40"
        >
          <ul className="space-y-3">
            {mistakes.map((mistake, index) => (
              <MistakeCard
                key={index}
                trap={<QuestionMath text={mistake.trap} />}
                fix={mistake.fix ? <QuestionMath text={mistake.fix} /> : null}
              />
            ))}
          </ul>
        </Section>
      )}

      {recap.length > 0 && (
        <Section
          id="ghi-nho"
          step={stepOf('ghi-nho')}
          eyebrow="Ghi nhớ"
          title="Mang theo sau bài học"
          icon={BookmarkCheck}
          tone="emerald"
          className="bg-gradient-to-br from-emerald-50/70 to-white"
        >
          <ol className="grid gap-3 sm:grid-cols-2">
            {recap.map((item, index) => (
              <li
                key={index}
                className="flex gap-3 rounded-xl border border-emerald-100 bg-white p-3.5"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-[12px] font-bold text-white">
                  {index + 1}
                </span>
                <span className="text-[15px] leading-7 text-slate-800">
                  <QuestionMath text={item} />
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {references && (
        <section
          id="tham-khao"
          aria-labelledby="tham-khao-title"
          className="px-1 text-sm text-slate-500"
        >
          <h2
            id="tham-khao-title"
            className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400"
          >
            Tham khảo
          </h2>
          <RichText content={references} />
        </section>
      )}
    </div>
  );
}
