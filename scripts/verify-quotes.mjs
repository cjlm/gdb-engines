#!/usr/bin/env node
/**
 * Refetches every cited page and confirms the stored quote is actually on it.
 *
 * The failure mode this exists for: a research pass returns a plausible URL and a plausible
 * sentence, and neither is real. No amount of reviewing the *values* catches that — the value is
 * usually right, which is what makes the fake citation survive. Checking the quote as a literal
 * substring of the live page is mechanical, needs no model, and rejects the fabrication outright.
 *
 * Writes the verdict back into each source as `verified`:
 *   matched         — the quote is on the live page
 *   matched-archive — the original wouldn't load, but an Internet Archive snapshot carries it
 *   mismatch        — the page loaded and does not contain it; treat the claim as unsourced
 *   unreachable     — the fetch failed and no snapshot has the quote either. Not a verdict on the
 *                     quote; needs a human look.
 *
 * PDFs are extracted with pdftotext (poppler). Without it on PATH they fall back to unreachable
 * rather than failing every quote in a paper.
 *
 * Usage: node scripts/verify-quotes.mjs [slug ...]     (all slugs when none given)
 */
import { readdirSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { parse } from 'smol-toml';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { EVIDENCE_DIR, writeEvidence } from './lib/evidence-file.mjs';

const CONCURRENCY = 5;
const TIMEOUT_MS = 20_000;
/**
 * Below this much extracted text, assume the page didn't really render rather than blaming the
 * quote. Real documentation pages measure in the thousands of characters; a client-rendered shell
 * collapses to a few hundred once its scripts are stripped.
 */
const MIN_PAGE_TEXT = 500;

const USER_AGENT =
  'gdb-engines-evidence-checker/1.0 (+https://gdb-engines.com/about/; verifying cited sources)';

/**
 * Some documentation hosts serve a different page to anything that doesn't look like a browser.
 * Only used as a second attempt, when the honest identifier produced a page the quote wasn't on —
 * the alternative is reporting an accurate citation as a fabrication.
 */
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/126.0.0.0 Safari/537.36';

let pdftotextChecked;
function hasPdftotext() {
  if (pdftotextChecked === undefined) {
    try {
      execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
      pdftotextChecked = true;
    } catch {
      pdftotextChecked = false;
    }
  }
  return pdftotextChecked;
}

/**
 * Papers and vendor manuals are legitimate sources, so extract their text rather than declaring
 * PDFs unverifiable. Line-ending hyphens are rejoined first: a PDF breaking "protocol" across
 * lines would otherwise read as two words and fail an accurate quote.
 */
function pdfText(buffer) {
  const path = join(tmpdir(), `gdb-evidence-${randomUUID()}.pdf`);
  try {
    writeFileSync(path, buffer);
    const raw = execFileSync('pdftotext', ['-q', '-enc', 'UTF-8', path, '-'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    return raw.replace(/-\r?\n/g, '');
  } catch {
    return null;
  } finally {
    try { unlinkSync(path); } catch { /* already gone */ }
  }
}

/** Strips markup, leaving a space where each tag was so adjacent words don't weld together. */
function pageText(html) {
  return html
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
}

/**
 * Reduces text to a bare sequence of lowercase words.
 *
 * Comparing on punctuation was the first attempt and it produced nothing but false accusations:
 * stripping `<code>` tags turns "the SPARQL Protocol; the Graph Store Protocol" into
 * "the sparql protocol ; the graph store protocol", so a quote copied accurately off the page
 * still failed. Dropping punctuation entirely and matching word sequences forgives the markup
 * without forgiving a quote that isn't there — the words themselves still have to appear, in
 * order, contiguously.
 */
function normalize(text) {
  return text
    .replace(/&(?:#(\d+)|#x([\da-f]+));/gi, (_, dec, hex) =>
      String.fromCodePoint(parseInt(dec ?? hex, dec ? 10 : 16)))
    // Named entities become a space: decoding "&reg;" to a glyph is pointless once punctuation
    // is dropped, and mapping it to letters would inject a bogus word mid-quote.
    .replace(/&[a-z]+\d*;/gi, ' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Padded so a word boundary is required at each end — "cat" must not match inside "catalog". */
function contains(haystack, needle) {
  return ` ${haystack} `.includes(` ${needle} `);
}

/**
 * GitHub renders file contents client-side, so a `/blob/` page's HTML doesn't contain the code.
 * Quoting a line of source is legitimate evidence — resolve to the raw file rather than reporting
 * the citation as fabricated.
 */
function resolveUrl(url) {
  return url.replace(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/,
    'https://raw.githubusercontent.com/$1/$2/$3',
  );
}

async function fetchText(rawUrl, userAgent = USER_AGENT) {
  const url = resolveUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': userAgent, accept: 'text/html,text/plain,*/*' },
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const type = res.headers.get('content-type') ?? '';
    if (type.includes('pdf') || new URL(url).pathname.toLowerCase().endsWith('.pdf')) {
      if (!hasPdftotext()) return { ok: false, reason: 'PDF — pdftotext not on PATH' };
      const text = pdfText(Buffer.from(await res.arrayBuffer()));
      if (text === null) return { ok: false, reason: 'PDF — text extraction failed' };
      return { ok: true, text: normalize(text) };
    }
    const body = await res.text();
    return { ok: true, text: normalize(type.includes('html') ? pageText(body) : body) };
  } catch (err) {
    return { ok: false, reason: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Last resort when the original won't load: ask the Internet Archive for its closest snapshot.
 *
 * Vendor documentation goes behind a bot wall or gets restructured, and the citation stops being
 * checkable through no fault of the research. A snapshot that carries the quote is weaker evidence
 * than the live page but far better than an unverifiable link, so it's published as such.
 */
async function findSnapshot(url) {
  try {
    const res = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`, {
      headers: { 'user-agent': USER_AGENT },
    });
    if (!res.ok) return null;
    const closest = (await res.json())?.archived_snapshots?.closest;
    return closest?.url ?? null;
  } catch {
    return null;
  }
}

/** One fetch per URL even when several claims cite the same page. */
const pageCache = new Map();
function loadPage(url, userAgent) {
  const key = `${userAgent ?? USER_AGENT} ${url}`;
  if (!pageCache.has(key)) pageCache.set(key, fetchText(url, userAgent));
  return pageCache.get(key);
}

async function pool(items, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) await worker(queue.shift());
  });
  await Promise.all(runners);
}

const today = new Date().toISOString().slice(0, 10);
const requested = process.argv.slice(2);

if (!existsSync(EVIDENCE_DIR)) {
  console.log(`[verify] ${EVIDENCE_DIR} does not exist yet — nothing to verify.`);
  process.exit(0);
}

const files = readdirSync(EVIDENCE_DIR)
  .filter((f) => f.endsWith('.toml'))
  .filter((f) => requested.length === 0 || requested.includes(f.replace(/\.toml$/, '')));

const tally = { matched: 0, 'matched-archive': 0, mismatch: 0, unreachable: 0 };
const rejected = [];

for (const file of files) {
  const evidence = parse(readFileSync(join(EVIDENCE_DIR, file), 'utf8'));
  const sources = (evidence.claims ?? []).flatMap((c) => (c.sources ?? []).map((s) => ({ claim: c, s })));

  await pool(sources, async ({ claim, s }) => {
    const quote = normalize(s.quote);
    let page = await loadPage(s.url);

    // Retry as a browser before calling a quote fabricated — see BROWSER_USER_AGENT.
    if (!page.ok || page.text.length < MIN_PAGE_TEXT || !contains(page.text, quote)) {
      const retry = await loadPage(s.url, BROWSER_USER_AGENT);
      if (retry.ok && retry.text.length >= MIN_PAGE_TEXT) page = retry;
    }

    const liveUnusable = !page.ok || page.text.length < MIN_PAGE_TEXT;

    if (liveUnusable) {
      const snapshot = await findSnapshot(s.url);
      const archived = snapshot ? await loadPage(snapshot, BROWSER_USER_AGENT) : null;
      if (archived?.ok && archived.text.length >= MIN_PAGE_TEXT && contains(archived.text, quote)) {
        s.verified = 'matched-archive';
        s.archive_url = snapshot;
      } else {
        s.verified = 'unreachable';
        s.note = page.reason;
        delete s.archive_url;
      }
    } else {
      s.verified = contains(page.text, quote) ? 'matched' : 'mismatch';
      delete s.archive_url;
    }
    s.checked = today;
    tally[s.verified] += 1;
    if (s.verified === 'mismatch') {
      rejected.push(`${evidence.slug} · ${claim.field} · ${s.url}`);
    }
    // `note` is scratch for the console line below; it isn't part of the schema.
    delete s.note;
  });

  writeEvidence(evidence);
  const worst = sources.some(({ s }) => s.verified === 'mismatch') ? '✗' : '✓';
  console.log(`[verify] ${worst} ${evidence.slug} (${sources.length} sources)`);
}

if (rejected.length > 0) {
  console.log('\n[verify] quotes not found on the cited page:');
  for (const r of rejected) console.log(`  - ${r}`);
}
console.log(
  `\n[verify] ${tally.matched} matched, ${tally['matched-archive']} matched via archive, ` +
  `${tally.mismatch} mismatched, ${tally.unreachable} unreachable.`,
);
