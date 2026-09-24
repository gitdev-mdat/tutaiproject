import Link from 'next/link';

import { BLOG_CATEGORIES, type BlogCategorySlug } from '@/lib/blog/articles';

export function BlogCategoryNav({ activeCategory }: { activeCategory?: BlogCategorySlug }) {
  return (
    <nav aria-label="Chuyên mục Blog" className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max items-center gap-2">
        <li>
          <Link
            href="/blog#articles"
            aria-current={activeCategory ? undefined : 'page'}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
              activeCategory
                ? 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                : 'border-blue-700 bg-blue-700 text-white shadow-sm'
            }`}
          >
            Tất cả bài viết
          </Link>
        </li>
        {BLOG_CATEGORIES.map((category) => {
          const isActive = activeCategory === category.slug;
          return (
            <li key={category.slug}>
              <Link
                href={`/blog/category/${category.slug}`}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  isActive
                    ? 'border-blue-700 bg-blue-700 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700'
                }`}
              >
                {category.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
