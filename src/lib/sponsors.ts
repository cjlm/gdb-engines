/**
 * Build-time loader for sponsor placements, sourced from the private gdb-engines-rankings
 * repo so commercial relationships stay out of the public history. Same fetch pattern as
 * loadRankings: GH contents API with RANKINGS_TOKEN, sibling-checkout fallback for local dev.
 * Logos are fetched the same way and returned as data: URIs, rendered through <img> so a
 * vendor SVG cannot run script in the page.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export type Placement = 'header' | 'ranking-banner' | 'compare-banner' | 'sponsors-page';
const PLACEMENTS: ReadonlySet<string> = new Set(['header', 'ranking-banner', 'compare-banner', 'sponsors-page']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** True for YYYY-MM-DD strings that name a real calendar day (rejects 2026-02-30, 2026-13-01). */
function isRealDate(s: string): boolean {
  if (!DATE.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().startsWith(s);
}

interface RawLogo { light: string; dark: string; symbol_light?: string; symbol_dark?: string }
export interface RawSponsor {
  id: string; name: string; tier: 'founding' | 'presenting';
  tagline: string; description: string; link: string; engine_slug?: string;
  logo: RawLogo; start: string; end?: string | null; placements: Placement[];
}
export interface SponsorLogo { light: string; dark: string; symbolLight?: string; symbolDark?: string }
export interface Sponsor extends Omit<RawSponsor, 'logo' | 'end'> { logo: SponsorLogo; end: string | null }

const REPO = process.env.RANKINGS_REPO ?? 'cjlm/gdb-engines-rankings';
const PATH = process.env.SPONSORS_PATH ?? 'sponsors.json';
const REF = process.env.RANKINGS_REF ?? 'main';
const LOCAL_DIR = process.env.SPONSORS_LOCAL_DIR ?? resolve(process.cwd(), '..', 'gdb-engines-rankings');
const INCLUDE_SCHEDULED = process.env.SPONSORS_INCLUDE_SCHEDULED === '1';

export function isLive(entry: { start: string; end?: string | null }, now: Date, includeScheduled: boolean): boolean {
  const t = now.getTime();
  if (entry.end && t >= Date.parse(`${entry.end}T00:00:00Z`) + DAY_MS) return false;
  return includeScheduled || t >= Date.parse(`${entry.start}T00:00:00Z`);
}

export function sponsorFor<T extends { placements: Placement[] }>(sponsors: T[], placement: Placement): T | null {
  return sponsors.find((s) => s.placements.includes(placement)) ?? null;
}

export function placementLink(link: string, placement: Placement): string {
  const url = new URL(link);
  url.searchParams.set('utm_content', placement);
  return url.toString();
}

function fail(id: string, problem: string): never {
  throw new Error(`[sponsors] ${id}: ${problem}. Fix sponsors.json in gdb-engines-rankings.`);
}

function checkText(id: string, s: RawSponsor): void {
  if (!s.name || !s.tagline || !s.description) {
    fail(id, 'name, tagline and description are required');
  }
}

function checkDates(id: string, s: RawSponsor): void {
  if (!isRealDate(s.start)) fail(id, `start must be YYYY-MM-DD, got "${s.start}"`);
  if (s.end != null && !isRealDate(s.end)) {
    fail(id, `end must be YYYY-MM-DD or null, got "${s.end}"`);
  }
  if (s.end != null && s.end < s.start) fail(id, `end ${s.end} is before start ${s.start}`);
}

function checkTier(id: string, s: RawSponsor): void {
  if (s.tier !== 'founding' && s.tier !== 'presenting') {
    fail(id, `tier must be founding or presenting, got "${s.tier}"`);
  }
}

function checkLink(id: string, s: RawSponsor): void {
  if (!s.link?.startsWith('https://')) fail(id, 'link must be https');
}

function checkPlacements(id: string, s: RawSponsor): void {
  const bad = (s.placements ?? []).filter((p) => !PLACEMENTS.has(p));
  if (!s.placements?.length || bad.length) {
    fail(id, `unknown or missing placement: ${bad.join(', ') || 'none'}`);
  }
}

function checkLogos(id: string, s: RawSponsor): void {
  for (const p of Object.values(s.logo ?? {})) {
    if (!p?.endsWith('.svg')) fail(id, `logo paths must be .svg, got "${p}"`);
  }
  if (!s.logo?.light || !s.logo?.dark) fail(id, 'logo.light and logo.dark (svg) are required');
}

function checkEntry(s: RawSponsor): void {
  const id = s.id || '(no id)';
  checkText(id, s);
  checkDates(id, s);
  checkTier(id, s);
  checkLink(id, s);
  checkPlacements(id, s);
  checkLogos(id, s);
}

export function parseSponsorFile(raw: unknown): RawSponsor[] {
  const list = (raw as { sponsors?: unknown })?.sponsors;
  if (!Array.isArray(list)) throw new Error('[sponsors] expected { "sponsors": [...] }: no sponsors array found.');
  for (const s of list as RawSponsor[]) checkEntry(s);
  return list as RawSponsor[];
}

async function fetchRaw(path: string, token: string): Promise<Buffer> {
  const url = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${REF}`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github.raw', 'user-agent': 'gdb-engines-build' },
  });
  if (!res.ok) throw new Error(`[sponsors] GitHub fetch of ${path} failed: ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

function readLocal(path: string): Buffer | null {
  const file = resolve(LOCAL_DIR, path);
  return existsSync(file) ? readFileSync(file) : null;
}

async function readAsset(path: string, token: string | undefined): Promise<Buffer | null> {
  return token ? fetchRaw(path, token) : readLocal(path);
}

async function svgDataUri(path: string | undefined, token: string | undefined): Promise<string | undefined> {
  if (!path) return undefined;
  const svg = await readAsset(path, token);
  if (!svg) throw new Error(`[sponsors] logo ${path} not found (looked in ${token ? REPO : LOCAL_DIR}).`);
  return `data:image/svg+xml;base64,${svg.toString('base64')}`;
}

async function resolveLogos(s: RawSponsor, token: string | undefined): Promise<Sponsor> {
  const [light, dark, symbolLight, symbolDark] = await Promise.all([
    svgDataUri(s.logo.light, token), svgDataUri(s.logo.dark, token),
    svgDataUri(s.logo.symbol_light, token), svgDataUri(s.logo.symbol_dark, token),
  ]);
  return { ...s, end: s.end ?? null, logo: { light: light!, dark: dark!, symbolLight, symbolDark } };
}

let cached: Promise<Sponsor[]> | undefined;

/** Live sponsors (scheduled ones too when SPONSORS_INCLUDE_SCHEDULED=1), logos resolved. */
export function loadSponsors(): Promise<Sponsor[]> {
  cached ??= (async () => {
    const token = process.env.RANKINGS_TOKEN;
    const file = await readAsset(PATH, token);
    if (!file) return [];
    const now = new Date();
    const live = parseSponsorFile(JSON.parse(file.toString('utf8'))).filter((s) => isLive(s, now, INCLUDE_SCHEDULED));
    return Promise.all(live.map((s) => resolveLogos(s, token)));
  })();
  return cached;
}
