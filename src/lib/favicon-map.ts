/**
 * One build-time pass over the catalogue producing slug -> logo URL.
 *
 * The single implementation: index.astro, db/[slug].astro, rankings/[slug].astro and the
 * comparison pages all call this. Call it once inside `getStaticPaths` and pass the map
 * through props — calling `fetchFavicon` per page turns a 30-second build into a
 * multi-minute one at comparison-page scale.
 *
 * Slugs whose lookup fell back to `/favicon.svg` are absent from the map rather than
 * mapped to it: that file is the *site's* icon, and rendering it beside an engine reads as
 * though the engine belonged to GDB-Engines. A caller that wants a placeholder chooses one.
 */
import { fetchFavicon } from '../utils/favicon';

interface FaviconSource {
  data: { slug: string; icon?: string; url?: string; github_url?: string };
}

export async function buildFaviconMap(databases: FaviconSource[]): Promise<Record<string, string>> {
  const faviconMap: Record<string, string> = {};
  for (const db of databases) {
    if (db.data.icon) {
      faviconMap[db.data.slug] = `/logos/${db.data.icon}`;
      continue;
    }
    const result = await fetchFavicon(db.data.slug, db.data.url ?? '', db.data.github_url);
    if (result.source !== 'fallback') faviconMap[db.data.slug] = result.url;
  }
  return faviconMap;
}
