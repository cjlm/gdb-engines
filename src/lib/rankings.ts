/**
 * Build-time loader for the rankings JSON published by the (private) gdb-engines-rankings repo.
 *
 *   - If RANKINGS_TOKEN is set, fetch from GitHub via the contents API.
 *   - Otherwise fall back to a sibling checkout (../gdb-engines-rankings/out/ranking.json) for
 *     local dev.
 *   - If neither is available, return null and the site builds without /rankings/* pages.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export type Tier = 'Leader' | 'Strong' | 'Growing' | 'Emerging' | 'Insufficient data';

export interface Pillars {
  popularity: number | null;
  activity: number | null;
  community: number | null;
  research: number | null;
}

export interface RankedEngine {
  slug: string;
  name: string;
  type: string;
  kind: string;
  category: string;
  license: string | null;
  queryLanguages: string[];
  implementationLanguage: string | null;
  score: number;
  tier: Tier;
  momentum: number;
  coverage: number;
  pillars: Pillars;
  rankDelta1m: number | 'new' | null;
}

export interface RankingFile {
  generatedAt: string;
  methodologyVersion: string;
  overall: RankedEngine[];
  byType: Record<string, RankedEngine[]>;
  byKind: Record<string, RankedEngine[]>;
  byLicenseTier: Record<string, RankedEngine[]>;
  byQueryLanguage: Record<string, RankedEngine[]>;
  byImplementationLanguage: Record<string, RankedEngine[]>;
  movers: RankedEngine[];
}

const REPO = process.env.RANKINGS_REPO ?? 'cjlm/gdb-engines-rankings';
const PATH = process.env.RANKINGS_PATH ?? 'out/ranking.json';
const REF = process.env.RANKINGS_REF ?? 'main';
const LOCAL_FALLBACK = resolve(process.cwd(), '..', 'gdb-engines-rankings', 'out', 'ranking.json');

async function fetchFromGitHub(token: string): Promise<RankingFile | null> {
  const url = `https://api.github.com/repos/${REPO}/contents/${PATH}?ref=${REF}`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github.raw', 'user-agent': 'gdb-engines-build' },
  });
  if (!res.ok) {
    console.warn(`[rankings] GitHub fetch failed: ${res.status} ${await res.text()}`);
    return null;
  }
  return (await res.json()) as RankingFile;
}

function readLocal(): RankingFile | null {
  if (!existsSync(LOCAL_FALLBACK)) return null;
  return JSON.parse(readFileSync(LOCAL_FALLBACK, 'utf8')) as RankingFile;
}

let cached: RankingFile | null | undefined;

export async function loadRankings(): Promise<RankingFile | null> {
  if (cached !== undefined) return cached;
  const token = process.env.RANKINGS_TOKEN;
  const raw = token ? await fetchFromGitHub(token) : readLocal();
  if (!raw) { console.warn('[rankings] No ranking data available — /rankings/* pages will not be generated.'); }
  cached = raw ?? null;
  return cached;
}
