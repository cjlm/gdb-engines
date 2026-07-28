/**
 * Picker data for the comparison combobox.
 *
 * Not `/api.json` — that carries a full 43-key feature object per engine, far more than a
 * picker needs. Aliases come from the catalogue's `previous_names` / `previous_vendors`, so
 * typing "RedisGraph" finds FalkorDB.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { loadRankings } from '../lib/rankings';
import { selectPairs, buildOverallRankMap } from '../lib/comparisons';

export const GET: APIRoute = async () => {
  const [databases, ranking] = await Promise.all([getCollection('databases'), loadRankings()]);
  const ranks = buildOverallRankMap(ranking);

  const engines = databases
    .sort((a, b) => a.data.name.localeCompare(b.data.name))
    .map((db) => ({
      slug: db.data.slug,
      name: db.data.name,
      aliases: [...(db.data.previous_names ?? []), ...(db.data.previous_vendors ?? [])],
      icon: db.data.icon ? `/logos/${db.data.icon}` : `/logos/${db.data.slug}.png`,
      rank: ranks.get(db.data.slug) ?? null,
    }));

  const pregenerated = selectPairs(
    ranking,
    databases.map((d) => ({ slug: d.data.slug, features: d.data.features }))
  ).map((p) => p.slug);

  return new Response(JSON.stringify({ engines, pregenerated }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
