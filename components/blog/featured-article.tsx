import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Clock3 } from 'lucide-react';

import { formatBlogDate, getBlogCategory, type BlogArticle } from '@/lib/blog/articles';

export function FeaturedArticle({ article }: { article: BlogArticle }) {
  const category = getBlogCategory(article.categorySlug);

  return (
    <article className="grid overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.08)] lg:grid-cols-[1.08fr_0.92fr]">
      <Link
        href={`/blog/${article.slug}`}
        className="relative min-h-[280px] overflow-hidden bg-slate-100 sm:min-h-[360px] lg:min-h-[430px]"
      >
        <Image
          src={article.coverImage}
          alt={article.coverAlt}
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="object-cover transition duration-300 hover:scale-[1.02]"
        />
      </Link>
      <div className="flex flex-col justify-center p-6 sm:p-9 lg:p-11">
        <p className="text-xs font-extrabold tracking-[0.14em] text-blue-700">BÀI VIẾT NỔI BẬT</p>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold tracking-[0.05em]">
          <span className="text-blue-700">{category?.name}</span>
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="text-slate-500">{article.subject}</span>
        </div>
        <h2 className="mt-3 text-2xl font-extrabold leading-[1.2] tracking-[-0.035em] text-slate-950 sm:text-3xl lg:text-[2.15rem]">
          <Link
            href={`/blog/${article.slug}`}
            className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
          >
            {article.title}
          </Link>
        </h2>
        <p className="mt-4 text-[15px] font-medium leading-7 text-slate-600 sm:text-base">
          {article.excerpt}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-500">
          <span>{formatBlogDate(article.publishedAt)}</span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={16} aria-hidden="true" />
            {article.readingTimeMinutes} phút đọc
          </span>
        </div>
        <Link
          href={`/blog/${article.slug}`}
          className="mt-7 inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-blue-700 px-5 text-sm font-bold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Đọc bài viết
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
