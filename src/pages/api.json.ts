import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { loadGithubStars } from '../lib/github-stars';

export const GET: APIRoute = async () => {
  const databases = await getCollection('databases');
  const githubStars = await loadGithubStars(databases);
  const nameBySlug = new Map(databases.map((db) => [db.data.slug, db.data.name]));

  // Keyed tables in the catalogue become a list here: one entry per parent, with the parent's
  // display name resolved so consumers don't need a second lookup. `parent_slug` is null for a
  // parent outside the catalogue.
  const lineageOf = (lineage: (typeof databases)[number]['data']['lineage'] = {}) =>
    Object.entries(lineage).map(([key, parent]) => ({
      relation: parent.relation,
      parent_slug: nameBySlug.has(key) ? key : null,
      parent_name: nameBySlug.get(key) ?? parent.name ?? key,
    }));

  const output = databases
    .sort((a, b) => a.data.name.localeCompare(b.data.name))
    .map((db) => ({
      slug: db.data.slug,
      name: db.data.name,
      description: db.data.description,
      url: db.data.url ?? null,
      github_url: db.data.github_url ?? null,
      github_stars: githubStars[db.data.slug] ?? null,
      type: db.data.type,
      protocols: db.data.protocols ?? null,
      category: db.data.category,
      released: db.data.released ?? null,
      previous_names: db.data.previous_names ?? [],
      lineage: lineageOf(db.data.lineage),
      gdotv_support: db.data.gdotv_support,
      features: db.data.features ?? null,
    }));

  return new Response(JSON.stringify(output, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
};
