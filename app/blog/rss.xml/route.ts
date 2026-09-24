import { siteConfig } from '@/config/site';
import {
  PUBLISHED_BLOG_ARTICLES,
  getArticleModifiedAt,
  getBlogCategory,
} from '@/lib/blog/articles';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function GET() {
  const latestUpdate = PUBLISHED_BLOG_ARTICLES.reduce((latest, article) => {
    const value = Date.parse(getArticleModifiedAt(article));
    return value > latest ? value : latest;
  }, 0);

  const items = PUBLISHED_BLOG_ARTICLES.map((article) => {
    const articleUrl = `${siteConfig.url}/blog/${article.slug}`;
    const category = getBlogCategory(article.categorySlug);

    return `
    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(articleUrl)}</link>
      <guid isPermaLink="true">${escapeXml(articleUrl)}</guid>
      <description>${escapeXml(article.excerpt)}</description>
      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>
      <dc:creator>${escapeXml(article.author.name)}</dc:creator>
      ${category ? `<category>${escapeXml(category.name)}</category>` : ''}
    </item>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Thư viện Tú Tài</title>
    <link>${escapeXml(`${siteConfig.url}/blog`)}</link>
    <description>Kiến thức, phương pháp làm bài và chiến lược luyện thi dành cho học sinh THPT.</description>
    <language>vi-VN</language>
    <lastBuildDate>${new Date(latestUpdate).toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(`${siteConfig.url}/blog/rss.xml`)}" rel="self" type="application/rss+xml" />${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
