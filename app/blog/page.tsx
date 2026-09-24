import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRight, Search } from 'lucide-react';

import { BlogCategoryNav } from '@/components/blog/blog-category-nav';
import { BlogDiscovery, BlogSearchForm } from '@/components/blog/blog-discovery';
import { FeaturedArticle } from '@/components/blog/featured-article';
import { PublicFooter, PublicHeader } from '@/components/layout';
import { siteConfig } from '@/config/site';
import { BLOG_ARTICLES, BLOG_COLLECTIONS, PUBLISHED_BLOG_ARTICLES } from '@/lib/blog/articles';

export const metadata: Metadata = {
  title: 'Thư viện học tập & luyện thi',
  description:
    'Kiến thức, phương pháp làm bài và chiến lược luyện thi rõ ràng dành cho học sinh THPT trên Tú Tài.',
  alternates: {
    canonical: '/blog',
    types: {
      'application/rss+xml': '/blog/rss.xml',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: '/blog',
    title: 'Thư viện học tập & luyện thi — Tú Tài',
    description: 'Học đúng cách, hiểu sâu hơn và tiến gần mục tiêu hơn với thư viện Tú Tài.',
    images: [
      {
        url: '/assets/blog/luyen-thi-thpt.svg',
        width: 1200,
        height: 720,
        alt: 'Thư viện học tập và luyện thi Tú Tài',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Thư viện học tập & luyện thi — Tú Tài',
    description: 'Kiến thức, phương pháp làm bài và chiến lược luyện thi rõ ràng.',
    images: ['/assets/blog/luyen-thi-thpt.svg'],
  },
};

function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

export default function BlogPage() {
  const featuredArticle =
    PUBLISHED_BLOG_ARTICLES.find((article) => article.featured) ?? PUBLISHED_BLOG_ARTICLES[0];
  const articlePreviews = PUBLISHED_BLOG_ARTICLES.map((article) => ({
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    categorySlug: article.categorySlug,
    subject: article.subject,
    coverImage: article.coverImage,
    coverAlt: article.coverAlt,
    publishedAt: article.publishedAt,
    readingTimeMinutes: article.readingTimeMinutes,
    collectionSlugs: article.collectionSlugs,
    tags: article.tags,
  }));

  const collectionPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Thư viện Tú Tài',
    description: metadata.description,
    url: `${siteConfig.url}/blog`,
    inLanguage: 'vi-VN',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: PUBLISHED_BLOG_ARTICLES.map((article, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${siteConfig.url}/blog/${article.slug}`,
        name: article.title,
      })),
    },
  };

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <JsonLd data={collectionPageJsonLd} />

      <div className="bg-[#f4f8ff]">
        <PublicHeader />
      </div>
      <main id="main-content" tabIndex={-1}>
        <section className="overflow-hidden bg-[radial-gradient(circle_at_20%_0%,#dceaff_0,transparent_36%),linear-gradient(180deg,#f4f8ff_0%,#edf4ff_72%,#ffffff_100%)]">
          <div className="mx-auto max-w-[1040px] px-4 pb-20 pt-16 text-center sm:px-6 sm:pb-24 sm:pt-20 lg:px-8 lg:pb-28 lg:pt-24">
            <p className="text-xs font-extrabold tracking-[0.16em] text-blue-700 sm:text-sm">
              THƯ VIỆN TÚ TÀI
            </p>
            <h1 className="mx-auto mt-5 max-w-[920px] text-[2.35rem] font-extrabold leading-[1.08] tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-[4.25rem]">
              Học đúng cách. Hiểu sâu hơn. Tiến gần mục tiêu hơn.
            </h1>
            <p className="mx-auto mt-6 max-w-[760px] text-[1rem] font-medium leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Kiến thức, phương pháp làm bài và chiến lược luyện thi được trình bày rõ ràng để em
              biết nên học gì và áp dụng như thế nào.
            </p>
            <Suspense
              fallback={
                <div className="mx-auto mt-8 flex min-h-16 max-w-[720px] items-center gap-3 rounded-2xl border border-blue-100 bg-white px-5 text-left shadow-[0_16px_42px_rgba(30,64,175,0.12)]">
                  <Search className="text-slate-400" size={21} aria-hidden="true" />
                  <span className="text-sm font-semibold text-slate-400">
                    Tìm bài viết, chủ đề hoặc kỹ năng...
                  </span>
                </div>
              }
            >
              <BlogSearchForm />
            </Suspense>
          </div>
        </section>

        <section aria-labelledby="featured-heading" className="py-16 sm:py-20">
          <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
            <h2 id="featured-heading" className="sr-only">
              Bài viết nổi bật
            </h2>
            <FeaturedArticle article={featuredArticle} />
          </div>
        </section>

        <section
          id="articles"
          aria-labelledby="articles-heading"
          className="scroll-mt-4 border-y border-slate-200/80 bg-slate-50/70 py-16 sm:py-20"
        >
          <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-extrabold tracking-[0.14em] text-blue-700">
                KHÁM PHÁ THEO NHU CẦU
              </p>
              <h2
                id="articles-heading"
                className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-slate-950 sm:text-4xl"
              >
                Bắt đầu từ điều em đang cần
              </h2>
              <p className="mt-3 text-base font-medium leading-7 text-slate-600">
                Tìm theo từ khóa hoặc đi vào một chuyên mục để đọc liền mạch hơn.
              </p>
            </div>
            <div className="mt-8">
              <BlogCategoryNav />
            </div>
            <div className="mt-9">
              <Suspense
                fallback={<div className="h-80 animate-pulse rounded-[24px] bg-slate-200/60" />}
              >
                <BlogDiscovery articles={articlePreviews} />
              </Suspense>
            </div>
          </div>
        </section>

        <section aria-labelledby="collections-heading" className="py-16 sm:py-20">
          <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
            <p className="text-xs font-extrabold tracking-[0.14em] text-blue-700">
              BỘ SƯU TẬP CHỦ ĐỀ
            </p>
            <h2
              id="collections-heading"
              className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-slate-950 sm:text-4xl"
            >
              Một vấn đề, nhiều góc nhìn thực hành
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {BLOG_COLLECTIONS.map((collection, index) => {
                const articleCount = BLOG_ARTICLES.filter(
                  (article) =>
                    article.status === 'published' &&
                    article.collectionSlugs.includes(collection.slug)
                ).length;

                return (
                  <Link
                    key={collection.slug}
                    href={`/blog?topic=${collection.slug}#articles`}
                    className="group flex min-h-[238px] flex-col rounded-[22px] border border-slate-200 bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_18px_42px_rgba(30,64,175,0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <span className="text-sm font-extrabold text-blue-700">0{index + 1}</span>
                    <p className="mt-7 text-[0.68rem] font-extrabold tracking-[0.12em] text-slate-500">
                      {collection.eyebrow}
                    </p>
                    <h3 className="mt-2 text-xl font-extrabold tracking-[-0.025em] text-slate-950">
                      {collection.title}
                    </h3>
                    <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
                      {collection.description}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-bold text-blue-700">
                      {articleCount} bài viết
                      <ArrowRight
                        size={15}
                        className="transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
