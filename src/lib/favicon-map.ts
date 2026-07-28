/**
 * One build-time pass over the catalogue producing slug -> logo URL.
 *
 * The same loop was duplicated in index.astro, db/[slug].astro and rankings/[slug].astro;
 * the comparison pages are the fourth consumer and the reason to lift it out. Call it once
 * inside `getStaticPaths` and pass the map through props — calling `fetchFavicon` per page
 * turns a 30-second build into a multi-minute one at comparison-page scale.
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
    } else {
      const result = await fetchFavicon(db.data.slug, db.data.url ?? '', db.data.github_url);
      faviconMap[db.data.slug] = result.url;
    }
  }
  return faviconMap;
}
