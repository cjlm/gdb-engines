/**
 * Picker and column data for the comparison builder.
 *
 * Not `/api.json` — that carries a per-engine `description` the builder never renders and
 * omits the slug/alias/icon/rank the picker needs. Aliases come from the catalogue's
 * `previous_names` / `previous_vendors`, so typing "RedisGraph" finds FalkorDB.
 *
 * Beyond the picker fields, each entry carries the fundamentals the `/compare/custom/`
 * columns render, plus `features` for surveyed engines only. One fetch serves both the
 * combobox and the table; absent values are omitted rather than sent as null, so an
 * unsurveyed engine costs nothing.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { loadRankings } from '../lib/rankings';
import { selectPairs, buildOverallRankMap, buildRankedMap } from '../lib/comparisons';

/** Drops undefined/null entries so the payload carries only facts we hold. */
function compact<T extends Record<string, unknown>>(object: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(object)) {
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out as Partial<T>;
}

export const GET: APIRoute = async () => {
  const [databases, ranking] = await Promise.all([getCollection('databases'), loadRankings()]);
  const ranks = buildOverallRankMap(ranking);
  const ranked = buildRankedMap(ranking);

  const engines = databases
    .sort((a, b) => a.data.name.localeCompare(b.data.name))
    .map((db) => {
      const score = ranked.get(db.data.slug)?.score;
      return {
        slug: db.data.slug,
        name: db.data.name,
        aliases: [...(db.data.previous_names ?? []), ...(db.data.previous_vendors ?? [])],
        icon: db.data.icon ? `/logos/${db.data.icon}` : `/logos/${db.data.slug}.png`,
        rank: ranks.get(db.data.slug) ?? null,
        ...compact({
          score: typeof score === 'number' ? score : undefined,
          vendor: db.data.vendor,
          type: db.data.type,
          kind: db.data.kind,
          category: db.data.category,
          released: db.data.released,
          status: db.data.status,
          status_note: db.data.status_note,
          license: db.data.license,
          implementation_language: db.data.implementation_language,
          query_languages: db.data.query_languages,
          gdotv_support: db.data.gdotv_support,
          features: db.data.features,
        }),
      };
    });

  const pregenerated = selectPairs(
    ranking,
    databases.map((d) => ({ slug: d.data.slug, features: d.data.features }))
  ).map((p) => p.slug);

  return new Response(JSON.stringify({ engines, pregenerated }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
