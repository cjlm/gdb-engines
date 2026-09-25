import type { APIRoute } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';

export const prerender = true;

const SITE = 'https://gdb-engines.com';

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Feed readers resolve root-relative URLs inconsistently, so point them at the site. */
function absolutizeUrls(html: string): string {
  return html.replaceAll(/(href|src)="\/(?!\/)/g, `$1="${SITE}/`);
}

function postHtml(post: CollectionEntry<'blog'>): string {
  const html = post.rendered?.html;
  if (!html) {
    throw new Error(`Blog post "${post.id}" has no rendered HTML for the RSS feed`);
  }
  return absolutizeUrls(html);
}

export const GET: APIRoute = async () => {
  const posts = (await getCollection('blog', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  const items = posts.map((post) => {
    const url = `${SITE}/blog/${post.id}/`;
    return [
      '    <item>',
      `      <title>${escapeXml(post.data.title)}</title>`,
      `      <description>${escapeXml(post.data.description)}</description>`,
      `      <link>${url}</link>`,
      `      <guid isPermaLink="true">${url}</guid>`,
      `      <pubDate>${post.data.date.toUTCString()}</pubDate>`,
      `      <content:encoded>${escapeXml(postHtml(post))}</content:encoded>`,
      '    </item>',
    ].join('\n');
  }).join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" ' +
    'xmlns:content="http://purl.org/rss/1.0/modules/content/">',
    '  <channel>',
    '    <title>GDB-Engines Blog</title>',
    '    <description>Research notes, release updates, and context from behind the GDB-Engines comparison and rankings.</description>',
    `    <link>${SITE}/blog/</link>`,
    `    <atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml"/>`,
    items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8' },
  });
};
