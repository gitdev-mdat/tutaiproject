import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Clock3 } from 'lucide-react';

import { formatBlogDate, getBlogCategory, type BlogArticle } from '@/lib/blog/articles';

export type BlogArticlePreview = Pick<
  BlogArticle,
  | 'slug'
  | 'title'
  | 'excerpt'
  | 'categorySlug'
  | 'subject'
  | 'coverImage'
  | 'coverAlt'
  | 'publishedAt'
  | 'readingTimeMinutes'
  | 'collectionSlugs'
  | 'tags'
>;

export function ArticleCard({ article }: { article: BlogArticlePreview }) {
  const category = getBlogCategory(article.categorySlug);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_14px_38px_rgba(15,23,42,0.055)] transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_20px_48px_rgba(30,64,175,0.11)]">
      <Link
        href={`/blog/${article.slug}`}
        className="relative block aspect-[5/3] overflow-hidden bg-slate-100"
      >
        <Image
          src={article.coverImage}
          alt={article.coverAlt}
          fill
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
          className="object-cover transition duration-300 group-hover:scale-[1.025]"
        />
      </Link>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-[0.055em]">
          <span className="text-blue-700">{category?.name}</span>
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="text-slate-500">{article.subject}</span>
        </div>
        <h3 className="mt-3 text-[1.15rem] font-bold leading-[1.35] tracking-[-0.02em] text-slate-950 sm:text-xl">
          <Link
            href={`/blog/${article.slug}`}
            className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
          >
            {article.title}
          </Link>
        </h3>
        <p className="mt-3 line-clamp-3 text-sm font-medium leading-6 text-slate-600">
          {article.excerpt}
        </p>
        <div className="mt-auto flex items-end justify-between gap-4 pt-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
            <span>{formatBlogDate(article.publishedAt)}</span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={14} aria-hidden="true" />
              {article.readingTimeMinutes} phút đọc
            </span>
          </div>
          <ArrowUpRight
            size={18}
            aria-hidden="true"
            className="shrink-0 text-blue-700 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </div>
      </div>
    </article>
  );
}

export function ArticleGrid({ articles }: { articles: BlogArticlePreview[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <ArticleCard key={article.slug} article={article} />
      ))}
    </div>
  );
}
