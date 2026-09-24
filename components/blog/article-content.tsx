import Link from 'next/link';
import { ArrowRight, BookOpenCheck, Check, Info, TriangleAlert } from 'lucide-react';

import { ArticleGrid } from '@/components/blog/article-card';
import type { BlogArticle } from '@/lib/blog/articles';

function ContentBlock({ block }: { block: BlogArticle['sections'][number]['blocks'][number] }) {
  switch (block.type) {
    case 'paragraph':
      return <p className="text-[1.03rem] font-medium leading-8 text-slate-700">{block.text}</p>;
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag
          className={`space-y-3 pl-6 text-[1.02rem] font-medium leading-7 text-slate-700 ${
            block.ordered ? 'list-decimal' : 'list-disc'
          } marker:font-bold marker:text-blue-700`}
        >
          {block.items.map((item) => (
            <li key={item} className="pl-1.5">
              {item}
            </li>
          ))}
        </Tag>
      );
    }
    case 'callout': {
      const warning = block.tone === 'warning';
      const example = block.tone === 'example';
      return (
        <aside
          className={`rounded-2xl border px-5 py-5 sm:px-6 ${
            warning
              ? 'border-amber-200 bg-amber-50'
              : example
                ? 'border-teal-200 bg-teal-50'
                : 'border-blue-200 bg-blue-50'
          }`}
        >
          <div className="flex gap-3">
            {warning ? (
              <TriangleAlert
                className="mt-0.5 shrink-0 text-amber-700"
                size={20}
                aria-hidden="true"
              />
            ) : (
              <Info
                className={`mt-0.5 shrink-0 ${example ? 'text-teal-700' : 'text-blue-700'}`}
                size={20}
                aria-hidden="true"
              />
            )}
            <div>
              <h3 className="font-extrabold text-slate-900">{block.title}</h3>
              <p className="mt-1.5 text-[0.96rem] font-medium leading-7 text-slate-700">
                {block.text}
              </p>
            </div>
          </div>
        </aside>
      );
    }
    case 'quote':
      return (
        <blockquote className="border-l-4 border-blue-700 py-2 pl-5 text-xl font-bold leading-8 tracking-[-0.015em] text-slate-800 sm:pl-7 sm:text-[1.35rem]">
          “{block.text}”
        </blockquote>
      );
    case 'table':
      return (
        <figure>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[640px] border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-slate-900">
                <tr>
                  {block.headers.map((header) => (
                    <th
                      key={header}
                      scope="col"
                      className="border-b border-slate-200 px-4 py-3.5 font-extrabold"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white text-slate-700">
                {block.rows.map((row, rowIndex) => (
                  <tr
                    key={`${row[0]}-${rowIndex}`}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${cell}-${cellIndex}`}
                        className="px-4 py-3.5 font-medium leading-6 first:font-bold first:text-slate-900"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <figcaption className="mt-2 text-sm font-medium text-slate-500">
            {block.caption}
          </figcaption>
        </figure>
      );
  }
}

export function ArticleTableOfContents({ article }: { article: BlogArticle }) {
  const links = article.sections.map((section) => (
    <li key={section.id}>
      <a
        href={`#${section.id}`}
        className="block border-l-2 border-slate-200 py-1.5 pl-3 text-sm font-semibold leading-5 text-slate-600 transition hover:border-blue-600 hover:text-blue-700"
      >
        {section.title}
      </a>
    </li>
  ));

  return (
    <>
      <details className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:hidden">
        <summary className="cursor-pointer font-extrabold text-slate-900">
          Trong bài viết này
        </summary>
        <ol className="mt-3 space-y-1">{links}</ol>
      </details>
      <aside className="hidden lg:block">
        <div className="sticky top-8">
          <p className="text-xs font-extrabold tracking-[0.12em] text-blue-700">
            TRONG BÀI VIẾT NÀY
          </p>
          <ol className="mt-4 space-y-1">{links}</ol>
        </div>
      </aside>
    </>
  );
}

export function ArticleBody({ article }: { article: BlogArticle }) {
  return (
    <div className="space-y-12">
      {article.sections.map((section) => (
        <section key={section.id} aria-labelledby={section.id} className="scroll-mt-8">
          <h2
            id={section.id}
            className="scroll-mt-8 text-2xl font-extrabold leading-tight tracking-[-0.03em] text-slate-950 sm:text-[1.75rem]"
          >
            {section.title}
          </h2>
          <div className="mt-5 space-y-5">
            {section.blocks.map((block, index) => (
              <ContentBlock key={`${section.id}-${index}`} block={block} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function ArticleTakeaways({ article }: { article: BlogArticle }) {
  return (
    <section
      aria-labelledby="takeaways-heading"
      className="rounded-[24px] border border-blue-200 bg-blue-50/70 p-6 sm:p-8"
    >
      <div className="flex items-center gap-3">
        <BookOpenCheck className="text-blue-700" size={24} aria-hidden="true" />
        <h2
          id="takeaways-heading"
          className="text-xl font-extrabold tracking-[-0.02em] text-slate-950"
        >
          Điều em nên nhớ
        </h2>
      </div>
      <ul className="mt-5 space-y-3">
        {article.keyTakeaways.map((takeaway) => (
          <li
            key={takeaway}
            className="flex gap-3 text-[0.98rem] font-semibold leading-7 text-slate-700"
          >
            <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-700 text-white">
              <Check size={13} strokeWidth={3} aria-hidden="true" />
            </span>
            {takeaway}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ArticleLearningLinks({ article }: { article: BlogArticle }) {
  if (article.learningLinks.length === 0) return null;

  return (
    <section aria-labelledby="learning-links-heading">
      <p className="text-xs font-extrabold tracking-[0.12em] text-blue-700">HỌC TIẾP TRÊN TÚ TÀI</p>
      <h2
        id="learning-links-heading"
        className="mt-2 text-2xl font-extrabold tracking-[-0.03em] text-slate-950"
      >
        Biến điều vừa đọc thành hành động
      </h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {article.learningLinks.map((learningLink) => (
          <Link
            key={learningLink.href}
            href={learningLink.href}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <h3 className="font-extrabold text-slate-950">{learningLink.title}</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              {learningLink.description}
            </p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-700">
              {learningLink.label}
              <ArrowRight
                size={15}
                className="transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function RelatedArticles({ articles }: { articles: BlogArticle[] }) {
  if (articles.length === 0) return null;

  return (
    <section
      aria-labelledby="related-heading"
      className="border-t border-slate-200 bg-slate-50/80 py-16 sm:py-20"
    >
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-extrabold tracking-[0.12em] text-blue-700">ĐỌC TIẾP</p>
        <h2
          id="related-heading"
          className="mt-2 text-3xl font-extrabold tracking-[-0.035em] text-slate-950"
        >
          Bài viết liên quan
        </h2>
        <div className="mt-8">
          <ArticleGrid articles={articles} />
        </div>
      </div>
    </section>
  );
}
