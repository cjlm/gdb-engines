/**
 * Build-time loader for sponsor placements, sourced from the private gdb-engines-rankings
 * repo (commercial relationships stay out of the public history). Same fetch pattern as
 * loadRankings: GH contents API with RANKINGS_TOKEN, sibling-checkout fallback for local dev.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface Sponsor {
  title: string;
  blurb: string;
  link: string;
  /** Optional YYYY-MM-DD; sponsor is ignored after this date. */
  expires?: string;
}

export type SponsorMap = Record<string, Sponsor | string | undefined>;

const REPO = process.env.RANKINGS_REPO ?? 'cjlm/gdb-engines-rankings';
const PATH = process.env.SPONSORS_PATH ?? 'sponsors.json';
const REF = process.env.RANKINGS_REF ?? 'main';
const LOCAL_FALLBACK = resolve(process.cwd(), '..', 'gdb-engines-rankings', 'sponsors.json');

async function fetchFromGitHub(token: string): Promise<SponsorMap | null> {
  const url = `https://api.github.com/repos/${REPO}/contents/${PATH}?ref=${REF}`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github.raw', 'user-agent': 'gdb-engines-build' },
  });
  if (!res.ok) {
    console.warn(`[sponsors] GitHub fetch failed: ${res.status} ${await res.text()}`);
    return null;
  }
  return (await res.json()) as SponsorMap;
}

function readLocal(): SponsorMap | null {
  if (!existsSync(LOCAL_FALLBACK)) return null;
  return JSON.parse(readFileSync(LOCAL_FALLBACK, 'utf8')) as SponsorMap;
}

let cached: SponsorMap | null | undefined;

export async function loadSponsors(): Promise<SponsorMap> {
  if (cached !== undefined) return cached ?? {};
  const token = process.env.RANKINGS_TOKEN;
  const raw = token ? await fetchFromGitHub(token) : readLocal();
  cached = raw ?? null;
  return cached ?? {};
}

/** Returns the active sponsor for a given board slug, or null if none/expired. */
export function getSponsor(sponsors: SponsorMap, boardSlug: string): Sponsor | null {
  if (boardSlug.startsWith('_')) return null;
  const entry = sponsors[boardSlug];
  if (!entry || typeof entry === 'string') return null;
  if (entry.expires && new Date(entry.expires) < new Date()) return null;
  return entry;
}
