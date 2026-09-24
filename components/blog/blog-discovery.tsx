'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Search, SearchX, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { ArticleGrid, type BlogArticlePreview } from '@/components/blog/article-card';

function normalizeVietnamese(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi');
}

export function BlogSearchForm() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') ?? '';

  return (
    <form action="/blog#articles" method="get" role="search" className="mx-auto mt-8 max-w-[720px]">
      <label htmlFor="blog-search" className="sr-only">
        Tìm kiếm trong thư viện Tú Tài
      </label>
      <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-blue-100 bg-white p-1.5 pl-4 shadow-[0_16px_42px_rgba(30,64,175,0.12)] sm:min-h-16 sm:pl-5">
        <Search className="shrink-0 text-slate-400" size={21} aria-hidden="true" />
        <input
          id="blog-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Tìm bài viết, chủ đề hoặc kỹ năng..."
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 sm:text-base"
        />
        <button
          type="submit"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-bold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:px-6"
        >
          Tìm kiếm
        </button>
      </div>
    </form>
  );
}

export function BlogDiscovery({ articles }: { articles: BlogArticlePreview[] }) {
  const searchParams = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';
  const topic = searchParams.get('topic')?.trim() ?? '';

  const filteredArticles = useMemo(() => {
    const normalizedQuery = normalizeVietnamese(query);

    return articles.filter((article) => {
      const matchesTopic = !topic || article.collectionSlugs.includes(topic);
      if (!matchesTopic) return false;
      if (!normalizedQuery) return true;

      const searchable = normalizeVietnamese(
        [article.title, article.excerpt, article.subject, ...article.tags].join(' ')
      );
      return searchable.includes(normalizedQuery);
    });
  }, [articles, query, topic]);

  const isFiltered = Boolean(query || topic);

  return (
    <div>
      {isFiltered ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3.5">
          <p className="text-sm font-semibold text-slate-700" role="status">
            Tìm thấy <span className="text-blue-700">{filteredArticles.length}</span> bài viết
            {query ? <> cho “{query}”</> : null}
          </p>
          <Link
            href="/blog#articles"
            className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <X size={16} aria-hidden="true" />
            Xóa bộ lọc
          </Link>
        </div>
      ) : null}

      {filteredArticles.length > 0 ? (
        <ArticleGrid articles={filteredArticles} />
      ) : (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-14 text-center">
          <SearchX className="mx-auto text-slate-400" size={30} aria-hidden="true" />
          <h3 className="mt-4 text-xl font-bold text-slate-900">Chưa tìm thấy bài viết phù hợp</h3>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-slate-600">
            Hãy thử một từ khóa ngắn hơn, tên môn học hoặc quay lại toàn bộ thư viện.
          </p>
          <Link
            href="/blog#articles"
            className="mt-5 inline-flex min-h-11 items-center rounded-full bg-blue-700 px-5 text-sm font-bold text-white transition hover:bg-blue-800"
          >
            Xem tất cả bài viết
          </Link>
        </div>
      )}
    </div>
  );
}
