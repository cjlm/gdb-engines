/**
 * Which blog posts mention which engines, so each profile can list the posts about it.
 *
 * A post mentions an engine when it links to the engine's profile (/db/<slug>/) or uses the
 * engine's name or one of its aliases, case-sensitive and as a whole word, outside fenced code. Names that are also
 * ordinary words count only as a link, so "traverse the graph" does not list Traverse.
 */
export const LINK_ONLY_NAMES = new Set([
  'Gaffer', 'GUN', 'Neptune', 'Parliament', 'Quine', 'TAO', 'Titan', 'Traverse', 'Virtuoso', 'Weaver',
]);

export interface MentionablePost {
  id: string;
  body: string;
}

export interface MentionableEngine {
  slug: string;
  name: string;
  aliases?: string[];
}

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function mentionsByEngine<P extends MentionablePost>(
  posts: P[],
  engines: MentionableEngine[],
): Map<string, P[]> {
  const result = new Map<string, P[]>();
  for (const post of posts) {
    const prose = post.body.replace(/```[\s\S]*?```/g, '');
    for (const engine of engines) {
      const linked = prose.includes(`/db/${engine.slug}/`) || prose.includes(`/db/${engine.slug})`);
      const named = [engine.name, ...(engine.aliases ?? [])]
        .filter((name) => !LINK_ONLY_NAMES.has(name))
        .some((name) => new RegExp(`(?<![\\w-])${escape(name)}(?![\\w-])`).test(prose));
      if (linked || named) result.set(engine.slug, [...(result.get(engine.slug) ?? []), post]);
    }
  }
  return result;
}
