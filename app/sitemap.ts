import type { MetadataRoute } from 'next';

import { siteConfig } from '@/config/site';
import {
  BLOG_CATEGORIES,
  PUBLISHED_BLOG_ARTICLES,
  getArticleModifiedAt,
  getArticlesByCategory,
} from '@/lib/blog/articles';

const baseUrl = siteConfig.url;

export default function sitemap(): MetadataRoute.Sitemap {
  const latestBlogUpdate = new Date(
    Math.max(...PUBLISHED_BLOG_ARTICLES.map((article) => Date.parse(getArticleModifiedAt(article))))
  );

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/subjects`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/exam-sets`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/mock-exams`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/teachers`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  const blogPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/blog`,
      lastModified: latestBlogUpdate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...BLOG_CATEGORIES.map((category) => {
      const categoryArticles = getArticlesByCategory(category.slug);
      const lastModified = new Date(
        Math.max(...categoryArticles.map((article) => Date.parse(getArticleModifiedAt(article))))
      );

      return {
        url: `${baseUrl}/blog/category/${category.slug}`,
        lastModified,
        changeFrequency: 'weekly' as const,
        priority: 0.65,
      };
    }),
    ...PUBLISHED_BLOG_ARTICLES.map((article) => ({
      url: `${baseUrl}/blog/${article.slug}`,
      lastModified: new Date(getArticleModifiedAt(article)),
      changeFrequency: 'monthly' as const,
      priority: article.featured ? 0.75 : 0.6,
    })),
  ];

  return [...staticPages, ...blogPages];
}
