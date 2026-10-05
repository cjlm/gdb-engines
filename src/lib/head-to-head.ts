/**
 * Links between every two column engines on a collection page.
 *
 * Only a subset of pairs is pre-generated (see comparisons.ts), so a collection's six columns
 * can name a pair with no static page. Those link to the client-side builder instead of a 404.
 */
export interface HeadToHeadEngine {
  slug: string;
  name: string;
}

export interface HeadToHeadLink {
  href: string;
  label: string;
}

export function headToHeadLinks(engines: HeadToHeadEngine[], published: Set<string>): HeadToHeadLink[] {
  const links: HeadToHeadLink[] = [];
  for (const [i, x] of engines.entries()) {
    for (const y of engines.slice(i + 1)) {
      const [p, q] = x.slug < y.slug ? [x, y] : [y, x];
      const slug = `${p.slug}-vs-${q.slug}`;
      const href = published.has(slug)
        ? `/compare/${slug}/`
        : `/compare/custom/?${new URLSearchParams([['db', p.slug], ['db', q.slug]])}`;
      links.push({ href, label: `${p.name} vs ${q.name}` });
    }
  }
  return links;
}
