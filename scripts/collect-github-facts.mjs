#!/usr/bin/env node
/**
 * Establishes what the GitHub API can settle on its own, so research agents only handle the
 * residue.
 *
 * One field comes out of the API cleanly enough to cite it directly:
 *   license  — /repos/{owner}/{repo}/license returns an SPDX id, and the JSON response is itself a
 *              fetchable, quotable page. Where GitHub can't classify the licence it returns
 *              NOASSERTION (ArangoDB's BUSL-1.1, for instance) — those are reported, not written.
 *
 * `released` and `implementation_language` are deliberately absent. A repo's created_at is not the
 * product release date, and its largest language can be skewed by build tooling or vendored code,
 * so neither is safe to establish mechanically here.
 *
 * Usage: node scripts/collect-github-facts.mjs <slug ...>   (all catalogue entries when none given)
 *        --write   persist confirmed licences to src/content/evidence/
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { readEvidence, writeEvidence } from './lib/evidence-file.mjs';

const DB_DIR = 'src/content/databases';
const API = 'https://api.github.com';
const UA = 'gdb-engines-evidence-collector/1.0 (+https://gdb-engines.com/about/)';

const args = process.argv.slice(2);
const write = args.includes('--write');
const requested = args.filter((a) => !a.startsWith('--'));
const today = new Date().toISOString().slice(0, 10);

/** GitHub's token is optional; without it the unauthenticated limit is 60 requests an hour. */
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
const headers = {
  'user-agent': UA,
  accept: 'application/vnd.github+json',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
};

async function api(path) {
  const res = await fetch(`${API}${path}`, { headers });
  if (res.status === 403 || res.status === 429) throw new Error('rate limited — set GITHUB_TOKEN');
  if (!res.ok) return null;
  return res.json();
}

function repoPath(url) {
  const m = url?.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

const entries = [];
for (const file of readdirSync(DB_DIR).filter((f) => f.endsWith('.toml'))) {
  const data = parse(readFileSync(join(DB_DIR, file), 'utf8'));
  if (requested.length > 0 && !requested.includes(data.slug)) continue;
  entries.push(data);
}

const confirmed = [];
const needsResearch = [];
const disagreements = [];

for (const entry of entries) {
  const repo = repoPath(entry.github_url);
  if (!repo) {
    needsResearch.push(`${entry.slug}: license — no GitHub repo`);
    continue;
  }

  let licence = null;
  try {
    licence = await api(`/repos/${repo}/license`);
  } catch (err) {
    console.error(`[github] ${entry.slug}: ${err.message}`);
    process.exit(1);
  }

  const spdx = licence?.license?.spdx_id;
  if (!spdx || spdx === 'NOASSERTION') {
    needsResearch.push(`${entry.slug}: license — GitHub returns ${spdx ?? 'no licence'}`);
    continue;
  }

  // A disagreement is a finding either way: the catalogue may be wrong, or GitHub may have
  // flattened a dual licence (Oxigraph's "Apache-2.0 OR MIT" comes back as just Apache-2.0).
  if (entry.license !== spdx) {
    disagreements.push(`${entry.slug}: catalogue=${entry.license ?? 'unset'} api=${spdx}`);
    needsResearch.push(`${entry.slug}: license — catalogue and API disagree`);
    continue;
  }

  confirmed.push({ slug: entry.slug, spdx, repo });
}

if (write) {
  for (const { slug, spdx, repo } of confirmed) {
    const existing = readEvidence(slug);
    const claims = (existing?.claims ?? []).filter((c) => c.field !== 'license');
    claims.push({
      field: 'license',
      value: spdx,
      confidence: 'high',
      method: 'api',
      checked: today,
      notes: 'SPDX identifier as classified by GitHub from the repository licence file.',
      sources: [{
        url: `${API}/repos/${repo}/license`,
        title: `GitHub licence API — ${repo}`,
        quote: `"spdx_id": "${spdx}"`,
        verified: 'unchecked',
      }],
    });
    writeEvidence({ slug, claims });
  }
}

console.log(`[github] ${entries.length} entries checked`);
console.log(`[github]   ${confirmed.length} licences confirmed against the API${write ? ' and written' : ''}`);
console.log(`[github]   ${needsResearch.length} need research`);
if (disagreements.length > 0) {
  console.log('\n[github] catalogue disagrees with the API — worth a human:');
  for (const d of disagreements) console.log(`  ${d}`);
}
if (!write) console.log('\n[github] dry run; pass --write to persist.');
