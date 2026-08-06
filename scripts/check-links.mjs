#!/usr/bin/env node
/**
 * Reports catalogue entries whose outbound links are broken or have quietly moved.
 *
 * Every entry links to a vendor site and often a repository, and those rot faster than anything
 * else here: companies fold, get acquired, or let a domain lapse. A dead link on a public
 * catalogue is a visible defect, and a cross-domain redirect is usually the first sign a product
 * changed hands — `altair.com` now answering as `siemens.com` says more about the vendor field
 * than any amount of re-reading the entry would.
 *
 * Report-only, deliberately. External sites time out for reasons that have nothing to do with this
 * repository, so this must never gate a build. Run it, read it, and act on what it finds.
 *
 * Usage: node scripts/check-links.mjs [--json]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'smol-toml';

const DB_DIR = 'src/content/databases';
const CONCURRENCY = 8;
const TIMEOUT_MS = 20_000;
const ATTEMPTS = 2;

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/126.0.0.0 Safari/537.36';

const asJson = process.argv.includes('--json');

/** Hosts differing only by a `www.` prefix are the same site, not a move. */
function bareHost(url) {
  return new URL(url).hostname.replace(/^www\./, '');
}

async function attempt(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT },
    });
    if (!res.ok) return { state: 'error', detail: `HTTP ${res.status}` };
    if (bareHost(res.url) !== bareHost(url)) {
      return { state: 'moved', detail: `→ ${new URL(res.url).hostname}` };
    }
    return { state: 'ok' };
  } catch (err) {
    return { state: 'error', detail: err.name === 'AbortError' ? 'timeout' : err.message.slice(0, 40) };
  } finally {
    clearTimeout(timer);
  }
}

/** Retried once: a single timeout says more about the network than about the link. */
async function check(url) {
  let last;
  for (let i = 0; i < ATTEMPTS; i += 1) {
    last = await attempt(url);
    if (last.state !== 'error') return last;
  }
  return last;
}

async function pool(items, worker) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) await worker(queue.shift());
  }));
}

const links = [];
for (const file of readdirSync(DB_DIR).filter((f) => f.endsWith('.toml'))) {
  const data = parse(readFileSync(join(DB_DIR, file), 'utf8'));
  for (const field of ['url', 'github_url']) {
    if (data[field]) links.push({ slug: data.slug, field, url: data[field] });
  }
}

const findings = [];
await pool(links, async (link) => {
  const result = await check(link.url);
  if (result.state !== 'ok') findings.push({ ...link, ...result });
});

findings.sort((a, b) => a.slug.localeCompare(b.slug) || a.field.localeCompare(b.field));

if (asJson) {
  console.log(JSON.stringify(findings, null, 1));
} else {
  const broken = findings.filter((f) => f.state === 'error');
  const moved = findings.filter((f) => f.state === 'moved');
  console.log(`[links] checked ${links.length} links across ${new Set(links.map((l) => l.slug)).size} entries`);
  console.log(`[links] ${broken.length} broken, ${moved.length} redirecting off-domain\n`);
  for (const group of [['broken', broken], ['moved off-domain', moved]]) {
    if (group[1].length === 0) continue;
    console.log(`${group[0]}:`);
    for (const f of group[1]) {
      console.log(`  ${f.slug.padEnd(24)} ${f.field.padEnd(11)} ${f.detail.padEnd(24)} ${f.url}`);
    }
    console.log();
  }
  console.log('[links] report only — external sites fail for their own reasons, so this never gates a build.');
}
