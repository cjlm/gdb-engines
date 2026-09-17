#!/usr/bin/env node
/**
 * Imports a research pass into the catalogue: writes `protocols` onto each database entry and the
 * sources behind it into `src/content/evidence/`.
 *
 * Input is a directory of JSON files, each an array of
 *   { slug, protocols[], confidence, notes, sources: [{ url, title, quote }] }
 * as produced by the research brief. Nothing is trusted on the way in — unknown slugs and
 * off-vocabulary protocol tags are reported and skipped rather than written.
 *
 * The catalogue entry is edited as text, not reparsed and re-emitted, so hand-written formatting
 * and key order survive.
 *
 * Usage: node scripts/import-research.mjs <results-dir>
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { writeEvidence, evidencePath } from './lib/evidence-file.mjs';
import { PROTOCOLS } from '../src/lib/protocols.ts';

const DB_DIR = 'src/content/databases';
const resultsDir = process.argv[2];

if (!resultsDir || !existsSync(resultsDir)) {
  console.error('Usage: node scripts/import-research.mjs <results-dir>');
  process.exit(1);
}

const vocabulary = new Set(PROTOCOLS);
const today = new Date().toISOString().slice(0, 10);

const files = new Map();
for (const file of readdirSync(DB_DIR).filter((f) => f.endsWith('.toml'))) {
  const data = parse(readFileSync(join(DB_DIR, file), 'utf8'));
  files.set(data.slug, file);
}

/** Confidence maps to how the value was established; the brief's wording is about the same thing. */
function methodFor(record) {
  const hosts = (record.sources ?? []).map((s) => {
    try {
      return new URL(s.url).hostname;
    } catch {
      return '';
    }
  });
  if (hosts.some((h) => h.includes('github') || h.includes('gitlab'))) return 'repo';
  if (hosts.length > 0) return 'vendor-docs';
  return 'web';
}

/** An empty array is a finding, not a gap: the engine has no client wire protocol at all. */
function upsertProtocols(file, protocols) {
  const path = join(DB_DIR, file);
  const lines = readFileSync(path, 'utf8').split('\n');
  const existing = lines.findIndex((l) => l.startsWith('protocols = '));

  if (protocols.length === 0) {
    if (existing === -1) return false;
    lines.splice(existing, 1);
    writeFileSync(path, lines.join('\n'));
    return true;
  }

  const rendered = `protocols = [${protocols.map((p) => `"${p}"`).join(', ')}]`;
  if (existing !== -1) {
    if (lines[existing] === rendered) return false;
    lines[existing] = rendered;
  } else {
    // Sits next to query_languages: the two are read together, one being the transport for the
    // other. Falls back to `type` for the handful of entries with no query language.
    let anchor = lines.findIndex((l) => l.startsWith('query_languages = '));
    if (anchor === -1) anchor = lines.findIndex((l) => l.startsWith('type = '));
    if (anchor === -1) {
      throw new Error(`${path}: no query_languages or type line to anchor protocols to.`);
    }
    lines.splice(anchor + 1, 0, rendered);
  }

  writeFileSync(path, lines.join('\n'));
  return true;
}

const seen = new Set();
const skipped = [];
let written = 0;
let unchanged = 0;
let removed = 0;

for (const file of readdirSync(resultsDir).filter((f) => f.endsWith('.json')).sort()) {
  let records;
  try {
    records = JSON.parse(readFileSync(join(resultsDir, file), 'utf8'));
  } catch (err) {
    skipped.push(`${file}: unreadable JSON — ${err.message}`);
    continue;
  }

  for (const record of records) {
    const { slug, protocols, confidence } = record;

    if (!files.has(slug)) {
      skipped.push(`${file}: unknown slug "${slug}".`);
      continue;
    }
    if (seen.has(slug)) {
      skipped.push(`${file}: duplicate result for "${slug}" — keeping the first.`);
      continue;
    }
    if (!Array.isArray(protocols)) {
      skipped.push(`${slug}: no protocols field returned.`);
      continue;
    }
    const offVocabulary = protocols.filter((p) => !vocabulary.has(p));
    if (offVocabulary.length > 0) {
      skipped.push(`${slug}: off-vocabulary protocol(s) ${offVocabulary.join(', ')}.`);
      continue;
    }
    if (!['high', 'medium', 'low'].includes(confidence)) {
      skipped.push(`${slug}: bad confidence "${confidence}".`);
      continue;
    }

    seen.add(slug);
    if (upsertProtocols(files.get(slug), protocols)) written += 1;
    else unchanged += 1;

    // Nothing left to source once the field is gone; a stale evidence file would fail the
    // build gate by claiming a field the entry no longer sets.
    if (protocols.length === 0) {
      const stale = evidencePath(slug);
      if (existsSync(stale)) { unlinkSync(stale); removed += 1; }
      continue;
    }

    writeEvidence({
      slug,
      claims: [{
        field: 'protocols',
        value: protocols,
        confidence,
        method: methodFor(record),
        checked: today,
        notes: record.notes || undefined,
        sources: (record.sources ?? []).map((s) => ({
          url: s.url,
          title: s.title,
          quote: s.quote,
          verified: 'unchecked',
        })),
      }],
    });
  }
}

const missing = [...files.keys()].filter((s) => !seen.has(s));

for (const s of skipped) console.warn(`[import] skipped: ${s}`);
// A partial pass (re-researching a handful of engines) legitimately covers only part of the
// catalogue, so list the gaps only when they're few enough to act on.
if (missing.length > 0) {
  console.warn(
    missing.length <= 20
      ? `[import] no result for ${missing.length}: ${missing.join(', ')}`
      : `[import] no result for ${missing.length} entries (partial pass — untouched).`,
  );
}
console.log(
  `[import] ${seen.size} entries imported (${written} changed, ${unchanged} already current` +
  `${removed > 0 ? `, ${removed} left with no wire protocol` : ''}).`,
);
console.log('[import] next: node scripts/verify-quotes.mjs && node scripts/check-evidence.mjs');
