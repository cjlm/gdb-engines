import { getCollection } from 'astro:content';

/**
 * Total number of database entries.
 *
 * Single source for the count figure shown across page titles, meta
 * descriptions, and structured data so the number never drifts between pages.
 */
export async function getDatabaseCount(): Promise<number> {
  return (await getCollection('databases')).length;
}
