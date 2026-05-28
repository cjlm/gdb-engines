import sponsorsData from '../data/sponsors.json';

export interface Sponsor {
  title: string;
  blurb: string;
  link: string;
  /** Optional YYYY-MM-DD; sponsor is ignored after this date. */
  expires?: string;
}

/** Returns the active sponsor for a given board slug, or null if none/expired. */
export function getSponsor(boardSlug: string): Sponsor | null {
  if (boardSlug.startsWith('_')) return null;
  const entry = (sponsorsData as Record<string, Sponsor | string | undefined>)[boardSlug];
  if (!entry || typeof entry === 'string') return null;
  if (entry.expires && new Date(entry.expires) < new Date()) return null;
  return entry;
}
