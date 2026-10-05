/**
 * Licence classification for the catalogue's SPDX-style `license` strings.
 *
 * Mirrors licenseTier() in gdb-engines-rankings (src/score.ts), which assigns engines to
 * the licence ranking boards; keep the two in step. 'Other' is the source-available tier
 * (shown as "Source-Available"): code is published but use is restricted, so it is not
 * open source. It is checked first because "MIT + Commons Clause" contains "mit".
 */
export type LicenseTier = 'Permissive' | 'Copyleft' | 'Proprietary' | 'Other';

// Licence strings come from both this catalogue and the rankings snapshot, which has used
// older spellings: "BSL-1.1" (Business Source, not the open-source Boost BSL-1.0) and "ELv2".
const SOURCE_AVAILABLE_TOKENS = ['busl', 'bsl-1.1', 'sspl', 'elastic', 'elv2', 'commons clause'];
const COPYLEFT_TOKENS = ['gpl', 'lgpl', 'agpl', 'eupl', 'osl', 'epl'];
const PERMISSIVE_EXACT = new Set([
  'mit', 'apache-2.0', 'bsd-2-clause', 'bsd-3-clause', 'isc', 'mpl-2.0', 'postgresql',
  'unlicense', 'zlib',
]);

export function licenseTier(license: string | null | undefined): LicenseTier {
  if (!license) return 'Other';
  const lower = license.toLowerCase();
  if (lower === 'proprietary') return 'Proprietary';
  if (SOURCE_AVAILABLE_TOKENS.some((token) => lower.includes(token))) return 'Other';
  if (COPYLEFT_TOKENS.some((token) => lower.includes(token))) return 'Copyleft';
  if (PERMISSIVE_EXACT.has(lower)) return 'Permissive';
  for (const token of ['bsd', 'apache', 'mit', 'mpl', 'artistic', 'bsl-1.0']) {
    if (lower.includes(token)) return 'Permissive';
  }
  return 'Other';
}

export function isOpenSource(license: string | null | undefined): boolean {
  const tier = licenseTier(license);
  return tier === 'Permissive' || tier === 'Copyleft';
}

/**
 * The licence as schema.org `license`: a single SPDX identifier links to its SPDX page; an
 * expression such as "MIT OR Apache-2.0" has no SPDX page, so it is named instead of linked.
 */
export function licenseSchema(license: string | null | undefined): string | { '@type': 'CreativeWork'; name: string } | undefined {
  if (!license || license === 'Proprietary') return undefined;
  if (/^[A-Za-z0-9.-]+$/.test(license)) return `https://spdx.org/licenses/${license}.html`;
  return { '@type': 'CreativeWork', name: license };
}
