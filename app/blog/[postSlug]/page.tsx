import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { CalendarDays, ChevronRight, Clock3, RefreshCw } from 'lucide-react';
import { notFound } from 'next/navigation';

import {
  ArticleBody,
  ArticleLearningLinks,
  ArticleTableOfContents,
  ArticleTakeaways,
  RelatedArticles,
} from '@/components/blog/article-content';
import { PublicFooter, PublicHeader } from '@/components/layout';
import { siteConfig } from '@/config/site';
import {
  PUBLISHED_BLOG_ARTICLES,
  formatBlogDate,
  getArticleModifiedAt,
  getBlogArticle,
  getBlogCategory,
  getRelatedArticles,
} from '@/lib/blog/articles';

interface ArticlePageProps {
  params: Promise<{ postSlug: string }>;
}

export function generateStaticParams() {
  return PUBLISHED_BLOG_ARTICLES.map((article) => ({ postSlug: article.slug }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { postSlug } = await params;
  const article = getBlogArticle(postSlug);
  if (!article) return {};

  const canonicalPath = `/blog/${article.slug}`;
  return {
    title: article.seoTitle,
    description: article.seoDescription,
    authors: [{ name: article.author.name }],
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: 'article',
      locale: 'vi_VN',
      url: canonicalPath,
      title: article.title,
      description: article.seoDescription,
      publishedTime: article.publishedAt,
      modifiedTime: getArticleModifiedAt(article),
      authors: [article.author.name],
      tags: article.tags,
      images: [
        {
          url: article.coverImage,
          width: 1200,
          height: 720,
          alt: article.coverAlt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.seoDescription,
      images: [article.coverImage],
    },
  };
}

export default async function BlogArticlePage({ params }: ArticlePageProps) {
  const { postSlug } = await params;
  const article = getBlogArticle(postSlug);
  if (!article) notFound();

  const category = getBlogCategory(article.categorySlug);
  if (!category) notFound();

  const canonicalUrl = `${siteConfig.url}/blog/${article.slug}`;
  const categoryUrl = `${siteConfig.url}/blog/category/${category.slug}`;
  const modifiedAt = getArticleModifiedAt(article);
  const relatedArticles = getRelatedArticles(article);
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: siteConfig.url },
        { '@type': 'ListItem', position: 2, name: 'Thư viện', item: `${siteConfig.url}/blog` },
        { '@type': 'ListItem', position: 3, name: category.name, item: categoryUrl },
        { '@type': 'ListItem', position: 4, name: article.title, item: canonicalUrl },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: article.title,
      description: article.seoDescription,
      image: `${siteConfig.url}${article.coverImage}`,
      datePublished: article.publishedAt,
      dateModified: modifiedAt,
      inLanguage: 'vi-VN',
      mainEntityOfPage: canonicalUrl,
      articleSection: category.name,
      keywords: article.tags.join(', '),
      author: {
        '@type': 'Organization',
        name: article.author.name,
        url: siteConfig.url,
      },
      publisher: {
        '@type': 'Organization',
        name: siteConfig.name,
        url: siteConfig.url,
      },
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />
      <div className="bg-[#f3f7ff]">
        <PublicHeader />
      </div>

      <main id="main-content" tabIndex={-1}>
        <article>
          <header className="border-b border-blue-100 bg-[linear-gradient(180deg,#f3f7ff_0%,#ffffff_100%)]">
            <div className="mx-auto max-w-[1000px] px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-10 lg:px-8">
              <nav aria-label="Đường dẫn" className="text-sm font-semibold text-slate-500">
                <ol className="flex flex-wrap items-center gap-1.5">
                  <li>
                    <Link href="/" className="hover:text-blue-700">
                      Trang chủ
                    </Link>
                  </li>
                  <li aria-hidden="true">
                    <ChevronRight size={14} />
                  </li>
                  <li>
                    <Link href="/blog" className="hover:text-blue-700">
                      Thư viện
                    </Link>
                  </li>
                  <li aria-hidden="true">
                    <ChevronRight size={14} />
                  </li>
                  <li>
                    <Link href={`/blog/category/${category.slug}`} className="hover:text-blue-700">
                      {category.name}
                    </Link>
                  </li>
                </ol>
              </nav>

              <div className="mt-10 flex flex-wrap items-center gap-2 text-xs font-extrabold tracking-[0.075em]">
                <Link
                  href={`/blog/category/${category.slug}`}
                  className="text-blue-700 hover:text-blue-900"
                >
                  {category.name}
                </Link>
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-slate-300" />
                <span className="text-slate-500">{article.subject}</span>
              </div>
              <h1 className="mt-4 text-[2.35rem] font-extrabold leading-[1.08] tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-[3.65rem]">
                {article.title}
              </h1>
              <p className="mt-6 max-w-[820px] text-[1.05rem] font-medium leading-8 text-slate-600 sm:text-xl">
                {article.excerpt}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-slate-200 pt-6 text-sm font-semibold text-slate-600">
                <span className="text-slate-900">{article.author.name}</span>
                <time dateTime={article.publishedAt} className="inline-flex items-center gap-1.5">
                  <CalendarDays size={16} aria-hidden="true" />
                  {formatBlogDate(article.publishedAt)}
                </time>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 size={16} aria-hidden="true" />
                  {article.readingTimeMinutes} phút đọc
                </span>
                {article.updatedAt ? (
                  <time
                    dateTime={article.updatedAt}
                    className="inline-flex items-center gap-1.5 text-slate-500"
                  >
                    <RefreshCw size={15} aria-hidden="true" />
                    Cập nhật {formatBlogDate(article.updatedAt)}
                  </time>
                ) : null}
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1120px] px-4 pt-10 sm:px-6 sm:pt-14 lg:px-8">
            <div className="relative aspect-[5/3] overflow-hidden rounded-[24px] border border-slate-200 bg-slate-100 shadow-[0_22px_60px_rgba(15,23,42,0.09)] sm:rounded-[30px]">
              <Image
                src={article.coverImage}
                alt={article.coverAlt}
                fill
                priority
                sizes="(min-width: 1120px) 1120px, 100vw"
                className="object-cover"
              />
            </div>
          </div>

          <div className="mx-auto grid max-w-[1000px] gap-10 px-4 py-14 sm:px-6 sm:py-18 lg:grid-cols-[220px_minmax(0,700px)] lg:gap-16 lg:px-8 lg:py-20">
            <ArticleTableOfContents article={article} />
            <div className="min-w-0">
              <ArticleBody article={article} />
              <div className="mt-14 space-y-12 border-t border-slate-200 pt-12">
                <ArticleTakeaways article={article} />
                <ArticleLearningLinks article={article} />
                <Link
                  href={`/blog/category/${category.slug}`}
                  className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-900"
                >
                  Xem thêm trong {category.name}
                  <ChevronRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </article>

        <RelatedArticles articles={relatedArticles} />
      </main>
      <PublicFooter />
    </div>
  );
}
