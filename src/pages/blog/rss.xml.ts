import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = true;

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export const GET: APIRoute = async () => {
  const posts = (await getCollection('blog', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  const items = posts.map((post) => {
    const url = `https://gdb-engines.com/blog/${post.id}/`;
    return [
      '    <item>',
      `      <title>${escapeXml(post.data.title)}</title>`,
      `      <description>${escapeXml(post.data.description)}</description>`,
      `      <link>${url}</link>`,
      `      <guid isPermaLink="true">${url}</guid>`,
      `      <pubDate>${post.data.date.toUTCString()}</pubDate>`,
      '    </item>',
    ].join('\n');
  }).join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>GDB-Engines Blog</title>',
    '    <description>Research notes, release updates, and context from behind the GDB-Engines comparison and rankings.</description>',
    '    <link>https://gdb-engines.com/blog/</link>',
    '    <atom:link href="https://gdb-engines.com/blog/rss.xml" rel="self" type="application/rss+xml"/>',
    items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8' },
  });
};
