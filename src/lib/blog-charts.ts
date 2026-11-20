/**
 * Charts a Markdown blog post can place between its paragraphs.
 *
 * Posts are plain Markdown from the private blog repo, so they cannot import components. A post
 * places a chart with an empty figure on its own line, separated by blank lines:
 *
 *   <figure data-chart="ai-coauthorship-repos"></figure>
 *
 * The post page splits the rendered HTML at each marker and renders the registered component
 * there. An unknown id fails the build rather than leaving an empty figure in a published post.
 */
export const BLOG_CHART_IDS = [
  'ai-coauthorship-monthly',
  'ai-coauthorship-repos',
] as const;
export type BlogChartId = (typeof BLOG_CHART_IDS)[number];

export type PostPart = { type: 'html'; html: string } | { type: 'chart'; id: BlogChartId };

const CHART_MARKER = /<figure\s+data-chart="([^"]*)"\s*>\s*<\/figure>/g;

function isBlogChartId(id: string): id is BlogChartId {
  return (BLOG_CHART_IDS as readonly string[]).includes(id);
}

/** Whether a post's rendered HTML places any chart. */
export function hasBlogCharts(html: string): boolean {
  return new RegExp(CHART_MARKER.source).test(html);
}

/**
 * Split rendered post HTML into HTML runs and chart placements, in document order.
 *
 * Raises:
 *   Error: a marker names a chart that is not in BLOG_CHART_IDS.
 */
export function splitPostHtml(html: string, postId = 'post'): PostPart[] {
  const parts: PostPart[] = [];
  let cursor = 0;
  for (const match of html.matchAll(CHART_MARKER)) {
    const id = match[1] ?? '';
    if (!isBlogChartId(id)) {
      throw new Error(
        `Blog post "${postId}" places unknown chart "${id}". ` +
          `Known charts: ${BLOG_CHART_IDS.join(', ')} (src/lib/blog-charts.ts).`,
      );
    }
    const before = html.slice(cursor, match.index);
    if (before.trim()) parts.push({ type: 'html', html: before });
    parts.push({ type: 'chart', id });
    cursor = match.index + match[0].length;
  }
  const rest = html.slice(cursor);
  if (rest.trim()) parts.push({ type: 'html', html: rest });
  return parts;
}
