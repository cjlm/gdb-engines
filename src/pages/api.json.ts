import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const databases = await getCollection('databases');

  const output = databases
    .sort((a, b) => a.data.name.localeCompare(b.data.name))
    .map((db) => ({
      slug: db.data.slug,
      name: db.data.name,
      description: db.data.description,
      url: db.data.url ?? null,
      type: db.data.type,
      category: db.data.category,
      gdotv_support: db.data.gdotv_support,
      features: db.data.features ?? null,
    }));

  return new Response(JSON.stringify(output, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
};
