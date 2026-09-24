import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { notFound } from 'next/navigation';

import { ArticleGrid } from '@/components/blog/article-card';
import { BlogCategoryNav } from '@/components/blog/blog-category-nav';
import { PublicFooter, PublicHeader } from '@/components/layout';
import { siteConfig } from '@/config/site';
import { BLOG_CATEGORIES, getArticlesByCategory, getBlogCategory } from '@/lib/blog/articles';

interface CategoryPageProps {
  params: Promise<{ categorySlug: string }>;
}

export function generateStaticParams() {
  return BLOG_CATEGORIES.map((category) => ({ categorySlug: category.slug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { categorySlug } = await params;
  const category = getBlogCategory(categorySlug);

  if (!category) return {};

  const canonicalPath = `/blog/category/${category.slug}`;
  const coverImage =
    getArticlesByCategory(category.slug)[0]?.coverImage ?? '/assets/blog/chien-luoc-hoc-tap.svg';
  return {
    title: category.name,
    description: `${category.description} Đọc các bài viết thực hành trong chuyên mục ${category.name} của Tú Tài.`,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: 'website',
      locale: 'vi_VN',
      url: canonicalPath,
      title: `${category.name} — Thư viện Tú Tài`,
      description: category.description,
      images: [{ url: coverImage, width: 1200, height: 720 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${category.name} — Thư viện Tú Tài`,
      description: category.description,
      images: [coverImage],
    },
  };
}

export default async function BlogCategoryPage({ params }: CategoryPageProps) {
  const { categorySlug } = await params;
  const category = getBlogCategory(categorySlug);
  if (!category) notFound();

  const articles = getArticlesByCategory(category.slug);
  const canonicalUrl = `${siteConfig.url}/blog/category/${category.slug}`;
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: siteConfig.url },
        { '@type': 'ListItem', position: 2, name: 'Thư viện', item: `${siteConfig.url}/blog` },
        { '@type': 'ListItem', position: 3, name: category.name, item: canonicalUrl },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: category.name,
      description: category.description,
      url: canonicalUrl,
      inLanguage: 'vi-VN',
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: articles.map((article, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: article.title,
          url: `${siteConfig.url}/blog/${article.slug}`,
        })),
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
        <header className="border-b border-blue-100 bg-[linear-gradient(180deg,#f3f7ff_0%,#ffffff_100%)]">
          <div className="mx-auto max-w-[1180px] px-4 pb-16 pt-10 sm:px-6 sm:pb-20 lg:px-8">
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
                <li aria-current="page" className="text-slate-800">
                  {category.name}
                </li>
              </ol>
            </nav>
            <p className="mt-10 text-xs font-extrabold tracking-[0.15em] text-blue-700">
              CHUYÊN MỤC
            </p>
            <h1 className="mt-3 max-w-4xl text-4xl font-extrabold leading-tight tracking-[-0.045em] text-slate-950 sm:text-5xl">
              {category.name}
            </h1>
            <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-slate-600 sm:text-lg">
              {category.description}
            </p>
          </div>
        </header>

        <section aria-labelledby="category-articles-heading" className="py-14 sm:py-18">
          <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
            <BlogCategoryNav activeCategory={category.slug} />
            <div className="mt-10 flex items-end justify-between gap-4">
              <h2
                id="category-articles-heading"
                className="text-2xl font-extrabold tracking-[-0.03em] text-slate-950 sm:text-3xl"
              >
                {articles.length} bài viết trong chuyên mục
              </h2>
            </div>
            <div className="mt-7">
              <ArticleGrid articles={articles} />
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
